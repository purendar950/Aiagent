import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export class ReadFileTool implements Tool {
  name = 'read_file';
  description = 'Read the contents of a file at the specified path';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to read' },
      offset: { type: 'number', description: 'Line number to start reading from (1-based)' },
      limit: { type: 'number', description: 'Number of lines to read' },
    },
    required: ['path'],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const filePath = resolve(context.workingDirectory, params.path as string);
    const offset = (params.offset as number) || 0;
    const limit = (params.limit as number) || undefined;

    let content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    if (offset || limit) {
      const start = offset ? offset - 1 : 0;
      const end = limit ? start + limit : lines.length;
      content = lines.slice(start, end).join('\n');
    }

    return {
      output: content,
      metadata: { path: filePath, lines: lines.length },
    };
  }
}
