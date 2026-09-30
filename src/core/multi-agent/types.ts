// ─── Multi-Agent Types ─────────────────────────────────────────────

export type AgentRole = 'planner' | 'coder' | 'reviewer' | 'tester' | 'researcher' | 'documenter' | 'devops';
export type AgentStatus = 'idle' | 'running' | 'waiting' | 'completed' | 'failed';

export interface AgentDefinition {
  id: string;
  role: AgentRole;
  name: string;
  systemPrompt: string;
  tools: string[];
  maxTokens: number;
  temperature: number;
}

export interface AgentTask {
  id: string;
  agentId: string;
  description: string;
  status: AgentStatus;
  dependencies: string[];
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface AgentMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  content: string;
  timestamp: number;
}

export interface BlackboardEntry {
  key: string;
  value: string;
  author: string;
  timestamp: number;
}

export interface DAGNode {
  id: string;
  task: AgentTask;
  children: string[];
  parents: string[];
  level: number;
}

export interface DAG {
  nodes: Map<string, DAGNode>;
  levels: string[][];
}

export interface SwarmConfig {
  maxParallel: number;
  timeout: number;
  retryCount: number;
  enableBlackboard: boolean;
  enableMessaging: boolean;
}
