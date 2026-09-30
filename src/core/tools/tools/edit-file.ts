import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

export class EditFileTool implements Tool {
  name = 'edit_file';
  description = 'Make precise edits to a file using old/new string replacement';
  riskLevel = 'medium' as const;

  parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to edit' },
      edits: {
        type: 'array',
        description: 'Array of edits to apply',
        items: {
          type: 'object',
          properties: {
            oldText: { type: 'string', description: 'Text to find and replace' },
            newText: { type: 'string', description: 'Replacement text' },
          },
          required: ['oldText', 'newText'],
        },
      },
    },
    required: ['path', 'edits'],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const filePath = resolve(context.workingDirectory, params.path as string);
    const edits = params.edits as Array<{ oldText: string; newText: string }>;

    let content = await readFile(filePath, 'utf-8');
    const originalContent = content;

    for (const edit of edits) {
      if (!content.includes(edit.oldText)) {
        throw new Error(`Could not find text to replace in ${filePath}: "${edit.oldText.substring(0, 50)}..."`);
      }
      content = content.replace(edit.oldText, edit.newText);
    }

    if (content === originalContent) {
      return { output: 'No changes made', metadata: { path: filePath, changed: false } };
    }

    await writeFile(filePath, content, 'utf-8');

    return {
      output: `File edited: ${filePath}`,
      metadata: { path: filePath, changed: true, editsApplied: edits.length },
    };
  }
}
