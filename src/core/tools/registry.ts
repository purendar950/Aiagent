import type { AgentContext, ToolCall, ToolResult, ToolRiskLevel } from '../agent/types.js';
import { ReadFileTool } from './tools/read-file.js';
import { WriteFileTool } from './tools/write-file.js';
import { EditFileTool } from './tools/edit-file.js';
import { ListDirTool } from './tools/list-dir.js';
import { SearchFilesTool } from './tools/search-files.js';
import { ExecuteCommandTool } from './tools/execute-command.js';
import { GitStatusTool } from './tools/git-status.js';
import { GitDiffTool } from './tools/git-diff.js';
import { GitCommitTool } from './tools/git-commit.js';
import { GitBranchTool } from './tools/git-branch.js';
import { GitLogTool } from './tools/git-log.js';
import { RunTestsTool } from './tools/run-tests.js';
import { LintTool } from './tools/lint.js';
import { TypeCheckTool } from './tools/type-check.js';
import { FetchUrlTool } from './tools/fetch-url.js';
import { SpawnAgentTool } from './tools/spawn-agent.js';
import { FindSymbolTool } from './tools/find-symbol.js';
import { GetReferencesTool } from './tools/get-references.js';
import { GenerateTestsTool } from './tools/generate-tests.js';
import { SecurityScanTool } from './tools/security-scan.js';
import { DependencyAuditTool } from './tools/dependency-audit.js';

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  riskLevel: ToolRiskLevel;
  execute(params: Record<string, unknown>, context: AgentContext): Promise<{ output: string; metadata?: Record<string, unknown> }>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const tools: Tool[] = [
      new ReadFileTool(),
      new WriteFileTool(),
      new EditFileTool(),
      new ListDirTool(),
      new SearchFilesTool(),
      new ExecuteCommandTool(),
      new GitStatusTool(),
      new GitDiffTool(),
      new GitCommitTool(),
      new GitBranchTool(),
      new GitLogTool(),
      new RunTestsTool(),
      new LintTool(),
      new TypeCheckTool(),
      new FetchUrlTool(),
      new SpawnAgentTool(),
      new FindSymbolTool(),
      new GetReferencesTool(),
      new GenerateTestsTool(),
      new SecurityScanTool(),
      new DependencyAuditTool(),
    ];

    for (const tool of tools) {
      this.register(tool);
    }
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  getToolSchemas(): Record<string, unknown>[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  getToolsByRisk(level: ToolRiskLevel): Tool[] {
    return Array.from(this.tools.values()).filter(t => t.riskLevel === level);
  }
}
