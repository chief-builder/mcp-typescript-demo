# MCP TypeScript Demo - API Reference

## Overview

This document provides comprehensive API documentation for all MCP servers in the TypeScript demo project. Each server implements the Model Context Protocol (MCP) 2025-06-18 specification with Phase 2.1 features including resource subscriptions, progress notifications, and sampling capabilities.

## Table of Contents

1. [Knowledge Server](#knowledge-server)
2. [Development Tools Server](#development-tools-server)
3. [Analytics Server](#analytics-server)
4. [Cloud Operations Server](#cloud-operations-server)
5. [Common MCP Features](#common-mcp-features)

---

## Knowledge Server

**Purpose**: Manages a knowledge base with document storage, search, and AI-powered content curation.

### Capabilities

The Knowledge Server implements the following MCP capabilities:

```json
{
  "logging": {},
  "elicitation": {},
  "prompts": { "listChanged": true },
  "resources": { "subscribe": true, "listChanged": true },
  "sampling": {},
  "tools": { "listChanged": true },
  "completions": {}
}
```

**Capability Details:**
- **`logging`**: Supports structured logging with configurable levels
- **`elicitation`**: Interactive data collection from users via forms and prompts
- **`prompts`**: Provides AI-powered prompt templates with change notifications
  - `listChanged: true` - Server sends notifications when prompt list changes
- **`resources`**: Exposes data sources with subscription support
  - `subscribe: true` - Clients can subscribe to resource updates
  - `listChanged: true` - Server notifies when resource list changes
- **`sampling`**: AI-powered response generation and content assistance
- **`tools`**: Executable functions with change notifications
  - `listChanged: true` - Server sends notifications when tool list changes
- **`completions`**: Text completion and suggestion capabilities

### Tools

#### `search_documents`
Search through the knowledge base using keywords.

**Parameters:**
- `query` (string, required): Search query
- `category` (string, optional): Filter by category
- `tags` (array of strings, optional): Filter by tags
- `limit` (number, optional): Maximum results (1-50, default: 10)

**Request Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_documents",
    "arguments": {
      "query": "MCP protocol",
      "category": "documentation",
      "tags": ["tutorial", "getting-started"],
      "limit": 5
    }
  }
}
```

**Response Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "# Search Results for \"MCP protocol\"\n\nFound 3 documents:\n\n## 1. MCP Protocol Overview (98.1% match)\n**Category**: documentation\n**Tags**: mcp, protocol, overview\n**Author**: MCP Team\n**Updated**: 1/15/2024\n**Summary**: Introduction to the Model Context Protocol and its architecture\n[Document ID: doc-1]"
      }
    ],
    "metadata": {
      "query": "MCP protocol",
      "resultCount": 3,
      "totalMatches": 3,
      "filters": {
        "category": "documentation",
        "tags": ["tutorial", "getting-started"]
      }
    }
  }
}
```

#### `get_document`
Retrieve a specific document by ID.

**Parameters:**
- `documentId` (string, required): Document ID to retrieve
- `format` (string, optional): Output format (markdown, html, text, default: markdown)

#### `create_document`
Create a new document in the knowledge base.

**Parameters:**
- `title` (string, required): Document title
- `content` (string, required): Document content (Markdown supported)
- `category` (string, required): Document category
- `tags` (array of strings, required): Document tags
- `author` (string, optional): Document author
- `summary` (string, optional): Brief summary

#### `list_categories`
List all document categories with counts.

**Parameters:** None

#### `bulk_knowledge_processing`
Process multiple documents with progress reporting.

**Parameters:**
- `operation` (string, required): Operation type (analyze, enhance, categorize, validate)
- `targetScope` (string, required): Scope (all, category, tag, recent)
- `scopeValue` (string, optional): Value for scoped operations
- `batchSize` (number, optional): Batch size (1-50, default: 5)
- `includeValidation` (boolean, optional): Include validation (default: true)
- `enhancementLevel` (string, optional): Enhancement level (basic, detailed, comprehensive)

#### `test_elicitation`
Test elicitation functionality with quick response.

**Parameters:**
- `testType` (string, optional): Test type (simple, complex, default: simple)

#### `interactive_knowledge_curator`
Interactive tool for creating and organizing content.

**Parameters:**
- `mode` (string, required): Operation mode (create, organize, analyze)
- `initialTopic` (string, optional): Initial topic to work with

### Resources

#### `knowledge_base_stats`
- **URI**: `knowledge://stats/overview`
- **Description**: Overview statistics of the knowledge base
- **Type**: Text

#### `recent_documents`
- **URI**: `knowledge://documents/recent`
- **Description**: Recently added documents
- **Type**: JSON

#### `document_collections`
- **URI**: `knowledge://collections/list`
- **Description**: Organized collections by category and tags
- **Type**: JSON

#### `search_indices`
- **URI**: `knowledge://search/indices`
- **Description**: Search index status and analytics
- **Type**: JSON

### Prompts

#### `research_assistant`
Help research a topic using the knowledge base.

**Arguments:**
- `topic` (required): Research topic or question
- `depth` (optional): Research depth level
- `focusAreas` (optional): Specific focus areas

#### `concept_explanation`
Generate comprehensive explanations of technical concepts.

**Arguments:**
- `concept` (required): Concept to explain
- `audienceLevel` (required): Target audience skill level
- `format` (required): Explanation format
- `includeExamples` (optional): Include practical examples
- `relatedTopics` (optional): Related topics to connect

#### `learning_path`
Create structured learning paths for mastering topics.

**Arguments:**
- `subject` (required): Main subject to learn
- `currentLevel` (required): Current skill level
- `learningGoal` (required): Target learning goal
- `timeCommitment` (required): Available time commitment
- `learningStyle` (required): Preferred learning approach
- `deadline` (optional): Target completion timeframe

---

## Development Tools Server

**Purpose**: Provides development tools including code formatting, file management, and code analysis.

### Capabilities

```json
{
  "logging": {},
  "sampling": {},
  "elicitation": {},
  "prompts": { "listChanged": true },
  "resources": { "subscribe": true, "listChanged": true },
  "tools": { "listChanged": true },
  "completions": {}
}
```

### Tools

#### `format_code`
Format code using Prettier with language-specific support.

**Parameters:**
- `code` (string, required): Code to format
- `language` (string, required): Programming language
  - **Allowed values**:
    - `typescript`: TypeScript source code
    - `javascript`: JavaScript source code
    - `json`: JSON configuration or data files
    - `css`: Cascading Style Sheets
    - `html`: HTML markup
    - `markdown`: Markdown documentation
- `filePath` (string, optional): File path for config detection and format inference

#### `list_project_files`
List source code files with filtering options.

**Parameters:**
- `pattern` (string, optional): Glob pattern for file matching
  - **Default**: `"**/*.{ts,tsx,js,jsx,py,java,cpp,c,h}"`
  - **Example**: `"src/**/*.ts"` for TypeScript files only
- `exclude` (array of strings, optional): Patterns to exclude from search
  - **Example**: `["node_modules", "dist", "*.test.ts"]`
- `maxDepth` (number, optional): Maximum directory depth to search
  - **Range**: 1-10
  - **Default**: 5

#### `read_file`
Read file contents with syntax highlighting info.

**Parameters:**
- `filePath` (string, required): Path to the file to read
- `maxLines` (number, optional): Maximum number of lines to read
  - **Range**: 1-1000
  - **Default**: 100
- `startLine` (number, optional): Starting line number (1-based indexing)
  - **Minimum**: 1
  - **Default**: 1

#### `interactive_code_review`
Perform customized code review with user-specified criteria.

**Parameters:**
- `code` (string, required): Code to review
- `language` (string, required): Programming language for analysis
  - **Allowed values**:
    - `typescript`: TypeScript code review with type checking
    - `javascript`: JavaScript code review with ES6+ support
    - `python`: Python code review with PEP standards
    - `java`: Java code review with enterprise patterns

#### `generate_documentation`
Generate documentation for code using AI assistance.

**Parameters:**
- `code` (string, required): Code to document
- `language` (string, required): Programming language for documentation generation
  - **Allowed values**:
    - `typescript`: TypeScript with JSDoc and type annotations
    - `javascript`: JavaScript with JSDoc comments
    - `python`: Python with docstrings (Sphinx compatible)
    - `java`: Java with Javadoc comments
- `style` (string, optional): Documentation style and format
  - **Allowed values**:
    - `jsdoc`: JSDoc format with type annotations
    - `markdown`: Markdown documentation files
    - `detailed`: Comprehensive documentation with examples
  - **Default**: `jsdoc`

#### `scan_project`
Scan project files with progress reporting.

**Parameters:**
- `directory` (string, optional): Directory to scan (default: ".")
- `pattern` (string, optional): File pattern to search
- `maxFiles` (number, optional): Maximum files to scan (1-1000, default: 100)
- `scanType` (string, optional): Scan type (quick, detailed, default: quick)

### Resources

#### `project_config`
- **URI**: `devtools://config/project`
- **Description**: Project configuration files and settings
- **Type**: Text

#### `test_reports`
- **URI**: `devtools://reports/testing`
- **Description**: Recent test execution reports and coverage data
- **Type**: Text

#### `build_configs`
- **URI**: `devtools://config/build`
- **Description**: Build system configurations and optimization settings
- **Type**: Text

#### `code_metrics`
- **URI**: `devtools://metrics/code-quality`
- **Description**: Code quality metrics including complexity and technical debt
- **Type**: Text

### Prompts

#### `code_review`
Perform comprehensive code review with improvement suggestions.

**Arguments:**
- `filePath` (required): Path to file to review
- `reviewType` (optional): Type of code review
- `language` (optional): Programming language

#### `debug_session`
Get systematic debugging guidance for troubleshooting.

**Arguments:**
- `errorMessage` (required): Error message or issue description
- `codeSnippet` (optional): Relevant code snippet
- `environment` (optional): Environment where issue occurs
- `urgency` (optional): Issue urgency level

#### `test_strategy`
Design comprehensive testing strategies for code features.

**Arguments:**
- `feature` (required): Feature or functionality to test
- `codeType` (required): Type of code being tested
- `testingFramework` (optional): Preferred testing framework
- `coverage` (optional): Desired test coverage level
- `constraints` (optional): Any constraints or requirements

---

## Analytics Server

**Purpose**: Provides data analysis tools, statistical calculations, and data export capabilities.

### Capabilities

```json
{
  "logging": {},
  "elicitation": {},
  "prompts": { "listChanged": true },
  "resources": { "subscribe": true, "listChanged": true },
  "sampling": {},
  "tools": { "listChanged": true },
  "completions": {}
}
```

### Tools

#### `analyze_csv`
Analyze CSV file and provide statistical insights.

**Parameters:**
- `filePath` (string, required): Path to CSV file
- `columns` (array of strings, optional): Specific columns to analyze

#### `generate_sample_data`
Generate sample dataset for testing analytics.

**Parameters:**
- `format` (string, required): Output format for generated data
  - **Allowed values**:
    - `json`: JavaScript Object Notation format
    - `csv`: Comma-Separated Values format
- `recordCount` (number, optional): Number of records to generate
  - **Range**: 1-10,000
  - **Default**: 100
- `outputPath` (string, optional): Optional file path to save the generated data
  - **Example**: `"./sample-data.json"` or `"./data/output.csv"`

#### `calculate_statistics`
Calculate statistical measures for numeric data.

**Parameters:**
- `data` (array of numbers, required): Array of numeric values for statistical analysis
- `measures` (array of strings, optional): Statistical measures to calculate
  - **Allowed values**:
    - `mean`: Arithmetic average of the dataset
    - `median`: Middle value when data is sorted
    - `mode`: Most frequently occurring value(s)
    - `std`: Standard deviation (population)
    - `min`: Minimum value in the dataset
    - `max`: Maximum value in the dataset
    - `quartiles`: Q1, Q2, Q3 quartile values
  - **Default**: `["mean", "median", "std", "min", "max"]`

#### `interactive_data_analysis`
Interactive tool for comprehensive data analysis.

**Parameters:**
- `dataPath` (string, required): Path to data file or dataset identifier

#### `export_data`
Export analyzed data in various formats.

**Parameters:**
- `data` (array of objects, required): Data array to export
- `format` (string, required): Export format
  - **Allowed values**:
    - `json`: JavaScript Object Notation with pretty formatting
    - `csv`: Comma-Separated Values with headers
- `filename` (string, optional): Optional filename for the exported file
  - **Example**: `"analysis-results.json"` or `"data-export.csv"`

#### `process_large_dataset`
Process large dataset with progress reporting.

**Parameters:**
- `operation` (string, required): Processing operation (aggregate, transform, filter, sort, analyze)
- `recordCount` (number, optional): Records to process (100-50000, default: 1000)
- `batchSize` (number, optional): Processing batch size (10-1000, default: 100)
- `includeValidation` (boolean, optional): Include data validation (default: true)

### Resources

#### `sample_datasets`
- **URI**: `analytics://datasets/samples`
- **Description**: Pre-generated sample datasets for testing
- **Type**: Text

#### `datasets_catalog`
- **URI**: `analytics://datasets/catalog`
- **Description**: Catalog of available datasets for analysis
- **Type**: JSON

#### `recent_reports`
- **URI**: `analytics://reports/recent`
- **Description**: Recently generated analysis reports and insights
- **Type**: JSON

#### `saved_dashboards`
- **URI**: `analytics://dashboards/saved`
- **Description**: Saved analytics dashboards and visualizations
- **Type**: JSON

### Prompts

#### `data_analysis_workflow`
Guide through comprehensive data analysis process.

**Arguments:**
- `dataSource` (required): Path to data file or description
- `analysisType` (required): Type of analysis to perform
- `questions` (optional): Specific questions to investigate

#### `visualization_request`
Design effective data visualizations.

**Arguments:**
- `dataDescription` (required): Description of data to visualize
- `audience` (required): Target audience
- `purpose` (required): Purpose of visualization
- `dataSize` (optional): Approximate dataset size
- `constraints` (optional): Any constraints or requirements

#### `performance_review`
Comprehensive review of analytics performance and data quality.

**Arguments:**
- `systemType` (required): Type of analytics system to review
- `timeframe` (required): Performance review timeframe
- `primaryConcerns` (optional): Specific performance concerns
- `stakeholders` (required): Primary stakeholders for review

---

## Cloud Operations Server

**Purpose**: Manages cloud infrastructure, deployments, monitoring, and scaling operations.

### Capabilities

```json
{
  "logging": {},
  "elicitation": {},
  "prompts": { "listChanged": true },
  "resources": { "subscribe": true, "listChanged": true },
  "sampling": {},
  "tools": { "listChanged": true },
  "completions": {}
}
```

### Tools

#### `check_service_health`
Check health status of cloud services.

**Parameters:**
- `serviceName` (string, optional): Specific service to check health status
  - **Example**: `"api-gateway"`, `"user-service"`, `"payment-service"`
- `environment` (string, optional): Target environment for health check
  - **Allowed values**:
    - `dev`: Development environment
    - `staging`: Staging/testing environment
    - `prod`: Production environment

#### `deploy_service`
Deploy a service to specified environment.

**Parameters:**
- `serviceName` (string, required): Name of the service to deploy
- `version` (string, required): Version identifier to deploy
  - **Example**: `"2.1.0"`, `"v1.5.3"`, `"latest"`
- `environment` (string, required): Target deployment environment
  - **Allowed values**:
    - `dev`: Development environment
    - `staging`: Staging/pre-production environment
    - `prod`: Production environment
- `dryRun` (boolean, optional): Perform deployment simulation without actual changes
  - **Default**: `false`

#### `get_system_metrics`
Retrieve system performance metrics.

**Parameters:**
- `timeRange` (string, optional): Time range for metrics collection
  - **Allowed values**:
    - `5m`: Last 5 minutes
    - `1h`: Last 1 hour
    - `6h`: Last 6 hours
    - `24h`: Last 24 hours
    - `7d`: Last 7 days
  - **Default**: `1h`
- `metrics` (array of strings, optional): System metrics to retrieve
  - **Allowed values**:
    - `cpu`: CPU utilization percentage
    - `memory`: Memory usage and availability
    - `network`: Network I/O statistics
    - `disk`: Disk usage and I/O metrics
  - **Default**: `["cpu", "memory"]`

#### `interactive_deployment_planner`
Interactive tool for planning and executing deployments.

**Parameters:**
- `serviceName` (string, required): Name of service to deploy
- `currentVersion` (string, optional): Current version of service

#### `scale_service`
Scale a service up or down based on demand.

**Parameters:**
- `serviceName` (string, required): Name of service to scale
- `targetInstances` (number, required): Target number of instances
- `scaleType` (string, optional): Type of scaling (horizontal, vertical)
- `autoScaleConfig` (object, optional): Auto-scaling configuration

#### `manage_alerts`
Configure and manage monitoring alerts.

**Parameters:**
- `action` (string, required): Alert action (create, list, update, delete)
- `alertConfig` (object, optional): Alert configuration

#### `deploy_multi_service`
Deploy multiple services with progress reporting.

**Parameters:**
- `services` (array of strings, required): List of services to deploy (1-10)
- `environment` (string, optional): Target environment (default: staging)
- `strategy` (string, optional): Deployment strategy (rolling, blue-green, canary, default: rolling)
- `enableHealthChecks` (boolean, optional): Enable health checks (default: true)
- `timeout` (number, optional): Deployment timeout in seconds (30-1800, default: 300)

### Resources

#### `infrastructure_status`
- **URI**: `cloudops://status/infrastructure`
- **Description**: Real-time infrastructure status dashboard
- **Type**: Text

#### `infrastructure_state`
- **URI**: `cloudops://infrastructure/state`
- **Description**: Current infrastructure state and resource allocation
- **Type**: JSON

#### `deployment_history`
- **URI**: `cloudops://deployments/history`
- **Description**: Recent deployment history and release information
- **Type**: JSON

#### `service_metrics`
- **URI**: `cloudops://metrics/services`
- **Description**: Real-time service performance metrics and monitoring data
- **Type**: JSON

### Prompts

#### `incident_response`
Guide through incident response and troubleshooting.

**Arguments:**
- `severity` (required): Incident severity level
- `serviceName` (optional): Affected service name
- `symptoms` (required): Description of observed symptoms

#### `deployment_plan`
Create comprehensive deployment plans with risk assessment.

**Arguments:**
- `serviceName` (required): Name of service to deploy
- `targetEnvironment` (required): Target deployment environment
- `currentVersion` (optional): Current version of service
- `deploymentType` (required): Type of deployment
- `urgency` (optional): Deployment urgency level

#### `infrastructure_audit`
Comprehensive infrastructure audit covering security and performance.

**Arguments:**
- `auditScope` (required): Primary focus area for audit
- `environment` (required): Environment(s) to audit
- `timeframe` (required): Audit timeframe
- `complianceFramework` (optional): Specific compliance framework

---

## Common MCP Features

### Protocol Version
All servers implement MCP protocol version `2025-06-18` with full JSON-RPC 2.0 compliance.

### Phase 2.1 Features

#### Resource Subscriptions
All servers support resource subscriptions with automatic notifications when resources change:
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/list_changed",
  "params": {}
}
```

#### Progress Notifications
Long-running operations send progress notifications:
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "bulk-process-123",
    "progress": 50,
    "total": 100
  }
}
```

#### Sampling Capability
All servers include sampling capability for LLM-powered responses and AI assistance integrated with the MCP sampling interface.

#### Completion Support
The dev-tools server implements completion support for parameter suggestions:
```json
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "completion/complete",
  "params": {
    "ref": {
      "type": "ref/tool",
      "name": "format_code"
    },
    "argument": {
      "name": "language",
      "value": "ja"
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "completion": {
      "values": ["java", "javascript"],
      "total": 2,
      "hasMore": false
    }
  }
}
```

**Supported Completions:**
- `format_code` tool: Language parameter suggestions
- `generate_documentation` tool: Language and style parameter suggestions
- `interactive_code_review` tool: Language parameter suggestions

#### Pagination Support
List operations support pagination using cursor-based navigation:
```json
// Request with pagination
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "cursor": "eyJvZmZzZXQiOjEwfQ=="  // Base64 encoded cursor
  }
}

// Response with next cursor
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [...],
    "nextCursor": "eyJvZmZzZXQiOjIwfQ=="
  }
}
```

**Pagination Details:**
- Default page size: 10 items
- Cursor contains offset information
- `nextCursor` is null when no more items
- Supported on: `tools/list`, `resources/list`, `prompts/list`

#### Cancellation Handling
Servers support cancellation notifications for long-running operations:
```json
// Cancellation notification from client
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": "operation-123"
  }
}
```

**Cancellation Support:**
- Long-running tool executions can be cancelled
- Progress tracking operations respect cancellation
- Servers clean up resources on cancellation
- Particularly useful for: `bulk_knowledge_processing`, `process_large_dataset`, `deploy_multi_service`

### Logging
All servers support structured logging with configurable levels:
- `debug`: Detailed debugging information
- `info`: General operational messages
- `warn`: Warning conditions
- `error`: Error conditions

### Error Handling
Standardized JSON-RPC 2.0 error responses:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "parameter": "limit",
      "expected": "number between 1 and 50",
      "received": "0"
    }
  }
}
```

**Common Error Codes:**
- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error

### Transport Support
- **STDIO**: Default transport for command-line usage and local development
- **HTTP**: Web-based transport with CORS support for browser applications
- **SSE**: Server-Sent Events for real-time updates and streaming responses

### Authentication
- **STDIO**: No authentication required (local process communication)
- **HTTP/SSE**: Token-based authentication via `Authorization` header or query parameter

---

## Getting Started

1. **Choose a Server**: Select the appropriate server for your use case
2. **Initialize Connection**: Connect using your preferred transport method
3. **Explore Capabilities**: Use the `initialize` method to discover server capabilities
4. **List Available Tools**: Call `tools/list` to see available functionality
5. **Access Resources**: Use `resources/list` to discover available data sources
6. **Use Prompts**: Call `prompts/list` to see available AI-powered assistants

For detailed examples and tutorials, see the [Developer Guide](./DEVELOPER_GUIDE.md).