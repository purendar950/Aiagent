import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export class LintTool implements Tool {
  name = 'lint';
  description = 'Run linter on the codebase';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Lint a specific file' },
      fix: { type: 'boolean', description: 'Auto-fix issues where possible' },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const file = params.file as string | undefined;
    const fix = params.fix as boolean || false;

    const linter = this.detectLinter(context);
    if (!linter) {
      return { output: 'No linter detected', error: 'Could not detect linter' };
    }

    let cmd = linter.command;
    if (file) cmd += ` "${file}"`;
    if (fix && linter.fixFlag) cmd += ` ${linter.fixFlag}`;

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: context.workingDirectory, timeout: 60000 });
      return { output: stdout + stderr, metadata: { linter: linter.name, file, fix } };
    } catch (error: any) {
      return { output: error.stdout || '', error: error.stderr || error.message, metadata: { linter: linter.name } };
    }
  }

  private detectLinter(context: AgentContext): { name: string; command: string; fixFlag?: string } | null {
    const pkgPath = resolve(context.workingDirectory, 'package.json');
    if (!existsSync(pkgPath)) return null;

    const pkg = require(pkgPath);
    const devDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (devDeps.eslint) {
      return { name: 'eslint', command: 'npx eslint', fixFlag: '--fix' };
    }
    if (devDeps.ruff || devDeps.flake8) {
      return { name: 'ruff', command: 'ruff check', fixFlag: '--fix' };
    }
    if (devDeps.golangciLint) {
      return { name: 'golangci-lint', command: 'golangci-lint run', fixFlag: '--fix' };
    }
    return null;
  }
}
