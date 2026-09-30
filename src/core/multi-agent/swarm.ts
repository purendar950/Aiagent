import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { DAGScheduler } from './dag-scheduler.js';
import type { AgentDefinition, AgentRole, AgentTask, AgentMessage, BlackboardEntry, SwarmConfig } from './types.js';
import { LLMRouter } from '../llm/router.js';
import { ToolRegistry } from '../tools/registry.js';
import type { AgentContext } from '../agent/types.js';

export class SwarmOrchestrator extends EventEmitter {
  private scheduler: DAGScheduler;
  private agents: Map<string, AgentDefinition> = new Map();
  private blackboard: Map<string, BlackboardEntry> = new Map();
  private messages: AgentMessage[] = [];
  private llmRouter: LLMRouter;
  private toolRegistry: ToolRegistry;
  private context: AgentContext;
  private config: SwarmConfig;

  constructor(context: AgentContext, config: Partial<SwarmConfig> = {}) {
    super();
    this.context = context;
    this.config = {
      maxParallel: 4,
      timeout: 300000,
      retryCount: 2,
      enableBlackboard: true,
      enableMessaging: true,
      ...config,
    };
    this.scheduler = new DAGScheduler(this.config);
    this.llmRouter = new LLMRouter();
    this.toolRegistry = new ToolRegistry();
  }

  /**
   * Register an agent with the swarm
   */
  registerAgent(role: AgentRole, name: string, customPrompt?: string): string {
    const id = uuid();
    const agent = this.createAgentDefinition(id, role, name, customPrompt);
    this.agents.set(id, agent);
    return id;
  }

  /**
   * Create a task and add it to the DAG
   */
  createTask(agentId: string, description: string, dependencies: string[] = []): string {
    return this.scheduler.addTask(description, agentId, dependencies);
  }

  /**
   * Execute the entire swarm
   */
  async execute(): Promise<Map<string, AgentTask>> {
    this.emit('swarm_started', { agents: this.agents.size, tasks: this.scheduler.getTasks().length });

    while (!this.scheduler.isComplete()) {
      const readyTasks = this.scheduler.getReadyTasks();

      // Limit parallel execution
      const availableSlots = this.config.maxParallel - this.scheduler.getSummary().running;
      const tasksToRun = readyTasks.slice(0, availableSlots);

      if (tasksToRun.length === 0) {
        // Wait a bit before checking again
        await this.sleep(100);
        continue;
      }

      // Execute tasks in parallel
      await Promise.all(tasksToRun.map(task => this.executeTask(task)));
    }

    const summary = this.scheduler.getSummary();
    this.emit('swarm_completed', summary);

    return new Map(this.scheduler.getTasks().map(t => [t.id, t]));
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: AgentTask): Promise<void> {
    this.scheduler.markRunning(task.id);
    this.emit('task_started', { taskId: task.id, agentId: task.agentId });

    const agent = this.agents.get(task.agentId);
    if (!agent) {
      this.scheduler.markFailed(task.id, `Agent not found: ${task.agentId}`);
      return;
    }

    try {
      // Build context from blackboard
      const blackboardContext = this.getBlackboardContext();

      // Build messages
      const messages = [
        {
          id: uuid(),
          role: 'system' as const,
          content: agent.systemPrompt + (blackboardContext ? `\n\nBlackboard:\n${blackboardContext}` : ''),
          timestamp: Date.now(),
        },
        {
          id: uuid(),
          role: 'user' as const,
          content: task.description,
          timestamp: Date.now(),
        },
      ];

      // Get LLM response
      const response = await this.llmRouter.chat({
        messages,
        model: this.selectModelForRole(agent.role),
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        tools: this.getToolsForAgent(agent),
      });

      // Execute any tool calls
      let result = response.content;
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          const tool = this.toolRegistry.get(toolCall.tool);
          if (tool) {
            const toolResult = await tool.execute(toolCall.params, this.context);
            result += `\n\n[${toolCall.tool}]: ${toolResult.output}`;
          }
        }
      }

      // Write to blackboard
      if (this.config.enableBlackboard) {
        this.writeToBlackboard(task.id, result, agent.name);
      }

      this.scheduler.markCompleted(task.id, result);
      this.emit('task_completed', { taskId: task.id, result });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.scheduler.markFailed(task.id, errorMsg);
      this.emit('task_failed', { taskId: task.id, error: errorMsg });
    }
  }

  /**
   * Send a message from one agent to another
   */
  sendMessage(fromAgent: string, toAgent: string, content: string): void {
    if (!this.config.enableMessaging) return;

    const message: AgentMessage = {
      id: uuid(),
      fromAgent,
      toAgent,
      content,
      timestamp: Date.now(),
    };

    this.messages.push(message);
    this.emit('agent_message', message);
  }

  /**
   * Write to the shared blackboard
   */
  writeToBlackboard(key: string, value: string, author: string): void {
    if (!this.config.enableBlackboard) return;

    this.blackboard.set(key, {
      key,
      value,
      author,
      timestamp: Date.now(),
    });

    this.emit('blackboard_update', { key, value, author });
  }

  /**
   * Read from the blackboard
   */
  readBlackboard(key: string): string | undefined {
    return this.blackboard.get(key)?.value;
  }

  /**
   * Get all blackboard entries as context string
   */
  getBlackboardContext(): string {
    if (this.blackboard.size === 0) return '';
    return Array.from(this.blackboard.values())
      .map(e => `[${e.author}] ${e.key}: ${e.value}`)
      .join('\n');
  }

  /**
   * Get execution summary
   */
  getSummary() {
    return this.scheduler.getSummary();
  }

  /**
   * Get all messages
   */
  getMessages(): AgentMessage[] {
    return [...this.messages];
  }

  /**
   * Get all blackboard entries
   */
  getBlackboard(): BlackboardEntry[] {
    return Array.from(this.blackboard.values());
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  private createAgentDefinition(id: string, role: AgentRole, name: string, customPrompt?: string): AgentDefinition {
    const prompts: Record<AgentRole, string> = {
      planner: 'You are the Planner agent. You decompose high-level tasks into actionable steps. You design system architecture and create implementation plans.',
      coder: 'You are the Coder agent. You write clean, well-tested code. You follow existing patterns and conventions. You make focused, minimal changes.',
      reviewer: 'You are the Reviewer agent. You review code for quality, security, and maintainability. You catch bugs and suggest improvements.',
      tester: 'You are the Tester agent. You write comprehensive tests. You run test suites and report results. You ensure code quality.',
      researcher: 'You are the Researcher agent. You find documentation, examples, and solutions. You search the web and codebase for relevant information.',
      documenter: 'You are the Documenter agent. You generate clear, comprehensive documentation. You write READMEs, API docs, and inline comments.',
      devops: 'You are the DevOps agent. You handle deployment, CI/CD, infrastructure, and monitoring. You ensure smooth operations.',
    };

    const toolsByRole: Record<AgentRole, string[]> = {
      planner: ['read_file', 'list_dir', 'search_files', 'find_symbol', 'get_references'],
      coder: ['read_file', 'write_file', 'edit_file', 'list_dir', 'search_files', 'execute_command', 'git_status', 'git_diff', 'git_commit', 'find_symbol', 'get_references', 'lint', 'type_check'],
      reviewer: ['read_file', 'search_files', 'git_diff', 'lint', 'type_check', 'security_scan'],
      tester: ['read_file', 'write_file', 'execute_command', 'run_tests', 'generate_tests'],
      researcher: ['read_file', 'search_files', 'fetch_url', 'find_symbol', 'get_references'],
      documenter: ['read_file', 'write_file', 'search_files', 'git_log'],
      devops: ['read_file', 'write_file', 'execute_command', 'git_status', 'git_diff', 'git_commit', 'git_branch'],
    };

    return {
      id,
      role,
      name,
      systemPrompt: customPrompt || prompts[role],
      tools: toolsByRole[role],
      maxTokens: 4096,
      temperature: role === 'coder' ? 0.2 : role === 'reviewer' ? 0.4 : 0.3,
    };
  }

  private selectModelForRole(role: AgentRole): string {
    const modelMap: Record<AgentRole, string> = {
      planner: 'claude-3-5-sonnet',
      coder: 'deepseek-coder',
      reviewer: 'claude-3-5-sonnet',
      tester: 'gpt-4o-mini',
      researcher: 'gpt-4o-mini',
      documenter: 'gpt-4o-mini',
      devops: 'gpt-4o-mini',
    };
    return modelMap[role];
  }

  private getToolsForAgent(agent: AgentDefinition): Record<string, unknown>[] {
    const allTools = this.toolRegistry.getToolSchemas();
    return allTools.filter(t => {
      const toolName = (t as any).function.name;
      return agent.tools.includes(toolName);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
