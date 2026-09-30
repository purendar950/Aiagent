import express from 'express';
import cors from 'cors';
import { resolve } from 'path';
import { AgentEngine } from '../core/agent/engine.js';
import type { AgentConfig, AgentContext } from '../core/agent/types.js';

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(resolve(__dirname, '../../dist')));

// ─── Session Manager ───────────────────────────────────────────────

const activeSessions = new Map<string, AgentEngine>();

// ─── API Routes ────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Get available models
app.get('/api/models', async (_req, res) => {
  const { LLMRouter } = await import('../core/llm/router.js');
  const router = new LLMRouter();
  res.json({ models: router.getAvailableModels() });
});

// Create a new agent session
app.post('/api/sessions', async (req, res) => {
  const { task, config, context } = req.body;

  const agentConfig: AgentConfig = {
    mode: config?.mode || 'autonomous',
    reasoning: config?.reasoning || 'standard',
    maxIterations: config?.maxIterations || 10,
    maxTokensPerTask: config?.maxTokensPerTask || 100000,
    sandboxMode: config?.sandboxMode || 'workspace',
    autoApprove: config?.autoApprove || false,
    autoTest: config?.autoTest !== false,
    autoLint: config?.autoLint !== false,
    autoFormat: config?.autoFormat !== false,
    learningEnabled: config?.learningEnabled !== false,
    proactiveEnabled: config?.proactiveEnabled || false,
  };

  const agentContext: AgentContext = {
    workingDirectory: context?.workingDirectory || process.cwd(),
    projectType: context?.projectType || 'unknown',
    language: context?.language || 'typescript',
    framework: context?.framework,
    dependencies: context?.dependencies || [],
    testFramework: context?.testFramework,
    lintingConfig: context?.lintingConfig,
    gitBranch: context?.gitBranch,
    recentFiles: context?.recentFiles || [],
  };

  const engine = new AgentEngine(agentConfig, agentContext);

  const sessionId = `session-${Date.now()}`;
  activeSessions.set(sessionId, engine);

  res.json({ sessionId, status: 'created' });
});

// Run a task
app.post('/api/sessions/:sessionId/run', async (req, res) => {
  const { sessionId } = req.params;
  const { task } = req.body;

  const engine = activeSessions.get(sessionId);
  if (!engine) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const state = await engine.run(task);
    res.json({ status: 'completed', state });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Get session state
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const engine = activeSessions.get(sessionId);

  if (!engine) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({ state: engine.getState() });
});

// Abort a session
app.post('/api/sessions/:sessionId/abort', (req, res) => {
  const { sessionId } = req.params;
  const engine = activeSessions.get(sessionId);

  if (!engine) {
    return res.status(404).json({ error: 'Session not found' });
  }

  engine.abort();
  res.json({ status: 'aborted' });
});

// SSE endpoint for real-time events
app.get('/api/sessions/:sessionId/events', (req, res) => {
  const { sessionId } = req.params;
  const engine = activeSessions.get(sessionId);

  if (!engine) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  engine.on('status_change', (data) => sendEvent('status_change', data));
  engine.on('message', (data) => sendEvent('message', data));
  engine.on('tool_call', (data) => sendEvent('tool_call', data));
  engine.on('tool_result', (data) => sendEvent('tool_result', data));
  engine.on('thinking', (data) => sendEvent('thinking', data));
  engine.on('task_started', (data) => sendEvent('task_started', data));
  engine.on('task_completed', (data) => sendEvent('task_completed', data));
  engine.on('error', (data) => sendEvent('error', data));

  req.on('close', () => {
    engine.removeAllListeners();
  });
});

// ─── Start Server ──────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PerfectAgent server running on http://localhost:${PORT}`);
});

export { app };
