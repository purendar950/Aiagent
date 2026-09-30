import { v4 as uuid } from 'uuid';
import type {
  AgentConfig,
  AgentState,
  AgentContext,
  AgentEvent,
  Message,
  Task,
  SubTask,
  ToolCall,
  ToolResult,
  LLMResponse,
  StreamEvent,
} from './types.js';
import { LLMRouter } from '../llm/router.js';
import { ToolRegistry } from '../tools/registry.js';
import { PermissionSystem } from '../permissions/system.js';
import { MemorySystem } from '../memory/system.js';
import { EventEmitter } from 'events';

export class AgentEngine extends EventEmitter {
  private config: AgentConfig;
  private state: AgentState;
  private context: AgentContext;
  private llmRouter: LLMRouter;
  private toolRegistry: ToolRegistry;
  private permissionSystem: PermissionSystem;
  private memorySystem: MemorySystem;
  private abortController: AbortController | null = null;

  constructor(config: AgentConfig, context: AgentContext) {
    super();
    this.config = config;
    this.context = context;
    this.llmRouter = new LLMRouter();
    this.toolRegistry = new ToolRegistry();
    this.permissionSystem = new PermissionSystem(config.sandboxMode);
    this.memorySystem = new MemorySystem(context.workingDirectory);
    this.state = this.createInitialState();
  }

  private createInitialState(): AgentState {
    return {
      messages: [],
      tasks: [],
      iteration: 0,
      tokenUsage: { prompt: 0, completion: 0, total: 0 },
      cost: 0,
      status: 'idle',
    };
  }

  /**
   * Main entry point — run a task from start to finish
   */
  async run(taskDescription: string): Promise<AgentState> {
    this.abortController = new AbortController();
    this.state.status = 'thinking';
    this.emit('status_change', { status: 'thinking' });

    try {
      // Phase 1: Plan
      const tasks = await this.plan(taskDescription);
      this.state.tasks = tasks;
      this.emit('task_started', { tasks });

      // Phase 2: Execute
      for (const task of tasks) {
        if (this.abortController.signal.aborted) break;
        await this.executeTask(task);
      }

      // Phase 3: Verify
      if (this.config.autoTest) {
        await this.verify();
      }

      // Phase 4: Reflect
      await this.reflect();

      this.state.status = 'completed';
      this.emit('status_change', { status: 'completed' });
    } catch (error) {
      this.state.status = 'failed';
      this.emit('error', { error });
      throw error;
    }

    return this.state;
  }

  /**
   * Phase 1: Decompose task into subtasks
   */
  private async plan(description: string): Promise<Task[]> {
    this.emit('thinking', { phase: 'planning', description });

    const systemPrompt = this.buildSystemPrompt();
    const planningPrompt = `Break down the following task into actionable subtasks. Return JSON array.

Task: ${description}

Context:
- Working directory: ${this.context.workingDirectory}
- Language: ${this.context.language}
- Framework: ${this.context.framework || 'none'}
- Dependencies: ${this.context.dependencies.join(', ')}

Return format:
[
  {
    "id": "task-1",
    "description": "...",
    "dependencies": [],
    "subtasks": [
      { "id": "sub-1", "description": "...", "toolCalls": [] }
    ]
  }
]`;

    const response = await this.llmRouter.chat({
      messages: [
        { id: uuid(), role: 'system', content: systemPrompt, timestamp: Date.now() },
        { id: uuid(), role: 'user', content: planningPrompt, timestamp: Date.now() },
      ],
      model: 'claude-3-5-sonnet',
      temperature: 0.2,
      maxTokens: 4096,
    });

    const tasks = this.parsePlanResponse(response.content);
    return tasks;
  }

  /**
   * Phase 2: Execute a single task
   */
  private async executeTask(task: Task): Promise<void> {
    task.status = 'in_progress';
    this.emit('task_started', { task });

    for (const subtask of task.subtasks) {
      if (this.abortController?.signal.aborted) break;

      // Check dependencies
      const unresolvedDeps = subtask.id === task.subtasks[0]?.id
        ? task.dependencies.filter(dep => !this.state.tasks.find(t => t.id === dep)?.status.includes('completed'))
        : [];

      if (unresolvedDeps.length > 0) {
        subtask.status = 'blocked';
        continue;
      }

      await this.executeSubtask(subtask, task);
    }

    task.status = 'completed';
    this.emit('task_completed', { task });
  }

  /**
   * Execute a single subtask with tool calls
   */
  private async executeSubtask(subtask: SubTask, parentTask: Task): Promise<void> {
    subtask.status = 'in_progress';
    this.emit('thinking', { phase: 'executing', subtask: subtask.description });

    const messages: Message[] = [
      {
        id: uuid(),
        role: 'system',
        content: this.buildSystemPrompt(),
        timestamp: Date.now(),
      },
      {
        id: uuid(),
        role: 'user',
        content: `Execute this subtask: ${subtask.description}

Context:
- Task: ${parentTask.description}
- Working directory: ${this.context.workingDirectory}
- Language: ${this.context.language}

Use available tools to complete this subtask. Make focused, minimal changes.`,
        timestamp: Date.now(),
      },
    ];

    let iteration = 0;
    const maxIterations = this.config.maxIterations;

    while (iteration < maxIterations) {
      if (this.abortController?.signal.aborted) break;

      // Get LLM response
      const response = await this.llmRouter.chat({
        messages,
        model: this.selectModelForTask(subtask),
        temperature: 0.3,
        maxTokens: 4096,
        tools: this.toolRegistry.getToolSchemas(),
      });

      // Update token usage
      this.state.tokenUsage.prompt += response.usage.prompt;
      this.state.tokenUsage.completion += response.usage.completion;
      this.state.tokenUsage.total += response.usage.total;

      // Add assistant message
      const assistantMessage: Message = {
        id: uuid(),
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
        timestamp: Date.now(),
      };
      messages.push(assistantMessage);
      this.state.messages.push(assistantMessage);
      this.emit('message', { message: assistantMessage });

      // If no tool calls, subtask is complete
      if (!response.toolCalls || response.toolCalls.length === 0) {
        subtask.status = 'completed';
        subtask.result = response.content;
        break;
      }

      // Execute tool calls
      for (const toolCall of response.toolCalls) {
        if (this.abortController?.signal.aborted) break;

        // Check permissions
        const permission = await this.permissionSystem.check(toolCall, this.context);
        if (!permission.allowed) {
          toolCall.status = 'denied';
          const result: ToolResult = {
            success: false,
            output: '',
            error: `Permission denied: ${permission.reason}`,
            duration: 0,
          };
          toolCall.result = result;
          subtask.toolCalls.push(toolCall);
          continue;
        }

        // Execute tool
        toolCall.status = 'executing';
        this.emit('tool_call', { toolCall });

        const result = await this.executeTool(toolCall);
        toolCall.result = result;
        toolCall.status = result.success ? 'completed' : 'failed';
        subtask.toolCalls.push(toolCall);

        this.emit('tool_result', { toolCall, result });

        // Add tool result to messages
        const toolMessage: Message = {
          id: uuid(),
          role: 'tool',
          content: result.output,
          timestamp: Date.now(),
          metadata: { toolCallId: toolCall.id, tool: toolCall.tool },
        };
        messages.push(toolMessage);
        this.state.messages.push(toolMessage);
      }

      iteration++;
    }

    if (iteration >= maxIterations) {
      subtask.status = 'failed';
      subtask.error = 'Max iterations reached';
    }
  }

  /**
   * Phase 3: Verify — run tests, lint, type check
   */
  private async verify(): Promise<void> {
    this.emit('thinking', { phase: 'verifying' });

    const verifyTasks: SubTask[] = [];

    if (this.config.autoTest) {
      verifyTasks.push({
        id: uuid(),
        description: 'Run tests',
        status: 'pending',
        toolCalls: [],
      });
    }

    if (this.config.autoLint) {
      verifyTasks.push({
        id: uuid(),
        description: 'Run linter',
        status: 'pending',
        toolCalls: [],
      });
    }

    for (const task of verifyTasks) {
      await this.executeSubtask(task, {
        id: uuid(),
        description: 'Verification',
        status: 'in_progress',
        dependencies: [],
        subtasks: [task],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  /**
   * Phase 4: Reflect — evaluate and learn
   */
  private async reflect(): Promise<void> {
    this.emit('thinking', { phase: 'reflecting' });

    if (!this.config.learningEnabled) return;

    const reflectionPrompt = `Review the completed tasks and identify:
1. What went well
2. What could be improved
3. Any patterns worth remembering
4. Any issues that should be flagged

Tasks completed:
${this.state.tasks.map(t => `- ${t.description}: ${t.status}`).join('\n')}

Tool calls made:
${this.state.tasks.flatMap(t => t.subtasks.flatMap(s => s.toolCalls.map(tc => `- ${tc.tool}: ${tc.status}`))).join('\n')}`;

    const response = await this.llmRouter.chat({
      messages: [
        { id: uuid(), role: 'system', content: this.buildSystemPrompt(), timestamp: Date.now() },
        { id: uuid(), role: 'user', content: reflectionPrompt, timestamp: Date.now() },
      ],
      model: 'claude-3-5-sonnet',
      temperature: 0.5,
      maxTokens: 2048,
    });

    // Store reflection in memory
    await this.memorySystem.storeReflection({
      taskId: this.state.tasks[0]?.id || 'unknown',
      reflection: response.content,
      timestamp: Date.now(),
    });
  }

  /**
   * Execute a single tool call
   */
  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.toolRegistry.get(toolCall.tool);

    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Unknown tool: ${toolCall.tool}`,
        duration: Date.now() - startTime,
      };
    }

    try {
      const result = await tool.execute(toolCall.params, this.context);
      return {
        success: true,
        output: result.output,
        duration: Date.now() - startTime,
        metadata: result.metadata,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Select the best model for a given task
   */
  private selectModelForTask(subtask: SubTask): string {
    const desc = subtask.description.toLowerCase();

    if (desc.includes('test') || desc.includes('lint') || desc.includes('format')) {
      return 'gpt-4o-mini'; // Cheap model for simple tasks
    }
    if (desc.includes('architect') || desc.includes('design') || desc.includes('refactor')) {
      return 'claude-3-5-sonnet'; // Powerful model for complex reasoning
    }
    if (desc.includes('boilerplate') || desc.includes('scaffold') || desc.includes('template')) {
      return 'deepseek-coder'; // Fast model for boilerplate
    }
    return 'claude-3-5-sonnet'; // Default
  }

  /**
   * Build the system prompt
   */
  private buildSystemPrompt(): string {
    return `You are PerfectAgent — an autonomous AI coding agent.

Your capabilities:
- Read, write, and edit files
- Execute shell commands
- Run tests, linters, and type checkers
- Search and navigate codebases
- Spawn sub-agents for parallel tasks
- Learn from past interactions

Your working directory: ${this.context.workingDirectory}
Language: ${this.context.language}
Framework: ${this.context.framework || 'none'}

Guidelines:
1. Make focused, minimal changes — don't refactor what isn't asked
2. Always run tests after making changes
3. Follow existing code style and conventions
4. If you encounter an error, diagnose and fix it before moving on
5. Explain what you're doing and why
6. If a task is ambiguous, make a reasonable assumption and note it

Available tools: ${this.toolRegistry.getToolNames().join(', ')}`;
  }

  /**
   * Parse the planning response into tasks
   */
  private parsePlanResponse(content: string): Task[] {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const tasks = JSON.parse(jsonMatch[0]);
      return tasks.map((t: any) => ({
        ...t,
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        subtasks: t.subtasks.map((s: any) => ({
          ...s,
          status: 'pending' as const,
          toolCalls: [],
        })),
      }));
    } catch {
      // Fallback: create a single task
      return [
        {
          id: uuid(),
          description: content,
          status: 'pending',
          dependencies: [],
          subtasks: [
            {
              id: uuid(),
              description: content,
              status: 'pending',
              toolCalls: [],
            },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
    }
  }

  /**
   * Abort the current run
   */
  abort(): void {
    this.abortController?.abort();
    this.state.status = 'idle';
  }

  /**
   * Get current state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get events as async iterator
   */
  async *events(): AsyncGenerator<AgentEvent> {
    // Implementation for SSE streaming
  }
}
