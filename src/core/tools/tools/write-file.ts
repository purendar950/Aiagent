import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';

export class WriteFileTool implements Tool {
  name = 'write_file';
  description = 'Write content to a file at the specified path';
  riskLevel = 'medium' as const;

  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to write' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const filePath = resolve(context.workingDirectory, params.path as string);
    const content = params.content as string;

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf-8');

    return {
      output: `File written: ${filePath}`,
      metadata: { path: filePath, bytes: content.length },
    };
  }
}
