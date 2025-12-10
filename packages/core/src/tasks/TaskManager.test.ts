import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskManager } from './TaskManager.js';

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let mockNotify: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNotify = vi.fn().mockResolvedValue(undefined);
    taskManager = new TaskManager({
      sendNotification: mockNotify,
      maxHistorySize: 10,
    });
  });

  describe('createTask', () => {
    it('should create a task with unique ID', () => {
      const task = taskManager.createTask('Test Task');
      expect(task.id).toBeDefined();
      expect(task.id).toMatch(/^task-\d+-[a-z0-9]+$/);
    });

    it('should set initial status to working', () => {
      const task = taskManager.createTask('Test Task');
      expect(task.status).toBe('working');
    });

    it('should set initial progress to 0', () => {
      const task = taskManager.createTask('Test Task');
      expect(task.progress).toBe(0);
    });

    it('should set title correctly', () => {
      const task = taskManager.createTask('My Operation');
      expect(task.title).toBe('My Operation');
    });

    it('should register progress token', () => {
      const task = taskManager.createTask('Test Task', 'token-123');
      expect(taskManager.getTaskIdByToken('token-123')).toBe(task.id);
    });

    it('should check if token is active', () => {
      taskManager.createTask('Test Task', 'token-123');
      expect(taskManager.isTokenActive('token-123')).toBe(true);
      expect(taskManager.isTokenActive('non-existent')).toBe(false);
    });
  });

  describe('getTask', () => {
    it('should retrieve task by ID', () => {
      const created = taskManager.createTask('Test Task');
      const retrieved = taskManager.getTask(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent task', () => {
      const retrieved = taskManager.getTask('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getActiveTasks', () => {
    it('should return only active tasks', () => {
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      taskManager.completeTask(task1.id);

      const active = taskManager.getActiveTasks();
      expect(active).toHaveLength(1);
      expect(active[0]?.id).toBe(task2.id);
    });

    it('should include input_required tasks', () => {
      const task = taskManager.createTask('Task');
      taskManager.setInputRequired(task.id, 'Waiting for input');

      const active = taskManager.getActiveTasks();
      expect(active).toHaveLength(1);
      expect(active[0]?.status).toBe('input_required');
    });
  });

  describe('updateProgress', () => {
    it('should update task progress', async () => {
      const task = taskManager.createTask('Test Task', 'token-123');
      await taskManager.updateProgress(task.id, 'token-123', 50, 'Halfway done');

      const updated = taskManager.getTask(task.id);
      expect(updated?.progress).toBe(50);
      expect(updated?.message).toBe('Halfway done');
    });

    it('should clamp progress to 0-100 range', async () => {
      const task = taskManager.createTask('Test Task');

      await taskManager.updateProgress(task.id, undefined, -10);
      expect(taskManager.getTask(task.id)?.progress).toBe(0);

      await taskManager.updateProgress(task.id, undefined, 150);
      expect(taskManager.getTask(task.id)?.progress).toBe(100);
    });

    it('should send progress notification', async () => {
      const task = taskManager.createTask('Test Task', 'token-123');
      await taskManager.updateProgress(task.id, 'token-123', 50, 'Processing');

      expect(mockNotify).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-123',
          progress: 50,
          total: 100,
          message: 'Processing',
        },
      });
    });

    it('should not send notification without token', async () => {
      const task = taskManager.createTask('Test Task');
      await taskManager.updateProgress(task.id, undefined, 50, 'Processing');

      expect(mockNotify).not.toHaveBeenCalled();
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed', () => {
      const task = taskManager.createTask('Test Task');
      taskManager.completeTask(task.id, { data: 'result' });

      const updated = taskManager.getTask(task.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.progress).toBe(100);
      expect(updated?.result).toEqual({ data: 'result' });
    });

    it('should cleanup progress token', () => {
      const task = taskManager.createTask('Test Task', 'token-123');
      taskManager.completeTask(task.id);

      expect(taskManager.isTokenActive('token-123')).toBe(false);
    });
  });

  describe('failTask', () => {
    it('should mark task as failed', () => {
      const task = taskManager.createTask('Test Task');
      taskManager.failTask(task.id, 'Something went wrong');

      const updated = taskManager.getTask(task.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.error).toBe('Something went wrong');
    });
  });

  describe('cancelTask', () => {
    it('should mark task as cancelled', () => {
      const task = taskManager.createTask('Test Task');
      taskManager.cancelTask(task.id);

      const updated = taskManager.getTask(task.id);
      expect(updated?.status).toBe('cancelled');
    });

    it('should cleanup progress token', () => {
      const task = taskManager.createTask('Test Task', 'token-123');
      taskManager.cancelTask(task.id);

      expect(taskManager.isTokenActive('token-123')).toBe(false);
    });
  });

  describe('setInputRequired', () => {
    it('should mark task as input_required', () => {
      const task = taskManager.createTask('Test Task');
      taskManager.setInputRequired(task.id, 'Need user input');

      const updated = taskManager.getTask(task.id);
      expect(updated?.status).toBe('input_required');
      expect(updated?.message).toBe('Need user input');
    });
  });

  describe('resumeTask', () => {
    it('should resume task from input_required', () => {
      const task = taskManager.createTask('Test Task');
      taskManager.setInputRequired(task.id);
      taskManager.resumeTask(task.id);

      const updated = taskManager.getTask(task.id);
      expect(updated?.status).toBe('working');
    });

    it('should not resume task that is not input_required', () => {
      const task = taskManager.createTask('Test Task');
      taskManager.completeTask(task.id);
      taskManager.resumeTask(task.id);

      const updated = taskManager.getTask(task.id);
      expect(updated?.status).toBe('completed');
    });
  });

  describe('toTaskResult', () => {
    it('should convert task to TaskResult', () => {
      const task = taskManager.createTask('Test Task');
      taskManager.completeTask(task.id, { data: 'value' });

      const result = taskManager.toTaskResult(task.id);
      expect(result).toBeDefined();
      expect(result?.taskId).toBe(task.id);
      expect(result?.status).toBe('completed');
      expect(result?.progress).toBe(100);
      expect(result?.result).toEqual({ data: 'value' });
    });

    it('should return undefined for non-existent task', () => {
      const result = taskManager.toTaskResult('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('history pruning', () => {
    it('should limit stored completed tasks to maxHistorySize', () => {
      // Create a manager with small history size
      const smallManager = new TaskManager({ maxHistorySize: 5 });

      // Create and complete 10 tasks
      const taskIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const task = smallManager.createTask(`Task ${i}`);
        smallManager.completeTask(task.id, { index: i });
        taskIds.push(task.id);
      }

      // Count how many completed tasks still exist
      let completedCount = 0;
      for (const id of taskIds) {
        if (smallManager.getTask(id)) {
          completedCount++;
        }
      }

      // Should have at most maxHistorySize completed tasks
      expect(completedCount).toBeLessThanOrEqual(5);
    });

    it('should allow new tasks after pruning', () => {
      const smallManager = new TaskManager({ maxHistorySize: 3 });

      // Create and complete many tasks
      for (let i = 0; i < 10; i++) {
        const task = smallManager.createTask(`Task ${i}`);
        smallManager.completeTask(task.id);
      }

      // Should still be able to create and work with new tasks
      const newTask = smallManager.createTask('New Task');
      expect(newTask.id).toBeDefined();
      expect(newTask.status).toBe('working');

      // Verify working tasks are not affected by pruning
      const activeTasks = smallManager.getActiveTasks();
      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0]?.id).toBe(newTask.id);
    });
  });

  describe('without notification function', () => {
    it('should work without sendNotification', async () => {
      const manager = new TaskManager();
      const task = manager.createTask('Test Task', 'token-123');

      // Should not throw
      await manager.updateProgress(task.id, 'token-123', 50, 'Progress');
      expect(manager.getTask(task.id)?.progress).toBe(50);
    });
  });
});
