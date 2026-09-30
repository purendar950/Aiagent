import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { glob } from 'glob';
import { resolve } from 'path';

export class SearchFilesTool implements Tool {
  name = 'search_files';
  description = 'Search for files matching a pattern or content';
  riskLevel = 'low' as const;

  parameters = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern to match files (e.g., "**/*.ts")' },
      content: { type: 'string', description: 'Search for files containing this text' },
      path: { type: 'string', description: 'Directory to search in' },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const searchPath = resolve(context.workingDirectory, (params.path as string) || '.');
    const pattern = (params.pattern as string) || '**/*';
    const content = params.content as string | undefined;

    const files = await glob(pattern, { cwd: searchPath, nodir: true });

    if (content) {
      const { readFile } = await import('fs/promises');
      const matchingFiles: string[] = [];
      for (const file of files.slice(0, 100)) {
        try {
          const text = await readFile(resolve(searchPath, file), 'utf-8');
          if (text.includes(content)) {
            matchingFiles.push(file);
          }
        } catch { /* skip unreadable files */ }
      }
      return {
        output: JSON.stringify(matchingFiles, null, 2),
        metadata: { pattern, content, matches: matchingFiles.length },
      };
    }

    return {
      output: JSON.stringify(files, null, 2),
      metadata: { pattern, matches: files.length },
    };
  }
}
