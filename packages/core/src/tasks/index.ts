/**
 * MCP Task Management utilities
 *
 * Provides centralized task tracking for long-running operations
 * per MCP 2025-11-25 specification.
 */

export {
  TaskManager,
  type Task,
  type TaskManagerOptions,
  type TaskStatus,
  type TaskResult,
  type ProgressUpdate,
} from './TaskManager.js';
