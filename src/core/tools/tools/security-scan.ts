import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SecurityScanTool implements Tool {
  name = 'security_scan';
  description = 'Scan codebase for security vulnerabilities';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Scan a specific file' },
      severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical', 'all'], description: 'Minimum severity level' },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const file = params.file as string | undefined;
    const severity = params.severity as string || 'all';

    // Check for common security issues
    const issues: string[] = [];

    // Check for hardcoded secrets
    const secretPatterns = [
      { pattern: /api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9]{32,}["']/gi, type: 'Hardcoded API key' },
      { pattern: /password\s*[:=]\s*["'][^"']{8,}["']/gi, type: 'Hardcoded password' },
      { pattern: /secret\s*[:=]\s*["'][a-zA-Z0-9]{32,}["']/gi, type: 'Hardcoded secret' },
      { pattern: /token\s*[:=]\s*["'][a-zA-Z0-9]{32,}["']/gi, type: 'Hardcoded token' },
    ];

    // Use ripgrep to search for patterns
    for (const { pattern, type } of secretPatterns) {
      try {
        const { stdout } = await execAsync(
          `rg -n "${pattern.source}" --type-add 'code:*.{ts,js,py,rs,go,java}' -tcode ${file || ''}`,
          { cwd: context.workingDirectory }
        );
        if (stdout.trim()) {
          issues.push(`${type}: ${stdout.trim()}`);
        }
      } catch { /* no matches */ }
    }

    // Check for SQL injection vulnerabilities
    try {
      const { stdout } = await execAsync(
        `rg -n "execute.*\\$\\{|query.*\\$\\{" --type-add 'code:*.{ts,js,py,rs,go,java}' -tcode ${file || ''}`,
        { cwd: context.workingDirectory }
      );
      if (stdout.trim()) {
        issues.push(`Potential SQL injection: ${stdout.trim()}`);
      }
    } catch { /* no matches */ }

    return {
      output: issues.length > 0 ? issues.join('\n') : 'No security issues found',
      metadata: { severity, issuesFound: issues.length },
    };
  }
}
