import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { readdir } from 'fs/promises';
import { resolve } from 'path';

export class ListDirTool implements Tool {
  name = 'list_dir';
  description = 'List contents of a directory';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the directory (default: working directory)' },
      recursive: { type: 'boolean', description: 'List recursively' },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const dirPath = resolve(context.workingDirectory, (params.path as string) || '.');
    const recursive = (params.recursive as boolean) || false;

    const entries = await readdir(dirPath, { withFileTypes: true, recursive });
    const items = entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
      path: resolve(dirPath, e.name),
    }));

    return {
      output: JSON.stringify(items, null, 2),
      metadata: { path: dirPath, count: items.length },
    };
  }
}
