# Cloud Operations Server

MCP server providing cloud infrastructure monitoring and management capabilities.

## Features

### Tools
- **check_service_health**: Monitor health status of cloud services
- **deploy_service**: Deploy services to different environments with dry-run support
- **get_system_metrics**: Retrieve system performance metrics over time

### Resources
- **infrastructure_status**: Real-time infrastructure status dashboard

### Prompts
- **incident_response**: Guided incident response and troubleshooting workflow

## Usage

```bash
# Build the server
pnpm build

# Start the server
pnpm start

# Development mode
pnpm dev
```

## Testing with MCP Inspector

1. Build the server: `pnpm build`
2. Open MCP Inspector
3. Add server with command: `node packages/servers/cloud-ops/dist/index.js`
4. Test the tools, resources, and prompts

## Features

- **Service Health Monitoring**: Check status, uptime, CPU, and memory usage
- **Deployment Management**: Deploy services with version control and environment targeting
- **System Metrics**: Historical performance data with configurable time ranges
- **Incident Response**: Structured workflow for handling infrastructure issues
- **Real-time Updates**: Background monitoring with periodic status updates

## Dependencies

- **node-cron**: Scheduled monitoring tasks
- **child_process**: System command execution for real operations