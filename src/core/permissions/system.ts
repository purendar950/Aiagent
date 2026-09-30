import type { ToolCall, AgentContext, ToolRiskLevel } from '../agent/types.js';

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiresApproval: boolean;
}

export class PermissionSystem {
  private sandboxMode: 'none' | 'workspace' | 'strict';
  private allowList: Set<string> = new Set();
  private denyList: Set<string> = new Set();
  private askList: Set<string> = new Set();
  private auditLog: Array<{ tool: string; params: Record<string, unknown>; allowed: boolean; timestamp: number }> = [];

  constructor(sandboxMode: 'none' | 'workspace' | 'strict' = 'workspace') {
    this.sandboxMode = sandboxMode;
    this.loadDefaults();
  }

  private loadDefaults(): void {
    // Low risk tools are auto-allowed
    this.allowList.add('read_file');
    this.allowList.add('list_dir');
    this.allowList.add('search_files');
    this.allowList.add('git_status');
    this.allowList.add('git_diff');
    this.allowList.add('git_log');
    this.allowList.add('find_symbol');
    this.allowList.add('get_references');
    this.allowList.add('fetch_url');
    this.allowList.add('lint');
    this.allowList.add('type_check');
    this.allowList.add('security_scan');
    this.allowList.add('dependency_audit');

    // High risk tools require approval
    this.askList.add('execute_command');
    this.askList.add('git_commit');
    this.askList.add('git_branch');
    this.askList.add('spawn_agent');

    // Critical tools are denied in strict mode
    this.denyList.add('write_file');
    this.denyList.add('edit_file');
  }

  async check(toolCall: ToolCall, context: AgentContext): Promise<PermissionResult> {
    const tool = toolCall.tool;
    const params = toolCall.params;

    // Check deny list
    if (this.denyList.has(tool)) {
      if (this.sandboxMode === 'strict') {
        this.log(tool, params, false);
        return { allowed: false, reason: 'Tool is denied in strict mode', requiresApproval: false };
      }
    }

    // Check allow list
    if (this.allowList.has(tool)) {
      this.log(tool, params, true);
      return { allowed: true, requiresApproval: false };
    }

    // Check ask list
    if (this.askList.has(tool)) {
      this.log(tool, params, false);
      return { allowed: false, reason: 'Tool requires approval', requiresApproval: true };
    }

    // Check sandbox mode
    if (this.sandboxMode === 'workspace') {
      // Ensure file operations are within workspace
      if (this.isFileOperation(tool)) {
        const path = params.path as string;
        if (path && !this.isWithinWorkspace(path, context)) {
          this.log(tool, params, false);
          return { allowed: false, reason: 'Path is outside workspace', requiresApproval: false };
        }
      }
    }

    // Default: allow low risk, ask for medium/high
    const riskLevel = toolCall.riskLevel;
    if (riskLevel === 'low') {
      this.log(tool, params, true);
      return { allowed: true, requiresApproval: false };
    }

    if (riskLevel === 'medium' || riskLevel === 'high') {
      this.log(tool, params, false);
      return { allowed: false, reason: `Tool has ${riskLevel} risk level`, requiresApproval: true };
    }

    // Critical risk: deny
    this.log(tool, params, false);
    return { allowed: false, reason: 'Tool has critical risk level', requiresApproval: false };
  }

  private isFileOperation(tool: string): boolean {
    return ['read_file', 'write_file', 'edit_file', 'list_dir', 'search_files'].includes(tool);
  }

  private isWithinWorkspace(path: string, context: AgentContext): boolean {
    const resolved = require('path').resolve(context.workingDirectory, path);
    return resolved.startsWith(context.workingDirectory);
  }

  private log(tool: string, params: Record<string, unknown>, allowed: boolean): void {
    this.auditLog.push({ tool, params, allowed, timestamp: Date.now() });
  }

  getAuditLog(): Array<{ tool: string; params: Record<string, unknown>; allowed: boolean; timestamp: number }> {
    return [...this.auditLog];
  }

  addToAllowList(tool: string): void {
    this.allowList.add(tool);
  }

  addToDenyList(tool: string): void {
    this.denyList.add(tool);
  }

  addToAskList(tool: string): void {
    this.askList.add(tool);
  }
}
