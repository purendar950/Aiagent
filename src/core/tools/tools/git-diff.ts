import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitDiffTool implements Tool {
  name = 'git_diff';
  description = 'Show changes between commits, working tree, and index';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      staged: { type: 'boolean', description: 'Show staged changes only' },
      file: { type: 'string', description: 'Show diff for a specific file' },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    let cmd = 'git diff';
    if (params.staged) cmd += ' --cached';
    if (params.file) cmd += ` -- "${params.file}"`;

    const { stdout } = await execAsync(cmd, { cwd: context.workingDirectory, maxBuffer: 1024 * 1024 * 10 });
    return { output: stdout || 'No changes', metadata: { staged: !!params.staged } };
  }
}
