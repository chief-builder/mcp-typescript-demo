import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Brain, Sparkles, Zap } from 'lucide-react';

interface Provider {
  name: string;
  type: string;
  isDefault: boolean;
}

interface ProviderDropdownProps {
  providers: Provider[];
  currentProvider: string;
  onProviderChange: (provider: string) => void;
  disabled?: boolean;
}

export default function ProviderDropdown({
  providers,
  currentProvider,
  onProviderChange,
  disabled = false
}: ProviderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getProviderIcon = (providerName: string) => {
    switch (providerName.toLowerCase()) {
      case 'openai':
        return <Sparkles className="w-4 h-4" />;
      case 'claude':
        return <Brain className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const getProviderLabel = (providerName: string) => {
    switch (providerName.toLowerCase()) {
      case 'openai':
        return 'OpenAI';
      case 'claude':
        return 'Claude';
      default:
        return providerName;
    }
  };

  const currentProviderData = providers.find(p => p.name === currentProvider);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || providers.length <= 1}
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-lg border
          ${disabled || providers.length <= 1 
            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500'
          }
        `}
      >
        {currentProviderData && (
          <>
            {getProviderIcon(currentProvider)}
            <span className="font-medium">{getProviderLabel(currentProvider)}</span>
            {providers.length > 1 && (
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            )}
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && providers.length > 1 && (
        <div className="absolute z-10 mt-2 w-56 rounded-lg bg-white shadow-lg border border-gray-200">
          <div className="py-1">
            {providers.map((provider) => (
              <button
                key={provider.name}
                onClick={() => {
                  onProviderChange(provider.name);
                  setIsOpen(false);
                }}
                className={`
                  w-full px-4 py-2 text-left flex items-center justify-between
                  hover:bg-gray-50 transition-colors
                  ${provider.name === currentProvider ? 'bg-blue-50' : ''}
                `}
              >
                <div className="flex items-center space-x-2">
                  {getProviderIcon(provider.name)}
                  <div>
                    <div className="font-medium text-gray-900">
                      {getProviderLabel(provider.name)}
                    </div>
                    {provider.isDefault && (
                      <div className="text-xs text-gray-500">Default</div>
                    )}
                  </div>
                </div>
                {provider.name === currentProvider && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>

          {/* Provider Info */}
          <div className="border-t border-gray-200 px-4 py-2">
            <div className="text-xs text-gray-500">
              {providers.length} provider{providers.length !== 1 ? 's' : ''} available
            </div>
          </div>
        </div>
      )}
    </div>
  );
}