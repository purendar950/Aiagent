import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitBranchTool implements Tool {
  name = 'git_branch';
  description = 'List, create, or switch git branches';
  riskLevel = 'medium' as const;

  parameters = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'create', 'switch', 'delete'], description: 'Action to perform' },
      name: { type: 'string', description: 'Branch name (for create/switch/delete)' },
    },
    required: ['action'],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const action = params.action as string;
    const name = params.name as string | undefined;

    let cmd = 'git branch';
    if (action === 'create' && name) cmd = `git branch "${name}"`;
    else if (action === 'switch' && name) cmd = `git checkout "${name}"`;
    else if (action === 'delete' && name) cmd = `git branch -d "${name}"`;

    const { stdout, stderr } = await execAsync(cmd, { cwd: context.workingDirectory });
    return { output: stdout + stderr, metadata: { action, name } };
  }
}
