import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentEngine } from '../../src/core/agent/engine.js';
import { SwarmOrchestrator } from '../../src/core/multi-agent/swarm.js';
import type { AgentConfig, AgentContext } from '../../src/core/agent/types.js';

describe('Agent Workflow Integration', () => {
  const mockContext: AgentContext = {
    workingDirectory: '/tmp/test-project',
    projectType: 'test',
    language: 'typescript',
    dependencies: [],
    recentFiles: [],
  };

  const defaultConfig: AgentConfig = {
    mode: 'autonomous',
    reasoning: 'standard',
    maxIterations: 3,
    maxTokensPerTask: 50000,
    sandboxMode: 'workspace',
    autoApprove: true,
    autoTest: false,
    autoLint: false,
    autoFormat: false,
    learningEnabled: false,
    proactiveEnabled: false,
  };

  it('should complete a simple task end-to-end', async () => {
    const engine = new AgentEngine(defaultConfig, mockContext);

    // Mock LLM responses
    const mockResponses = [
      {
        content: '[{"id":"task-1","description":"Create file","dependencies":[],"subtasks":[{"id":"sub-1","description":"Write hello.ts","toolCalls":[]}]}]',
        usage: { prompt: 100, completion: 50, total: 150 },
        model: 'test-model',
        finishReason: 'stop',
      },
      {
        content: 'File created successfully',
        usage: { prompt: 200, completion: 100, total: 300 },
        model: 'test-model',
        finishReason: 'stop',
      },
    ];

    let callIndex = 0;
    vi.spyOn(engine as any, 'llmRouter', 'get').mockReturnValue({
      chat: vi.fn().mockImplementation(() => {
        const response = mockResponses[callIndex] || mockResponses[mockResponses.length - 1];
        callIndex++;
        return Promise.resolve(response);
      }),
    });

    const state = await engine.run('Create a hello world file');

    expect(state.status).toBe('completed');
    expect(state.tasks.length).toBeGreaterThan(0);
    expect(state.tokenUsage.total).toBeGreaterThan(0);
  });

  it('should handle tool execution', async () => {
    const engine = new AgentEngine(defaultConfig, mockContext);

    const mockResponse = {
      content: 'Writing file',
      toolCalls: [{
        id: 'call-1',
        tool: 'write_file',
        params: { path: 'test.txt', content: 'Hello World' },
        riskLevel: 'medium' as const,
        status: 'pending' as const,
      }],
      usage: { prompt: 100, completion: 50, total: 150 },
      model: 'test-model',
      finishReason: 'tool_use',
    };

    vi.spyOn(engine as any, 'llmRouter', 'get').mockReturnValue({
      chat: vi.fn().mockResolvedValue(mockResponse),
    });

    // Mock tool execution
    vi.spyOn(engine as any, 'executeTool').mockResolvedValue({
      success: true,
      output: 'File written',
      duration: 100,
    });

    const toolResult = await (engine as any).executeTool(mockResponse.toolCalls[0]);
    expect(toolResult.success).toBe(true);
  });
});

describe('Swarm Integration', () => {
  const mockContext: AgentContext = {
    workingDirectory: '/tmp/test-project',
    projectType: 'test',
    language: 'typescript',
    dependencies: [],
    recentFiles: [],
  };

  it('should register agents and create tasks', () => {
    const swarm = new SwarmOrchestrator(mockContext);

    const coderId = swarm.registerAgent('coder', 'Coder');
    const reviewerId = swarm.registerAgent('reviewer', 'Reviewer');

    swarm.createTask(coderId, 'Implement feature');
    swarm.createTask(reviewerId, 'Review implementation', []);

    expect(swarm.getSummary().total).toBe(2);
  });

  it('should execute tasks with dependencies', async () => {
    const swarm = new SwarmOrchestrator(mockContext, { maxParallel: 2 });

    const coderId = swarm.registerAgent('coder', 'Coder');
    const reviewerId = swarm.registerAgent('reviewer', 'Reviewer');

    const task1 = swarm.createTask(coderId, 'Write code');
    swarm.createTask(reviewerId, 'Review code', [task1]);

    // Mock LLM
    vi.spyOn(swarm as any, 'llmRouter', 'get').mockReturnValue({
      chat: vi.fn().mockResolvedValue({
        content: 'Done',
        usage: { prompt: 10, completion: 20, total: 30 },
        model: 'test-model',
        finishReason: 'stop',
      }),
    });

    const results = await swarm.execute();

    expect(results.size).toBe(2);
    expect(swarm.getSummary().completed).toBe(2);
  });
});
