import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitCommitTool implements Tool {
  name = 'git_commit';
  description = 'Stage and commit changes with a message';
  riskLevel = 'medium' as const;

  parameters = {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Commit message' },
      files: { type: 'array', items: { type: 'string' }, description: 'Specific files to commit (default: all)' },
      amend: { type: 'boolean', description: 'Amend the last commit' },
    },
    required: ['message'],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const message = params.message as string;
    const files = params.files as string[] | undefined;
    const amend = params.amend as boolean || false;

    // Stage files
    if (files && files.length > 0) {
      for (const file of files) {
        await execAsync(`git add "${file}"`, { cwd: context.workingDirectory });
      }
    } else {
      await execAsync('git add -A', { cwd: context.workingDirectory });
    }

    // Commit
    let cmd = `git commit -m "${message.replace(/"/g, '\\"')}"`;
    if (amend) cmd += ' --amend --no-edit';

    const { stdout, stderr } = await execAsync(cmd, { cwd: context.workingDirectory });
    return { output: stdout + stderr, metadata: { message, files: files || 'all' } };
  }
}
