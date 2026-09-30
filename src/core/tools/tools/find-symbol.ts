import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class FindSymbolTool implements Tool {
  name = 'find_symbol';
  description = 'Find a symbol (function, class, variable) by name';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Symbol name to search for' },
      type: { type: 'string', enum: ['function', 'class', 'variable', 'interface', 'type', 'all'], description: 'Symbol type' },
    },
    required: ['name'],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const name = params.name as string;
    const type = params.type as string || 'all';

    // Use ripgrep to find symbol definitions
    const patterns: Record<string, string> = {
      function: `function\\s+${name}|const\\s+${name}\\s*=|def\\s+${name}`,
      class: `class\\s+${name}`,
      variable: `(?:const|let|var)\\s+${name}`,
      interface: `interface\\s+${name}`,
      type: `type\\s+${name}`,
      all: `${name}`,
    };

    const pattern = patterns[type] || patterns.all;
    const { stdout } = await execAsync(
      `rg -n "${pattern}" --type-add 'code:*.{ts,js,py,rs,go,java}' -tcode`,
      { cwd: context.workingDirectory, maxBuffer: 1024 * 1024 * 5 }
    );

    return { output: stdout || 'No matches found', metadata: { name, type } };
  }
}
