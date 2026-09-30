import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export class DependencyAuditTool implements Tool {
  name = 'dependency_audit';
  description = 'Audit project dependencies for vulnerabilities';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      fix: { type: 'boolean', description: 'Auto-fix vulnerabilities where possible' },
      production: { type: 'boolean', description: 'Audit production dependencies only' },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const fix = params.fix as boolean || false;
    const production = params.production as boolean || false;

    // Detect package manager
    const pkgManager = this.detectPackageManager(context);
    if (!pkgManager) {
      return { output: 'No package manager detected', error: 'Could not detect package manager' };
    }

    let cmd = '';
    switch (pkgManager) {
      case 'npm':
        cmd = 'npm audit --json';
        if (fix) cmd = 'npm audit fix';
        if (production) cmd += ' --omit=dev';
        break;
      case 'yarn':
        cmd = 'yarn audit --json';
        break;
      case 'pnpm':
        cmd = 'pnpm audit --json';
        if (fix) cmd = 'pnpm audit fix';
        break;
      case 'pip':
        cmd = 'pip-audit --format=json';
        break;
      case 'cargo':
        cmd = 'cargo audit --json';
        break;
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: context.workingDirectory, timeout: 60000 });
      return { output: stdout + stderr, metadata: { packageManager: pkgManager, fix, production } };
    } catch (error: any) {
      return { output: error.stdout || '', error: error.stderr || error.message, metadata: { packageManager: pkgManager } };
    }
  }

  private detectPackageManager(context: AgentContext): string | null {
    if (existsSync(resolve(context.workingDirectory, 'package-lock.json'))) return 'npm';
    if (existsSync(resolve(context.workingDirectory, 'yarn.lock'))) return 'yarn';
    if (existsSync(resolve(context.workingDirectory, 'pnpm-lock.yaml'))) return 'pnpm';
    if (existsSync(resolve(context.workingDirectory, 'requirements.txt'))) return 'pip';
    if (existsSync(resolve(context.workingDirectory, 'Cargo.toml'))) return 'cargo';
    return null;
  }
}
