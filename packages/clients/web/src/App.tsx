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
  const [toolArguments, setToolArguments] = useState<Record<string, any>>({});
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
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
  };

  // Read resource with custom URI
  const readResourceWithCustomUri = async () => {
    if (!selectedResource) return;
    
    await readResource(selectedResource.uri, selectedResource.name);
    setSelectedResource(null);
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
    // Set default arguments based on tool
    const defaultArgs: Record<string, any> = {};
    
    // Development Tools Server
    if (toolName === 'format_code') {
      defaultArgs.code = 'function hello() {\n  console.log("Hello World");\n}';
      defaultArgs.language = 'javascript';
    } else if (toolName === 'create_file') {
      defaultArgs.path = '/tmp/demo.txt';
      defaultArgs.content = 'Hello from MCP Web Client!';
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
      defaultArgs.instances = 3;
      defaultArgs.environment = 'prod';
    } else if (toolName === 'get_system_metrics') {
      defaultArgs.timeRange = '1h';
      defaultArgs.metrics = '["cpu", "memory"]';
    }
    // Knowledge Base Server
    else if (toolName === 'search_documents') {
      defaultArgs.query = 'MCP protocol';
      defaultArgs.limit = 5;
    } else if (toolName === 'get_document') {
      defaultArgs.documentId = 'doc-1';
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
      } else if (selectedTool === 'get_system_metrics') {
        if (typeof processedArgs.metrics === 'string') {
          processedArgs.metrics = JSON.parse(processedArgs.metrics);
        }
      } else if (selectedTool === 'add_document') {
        if (typeof processedArgs.tags === 'string') {
          processedArgs.tags = JSON.parse(processedArgs.tags);
        }
      }
      
      await executeTool(selectedTool, processedArgs);
      setSelectedTool(null);
      setToolArguments({});
    } catch (error) {
      addLog(`❌ Error parsing arguments: ${error}`, 'error');
    }
  };

  // Handle prompt selection for argument input
  const handlePromptSelect = (promptName: string) => {
    setSelectedPrompt(promptName);
    // Set default arguments based on prompt
    const defaultArgs: Record<string, any> = {};
    
    // Development Tools Server
    if (promptName === 'code_review') {
      defaultArgs.filePath = 'src/App.tsx';
    }
    // Analytics Server
    else if (promptName === 'data_analysis_workflow') {
      defaultArgs.dataSource = '/tmp/sample.csv';
      defaultArgs.analysisType = 'exploratory';
      defaultArgs.questions = 'What are the main trends in the data?';
    }
    // Cloud Operations Server
    else if (promptName === 'incident_response') {
      defaultArgs.severity = 'high';
      defaultArgs.symptoms = 'Service is returning 500 errors and response times are very slow';
      defaultArgs.affectedServices = 'api-gateway,user-service';
    } else if (promptName === 'deployment_plan') {
      defaultArgs.serviceName = 'user-service';
      defaultArgs.version = '2.2.0';
      defaultArgs.environment = 'production';
      defaultArgs.strategy = 'blue-green';
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
    }
    
    setPromptArguments(defaultArgs);
  };

  // Execute prompt with form arguments
  const executePromptWithArgs = async () => {
    if (!selectedPrompt) return;
    
    await getPrompt(selectedPrompt, promptArguments);
    setSelectedPrompt(null);
    setPromptArguments({});
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
                          
                          {/* Tool Arguments Form */}
                          {selectedTool && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <h3 className="font-medium mb-3 text-blue-900">Configure: {selectedTool}</h3>
                              <div className="space-y-3">
                                {Object.entries(toolArguments).map(([key, value]) => (
                                  <div key={key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      {key.charAt(0).toUpperCase() + key.slice(1)}
                                    </label>
                                    {key === 'code' ? (
                                      <textarea
                                        value={value as string}
                                        onChange={(e) => setToolArguments(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full p-2 border border-gray-300 rounded text-sm font-mono"
                                        rows={4}
                                        placeholder={`Enter ${key}...`}
                                      />
                                    ) : key === 'language' ? (
                                      <select
                                        value={value as string}
                                        onChange={(e) => setToolArguments(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
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
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                      >
                                        <option value="json">JSON</option>
                                        <option value="csv">CSV</option>
                                      </select>
                                    ) : (
                                      <input
                                        type={key === 'recordCount' ? 'number' : 'text'}
                                        value={value as string}
                                        onChange={(e) => setToolArguments(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        placeholder={`Enter ${key}...`}
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="flex space-x-2 mt-4">
                                <button
                                  onClick={executeToolWithArgs}
                                  className="px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
                                >
                                  Execute Tool
                                </button>
                                <button
                                  onClick={() => { setSelectedTool(null); setToolArguments({}); }}
                                  className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
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
                          
                          {/* Custom Resource URI Form */}
                          {selectedResource && (
                            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                              <h3 className="font-medium mb-3 text-purple-900">Custom Resource URI</h3>
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Resource URI
                                  </label>
                                  <input
                                    type="text"
                                    value={selectedResource.uri}
                                    onChange={(e) => setSelectedResource(prev => prev ? { ...prev, uri: e.target.value } : null)}
                                    className="w-full p-2 border border-gray-300 rounded text-sm font-mono"
                                    placeholder="Enter custom resource URI..."
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Modify the URI to read different resources or parameters
                                  </p>
                                </div>
                              </div>
                              <div className="flex space-x-2 mt-4">
                                <button
                                  onClick={readResourceWithCustomUri}
                                  className="px-4 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition-colors"
                                >
                                  Read Resource
                                </button>
                                <button
                                  onClick={() => setSelectedResource(null)}
                                  className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
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
                          
                          {/* Prompt Arguments Form */}
                          {selectedPrompt && (
                            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                              <h3 className="font-medium mb-3 text-orange-900">Configure: {selectedPrompt}</h3>
                              <div className="space-y-3">
                                {Object.entries(promptArguments).map(([key, value]) => (
                                  <div key={key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                                    </label>
                                    {key === 'analysisType' ? (
                                      <select
                                        value={value as string}
                                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                      >
                                        <option value="exploratory">Exploratory</option>
                                        <option value="statistical">Statistical</option>
                                        <option value="trend">Trend</option>
                                        <option value="comparative">Comparative</option>
                                      </select>
                                    ) : key === 'questions' ? (
                                      <textarea
                                        value={value as string}
                                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        rows={3}
                                        placeholder="Enter your analysis questions..."
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={value as string}
                                        onChange={(e) => setPromptArguments(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}...`}
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="flex space-x-2 mt-4">
                                <button
                                  onClick={executePromptWithArgs}
                                  className="px-4 py-2 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
                                >
                                  Get Prompt
                                </button>
                                <button
                                  onClick={() => { setSelectedPrompt(null); setPromptArguments({}); }}
                                  className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
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
    </div>
  );
}

export default App;