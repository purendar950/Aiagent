import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentEngine } from '../../src/core/agent/engine.js';
import type { AgentConfig, AgentContext } from '../../src/core/agent/types.js';

describe('AgentEngine', () => {
  let engine: AgentEngine;
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
    maxIterations: 5,
    maxTokensPerTask: 100000,
    sandboxMode: 'workspace',
    autoApprove: true,
    autoTest: false,
    autoLint: false,
    autoFormat: false,
    learningEnabled: false,
    proactiveEnabled: false,
  };

  beforeEach(() => {
    engine = new AgentEngine(defaultConfig, mockContext);
  });

  it('should create initial state', () => {
    const state = engine.getState();
    expect(state.status).toBe('idle');
    expect(state.messages.length).toBe(0);
    expect(state.tasks.length).toBe(0);
    expect(state.tokenUsage.total).toBe(0);
  });

  it('should emit status change events', async () => {
    const statuses: string[] = [];
    engine.on('status_change', ({ status }) => statuses.push(status));

    // Mock the LLM router to avoid actual API calls
    vi.spyOn(engine as any, 'llmRouter', 'get').mockReturnValue({
      chat: vi.fn().mockResolvedValue({
        content: 'Test response',
        usage: { prompt: 10, completion: 20, total: 30 },
        model: 'test-model',
        finishReason: 'stop',
      }),
    });

    try {
      await engine.run('Test task');
    } catch {
      // Expected to fail due to mocking
    }

    expect(statuses).toContain('thinking');
  });

  it('should abort running tasks', () => {
    engine.abort();
    const state = engine.getState();
    expect(state.status).toBe('idle');
  });

  it('should track token usage', () => {
    const state = engine.getState();
    expect(state.tokenUsage).toEqual({ prompt: 0, completion: 0, total: 0 });
  });
});
