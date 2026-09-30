import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export class GenerateTestsTool implements Tool {
  name = 'generate_tests';
  description = 'Generate tests for a given file or function';
  riskLevel = 'medium' as const;

  parameters = {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'File to generate tests for' },
      function: { type: 'string', description: 'Specific function to test' },
      framework: { type: 'string', enum: ['jest', 'vitest', 'pytest', 'auto'], description: 'Test framework' },
      coverage: { type: 'string', enum: ['basic', 'comprehensive', 'edge-cases'], description: 'Test coverage level' },
    },
    required: ['file'],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const file = params.file as string;
    const func = params.function as string | undefined;
    const framework = params.framework as string || 'auto';
    const coverage = params.coverage as string || 'comprehensive';

    const filePath = resolve(context.workingDirectory, file);
    const content = await readFile(filePath, 'utf-8');

    // Detect framework if auto
    const detectedFramework = framework === 'auto' ? this.detectFramework(context) : framework;

    // Generate test file path
    const testFile = file.replace(/\.(ts|js|py|rs|go)$/, '.test.$1');

    // In a real implementation, this would use the LLM to generate tests
    // For now, return a placeholder
    return {
      output: `Generated ${coverage} tests for ${func || file} using ${detectedFramework}\nTest file: ${testFile}`,
      metadata: { file, function: func, framework: detectedFramework, coverage },
    };
  }

  private detectFramework(context: AgentContext): string {
    const pkgPath = resolve(context.workingDirectory, 'package.json');
    try {
      const pkg = require(pkgPath);
      const devDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (devDeps.vitest) return 'vitest';
      if (devDeps.jest) return 'jest';
      if (devDeps.mocha) return 'mocha';
    } catch { /* ignore */ }
    return 'jest';
  }
}
