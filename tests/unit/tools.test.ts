import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/core/tools/registry.js';
import type { AgentContext } from '../../src/core/agent/types.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  const mockContext: AgentContext = {
    workingDirectory: '/tmp/test-project',
    projectType: 'test',
    language: 'typescript',
    dependencies: [],
    recentFiles: [],
  };

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should register all default tools', () => {
    const tools = registry.getToolNames();
    expect(tools).toContain('read_file');
    expect(tools).toContain('write_file');
    expect(tools).toContain('edit_file');
    expect(tools).toContain('execute_command');
    expect(tools).toContain('git_status');
    expect(tools).toContain('run_tests');
    expect(tools).toContain('lint');
    expect(tools).toContain('security_scan');
  });

  it('should have 21 tools registered', () => {
    const tools = registry.getToolNames();
    expect(tools.length).toBe(21);
  });

  it('should get tool by name', () => {
    const tool = registry.get('read_file');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('read_file');
  });

  it('should return undefined for unknown tool', () => {
    const tool = registry.get('unknown_tool');
    expect(tool).toBeUndefined();
  });

  it('should get tools by risk level', () => {
    const lowRisk = registry.getToolsByRisk('low');
    expect(lowRisk.length).toBeGreaterThan(0);
    expect(lowRisk.every(t => t.riskLevel === 'low')).toBe(true);
  });

  it('should generate tool schemas', () => {
    const schemas = registry.getToolSchemas();
    expect(schemas.length).toBe(21);
    expect(schemas[0]).toHaveProperty('type', 'function');
    expect(schemas[0]).toHaveProperty('function');
  });
});

describe('ReadFileTool', () => {
  it('should have correct metadata', () => {
    const registry = new ToolRegistry();
    const tool = registry.get('read_file');
    expect(tool?.name).toBe('read_file');
    expect(tool?.riskLevel).toBe('low');
    expect(tool?.description).toContain('Read');
  });
});

describe('WriteFileTool', () => {
  it('should have correct metadata', () => {
    const registry = new ToolRegistry();
    const tool = registry.get('write_file');
    expect(tool?.name).toBe('write_file');
    expect(tool?.riskLevel).toBe('medium');
  });
});

describe('ExecuteCommandTool', () => {
  it('should have high risk level', () => {
    const registry = new ToolRegistry();
    const tool = registry.get('execute_command');
    expect(tool?.riskLevel).toBe('high');
  });
});
