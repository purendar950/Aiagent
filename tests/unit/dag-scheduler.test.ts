import { describe, it, expect, beforeEach } from 'vitest';
import { DAGScheduler } from '../../src/core/multi-agent/dag-scheduler.js';

describe('DAGScheduler', () => {
  let scheduler: DAGScheduler;

  beforeEach(() => {
    scheduler = new DAGScheduler({ maxParallel: 2 });
  });

  it('should add tasks to the DAG', () => {
    const id = scheduler.addTask('Task 1', 'agent-1');
    expect(id).toBeDefined();
    expect(scheduler.getTasks().length).toBe(1);
  });

  it('should handle dependencies', () => {
    const task1 = scheduler.addTask('Task 1', 'agent-1');
    const task2 = scheduler.addTask('Task 2', 'agent-2', [task1]);

    expect(scheduler.getTasks().length).toBe(2);

    // Task 2 should not be ready until task 1 is completed
    const ready = scheduler.getReadyTasks();
    expect(ready.length).toBe(1);
    expect(ready[0].id).toBe(task1);
  });

  it('should mark tasks as running', () => {
    const id = scheduler.addTask('Task 1', 'agent-1');
    scheduler.markRunning(id);

    const summary = scheduler.getSummary();
    expect(summary.running).toBe(1);
  });

  it('should mark tasks as completed', () => {
    const id = scheduler.addTask('Task 1', 'agent-1');
    scheduler.markRunning(id);
    scheduler.markCompleted(id, 'Done');

    const summary = scheduler.getSummary();
    expect(summary.completed).toBe(1);
    expect(summary.running).toBe(0);
  });

  it('should mark tasks as failed', () => {
    const id = scheduler.addTask('Task 1', 'agent-1');
    scheduler.markRunning(id);
    scheduler.markFailed(id, 'Error');

    const summary = scheduler.getSummary();
    expect(summary.failed).toBe(1);
  });

  it('should detect completion', () => {
    const id = scheduler.addTask('Task 1', 'agent-1');
    scheduler.markRunning(id);
    scheduler.markCompleted(id, 'Done');

    expect(scheduler.isComplete()).toBe(true);
  });

  it('should calculate levels correctly', () => {
    const task1 = scheduler.addTask('Task 1', 'agent-1');
    const task2 = scheduler.addTask('Task 2', 'agent-2', [task1]);
    const task3 = scheduler.addTask('Task 3', 'agent-3', [task1]);
    const task4 = scheduler.addTask('Task 4', 'agent-4', [task2, task3]);

    const levels = scheduler.getLevels();
    expect(levels.length).toBe(3);
    expect(levels[0]).toContain(task1);
    expect(levels[1]).toContain(task2);
    expect(levels[1]).toContain(task3);
    expect(levels[2]).toContain(task4);
  });

  it('should respect max parallel limit', () => {
    const limitedScheduler = new DAGScheduler({ maxParallel: 1 });
    limitedScheduler.addTask('Task 1', 'agent-1');
    limitedScheduler.addTask('Task 2', 'agent-2');
    limitedScheduler.addTask('Task 3', 'agent-3');

    const ready = limitedScheduler.getReadyTasks();
    expect(ready.length).toBe(3); // All are ready, but only 1 should run at a time
  });
});
