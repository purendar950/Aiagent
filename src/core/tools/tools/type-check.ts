import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export class TypeCheckTool implements Tool {
  name = 'type_check';
  description = 'Run TypeScript type checker';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Type check a specific file' },
      strict: { type: 'boolean', description: 'Enable strict mode' },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const file = params.file as string | undefined;
    const strict = params.strict as boolean || false;

    const tsconfigPath = resolve(context.workingDirectory, 'tsconfig.json');
    if (!existsSync(tsconfigPath)) {
      return { output: 'No tsconfig.json found', error: 'TypeScript not configured' };
    }

    let cmd = 'npx tsc --noEmit';
    if (file) cmd += ` "${file}"`;
    if (strict) cmd += ' --strict';

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: context.workingDirectory, timeout: 60000 });
      return { output: stdout + stderr || 'No type errors', metadata: { file, strict } };
    } catch (error: any) {
      return { output: error.stdout || '', error: error.stderr || error.message, metadata: { file, strict } };
    }
  }
}
