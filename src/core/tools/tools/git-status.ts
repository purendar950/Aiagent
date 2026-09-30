import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitStatusTool implements Tool {
  name = 'git_status';
  description = 'Show the working tree status';
  riskLevel = 'low' as const;

  parameters = { type: 'object', properties: {}, required: [] };

  async execute(_params: Record<string, unknown>, context: AgentContext) {
    const { stdout } = await execAsync('git status --porcelain', { cwd: context.workingDirectory });
    return { output: stdout || 'Working tree clean', metadata: { branch: await this.getBranch(context) } };
  }

  private async getBranch(context: AgentContext): Promise<string> {
    const { stdout } = await execAsync('git branch --show-current', { cwd: context.workingDirectory });
    return stdout.trim();
  }
}
