import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Wrench, Loader2, AlertCircle, CheckCircle, Sparkles, Brain } from 'lucide-react';
import ElicitationModal from './components/ElicitationModal';
import ProviderDropdown from './components/ProviderDropdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: string[];
  isLoading?: boolean;
  isError?: boolean;
  provider?: string;
  isStreaming?: boolean;
}

interface Provider {
  name: string;
  type: string;
  isDefault: boolean;
}

const CHAT_SERVER_URL = 'http://localhost:4000';

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m ready to assist you with development tools through MCP. I can help you format code, create files, and analyze projects. What would you like me to help you with?',
      timestamp: new Date(),
      provider: 'claude'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [currentProvider, setCurrentProvider] = useState('claude');
  const [useStreaming, setUseStreaming] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check connection status and fetch providers on mount
  useEffect(() => {
    checkConnectionStatus();
    fetchProviders();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch(`${CHAT_SERVER_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus('connected');
        // Update current provider from server
        if (data.current_provider) {
          setCurrentProvider(data.current_provider);
        }
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch(`${CHAT_SERVER_URL}/providers`);
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
        if (data.current) {
          setCurrentProvider(data.current);
        }
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  };

  const switchProvider = async (providerName: string) => {
    try {
      const response = await fetch(`${CHAT_SERVER_URL}/providers/${providerName}/select`, {
        method: 'POST'
      });
      if (response.ok) {
        setCurrentProvider(providerName);
        // Add a system message about provider switch
        const systemMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Switched to ${providerName.toUpperCase()} provider.`,
          timestamp: new Date(),
          provider: providerName
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    } catch (error) {
      console.error('Failed to switch provider:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Add loading message for Claude
    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      if (useStreaming) {
        // Streaming response
        const response = await fetch(`${CHAT_SERVER_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage.content,
            provider: currentProvider,
            stream: true
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Update loading message to streaming
        setMessages(prev => prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { ...msg, isStreaming: true, isLoading: false, content: '', provider: currentProvider }
            : msg
        ));

        // Process streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          let buffer = '';
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              
              for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i];
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    setMessages(prev => prev.map(msg => 
                      msg.id === loadingMessage.id 
                        ? { ...msg, isStreaming: false }
                        : msg
                    ));
                    continue;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.content) {
                      setMessages(prev => prev.map(msg => 
                        msg.id === loadingMessage.id 
                          ? { ...msg, content: msg.content + parsed.content }
                          : msg
                      ));
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
              
              buffer = lines[lines.length - 1];
            }
          } finally {
            reader.releaseLock();
          }
        }
      } else {
        // Regular response
        const response = await fetch(`${CHAT_SERVER_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage.content,
            provider: currentProvider,
            stream: false
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Replace loading message with actual response
        setMessages(prev => prev.map(msg => 
          msg.id === loadingMessage.id 
            ? {
                ...msg,
                content: data.response,
                isLoading: false,
                timestamp: new Date(data.timestamp),
                provider: data.provider || currentProvider
              }
            : msg
        ));
      }

    } catch (error) {
      console.error('Chat error:', error);
      
      // Replace loading message with error message
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id 
          ? {
              ...msg,
              content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              isLoading: false,
              isError: true
            }
          : msg
      ));
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected to chat server';
      case 'error':
        return 'Server error';
      default:
        return 'Disconnected from chat server';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Bot className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">AI Chat</h1>
            </div>
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <Wrench className="w-4 h-4" />
              <span>MCP Development Tools</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 text-sm">
            {getStatusIcon()}
            <span className={`${
              connectionStatus === 'connected' ? 'text-green-600' : 
              connectionStatus === 'error' ? 'text-red-600' : 
              'text-gray-600'
            }`}>
              {getStatusText()}
            </span>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-6 chat-messages">
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-xs lg:max-w-md ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`flex-shrink-0 ${message.role === 'user' ? 'ml-3' : 'mr-3'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.role === 'user' 
                          ? 'bg-blue-500' 
                          : message.isError 
                            ? 'bg-red-500' 
                            : 'bg-gray-600'
                      }`}>
                        {message.role === 'user' ? (
                          <User className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>

                    {/* Message Content */}
                    <div className={`px-4 py-2 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : message.isError
                          ? 'bg-red-50 text-red-900 border border-red-200'
                          : 'bg-white text-gray-900 border border-gray-200'
                    }`}>
                      {message.isLoading ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Claude is thinking...</span>
                        </div>
                      ) : (
                        <div>
                          <span className="whitespace-pre-wrap">{message.content}</span>
                          {message.isStreaming && (
                            <span className="inline-block w-0.5 h-4 bg-gray-400 animate-blink ml-0.5" />
                          )}
                        </div>
                      )}
                      
                      {/* Tool calls indicator */}
                      {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="mt-2 flex items-center space-x-1 text-xs opacity-75">
                          <Wrench className="w-3 h-3" />
                          <span>Used tools: {message.toolCalls.join(', ')}</span>
                        </div>
                      )}
                      
                      {/* Timestamp and Provider */}
                      <div className={`text-xs mt-1 flex items-center justify-between ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        <span>{message.timestamp.toLocaleTimeString()}</span>
                        {message.role === 'assistant' && message.provider && (
                          <span className="flex items-center space-x-1">
                            {message.provider === 'openai' ? 
                              <Sparkles className="w-3 h-3" /> : 
                              <Brain className="w-3 h-3" />
                            }
                            <span className="text-xs">{message.provider}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 bg-white px-6 py-4">
            {/* Provider Selection and Options */}
            <div className="flex items-center justify-between mb-3">
              <ProviderDropdown
                providers={providers}
                currentProvider={currentProvider}
                onProviderChange={switchProvider}
                disabled={connectionStatus !== 'connected' || isTyping}
              />
              
              <label className="flex items-center space-x-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={useStreaming}
                  onChange={(e) => setUseStreaming(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={isTyping}
                />
                <span>Enable streaming</span>
              </label>
            </div>
            
            <div className="flex space-x-4">
              <div className="flex-1">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask Claude to help with development tasks... (e.g., 'Format this code' or 'Create a new file')"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                  disabled={isTyping || connectionStatus !== 'connected'}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isTyping || connectionStatus !== 'connected'}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isTyping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{isTyping ? 'Sending...' : 'Send'}</span>
              </button>
            </div>
            
            {connectionStatus !== 'connected' && (
              <div className="mt-2 text-sm text-amber-600">
                ⚠️ Chat server is not available. Make sure the chat-server is running on port 4000.
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Elicitation Modal */}
      <ElicitationModal chatServerUrl={CHAT_SERVER_URL} />
    </div>
  );
}

export default App;