// ─── Core Agent Types ───────────────────────────────────────────────

export type ExecutionMode = 'autonomous' | 'supervised' | 'interactive';
export type ReasoningMode = 'fast' | 'standard' | 'deep';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AgentConfig {
  mode: ExecutionMode;
  reasoning: ReasoningMode;
  maxIterations: number;
  maxTokensPerTask: number;
  sandboxMode: 'none' | 'workspace' | 'strict';
  autoApprove: boolean;
  autoTest: boolean;
  autoLint: boolean;
  autoFormat: boolean;
  learningEnabled: boolean;
  proactiveEnabled: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  riskLevel: ToolRiskLevel;
  status: 'pending' | 'approved' | 'denied' | 'executing' | 'completed' | 'failed';
  result?: ToolResult;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  subtasks: SubTask[];
  result?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SubTask {
  id: string;
  description: string;
  status: TaskStatus;
  toolCalls: ToolCall[];
  result?: string;
  error?: string;
}

export interface AgentState {
  messages: Message[];
  tasks: Task[];
  currentTask?: string;
  iteration: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost: number;
  status: 'idle' | 'thinking' | 'executing' | 'reflecting' | 'completed' | 'failed';
}

export interface AgentContext {
  workingDirectory: string;
  projectType: string;
  language: string;
  framework?: string;
  dependencies: string[];
  testFramework?: string;
  lintingConfig?: Record<string, unknown>;
  gitBranch?: string;
  recentFiles: string[];
  codebaseGraph?: CodeGraph;
}

export interface CodeGraph {
  entities: CodeEntity[];
  relationships: CodeRelationship[];
}

export interface CodeEntity {
  id: string;
  type: 'function' | 'class' | 'variable' | 'module' | 'interface' | 'type';
  name: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  signature?: string;
  docstring?: string;
}

export interface CodeRelationship {
  from: string;
  to: string;
  type: 'calls' | 'imports' | 'implements' | 'extends' | 'uses';
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  finishReason: string;
}

export interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done';
  data: string | ToolCall | ToolResult | Record<string, unknown>;
  timestamp: number;
}

export interface AgentEvent {
  type: 'message' | 'task_started' | 'task_completed' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'status_change';
  data: unknown;
  timestamp: number;
}
