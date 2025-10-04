import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ElicitationRequest {
  id: string;
  message: string;
  schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  timestamp: number;
}

interface ElicitationModalProps {
  chatServerUrl: string;
}

const ElicitationModal: React.FC<ElicitationModalProps> = ({ chatServerUrl }) => {
  const [currentElicitation, setCurrentElicitation] = useState<ElicitationRequest | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Poll for new elicitation requests
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${chatServerUrl}/elicitations`);
        if (response.ok) {
          const data = await response.json();
          if (data.elicitations.length > 0) {
            // Get the newest elicitation
            const newest = data.elicitations[0];
            
            // Only update if this is a new elicitation (different ID)
            if (!currentElicitation || newest.id !== currentElicitation.id) {
              console.log('New elicitation detected:', newest.id);
              setCurrentElicitation(newest);
              
              // Initialize form data with defaults only for NEW elicitations
              const initialData: Record<string, any> = {};
              if (newest.schema.properties) {
                Object.entries(newest.schema.properties).forEach(([key, prop]: [string, any]) => {
                  if (prop.default !== undefined) {
                    initialData[key] = prop.default;
                  } else if (prop.type === 'boolean') {
                    initialData[key] = false;
                  } else if (prop.type === 'number') {
                    initialData[key] = prop.minimum || 1;
                  }
                });
              }
              setFormData(initialData);
            }
          } else if (currentElicitation) {
            // No elicitations found, clear current one
            setCurrentElicitation(null);
            setFormData({});
          }
        }
      } catch (error) {
        console.error('Failed to poll elicitations:', error);
      }
    }, 2000); // Poll every 2 seconds (less aggressive)

    return () => clearInterval(pollInterval);
  }, [chatServerUrl, currentElicitation]);

  const handleInputChange = (key: string, value: any) => {
    console.log('Form data changing:', key, '=', value);
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async (action: 'accept' | 'decline' | 'cancel') => {
    if (!currentElicitation) return;

    // Validate required fields if accepting
    if (action === 'accept' && currentElicitation.schema.required) {
      for (const field of currentElicitation.schema.required) {
        if (!formData[field] || formData[field] === '') {
          alert(`Please fill in the required field: ${field}`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const payload: any = { action };
      if (action === 'accept') {
        payload.content = formData;
      }

      const response = await fetch(
        `${chatServerUrl}/elicitations/${currentElicitation.id}/response`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (response.ok) {
        // Clear the current elicitation
        setCurrentElicitation(null);
        setFormData({});
      } else {
        console.error('Failed to submit response');
      }
    } catch (error) {
      console.error('Error submitting response:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFormField = (key: string, schema: any) => {
    const { type, title, description, enum: enumValues, enumNames, minimum, maximum } = schema;

    return (
      <div key={key} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {title || key}
          {currentElicitation?.schema.required?.includes(key) && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
        {description && (
          <p className="text-xs text-gray-500 mb-2">{description}</p>
        )}

        {enumValues ? (
          <select
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              currentElicitation?.schema.required?.includes(key) && (!formData[key] || formData[key] === '')
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300'
            }`}
            value={formData[key] || ''}
            onChange={(e) => handleInputChange(key, e.target.value)}
          >
            <option value="">Select...</option>
            {enumValues.map((value: string, index: number) => (
              <option key={value} value={value}>
                {enumNames?.[index] || value}
              </option>
            ))}
          </select>
        ) : type === 'boolean' ? (
          <div className="flex items-center">
            <input
              type="checkbox"
              id={key}
              checked={formData[key] || false}
              onChange={(e) => handleInputChange(key, e.target.checked)}
              className="mr-2"
            />
            <label htmlFor={key} className="text-sm">
              {formData[key] ? 'Yes' : 'No'}
            </label>
          </div>
        ) : type === 'number' || type === 'integer' ? (
          <input
            type="number"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              currentElicitation?.schema.required?.includes(key) && (!formData[key] || formData[key] === '')
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300'
            }`}
            value={formData[key] || ''}
            onChange={(e) => handleInputChange(key, Number(e.target.value))}
            min={minimum}
            max={maximum}
          />
        ) : (
          <input
            type="text"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              currentElicitation?.schema.required?.includes(key) && (!formData[key] || formData[key] === '')
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300'
            }`}
            value={formData[key] || ''}
            onChange={(e) => handleInputChange(key, e.target.value)}
          />
        )}
      </div>
    );
  };

  if (!currentElicitation) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Input Requested</h2>
            <button
              onClick={() => handleSubmit('cancel')}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSubmitting}
            >
              <X size={20} />
            </button>
          </div>

          <div className="mb-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">{currentElicitation.message}</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit('accept'); }}>
            {currentElicitation.schema.properties &&
              Object.entries(currentElicitation.schema.properties).map(([key, schema]) =>
                renderFormField(key, schema)
              )}

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Submitting...
                  </span>
                ) : (
                  <>
                    <CheckCircle size={16} className="mr-2" />
                    Accept
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => handleSubmit('decline')}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={isSubmitting}
              >
                <XCircle size={16} className="mr-2" />
                Decline
              </button>
            </div>
          </form>

          <div className="mt-4 text-xs text-gray-500">
            <AlertCircle size={12} className="inline mr-1" />
            Request ID: {currentElicitation.id}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElicitationModal;