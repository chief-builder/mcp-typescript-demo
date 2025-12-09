# Phase 3: MCP Tasks Implementation

## Objective

Implement MCP Tasks (SEP-1686) for long-running operations, allowing clients to track progress, query status, and retrieve results asynchronously. Tasks provide a new abstraction for operations that may take extended time to complete.

## Background

Tasks were introduced in MCP SDK 1.24.0 aligned with spec 2025-11-25. A Task represents a long-running operation with states:
- `working` - Task is in progress
- `input_required` - Task needs additional input (via elicitation)
- `completed` - Task finished successfully
- `failed` - Task encountered an error
- `cancelled` - Task was cancelled

## Candidate Tools for Task Conversion

### High Priority (Long-Running Operations)
| Server | Tool | Reason |
|--------|------|--------|
| cloud-ops | `deploy_service` | Deployment takes time |
| cloud-ops | `scale_service` | Scaling operations are async |
| analytics | `analyze_csv` | Large dataset analysis |
| dev-tools | `scan_project` | Project scanning can be slow |

### Medium Priority
| Server | Tool | Reason |
|--------|------|--------|
| knowledge | `search_documents` | Large knowledge base searches |
| analytics | `generate_sample_data` | Large dataset generation |

## Files to Modify

### Server Implementations
- `packages/servers/cloud-ops/src/index.ts` - Add Task support for deploy/scale
- `packages/servers/analytics/src/index.ts` - Add Task support for analyze_csv
- `packages/servers/dev-tools/src/index.ts` - Add Task support for scan_project

### New Task Manager
- `packages/core/src/tasks/TaskManager.ts` - Create shared task management utility
- `packages/core/src/tasks/types.ts` - Task type definitions
- `packages/core/src/index.ts` - Export task utilities

### Client Updates
- `packages/clients/cli/src/index.ts` - Add task polling support
- `packages/clients/web/src/App.tsx` - Add task status UI
- `packages/servers/chat-server/src/index.ts` - Handle task responses

## Implementation Pattern

### Server-Side Task Creation
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

server.tool(
  'deploy_service',
  'Deploy a service to the cluster',
  {
    serviceName: z.string(),
    version: z.string(),
  },
  async (params, { meta }) => {
    // Create a task for long-running operation
    const task = await server.createTask({
      title: `Deploying ${params.serviceName}`,
      status: 'working',
    });

    // Perform deployment asynchronously
    deployServiceAsync(params, task.id);

    // Return task reference
    return {
      content: [{ type: 'text', text: `Deployment started` }],
      _meta: { taskId: task.id }
    };
  }
);
```

### Task Progress Updates
```typescript
async function deployServiceAsync(params: any, taskId: string) {
  try {
    await server.updateTask(taskId, {
      status: 'working',
      progress: 25,
      message: 'Pulling container images...'
    });

    // ... deployment steps ...

    await server.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      result: { deployed: true, url: '...' }
    });
  } catch (error) {
    await server.updateTask(taskId, {
      status: 'failed',
      error: error.message
    });
  }
}
```

### Client-Side Task Polling
```typescript
async function waitForTask(client: Client, taskId: string) {
  while (true) {
    const status = await client.getTaskStatus(taskId);

    if (status.status === 'completed') {
      return status.result;
    }
    if (status.status === 'failed') {
      throw new Error(status.error);
    }
    if (status.status === 'cancelled') {
      throw new Error('Task was cancelled');
    }

    // Wait before polling again
    await new Promise(r => setTimeout(r, 1000));
  }
}
```

## Requirements

1. Create TaskManager utility in core package
2. Implement task creation for deploy_service, scale_service
3. Implement task creation for analyze_csv with large datasets
4. Implement task creation for scan_project
5. Add progress reporting for each task-enabled tool
6. Update CLI client to poll for task completion
7. Update web client to show task progress UI
8. Add task cancellation support

## Acceptance Criteria

- [ ] TaskManager utility created in @mcp-demo/core
- [ ] deploy_service returns task ID for async tracking
- [ ] scale_service returns task ID for async tracking
- [ ] analyze_csv uses tasks for datasets > 1000 rows
- [ ] scan_project uses tasks for large projects
- [ ] CLI client can poll and display task progress
- [ ] Web client shows task status and progress bar
- [ ] Tasks can be cancelled
- [ ] All existing tests pass + new task tests

## References

- [MCP Tasks Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [SDK 1.24.0 Release - Tasks](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v1.24.0)
