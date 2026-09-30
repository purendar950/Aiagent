import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GetReferencesTool implements Tool {
  name = 'get_references';
  description = 'Find all references to a symbol';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Symbol name to find references for' },
      file: { type: 'string', description: 'Limit search to a specific file' },
    },
    required: ['name'],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const name = params.name as string;
    const file = params.file as string | undefined;

    let cmd = `rg -n "${name}" --type-add 'code:*.{ts,js,py,rs,go,java}' -tcode`;
    if (file) cmd += ` "${file}"`;

    const { stdout } = await execAsync(cmd, { cwd: context.workingDirectory, maxBuffer: 1024 * 1024 * 5 });
    return { output: stdout || 'No references found', metadata: { name, file } };
  }
}
