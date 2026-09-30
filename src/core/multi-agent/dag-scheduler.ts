import type { AgentTask, DAG, DAGNode, SwarmConfig } from './types.js';
import { v4 as uuid } from 'uuid';

export class DAGScheduler {
  private dag: DAG;
  private config: SwarmConfig;
  private completed: Set<string> = new Set();
  private running: Set<string> = new Set();
  private failed: Set<string> = new Set();

  constructor(config: Partial<SwarmConfig> = {}) {
    this.config = {
      maxParallel: 4,
      timeout: 300000,
      retryCount: 2,
      enableBlackboard: true,
      enableMessaging: true,
      ...config,
    };
    this.dag = { nodes: new Map(), levels: [] };
  }

  /**
   * Add a task to the DAG
   */
  addTask(description: string, agentId: string, dependencies: string[] = []): string {
    const id = uuid();
    const task: AgentTask = {
      id,
      agentId,
      description,
      status: 'idle',
      dependencies,
    };

    const node: DAGNode = {
      id,
      task,
      children: [],
      parents: [...dependencies],
      level: 0,
    };

    this.dag.nodes.set(id, node);

    // Update parent's children
    for (const depId of dependencies) {
      const parent = this.dag.nodes.get(depId);
      if (parent) {
        parent.children.push(id);
      }
    }

    this.recalculateLevels();
    return id;
  }

  /**
   * Get tasks that are ready to run (all dependencies completed)
   */
  getReadyTasks(): AgentTask[] {
    const ready: AgentTask[] = [];

    for (const [id, node] of this.dag.nodes) {
      if (node.task.status !== 'idle') continue;
      if (this.running.has(id)) continue;

      const allDepsCompleted = node.parents.every(depId => this.completed.has(depId));
      if (allDepsCompleted) {
        ready.push(node.task);
      }
    }

    return ready;
  }

  /**
   * Mark a task as running
   */
  markRunning(taskId: string): void {
    this.running.add(taskId);
    const node = this.dag.nodes.get(taskId);
    if (node) {
      node.task.status = 'running';
      node.task.startedAt = Date.now();
    }
  }

  /**
   * Mark a task as completed
   */
  markCompleted(taskId: string, result: string): void {
    this.running.delete(taskId);
    this.completed.add(taskId);
    const node = this.dag.nodes.get(taskId);
    if (node) {
      node.task.status = 'completed';
      node.task.result = result;
      node.task.completedAt = Date.now();
    }
  }

  /**
   * Mark a task as failed
   */
  markFailed(taskId: string, error: string): void {
    this.running.delete(taskId);
    this.failed.add(taskId);
    const node = this.dag.nodes.get(taskId);
    if (node) {
      node.task.status = 'failed';
      node.task.error = error;
    }
  }

  /**
   * Check if all tasks are done
   */
  isComplete(): boolean {
    return this.completed.size + this.failed.size === this.dag.nodes.size;
  }

  /**
   * Get execution summary
   */
  getSummary(): {
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
  } {
    return {
      total: this.dag.nodes.size,
      completed: this.completed.size,
      failed: this.failed.size,
      running: this.running.size,
      pending: this.dag.nodes.size - this.completed.size - this.failed.size - this.running.size,
    };
  }

  /**
   * Get the DAG structure
   */
  getDAG(): DAG {
    return this.dag;
  }

  /**
   * Get all tasks
   */
  getTasks(): AgentTask[] {
    return Array.from(this.dag.nodes.values()).map(n => n.task);
  }

  /**
   * Recalculate topological levels for parallel execution
   */
  private recalculateLevels(): void {
    const levels: string[][] = [];
    const visited = new Set<string>();

    // Find root nodes (no parents)
    let currentLevel: string[] = [];
    for (const [id, node] of this.dag.nodes) {
      if (node.parents.length === 0) {
        currentLevel.push(id);
        node.level = 0;
      }
    }

    while (currentLevel.length > 0) {
      levels.push(currentLevel);
      const nextLevel: string[] = [];

      for (const id of currentLevel) {
        visited.add(id);
        const node = this.dag.nodes.get(id);
        if (node) {
          for (const childId of node.children) {
            const child = this.dag.nodes.get(childId);
            if (child && !visited.has(childId)) {
              // Check if all parents of child are visited
              const allParentsVisited = child.parents.every(p => visited.has(p));
              if (allParentsVisited) {
                child.level = levels.length;
                nextLevel.push(childId);
              }
            }
          }
        }
      }

      currentLevel = nextLevel;
    }

    this.dag.levels = levels;
  }

  /**
   * Get tasks grouped by level (for parallel execution)
   */
  getLevels(): string[][] {
    return this.dag.levels;
  }
}
