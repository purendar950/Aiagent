import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitLogTool implements Tool {
  name = 'git_log';
  description = 'Show commit history';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Number of commits to show (default: 10)' },
      file: { type: 'string', description: 'Show commits for a specific file' },
      oneline: { type: 'boolean', description: 'Show one-line format' },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const limit = (params.limit as number) || 10;
    const file = params.file as string | undefined;
    const oneline = params.oneline as boolean || false;

    let cmd = `git log --max-count=${limit}`;
    if (oneline) cmd += ' --oneline';
    if (file) cmd += ` -- "${file}"`;

    const { stdout } = await execAsync(cmd, { cwd: context.workingDirectory });
    return { output: stdout, metadata: { limit, file } };
  }
}
