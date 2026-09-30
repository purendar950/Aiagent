import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export class RunTestsTool implements Tool {
  name = 'run_tests';
  description = 'Run the project test suite';
  riskLevel = 'medium' as const;

  parameters = {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Run tests for a specific file' },
      pattern: { type: 'string', description: 'Test name pattern to match' },
      coverage: { type: 'boolean', description: 'Generate coverage report' },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const file = params.file as string | undefined;
    const pattern = params.pattern as string | undefined;
    const coverage = params.coverage as boolean || false;

    // Detect test framework
    const framework = this.detectTestFramework(context);
    if (!framework) {
      return { output: 'No test framework detected', error: 'Could not detect test framework' };
    }

    let cmd = framework.command;
    if (file) cmd += ` "${file}"`;
    if (pattern) cmd += ` --testNamePattern="${pattern}"`;
    if (coverage && framework.coverageFlag) cmd += ` ${framework.coverageFlag}`;

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: context.workingDirectory,
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 10,
      });
      return { output: stdout + stderr, metadata: { framework: framework.name, file, pattern } };
    } catch (error: any) {
      return { output: error.stdout || '', error: error.stderr || error.message, metadata: { framework: framework.name } };
    }
  }

  private detectTestFramework(context: AgentContext): { name: string; command: string; coverageFlag?: string } | null {
    const pkgPath = resolve(context.workingDirectory, 'package.json');
    if (!existsSync(pkgPath)) return null;

    const pkg = require(pkgPath);
    const scripts = pkg.scripts || {};
    const devDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (devDeps.vitest || scripts.test?.includes('vitest')) {
      return { name: 'vitest', command: 'npx vitest run', coverageFlag: '--coverage' };
    }
    if (devDeps.jest || scripts.test?.includes('jest')) {
      return { name: 'jest', command: 'npx jest', coverageFlag: '--coverage' };
    }
    if (devDeps.mocha || scripts.test?.includes('mocha')) {
      return { name: 'mocha', command: 'npx mocha', coverageFlag: '--coverage' };
    }
    if (devDeps.pytest || existsSync(resolve(context.workingDirectory, 'pytest.ini'))) {
      return { name: 'pytest', command: 'python -m pytest', coverageFlag: '--cov' };
    }
    if (scripts.test) {
      return { name: 'npm', command: 'npm test' };
    }
    return null;
  }
}
