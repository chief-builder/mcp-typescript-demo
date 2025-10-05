import { useState, useCallback, useRef, useEffect } from 'react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { 
  Server, 
  Database, 
  Wrench, 
  Brain, 
  Cloud,
  Play,
  Circle,
  AlertCircle,
  CheckCircle,
  Loader2,
  X
} from 'lucide-react';

interface ServerInfo {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  port: number;
  url: string;
}

interface Tool {
  name: string;
  description?: string;
}

interface Resource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

interface Prompt {
  name: string;
  description?: string;
}

const SERVERS: ServerInfo[] = [
  {
    id: 'dev-tools',
    name: 'Development Tools',
    description: 'Code formatting, file management, and development utilities',
    icon: Wrench,
    color: 'bg-blue-500',
    port: 3001,
    url: 'http://localhost:3001/mcp',
  },
  {
    id: 'analytics',
    name: 'Data Analytics',
    description: 'Data analysis, statistics, and sample data generation',
    icon: Database,
    color: 'bg-green-500',
    port: 3002,
    url: 'http://localhost:3002/mcp',
  },
  {
    id: 'cloud-ops',
    name: 'Cloud Operations',
    description: 'Infrastructure monitoring and deployment management',
    icon: Cloud,
    color: 'bg-purple-500',
    port: 3003,
    url: 'http://localhost:3003/mcp',
  },
  {
    id: 'knowledge',
    name: 'Knowledge Base',
    description: 'Document storage, search, and knowledge management',
    icon: Brain,
    color: 'bg-orange-500',
    port: 3004,
    url: 'http://localhost:3004/mcp',
  },
];

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

function App() {
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [client, setClient] = useState<Client | null>(null);
  const [transport, setTransport] = useState<StreamableHTTPClientTransport | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [activeTab, setActiveTab] = useState<'tools' | 'resources' | 'prompts'>('tools');
  const [output, setOutput] = useState<string>('MCP Web Client initialized...\n');
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [showToolModal, setShowToolModal] = useState(false);
  const [toolArguments, setToolArguments] = useState<Record<string, any>>({});
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceUri, setResourceUri] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptArguments, setPromptArguments] = useState<Record<string, any>>({});

  // Add log function
  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${type.toUpperCase()}: ${message}\n`;
    setOutput(prev => prev + logMessage);
  }, []);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Connect to MCP server
  const connectToServer = async (serverId: string) => {
    const serverInfo = SERVERS.find(s => s.id === serverId);
    if (!serverInfo) return;

    setConnectionStatus('connecting');
    setError(null);
    addLog(`Connecting to ${serverInfo.name}...`);
    
    try {
      // Create new client
      const newClient = new Client({
        name: 'mcp-web-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // Set up error handler
      newClient.onerror = (error) => {
        addLog(`Client error: ${error}`, 'error');
        setError(`Client error: ${error}`);
      };

      // Create transport
      const newTransport = new StreamableHTTPClientTransport(new URL(serverInfo.url));

      // Connect to server
      await newClient.connect(newTransport);
      
      setClient(newClient);
      setTransport(newTransport);
      setSelectedServer(serverId);
      setConnectionStatus('connected');
      
      addLog(`✅ Connected to ${serverInfo.name}`, 'success');

      // Load server capabilities
      await loadServerCapabilities(newClient);
      
    } catch (error) {
      setConnectionStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Failed to connect: ${errorMessage}`, 'error');
      setError(`Connection failed: ${errorMessage}`);
    }
  };

  // Load server capabilities
  const loadServerCapabilities = async (mcpClient: Client) => {
    try {
      addLog('Loading server capabilities...');
      
      // Load tools
      try {
        const toolsResponse = await mcpClient.listTools();
        setTools(toolsResponse.tools || []);
        addLog(`Loaded ${toolsResponse.tools?.length || 0} tools`);
      } catch (error) {
        addLog(`Failed to load tools: ${error}`, 'error');
        setTools([]);
      }

      // Load resources
      try {
        const resourcesResponse = await mcpClient.listResources();
        setResources(resourcesResponse.resources || []);
        addLog(`Loaded ${resourcesResponse.resources?.length || 0} resources`);
      } catch (error) {
        addLog(`Failed to load resources: ${error}`, 'error');
        setResources([]);
      }

      // Load prompts
      try {
        const promptsResponse = await mcpClient.listPrompts();
        setPrompts(promptsResponse.prompts || []);
        addLog(`Loaded ${promptsResponse.prompts?.length || 0} prompts`);
      } catch (error) {
        addLog(`Failed to load prompts: ${error}`, 'error');
        setPrompts([]);
      }

    } catch (error) {
      addLog(`Failed to load capabilities: ${error}`, 'error');
    }
  };

  // Disconnect from server
  const disconnectFromServer = async () => {
    if (transport && client) {
      try {
        await transport.close();
        addLog('Disconnected from server', 'info');
      } catch (error) {
        addLog(`Error during disconnect: ${error}`, 'error');
      }
    }
    
    setClient(null);
    setTransport(null);
    setSelectedServer(null);
    setConnectionStatus('disconnected');
    setTools([]);
    setResources([]);
    setPrompts([]);
    setError(null);
  };

  // Execute tool with user-provided arguments
  const executeTool = async (toolName: string, args?: Record<string, any>) => {
    if (!client) return;

    addLog(`Executing tool: ${toolName}...`);
    
    try {
      const response = await client.callTool({
        name: toolName,
        arguments: args || {}
      });

      addLog(`✅ Tool '${toolName}' executed successfully`, 'success');
      
      // Display tool result
      if (response.content && Array.isArray(response.content)) {
        response.content.forEach((item: any) => {
          if (item.type === 'text' && typeof item.text === 'string') {
            const fullText = item.text;
            addLog(`Tool result:`);
            addLog(`${fullText.substring(0, 300)}${fullText.length > 300 ? '...' : ''}`);
            if (fullText.length > 300) {
              addLog(`[Full result length: ${fullText.length} characters]`);
            }
          }
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Tool execution failed: ${errorMessage}`, 'error');
    }
  };

  // Read resource
  const readResource = async (uri: string, name?: string) => {
    if (!client) return;

    addLog(`Reading resource: ${name || uri}...`);
    
    try {
      const response = await client.readResource({ uri });
      
      addLog(`✅ Resource '${name || uri}' read successfully`, 'success');
      
      if (response.contents && Array.isArray(response.contents)) {
        response.contents.forEach((content: any) => {
          if (content.text && typeof content.text === 'string') {
            const fullText = content.text;
            addLog(`Resource content:`);
            addLog(`${fullText.substring(0, 400)}${fullText.length > 400 ? '...' : ''}`);
            if (fullText.length > 400) {
              addLog(`[Full content length: ${fullText.length} characters]`);
            }
          }
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Resource read failed: ${errorMessage}`, 'error');
    }
  };

  // Handle resource selection for custom URI input
  const handleResourceSelect = (resource: Resource) => {
    setSelectedResource(resource);
    setResourceUri(resource.uri);
    setShowResourceModal(true);
  };

  // Read resource with custom URI
  const readResourceWithCustomUri = async () => {
    if (!selectedResource || !resourceUri) return;
    
    await readResource(resourceUri, selectedResource.name);
    setSelectedResource(null);
    setResourceUri('');
    setShowResourceModal(false);
  };

  // Close resource modal
  const closeResourceModal = () => {
    setSelectedResource(null);
    setResourceUri('');
    setShowResourceModal(false);
  };

  // Get prompt with user-provided arguments
  const getPrompt = async (promptName: string, args?: Record<string, any>) => {
    if (!client) return;

    addLog(`Getting prompt: ${promptName}...`);
    
    try {
      const response = await client.getPrompt({
        name: promptName,
        arguments: args || {}
      });

      addLog(`✅ Prompt '${promptName}' retrieved successfully`, 'success');
      
      if (response.messages && Array.isArray(response.messages)) {
        response.messages.forEach((message: any, index: number) => {
          if (message.content?.text && typeof message.content.text === 'string') {
            // Show more of the prompt content
            const fullText = message.content.text;
            addLog(`Prompt message ${index + 1}:`);
            addLog(`${fullText.substring(0, 500)}${fullText.length > 500 ? '...' : ''}`);
            if (fullText.length > 500) {
              addLog(`[Full prompt length: ${fullText.length} characters]`);
            }
          }
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Prompt retrieval failed: ${errorMessage}`, 'error');
    }
  };

  /**
   * Example: Health check implementation for MCP servers
   * 
   * async function checkServerHealth(serverInfo: ServerInfo) {
   *   try {
   *     const healthUrl = `http://localhost:${serverInfo.port}/health`;
   *     const response = await fetch(healthUrl);
   *     return response.ok;
   *   } catch (error) {
   *     return false;
   *   }
   * }
   */

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'connecting':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-500" />;
    }
  };

  // Clear output
  const clearOutput = () => {
    setOutput('Output cleared.\n');
  };

  // Handle tool selection for argument input
  const handleToolSelect = (toolName: string) => {
    setSelectedTool(toolName);
    setShowToolModal(true);
    // Set default arguments based on tool
    const defaultArgs: Record<string, any> = {};
    
    // Development Tools Server
    if (toolName === 'format_code') {
      defaultArgs.code = 'function hello() {\n  console.log("Hello World");\n}';
      defaultArgs.language = 'javascript';
    } else if (toolName === 'create_file') {
      defaultArgs.path = '/tmp/demo.txt';
      defaultArgs.content = 'Hello from MCP Web Client!';
    } else if (toolName === 'read_file') {
      defaultArgs.filePath = 'README.md';
    } else if (toolName === 'list_project_files') {
      defaultArgs.projectPath = '.';
      defaultArgs.extensions = '.ts,.tsx,.js,.jsx';
    } else if (toolName === 'interactive_code_review') {
      defaultArgs.code = 'function hello() {\n  console.log("Hello World");\n}';
      defaultArgs.language = 'javascript';
    } else if (toolName === 'generate_documentation') {
      defaultArgs.code = 'function hello() {\n  console.log("Hello World");\n}';
      defaultArgs.language = 'javascript';
    } else if (toolName === 'scan_project') {
      defaultArgs.projectPath = '.';
      defaultArgs.scanType = 'quick';
    } else if (toolName === 'analyze_project') {
      defaultArgs.projectPath = '.';
    }
    // Analytics Server
    else if (toolName === 'generate_sample_data') {
      defaultArgs.format = 'json';
      defaultArgs.recordCount = 10;
    } else if (toolName === 'calculate_statistics') {
      defaultArgs.data = '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]';
      defaultArgs.measures = '["mean", "median", "std"]';
    } else if (toolName === 'analyze_csv') {
      defaultArgs.filePath = '/tmp/sample.csv';
    } else if (toolName === 'interactive_data_analysis') {
      defaultArgs.dataPath = '/tmp/sample.csv';
    } else if (toolName === 'export_data') {
      defaultArgs.data = '[{"id": 1, "name": "Item 1", "value": 100}, {"id": 2, "name": "Item 2", "value": 200}]';
      defaultArgs.format = 'json';
      defaultArgs.fileName = 'export_data.json';
    } else if (toolName === 'process_large_dataset') {
      defaultArgs.operation = 'aggregate';
      defaultArgs.dataPath = '/tmp/large_dataset.csv';
      defaultArgs.options = '{"groupBy": "category", "metric": "sum"}';
    }
    // Cloud Operations Server
    else if (toolName === 'check_service_health') {
      defaultArgs.serviceName = '';
      defaultArgs.environment = 'prod';
    } else if (toolName === 'deploy_service') {
      defaultArgs.serviceName = 'user-service';
      defaultArgs.version = '2.2.0';
      defaultArgs.environment = 'staging';
    } else if (toolName === 'scale_service') {
      defaultArgs.serviceName = 'api-gateway';
      defaultArgs.targetInstances = 3;
      defaultArgs.environment = 'prod';
    } else if (toolName === 'get_system_metrics') {
      defaultArgs.timeRange = '1h';
      defaultArgs.metrics = '["cpu", "memory"]';
    } else if (toolName === 'interactive_deployment_planner') {
      defaultArgs.serviceName = 'user-service';
      defaultArgs.targetEnvironment = 'staging';
    } else if (toolName === 'monitor_deployments') {
      defaultArgs.environment = 'prod';
      defaultArgs.limit = 10;
    } else if (toolName === 'rollback_deployment') {
      defaultArgs.serviceName = 'user-service';
      defaultArgs.environment = 'staging';
      defaultArgs.targetVersion = '2.1.0';
    } else if (toolName === 'manage_alerts') {
      defaultArgs.action = 'list';
      defaultArgs.alertType = 'critical';
    } else if (toolName === 'deploy_multi_service') {
      defaultArgs.services = '["user-service", "api-gateway", "notification-service"]';
      defaultArgs.environment = 'staging';
      defaultArgs.strategy = 'rolling';
    }
    // Knowledge Base Server
    else if (toolName === 'search_documents') {
      defaultArgs.query = 'MCP protocol';
      defaultArgs.limit = 5;
    } else if (toolName === 'get_document') {
      defaultArgs.documentId = 'doc-1';
    } else if (toolName === 'create_document') {
      defaultArgs.title = 'New Document';
      defaultArgs.content = 'This is a new document created via MCP web client.';
      defaultArgs.category = 'general';
      defaultArgs.tags = '["demo", "mcp", "web-client"]';
    } else if (toolName === 'add_document') {
      defaultArgs.title = 'New Document';
      defaultArgs.content = 'This is a new document added via MCP.';
      defaultArgs.category = 'general';
      defaultArgs.tags = '["demo", "mcp"]';
    } else if (toolName === 'update_document') {
      defaultArgs.documentId = 'doc-1';
      defaultArgs.title = 'Updated Document Title';
      defaultArgs.content = 'Updated content for the document.';
    } else if (toolName === 'delete_document') {
      defaultArgs.documentId = 'doc-1';
    } else if (toolName === 'bulk_knowledge_processing') {
      defaultArgs.operation = 'analyze';
      defaultArgs.targetScope = 'all';
    } else if (toolName === 'interactive_knowledge_curator') {
      defaultArgs.mode = 'analyze';
      defaultArgs.topic = 'MCP protocol documentation';
    }
    
    setToolArguments(defaultArgs);
  };

  // Execute tool with form arguments
  const executeToolWithArgs = async () => {
    if (!selectedTool) return;
    
    try {
      // Parse JSON arrays for specific fields
      const processedArgs = { ...toolArguments };
      
      if (selectedTool === 'calculate_statistics') {
        if (typeof processedArgs.data === 'string') {
          processedArgs.data = JSON.parse(processedArgs.data);
        }
        if (typeof processedArgs.measures === 'string') {
          processedArgs.measures = JSON.parse(processedArgs.measures);
        }
      } else if (selectedTool === 'export_data') {
        if (typeof processedArgs.data === 'string') {
          processedArgs.data = JSON.parse(processedArgs.data);
        }
      } else if (selectedTool === 'process_large_dataset') {
        if (typeof processedArgs.options === 'string') {
          processedArgs.options = JSON.parse(processedArgs.options);
        }
      } else if (selectedTool === 'deploy_multi_service') {
        if (typeof processedArgs.services === 'string') {
          processedArgs.services = JSON.parse(processedArgs.services);
        }
      } else if (selectedTool === 'get_system_metrics') {
        if (typeof processedArgs.metrics === 'string') {
          processedArgs.metrics = JSON.parse(processedArgs.metrics);
        }
      } else if (selectedTool === 'add_document' || selectedTool === 'create_document') {
        if (typeof processedArgs.tags === 'string') {
          processedArgs.tags = JSON.parse(processedArgs.tags);
        }
      }
      
      await executeTool(selectedTool, processedArgs);
      setSelectedTool(null);
      setToolArguments({});
      setShowToolModal(false);
    } catch (error) {
      addLog(`❌ Error parsing arguments: ${error}`, 'error');
    }
  };

  // Close tool modal
  const closeToolModal = () => {
    setSelectedTool(null);
    setToolArguments({});
    setShowToolModal(false);
  };

  // Handle prompt selection for argument input
  const handlePromptSelect = (promptName: string) => {
    setSelectedPrompt(promptName);
    setShowPromptModal(true);
    // Set default arguments based on prompt
    const defaultArgs: Record<string, any> = {};
    
    // Development Tools Server
    if (promptName === 'code_review') {
      defaultArgs.filePath = 'package.json';
    } else if (promptName === 'debug_session') {
      defaultArgs.errorMessage = 'TypeError: Cannot read property of undefined';
      defaultArgs.codeSnippet = 'const result = data.map(item => item.value);';
      defaultArgs.environment = 'development';
      defaultArgs.urgency = 'medium';
    } else if (promptName === 'test_strategy') {
      defaultArgs.feature = 'User authentication system';
      defaultArgs.codeType = 'api';
      defaultArgs.testingFramework = 'Jest';
      defaultArgs.coverage = 'comprehensive';
      defaultArgs.constraints = 'Must run in CI/CD pipeline under 5 minutes';
    }
    // Analytics Server
    else if (promptName === 'data_analysis_workflow') {
      defaultArgs.dataSource = '/tmp/sample.csv';
      defaultArgs.analysisType = 'exploratory';
      defaultArgs.questions = 'What are the main trends in the data?';
    } else if (promptName === 'visualization_request') {
      defaultArgs.dataDescription = 'Sales data with customer demographics and purchase behavior over the last 12 months';
      defaultArgs.audience = 'business';
      defaultArgs.purpose = 'presentation';
      defaultArgs.preferredCharts = 'bar chart, line graph, heat map';
    } else if (promptName === 'performance_review') {
      defaultArgs.systemType = 'dashboard';
      defaultArgs.timeframe = 'monthly';
      defaultArgs.stakeholders = 'business';
      defaultArgs.currentIssues = 'Slow loading times during peak hours, occasional timeout errors';
    }
    // Cloud Operations Server
    else if (promptName === 'incident_response') {
      defaultArgs.severity = 'high';
      defaultArgs.symptoms = 'Service is returning 500 errors and response times are very slow';
      defaultArgs.affectedServices = 'api-gateway,user-service';
    } else if (promptName === 'deployment_plan') {
      defaultArgs.serviceName = 'user-service';
      defaultArgs.version = '2.2.0';
      defaultArgs.targetEnvironment = 'staging';
      defaultArgs.deploymentType = 'feature';
      defaultArgs.strategy = 'blue-green';
    } else if (promptName === 'infrastructure_audit') {
      defaultArgs.auditScope = 'comprehensive';
      defaultArgs.environment = 'prod';
      defaultArgs.timeframe = 'quarterly';
      defaultArgs.complianceStandards = 'SOC2, ISO27001, PCI-DSS';
    }
    // Knowledge Base Server  
    else if (promptName === 'research_topic') {
      defaultArgs.topic = 'Model Context Protocol';
      defaultArgs.depth = 'comprehensive';
      defaultArgs.focus = 'technical implementation';
    } else if (promptName === 'research_assistant') {
      defaultArgs.topic = 'Model Context Protocol';
      defaultArgs.depth = 'comprehensive';
      defaultArgs.focus = 'technical implementation';
    } else if (promptName === 'concept_explanation') {
      defaultArgs.concept = 'Model Context Protocol';
      defaultArgs.audienceLevel = 'intermediate';
      defaultArgs.format = 'overview';
    } else if (promptName === 'learning_path') {
      defaultArgs.subject = 'Model Context Protocol';
      defaultArgs.currentLevel = 'some-experience';
      defaultArgs.learningGoal = 'professional';
      defaultArgs.timeCommitment = 'regular';
      defaultArgs.learningStyle = 'mixed';
    }
    
    setPromptArguments(defaultArgs);
  };

  // Execute prompt with form arguments
  const executePromptWithArgs = async () => {
    if (!selectedPrompt) return;
    
    await getPrompt(selectedPrompt, promptArguments);
    setSelectedPrompt(null);
    setPromptArguments({});
    setShowPromptModal(false);
  };

  // Close prompt modal
  const closePromptModal = () => {
    setSelectedPrompt(null);
    setPromptArguments({});
    setShowPromptModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">MCP Web Client</h1>
          <p className="text-gray-600">
            Connect to Model Context Protocol servers and explore their capabilities
          </p>
        </header>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <span className="font-medium">
                {connectionStatus === 'connected' && selectedServer
                  ? `Connected to ${SERVERS.find(s => s.id === selectedServer)?.name}`
                  : connectionStatus === 'connecting'
                  ? 'Connecting...'
                  : connectionStatus === 'error'
                  ? 'Connection Error'
                  : 'Not Connected'
                }
              </span>
              {transport?.sessionId && (
                <span className="text-sm text-gray-500">
                  Session: {transport.sessionId.substring(0, 8)}...
                </span>
              )}
            </div>
            {connectionStatus === 'connected' && (
              <button
                onClick={disconnectFromServer}
                className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4 mr-2" />
                Disconnect
              </button>
            )}
          </div>
          {error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Servers */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Server className="w-5 h-5 mr-2" />
                Available Servers
              </h2>
              <div className="space-y-3">
                {SERVERS.map((server) => {
                  const IconComponent = server.icon;
                  return (
                    <div
                      key={server.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${server.color}`}>
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{server.name}</h3>
                          <p className="text-sm text-gray-600 mb-2">{server.description}</p>
                          <p className="text-xs text-gray-500 mb-3">Port: {server.port}</p>
                          <button
                            onClick={() => connectToServer(server.id)}
                            disabled={connectionStatus === 'connecting' || (connectionStatus === 'connected' && selectedServer === server.id)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            {selectedServer === server.id ? 'Connected' : 'Connect'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Output Console */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Console Output</h2>
                <button
                  onClick={clearOutput}
                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
                <pre ref={outputRef} className="whitespace-pre-wrap h-full overflow-y-auto">{output}</pre>
              </div>
            </div>
          </div>

          {/* Right Panel - Server Capabilities */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Server Capabilities</h2>
            
            {connectionStatus === 'connected' ? (
              <>
                {/* Tabs */}
                <div className="flex space-x-1 mb-4">
                  {(['tools', 'resources', 'prompts'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                        activeTab === tab
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tab} ({tab === 'tools' ? tools.length : tab === 'resources' ? resources.length : prompts.length})
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {activeTab === 'tools' && (
                    <div>
                      {tools.length > 0 ? (
                        <>
                          {tools.map((tool) => (
                            <div key={tool.name} className="border rounded-lg p-3 mb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium">{tool.name}</h4>
                                  <p className="text-sm text-gray-600">{tool.description}</p>
                                </div>
                                <button
                                  onClick={() => handleToolSelect(tool.name)}
                                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors ml-2"
                                >
                                  Configure
                                </button>
                              </div>
                            </div>
                          ))}
                          
                        </>
                      ) : (
                        <p className="text-gray-500">No tools available</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'resources' && (
                    <div>
                      {resources.length > 0 ? (
                        <>
                          {resources.map((resource) => (
                            <div key={resource.uri} className="border rounded-lg p-3 mb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium">{resource.name || 'Unnamed Resource'}</h4>
                                  <p className="text-sm text-gray-600">{resource.description}</p>
                                  <code className="text-xs bg-gray-100 px-1 rounded">{resource.uri}</code>
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => readResource(resource.uri, resource.name)}
                                    className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition-colors"
                                  >
                                    Read
                                  </button>
                                  <button
                                    onClick={() => handleResourceSelect(resource)}
                                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                                  >
                                    Custom
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                        </>
                      ) : (
                        <p className="text-gray-500">No resources available</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'prompts' && (
                    <div>
                      {prompts.length > 0 ? (
                        <>
                          {prompts.map((prompt) => (
                            <div key={prompt.name} className="border rounded-lg p-3 mb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium">{prompt.name}</h4>
                                  <p className="text-sm text-gray-600">{prompt.description}</p>
                                </div>
                                <button
                                  onClick={() => handlePromptSelect(prompt.name)}
                                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors ml-2"
                                >
                                  Configure
                                </button>
                              </div>
                            </div>
                          ))}
                          
                        </>
                      ) : (
                        <p className="text-gray-500">No prompts available</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Connect to a server to view its capabilities</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tool Configuration Modal */}
      {showToolModal && selectedTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Configure: {selectedTool}</h3>
                <button
                  onClick={closeToolModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                {Object.entries(toolArguments).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </label>
                    {key === 'code' ? (
                      <textarea
                        value={value as string}
                        onChange={(e) => setToolArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={6}
                        placeholder={`Enter ${key}...`}
                      />
                    ) : key === 'language' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setToolArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="javascript">JavaScript</option>
                        <option value="typescript">TypeScript</option>
                        <option value="json">JSON</option>
                        <option value="css">CSS</option>
                        <option value="html">HTML</option>
                        <option value="markdown">Markdown</option>
                      </select>
                    ) : key === 'format' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setToolArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                      </select>
                    ) : (
                      <input
                        type={key === 'recordCount' ? 'number' : 'text'}
                        value={value as string}
                        onChange={(e) => setToolArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Enter ${key}...`}
                      />
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={closeToolModal}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeToolWithArgs}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Execute Tool
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resource Configuration Modal */}
      {showResourceModal && selectedResource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Configure Resource: {selectedResource.name || 'Custom Resource'}</h3>
                <button
                  onClick={closeResourceModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resource URI
                  </label>
                  <input
                    type="text"
                    value={resourceUri}
                    onChange={(e) => setResourceUri(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter custom resource URI..."
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Modify the URI to read different resources or parameters
                  </p>
                </div>
                
                {selectedResource.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                      {selectedResource.description}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={closeResourceModal}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={readResourceWithCustomUri}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  Read Resource
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Configuration Modal */}
      {showPromptModal && selectedPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Configure Prompt: {selectedPrompt}</h3>
                <button
                  onClick={closePromptModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                {Object.entries(promptArguments).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                    </label>
                    {key === 'analysisType' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="exploratory">Exploratory</option>
                        <option value="statistical">Statistical</option>
                        <option value="trend">Trend</option>
                        <option value="comparative">Comparative</option>
                      </select>
                    ) : key === 'questions' || key === 'symptoms' || key === 'codeSnippet' || key === 'constraints' || key === 'dataDescription' || key === 'currentIssues' || key === 'preferredCharts' ? (
                      <textarea
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        rows={4}
                        placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}...`}
                      />
                    ) : key === 'severity' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    ) : key === 'strategy' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="blue-green">Blue-Green</option>
                        <option value="rolling">Rolling</option>
                        <option value="canary">Canary</option>
                        <option value="recreate">Recreate</option>
                      </select>
                    ) : key === 'depth' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="basic">Basic</option>
                        <option value="comprehensive">Comprehensive</option>
                        <option value="detailed">Detailed</option>
                        <option value="expert">Expert</option>
                      </select>
                    ) : key === 'codeType' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="function">Function</option>
                        <option value="class">Class</option>
                        <option value="module">Module</option>
                        <option value="api">API</option>
                        <option value="ui">UI</option>
                        <option value="integration">Integration</option>
                      </select>
                    ) : key === 'coverage' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="basic">Basic</option>
                        <option value="comprehensive">Comprehensive</option>
                        <option value="edge-cases">Edge Cases</option>
                      </select>
                    ) : key === 'urgency' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    ) : key === 'environment' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        {selectedPrompt === 'infrastructure_audit' ? (
                          <>
                            <option value="dev">Development</option>
                            <option value="staging">Staging</option>
                            <option value="prod">Production</option>
                            <option value="all">All Environments</option>
                          </>
                        ) : (
                          <>
                            <option value="development">Development</option>
                            <option value="staging">Staging</option>
                            <option value="production">Production</option>
                          </>
                        )}
                      </select>
                    ) : key === 'audience' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="technical">Technical</option>
                        <option value="business">Business</option>
                        <option value="general">General</option>
                        <option value="academic">Academic</option>
                      </select>
                    ) : key === 'purpose' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="exploration">Exploration</option>
                        <option value="presentation">Presentation</option>
                        <option value="dashboard">Dashboard</option>
                        <option value="report">Report</option>
                      </select>
                    ) : key === 'systemType' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="dashboard">Dashboard</option>
                        <option value="reports">Reports</option>
                        <option value="etl">ETL</option>
                        <option value="database">Database</option>
                        <option value="api">API</option>
                      </select>
                    ) : key === 'timeframe' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        {selectedPrompt === 'infrastructure_audit' ? (
                          <>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="annual">Annual</option>
                          </>
                        ) : (
                          <>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                          </>
                        )}
                      </select>
                    ) : key === 'stakeholders' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="technical">Technical</option>
                        <option value="business">Business</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    ) : key === 'targetEnvironment' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="dev">Development</option>
                        <option value="staging">Staging</option>
                        <option value="prod">Production</option>
                      </select>
                    ) : key === 'deploymentType' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="feature">Feature</option>
                        <option value="hotfix">Hotfix</option>
                        <option value="major">Major</option>
                        <option value="rollback">Rollback</option>
                      </select>
                    ) : key === 'auditScope' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="security">Security</option>
                        <option value="performance">Performance</option>
                        <option value="compliance">Compliance</option>
                        <option value="comprehensive">Comprehensive</option>
                      </select>
                    ) : key === 'audienceLevel' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    ) : key === 'format' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="tutorial">Tutorial</option>
                        <option value="reference">Reference</option>
                        <option value="overview">Overview</option>
                        <option value="deep-dive">Deep Dive</option>
                      </select>
                    ) : key === 'currentLevel' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="complete-beginner">Complete Beginner</option>
                        <option value="some-experience">Some Experience</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    ) : key === 'learningGoal' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="foundational">Foundational</option>
                        <option value="professional">Professional</option>
                        <option value="expert">Expert</option>
                        <option value="teaching">Teaching</option>
                      </select>
                    ) : key === 'timeCommitment' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="casual">Casual</option>
                        <option value="regular">Regular</option>
                        <option value="intensive">Intensive</option>
                        <option value="immersive">Immersive</option>
                      </select>
                    ) : key === 'learningStyle' ? (
                      <select
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="theoretical">Theoretical</option>
                        <option value="practical">Practical</option>
                        <option value="project-based">Project Based</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={value as string}
                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}...`}
                      />
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={closePromptModal}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executePromptWithArgs}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Get Prompt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;