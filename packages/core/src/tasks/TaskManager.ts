/**
 * TaskManager - Centralized task/progress management for MCP servers
 *
 * Provides a consistent interface for managing long-running operations
 * with progress tracking per MCP 2025-11-25 specification.
 */

import { z } from 'zod';
import { taskStatusSchema, taskResultSchema, progressUpdateSchema } from '../schemas/index.js';

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskResult = z.infer<typeof taskResultSchema>;
export type ProgressUpdate = z.infer<typeof progressUpdateSchema>;

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  progress: number;
  message?: string;
  result?: unknown;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskManagerOptions {
  /** Function to send notifications (typically baseServer.notification) */
  sendNotification?: (notification: { method: string; params: unknown }) => Promise<void>;
  /** Maximum number of completed tasks to keep in history */
  maxHistorySize?: number;
}

/**
 * TaskManager handles creation, tracking, and progress reporting for long-running operations.
 *
 * @example
 * ```typescript
 * const taskManager = new TaskManager({
 *   sendNotification: (n) => baseServer.notification(n)
 * });
 *
 * // Create a task
 * const task = taskManager.createTask('Processing data');
 *
 * // Update progress
 * await taskManager.updateProgress(task.id, progressToken, 50, 'Halfway done');
 *
 * // Complete the task
 * taskManager.completeTask(task.id, { data: 'result' });
 * ```
 */
export class TaskManager {
  private tasks = new Map<string, Task>();
  private activeProgressTokens = new Map<string | number, string>(); // token -> taskId
  private sendNotification?: (notification: { method: string; params: unknown }) => Promise<void>;
  private maxHistorySize: number;

  constructor(options: TaskManagerOptions = {}) {
    this.sendNotification = options.sendNotification;
    this.maxHistorySize = options.maxHistorySize ?? 100;
  }

  /**
   * Creates a new task for tracking a long-running operation
   */
  createTask(title: string, progressToken?: string | number): Task {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date();

    const task: Task = {
      id,
      title,
      status: 'working',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(id, task);

    if (progressToken !== undefined) {
      this.activeProgressTokens.set(progressToken, id);
    }

    return task;
  }

  /**
   * Gets a task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Gets all active (non-completed) tasks
   */
  getActiveTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(
      t => t.status === 'working' || t.status === 'input_required'
    );
  }

  /**
   * Gets task ID associated with a progress token
   */
  getTaskIdByToken(progressToken: string | number): string | undefined {
    return this.activeProgressTokens.get(progressToken);
  }

  /**
   * Checks if a progress token is still active (not cancelled)
   */
  isTokenActive(progressToken: string | number): boolean {
    return this.activeProgressTokens.has(progressToken);
  }

  /**
   * Updates task progress and optionally sends a notification
   */
  async updateProgress(
    taskId: string,
    progressToken: string | number | undefined,
    progress: number,
    message?: string
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.progress = Math.max(0, Math.min(100, progress));
    task.message = message;
    task.updatedAt = new Date();

    // Send progress notification if we have a token and notification function
    if (progressToken !== undefined && this.sendNotification && this.isTokenActive(progressToken)) {
      try {
        await this.sendNotification({
          method: 'notifications/progress',
          params: {
            progressToken,
            progress: task.progress,
            total: 100,
            message: message || task.title,
          },
        });
      } catch (error) {
        // Log error but don't fail the task
        console.error('Failed to send progress notification:', error);
      }
    }
  }

  /**
   * Marks a task as completed with an optional result
   */
  completeTask(taskId: string, result?: unknown): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'completed';
    task.progress = 100;
    task.result = result;
    task.updatedAt = new Date();

    // Clean up progress token
    this.cleanupTaskToken(taskId);
    this.pruneHistory();
  }

  /**
   * Marks a task as failed with an error message
   */
  failTask(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.error = error;
    task.updatedAt = new Date();

    this.cleanupTaskToken(taskId);
    this.pruneHistory();
  }

  /**
   * Cancels a task
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'cancelled';
    task.updatedAt = new Date();

    this.cleanupTaskToken(taskId);
    this.pruneHistory();
  }

  /**
   * Marks a task as requiring input (for elicitation)
   */
  setInputRequired(taskId: string, message?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'input_required';
    task.message = message;
    task.updatedAt = new Date();
  }

  /**
   * Resumes a task that was waiting for input
   */
  resumeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'input_required') return;

    task.status = 'working';
    task.updatedAt = new Date();
  }

  /**
   * Converts a task to a TaskResult object for schema validation
   */
  toTaskResult(taskId: string): TaskResult | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    return taskResultSchema.parse({
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      message: task.message,
      result: task.result,
      error: task.error,
    });
  }

  /**
   * Cleans up completed tasks when history limit is exceeded
   */
  private pruneHistory(): void {
    const completedTasks = Array.from(this.tasks.values())
      .filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    if (completedTasks.length > this.maxHistorySize) {
      const toRemove = completedTasks.slice(this.maxHistorySize);
      toRemove.forEach(t => this.tasks.delete(t.id));
    }
  }

  /**
   * Removes progress token association for a task
   */
  private cleanupTaskToken(taskId: string): void {
    for (const [token, id] of this.activeProgressTokens.entries()) {
      if (id === taskId) {
        this.activeProgressTokens.delete(token);
        break;
      }
    }
  }
}

export default TaskManager;
