import { MemorySystem, type Interaction } from '../memory/system.js';
import { LLMRouter } from '../llm/router.js';
import type { AgentContext } from '../agent/types.js';
import { v4 as uuid } from 'uuid';

export interface LearningPattern {
  id: string;
  type: 'style' | 'preference' | 'anti_pattern' | 'best_practice';
  description: string;
  confidence: number;
  occurrences: number;
  lastSeen: number;
}

export interface ProactiveSuggestion {
  id: string;
  type: 'bug' | 'security' | 'performance' | 'refactor' | 'test_gap' | 'dependency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line?: number;
  description: string;
  suggestedFix?: string;
  confidence: number;
}

export class SelfLearner {
  private memory: MemorySystem;
  private llmRouter: LLMRouter;
  private context: AgentContext;
  private patterns: LearningPattern[] = [];

  constructor(context: AgentContext) {
    this.context = context;
    this.memory = new MemorySystem(context.workingDirectory);
    this.llmRouter = new LLMRouter();
  }

  /**
   * Learn from a completed task
   */
  async learnFromTask(taskDescription: string, result: string, success: boolean): Promise<void> {
    // Extract patterns from the interaction
    const patterns = await this.extractPatterns(taskDescription, result, success);

    for (const pattern of patterns) {
      await this.memory.storeInteraction({
        id: uuid(),
        type: success ? 'success' : 'failure',
        description: pattern,
        context: taskDescription,
        timestamp: Date.now(),
      });
    }

    // Update preferences based on the task
    await this.updatePreferences(taskDescription, result);
  }

  /**
   * Extract patterns from a task using LLM
   */
  private async extractPatterns(task: string, result: string, success: boolean): Promise<string[]> {
    const prompt = `Analyze this coding task and extract reusable patterns.

Task: ${task}
Result: ${result.substring(0, 500)}
Success: ${success}

Extract patterns as a JSON array of strings. Focus on:
1. Code patterns that worked well
2. Anti-patterns to avoid
3. Best practices discovered
4. Style preferences observed

Return JSON array only:`;

    try {
      const response = await this.llmRouter.chat({
        messages: [
          { id: uuid(), role: 'system', content: 'You are a pattern extraction engine. Return only JSON arrays.', timestamp: Date.now() },
          { id: uuid(), role: 'user', content: prompt, timestamp: Date.now() },
        ],
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 1024,
      });

      const patterns: string[] = JSON.parse(response.content);
      return Array.isArray(patterns) ? patterns : [];
    } catch {
      return [];
    }
  }

  /**
   * Update user preferences based on task
   */
  private async updatePreferences(task: string, result: string): Promise<void> {
    // Detect language preference
    const languages = ['typescript', 'python', 'rust', 'go', 'java', 'javascript'];
    for (const lang of languages) {
      if (task.toLowerCase().includes(lang) || result.toLowerCase().includes(lang)) {
        await this.memory.setPreference('preferred_language', lang);
      }
    }

    // Detect framework preference
    const frameworks = ['react', 'vue', 'angular', 'express', 'fastapi', 'django', 'nextjs'];
    for (const fw of frameworks) {
      if (task.toLowerCase().includes(fw) || result.toLowerCase().includes(fw)) {
        await this.memory.setPreference('preferred_framework', fw);
      }
    }

    // Detect test framework
    const testFrameworks = ['jest', 'vitest', 'pytest', 'mocha', 'cypress'];
    for (const tf of testFrameworks) {
      if (task.toLowerCase().includes(tf) || result.toLowerCase().includes(tf)) {
        await this.memory.setPreference('preferred_test_framework', tf);
      }
    }
  }

  /**
   * Get relevant patterns for a task
   */
  async getRelevantPatterns(taskDescription: string): Promise<Interaction[]> {
    return this.memory.findSimilarPatterns(taskDescription, 5);
  }

  /**
   * Get learned preferences
   */
  async getPreferences(): Promise<Record<string, string>> {
    const prefs: Record<string, string> = {};
    const keys = ['preferred_language', 'preferred_framework', 'preferred_test_framework'];

    for (const key of keys) {
      const value = await this.memory.getPreference(key);
      if (value) prefs[key] = value;
    }

    return prefs;
  }

  /**
   * Get recent reflections
   */
  async getRecentReflections(limit: number = 5) {
    return this.memory.getRecentReflections(limit);
  }
}

export class ProactiveScanner {
  private context: AgentContext;
  private llmRouter: LLMRouter;

  constructor(context: AgentContext) {
    this.context = context;
    this.llmRouter = new LLMRouter();
  }

  /**
   * Scan codebase for issues and opportunities
   */
  async scan(): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    // Scan for common issues
    const [bugs, security, performance, tests] = await Promise.all([
      this.scanForBugs(),
      this.scanForSecurity(),
      this.scanForPerformance(),
      this.scanForTestGaps(),
    ]);

    suggestions.push(...bugs, ...security, ...performance, ...tests);
    return suggestions.sort((a, b) => this.severityWeight(b.severity) - this.severityWeight(a.severity));
  }

  /**
   * Scan for potential bugs
   */
  private async scanForBugs(): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    // Check for common bug patterns
    const bugPatterns = [
      { pattern: 'console\\.log', type: 'debug statement left in code' },
      { pattern: 'TODO|FIXME|HACK', type: 'unfinished code marker' },
      { pattern: 'catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}', type: 'empty catch block' },
      { pattern: '==(?!=)', type: 'loose equality (use ===)' },
    ];

    for (const { pattern, type } of bugPatterns) {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const { stdout } = await execAsync(
          `rg -n "${pattern}" --type-add 'code:*.{ts,js,py,rs,go,java}' -tcode`,
          { cwd: this.context.workingDirectory }
        );

        if (stdout.trim()) {
          const lines = stdout.trim().split('\n').slice(0, 5);
          for (const line of lines) {
            const [file, lineNum] = line.split(':');
            suggestions.push({
              id: uuid(),
              type: 'bug',
              severity: 'medium',
              file,
              line: parseInt(lineNum),
              description: type,
              confidence: 0.7,
            });
          }
        }
      } catch { /* ignore */ }
    }

    return suggestions;
  }

  /**
   * Scan for security issues
   */
  private async scanForSecurity(): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    const securityPatterns = [
      { pattern: 'api[_-]?key\\s*[:=]\\s*["\'][a-zA-Z0-9]{32,}["\']', type: 'hardcoded API key' },
      { pattern: 'password\\s*[:=]\\s*["\'][^"\']{8,}["\']', type: 'hardcoded password' },
      { pattern: 'eval\\s*\\(', type: 'use of eval()' },
      { pattern: 'innerHTML\\s*=', type: 'potential XSS vulnerability' },
    ];

    for (const { pattern, type } of securityPatterns) {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const { stdout } = await execAsync(
          `rg -n "${pattern}" --type-add 'code:*.{ts,js,py,rs,go,java}' -tcode`,
          { cwd: this.context.workingDirectory }
        );

        if (stdout.trim()) {
          const lines = stdout.trim().split('\n').slice(0, 3);
          for (const line of lines) {
            const [file, lineNum] = line.split(':');
            suggestions.push({
              id: uuid(),
              type: 'security',
              severity: 'high',
              file,
              line: parseInt(lineNum),
              description: type,
              confidence: 0.8,
            });
          }
        }
      } catch { /* ignore */ }
    }

    return suggestions;
  }

  /**
   * Scan for performance issues
   */
  private async scanForPerformance(): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    const perfPatterns = [
      { pattern: 'for\\s*\\([^)]*\\)\\s*\\{[^}]*for\\s*\\(', type: 'nested loops (potential O(n²))' },
      { pattern: 'JSON\\.parse\\(JSON\\.stringify', type: 'inefficient deep clone' },
    ];

    for (const { pattern, type } of perfPatterns) {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const { stdout } = await execAsync(
          `rg -n "${pattern}" --type-add 'code:*.{ts,js,py,rs,go,java}' -tcode`,
          { cwd: this.context.workingDirectory }
        );

        if (stdout.trim()) {
          suggestions.push({
            id: uuid(),
            type: 'performance',
            severity: 'low',
            file: 'unknown',
            description: type,
            confidence: 0.5,
          });
        }
      } catch { /* ignore */ }
    }

    return suggestions;
  }

  /**
   * Scan for test gaps
   */
  private async scanForTestGaps(): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Find source files without corresponding test files
      const { stdout } = await execAsync(
        `find . -name "*.ts" -o -name "*.js" | grep -v node_modules | grep -v test | grep -v spec | head -20`,
        { cwd: this.context.workingDirectory }
      );

      const sourceFiles = stdout.trim().split('\n').filter(Boolean);

      for (const file of sourceFiles.slice(0, 10)) {
        const testFile = file.replace(/\.(ts|js)$/, '.test.$1');
        const { existsSync } = await import('fs');
        if (!existsSync(testFile)) {
          suggestions.push({
            id: uuid(),
            type: 'test_gap',
            severity: 'low',
            file,
            description: `No test file found for ${file}`,
            confidence: 0.6,
          });
        }
      }
    } catch { /* ignore */ }

    return suggestions;
  }

  private severityWeight(severity: string): number {
    const weights: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[severity] || 0;
  }
}
