import { ref, computed, reactive } from 'vue';
import type { AgentConfig, AgentState, Message, Task } from '../core/agent/types.js';

export function useDesktopState() {
  // ─── State ───────────────────────────────────────────────────────
  const threads = ref<Array<{ id: string; title: string; createdAt: number }>>([]);
  const selectedThreadId = ref<string | null>(null);
  const messages = ref<Message[]>([]);
  const isLoading = ref(false);
  const status = ref<string>('idle');
  const tokenUsage = ref({ prompt: 0, completion: 0, total: 0 });
  const cost = ref(0);
  const eventSource = ref<EventSource | null>(null);

  const config = reactive<AgentConfig>({
    mode: 'autonomous',
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
  });

  // ─── Computed ────────────────────────────────────────────────────
  const selectedThread = computed(() => {
    if (!selectedThreadId.value) return null;
    return threads.value.find(t => t.id === selectedThreadId.value) || null;
  });

  // ─── Methods ─────────────────────────────────────────────────────
  function initialize() {
    // Load from localStorage
    const saved = localStorage.getItem('perfect-agent.threads');
    if (saved) {
      threads.value = JSON.parse(saved);
    }
  }

  function dispose() {
    eventSource.value?.close();
  }

  function createThread() {
    const id = `thread-${Date.now()}`;
    threads.value.unshift({
      id,
      title: 'New Task',
      createdAt: Date.now(),
    });
    selectedThreadId.value = id;
    messages.value = [];
    saveThreads();
  }

  function selectThread(id: string) {
    selectedThreadId.value = id;
    messages.value = [];
    // Load messages for this thread
  }

  async function sendMessage(content: string) {
    if (!selectedThreadId.value || !content.trim()) return;

    isLoading.value = true;
    status.value = 'thinking';

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    messages.value.push(userMessage);

    try {
      // Create session if needed
      const sessionResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: content,
          config: { ...config },
          context: {
            workingDirectory: process.cwd(),
            language: 'typescript',
          },
        }),
      });

      const { sessionId } = await sessionResponse.json();

      // Connect to SSE
      connectToEvents(sessionId);

      // Run task
      await fetch(`/api/sessions/${sessionId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: content }),
      });
    } catch (error) {
      status.value = 'failed';
      console.error('Failed to send message:', error);
    } finally {
      isLoading.value = false;
    }
  }

  function connectToEvents(sessionId: string) {
    eventSource.value?.close();

    const es = new EventSource(`/api/sessions/${sessionId}/events`);
    eventSource.value = es;

    es.addEventListener('status_change', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      status.value = data.status;
    });

    es.addEventListener('message', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      messages.value.push(data.message);
    });

    es.addEventListener('tool_call', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      // Update UI with tool call
    });

    es.addEventListener('tool_result', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      // Update UI with tool result
    });

    es.addEventListener('thinking', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      // Show thinking indicator
    });

    es.addEventListener('error', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      status.value = 'failed';
      console.error('Agent error:', data.error);
    });
  }

  function abort() {
    eventSource.value?.close();
    isLoading.value = false;
    status.value = 'idle';
  }

  function updateConfig(newConfig: Partial<AgentConfig>) {
    Object.assign(config, newConfig);
    localStorage.setItem('perfect-agent.config', JSON.stringify(config));
  }

  function saveThreads() {
    localStorage.setItem('perfect-agent.threads', JSON.stringify(threads.value));
  }

  return {
    // State
    threads,
    selectedThreadId,
    selectedThread,
    messages,
    isLoading,
    status,
    tokenUsage,
    cost,
    config,
    // Methods
    initialize,
    dispose,
    createThread,
    selectThread,
    sendMessage,
    abort,
    updateConfig,
  };
}
