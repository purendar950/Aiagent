# PerfectAgent — Autonomous AI Coding Agent

> Next-gen autonomous AI coding agent that surpasses Claude Code & ChatGPT

## Features

- **Autonomous Execution** — Give it a task, it plans, codes, tests, and delivers
- **Multi-Provider LLM** — Claude, OpenAI, DeepSeek with automatic fallback
- **21 Built-in Tools** — File I/O, shell, git, testing, linting, security scanning
- **Self-Improving** — Learns from every interaction
- **Multi-Agent Swarms** — Spawn sub-agents for parallel tasks
- **Permission System** — Tiered permissions with sandbox modes
- **Web UI** — Vue 3 + TailwindCSS real-time interface
- **CLI** — Terminal-based interactive and batch modes

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your API keys

# Run a task
npm run cli run "Create a REST API for a todo app"

# Interactive mode
npm run cli interactive

# Web UI
npm run server
# Open http://localhost:3000
```

## Architecture

```
src/
├── core/
│   ├── agent/          # Agent engine, types, planning, execution
│   ├── tools/          # 21 tool implementations
│   ├── llm/            # Multi-provider LLM router
│   ├── permissions/    # Permission & sandbox system
│   └── memory/         # Long-term memory & learning
├── server/             # Express API server
├── components/         # Vue 3 UI components
├── composables/        # Reactive state management
└── cli/                # CLI entry point
```

## Configuration

| Option | Values | Default |
|---|---|---|
| Mode | autonomous, supervised, interactive | autonomous |
| Reasoning | fast, standard, deep | standard |
| Sandbox | none, workspace, strict | workspace |
| Auto-test | true/false | true |
| Auto-lint | true/false | true |
| Learning | true/false | true |

## License

MIT
