import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';

const execAsync = promisify(exec);

export class ExecuteCommandTool implements Tool {
  name = 'execute_command';
  description = 'Execute a shell command in the working directory';
  riskLevel = 'high' as const;

  parameters = {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
    },
    required: ['command'],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const command = params.command as string;
    const timeout = (params.timeout as number) || 30000;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: context.workingDirectory,
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB
      });

      return {
        output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''),
        metadata: { command, exitCode: 0 },
      };
    } catch (error: any) {
      return {
        output: error.stdout || '',
        error: error.stderr || error.message,
        metadata: { command, exitCode: error.code || 1 },
      };
    }
  }
}
