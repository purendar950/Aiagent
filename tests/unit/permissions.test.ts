import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionSystem } from '../../src/core/permissions/system.js';
import type { ToolCall, AgentContext } from '../../src/core/agent/types.js';

describe('PermissionSystem', () => {
  let system: PermissionSystem;
  const mockContext: AgentContext = {
    workingDirectory: '/tmp/test-project',
    projectType: 'test',
    language: 'typescript',
    dependencies: [],
    recentFiles: [],
  };

  const createToolCall = (tool: string, params: Record<string, unknown> = {}): ToolCall => ({
    id: 'test-id',
    tool,
    params,
    riskLevel: 'low',
    status: 'pending',
  });

  beforeEach(() => {
    system = new PermissionSystem('workspace');
  });

  it('should allow low-risk tools by default', async () => {
    const result = await system.check(createToolCall('read_file', { path: 'test.ts' }), mockContext);
    expect(result.allowed).toBe(true);
  });

  it('should allow search_files by default', async () => {
    const result = await system.check(createToolCall('search_files', { pattern: '*.ts' }), mockContext);
    expect(result.allowed).toBe(true);
  });

  it('should require approval for execute_command', async () => {
    const result = await system.check(createToolCall('execute_command', { command: 'ls' }), mockContext);
    expect(result.requiresApproval).toBe(true);
  });

  it('should require approval for git_commit', async () => {
    const result = await system.check(createToolCall('git_commit', { message: 'test' }), mockContext);
    expect(result.requiresApproval).toBe(true);
  });

  it('should deny write_file in strict mode', async () => {
    const strictSystem = new PermissionSystem('strict');
    const result = await strictSystem.check(createToolCall('write_file', { path: 'test.ts', content: 'test' }), mockContext);
    expect(result.allowed).toBe(false);
  });

  it('should allow tools in allow list', async () => {
    system.addToAllowList('write_file');
    const result = await system.check(createToolCall('write_file', { path: 'test.ts', content: 'test' }), mockContext);
    expect(result.allowed).toBe(true);
  });

  it('should deny tools in deny list', async () => {
    system.addToDenyList('execute_command');
    const result = await system.check(createToolCall('execute_command', { command: 'rm -rf /' }), mockContext);
    expect(result.allowed).toBe(false);
  });

  it('should log all checks to audit log', async () => {
    await system.check(createToolCall('read_file', { path: 'test.ts' }), mockContext);
    await system.check(createToolCall('execute_command', { command: 'ls' }), mockContext);

    const log = system.getAuditLog();
    expect(log.length).toBe(2);
  });

  it('should block paths outside workspace in workspace mode', async () => {
    const result = await system.check(createToolCall('write_file', { path: '../outside.ts', content: 'test' }), mockContext);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('outside workspace');
  });
});
