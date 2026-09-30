import { Command } from 'commander';
import { AgentEngine } from '../core/agent/engine.js';
import type { AgentConfig, AgentContext } from '../core/agent/types.js';
import * as readline from 'readline';

const program = new Command();

program
  .name('perfect-agent')
  .description('Autonomous AI coding agent')
  .version('0.1.0');

program
  .command('run')
  .description('Run a task autonomously')
  .argument('<task>', 'Task description')
  .option('-m, --mode <mode>', 'Execution mode (autonomous|supervised|interactive)', 'autonomous')
  .option('-r, --reasoning <level>', 'Reasoning depth (fast|standard|deep)', 'standard')
  .option('-s, --sandbox <mode>', 'Sandbox mode (none|workspace|strict)', 'workspace')
  .option('--no-test', 'Disable auto-testing')
  .option('--no-lint', 'Disable auto-linting')
  .option('--no-learning', 'Disable learning')
  .action(async (task, options) => {
    const config: AgentConfig = {
      mode: options.mode as any,
      reasoning: options.reasoning as any,
      maxIterations: 10,
      maxTokensPerTask: 100000,
      sandboxMode: options.sandbox as any,
      autoApprove: options.mode === 'autonomous',
      autoTest: options.test,
      autoLint: options.lint,
      autoFormat: true,
      learningEnabled: options.learning,
      proactiveEnabled: false,
    };

    const context: AgentContext = {
      workingDirectory: process.cwd(),
      projectType: 'unknown',
      language: 'typescript',
      dependencies: [],
      recentFiles: [],
    };

    const engine = new AgentEngine(config, context);

    // Listen to events
    engine.on('status_change', ({ status }) => {
      console.log(`\n[Status] ${status}`);
    });

    engine.on('thinking', ({ phase, description }) => {
      console.log(`[Thinking] ${phase}: ${description || ''}`);
    });

    engine.on('message', ({ message }) => {
      if (message.role === 'assistant') {
        console.log(`\n[Agent] ${message.content}`);
      }
    });

    engine.on('tool_call', ({ toolCall }) => {
      console.log(`[Tool] ${toolCall.tool}(${JSON.stringify(toolCall.params)})`);
    });

    engine.on('tool_result', ({ toolCall, result }) => {
      const status = result.success ? '✓' : '✗';
      console.log(`[Result] ${status} ${toolCall.tool}`);
    });

    engine.on('error', ({ error }) => {
      console.error(`[Error] ${error}`);
    });

    console.log(`Running task: ${task}\n`);

    try {
      const state = await engine.run(task);
      console.log('\n--- Task Complete ---');
      console.log(`Status: ${state.status}`);
      console.log(`Tokens: ${state.tokenUsage.total}`);
      console.log(`Cost: $${state.cost.toFixed(4)}`);
    } catch (error) {
      console.error('\n--- Task Failed ---');
      console.error(error);
      process.exit(1);
    }
  });

program
  .command('interactive')
  .description('Start interactive mode')
  .action(async () => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const config: AgentConfig = {
      mode: 'interactive',
      reasoning: 'standard',
      maxIterations: 10,
      maxTokensPerTask: 100000,
      sandboxMode: 'workspace',
      autoApprove: false,
      autoTest: true,
      autoLint: true,
      autoFormat: true,
      learningEnabled: true,
      proactiveEnabled: false,
    };

    const context: AgentContext = {
      workingDirectory: process.cwd(),
      projectType: 'unknown',
      language: 'typescript',
      dependencies: [],
      recentFiles: [],
    };

    const engine = new AgentEngine(config, context);

    engine.on('message', ({ message }) => {
      if (message.role === 'assistant') {
        console.log(`\n🤖 ${message.content}\n`);
      }
    });

    engine.on('tool_call', ({ toolCall }) => {
      console.log(`🔧 ${toolCall.tool}(${JSON.stringify(toolCall.params)})`);
    });

    const ask = () => {
      rl.question('> ', async (input) => {
        if (input === 'exit' || input === 'quit') {
          rl.close();
          return;
        }

        try {
          await engine.run(input);
        } catch (error) {
          console.error('Error:', error);
        }

        ask();
      });
    };

    console.log('PerfectAgent Interactive Mode');
    console.log('Type "exit" to quit\n');
    ask();
  });

program
  .command('serve')
  .description('Start the web server')
  .option('-p, --port <port>', 'Port number', '3000')
  .action(async (options) => {
    const { app } = await import('../server/index.js');
    const port = parseInt(options.port);
    app.listen(port, () => {
      console.log(`PerfectAgent server running on http://localhost:${port}`);
    });
  });

program.parse();
