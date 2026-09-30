import type { Tool } from '../registry.js';
import type { AgentContext } from '../../agent/types.js';
import { v4 as uuid } from 'uuid';

export class SpawnAgentTool implements Tool {
  name = 'spawn_agent';
  description = 'Spawn a sub-agent to handle a specific task in parallel';
  riskLevel = 'medium' as const;

  parameters = {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'Task description for the sub-agent' },
      agentType: { type: 'string', enum: ['coder', 'reviewer', 'tester', 'researcher', 'documenter'], description: 'Type of agent to spawn' },
      context: { type: 'string', description: 'Additional context for the sub-agent' },
    },
    required: ['task', 'agentType'],
  };

  async execute(params: Record<string, unknown>, context: AgentContext) {
    const task = params.task as string;
    const agentType = params.agentType as string;
    const additionalContext = params.context as string | undefined;

    const agentId = uuid();

    // In a real implementation, this would spawn a child process or worker
    // For now, return a placeholder
    return {
      output: `Spawned ${agentType} agent (${agentId}) for task: ${task}`,
      metadata: { agentId, agentType, task, context: additionalContext },
    };
  }
}
