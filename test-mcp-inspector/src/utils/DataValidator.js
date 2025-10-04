#!/usr/bin/env node

/**
 * Data Validator for MCP Inspector Testing
 * Validates MCP responses and test data
 */

export class DataValidator {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode || false,
      validateTimestamps: options.validateTimestamps !== false,
      validateResponseTimes: options.validateResponseTimes !== false,
      ...options
    };
    
    this.validationErrors = [];
    this.validationWarnings = [];
  }

  /**
   * Validate complete test results data structure
   */
  validateTestResults(testResults) {
    console.log('🔍 Validating test results data...');
    
    this.validationErrors = [];
    this.validationWarnings = [];
    
    try {
      if (!Array.isArray(testResults)) {
        this.addError('Test results must be an array');
        return this.getValidationResult();
      }

      testResults.forEach((server, index) => {
        this.validateServerResult(server, index);
      });

      const result = this.getValidationResult();
      console.log(`✅ Validation completed: ${result.errors.length} errors, ${result.warnings.length} warnings`);
      
      return result;
    } catch (error) {
      this.addError(`Validation failed: ${error.message}`);
      return this.getValidationResult();
    }
  }

  /**
   * Validate individual server test result
   */
  validateServerResult(server, index) {
    const context = `Server ${index + 1} (${server.serverName || 'unnamed'})`;
    
    // Required fields
    this.validateRequired(server, 'serverName', context);
    this.validateRequired(server, 'status', context);
    this.validateRequired(server, 'capabilities', context);
    
    // Status validation
    const validStatuses = ['completed', 'failed', 'unknown'];
    if (server.status && !validStatuses.includes(server.status)) {
      this.addError(`${context}: Invalid status '${server.status}'. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    // Timestamps
    if (this.options.validateTimestamps) {
      this.validateTimestamp(server.startTime, `${context} startTime`);
      if (server.endTime) {
        this.validateTimestamp(server.endTime, `${context} endTime`);
        this.validateTimeOrder(server.startTime, server.endTime, `${context} time order`);
      }
    }
    
    // Capabilities validation
    if (server.capabilities) {
      this.validateCapabilities(server.capabilities, context);
    }
    
    // Connection validation
    if (server.connection) {
      this.validateConnection(server.connection, context);
    }
    
    // Elicitation validation
    if (server.elicitation) {
      this.validateElicitation(server.elicitation, context);
    }
    
    // Progress notifications validation
    if (server.progressNotifications) {
      this.validateProgressNotifications(server.progressNotifications, context);
    }
    
    // Ping validation
    if (server.ping) {
      this.validatePing(server.ping, context);
    }
    
    // Errors validation
    if (server.errors) {
      this.validateErrorsList(server.errors, context);
    }
    
    // Screenshots validation
    if (server.screenshots) {
      this.validateScreenshots(server.screenshots, context);
    }
  }

  /**
   * Validate capabilities structure
   */
  validateCapabilities(capabilities, context) {
    const requiredCapabilities = ['tools', 'resources', 'prompts'];
    
    requiredCapabilities.forEach(capability => {
      if (!capabilities[capability]) {
        this.addError(`${context}: Missing capability '${capability}'`);
        return;
      }
      
      const cap = capabilities[capability];
      this.validateRequired(cap, 'expected', `${context} ${capability}`);
      this.validateRequired(cap, 'actual', `${context} ${capability}`);
      this.validateRequired(cap, 'tests', `${context} ${capability}`);
      
      // Validate counts
      if (typeof cap.expected !== 'number' || cap.expected < 0) {
        this.addError(`${context} ${capability}: expected must be a non-negative number`);
      }
      
      if (typeof cap.actual !== 'number' || cap.actual < 0) {
        this.addError(`${context} ${capability}: actual must be a non-negative number`);
      }
      
      // Validate tests array
      if (!Array.isArray(cap.tests)) {
        this.addError(`${context} ${capability}: tests must be an array`);
      } else {
        cap.tests.forEach((test, testIndex) => {
          this.validateTest(test, `${context} ${capability} test ${testIndex + 1}`);
        });
      }
      
      // Consistency check
      if (cap.tests && cap.tests.length !== cap.actual) {
        this.addWarning(`${context} ${capability}: tests array length (${cap.tests.length}) doesn't match actual count (${cap.actual})`);
      }
    });
  }

  /**
   * Validate individual test result
   */
  validateTest(test, context) {
    this.validateRequired(test, 'name', context);
    this.validateRequired(test, 'status', context);
    this.validateRequired(test, 'timestamp', context);
    
    // Status validation
    const validStatuses = ['success', 'failed', 'unknown'];
    if (test.status && !validStatuses.includes(test.status)) {
      this.addError(`${context}: Invalid status '${test.status}'. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    // Response time validation
    if (this.options.validateResponseTimes && test.responseTime !== null && test.responseTime !== undefined) {
      if (typeof test.responseTime !== 'number' || test.responseTime < 0) {
        this.addError(`${context}: responseTime must be a non-negative number`);
      } else if (test.responseTime > 300000) { // 5 minutes
        this.addWarning(`${context}: responseTime (${test.responseTime}ms) seems unusually high`);
      }
    }
    
    // Timestamp validation
    if (this.options.validateTimestamps) {
      this.validateTimestamp(test.timestamp, `${context} timestamp`);
    }
    
    // Error validation for failed tests
    if (test.status === 'failed' && !test.error) {
      this.addWarning(`${context}: Failed test should include error message`);
    }
  }

  /**
   * Validate connection result
   */
  validateConnection(connection, context) {
    this.validateRequired(connection, 'status', `${context} connection`);
    this.validateRequired(connection, 'timestamp', `${context} connection`);
    
    if (this.options.validateTimestamps) {
      this.validateTimestamp(connection.timestamp, `${context} connection timestamp`);
    }
  }

  /**
   * Validate elicitation result
   */
  validateElicitation(elicitation, context) {
    this.validateRequired(elicitation, 'supported', `${context} elicitation`);
    this.validateRequired(elicitation, 'tests', `${context} elicitation`);
    
    if (typeof elicitation.supported !== 'boolean') {
      this.addError(`${context} elicitation: supported must be a boolean`);
    }
    
    if (!Array.isArray(elicitation.tests)) {
      this.addError(`${context} elicitation: tests must be an array`);
    } else {
      elicitation.tests.forEach((test, testIndex) => {
        this.validateElicitationTest(test, `${context} elicitation test ${testIndex + 1}`);
      });
    }
  }

  /**
   * Validate elicitation test
   */
  validateElicitationTest(test, context) {
    this.validateRequired(test, 'toolName', context);
    this.validateRequired(test, 'status', context);
    this.validateRequired(test, 'timestamp', context);
    this.validateRequired(test, 'formHandled', context);
    
    if (typeof test.formHandled !== 'boolean') {
      this.addError(`${context}: formHandled must be a boolean`);
    }
    
    if (this.options.validateTimestamps) {
      this.validateTimestamp(test.timestamp, `${context} timestamp`);
    }
  }

  /**
   * Validate progress notifications result
   */
  validateProgressNotifications(progress, context) {
    this.validateRequired(progress, 'supported', `${context} progress`);
    this.validateRequired(progress, 'tests', `${context} progress`);
    
    if (typeof progress.supported !== 'boolean') {
      this.addError(`${context} progress: supported must be a boolean`);
    }
    
    if (!Array.isArray(progress.tests)) {
      this.addError(`${context} progress: tests must be an array`);
    }
  }

  /**
   * Validate ping result
   */
  validatePing(ping, context) {
    this.validateRequired(ping, 'status', `${context} ping`);
    this.validateRequired(ping, 'timestamp', `${context} ping`);
    
    if (this.options.validateTimestamps) {
      this.validateTimestamp(ping.timestamp, `${context} ping timestamp`);
    }
    
    if (this.options.validateResponseTimes && ping.responseTime !== null && ping.responseTime !== undefined) {
      if (typeof ping.responseTime !== 'number' || ping.responseTime < 0) {
        this.addError(`${context} ping: responseTime must be a non-negative number`);
      }
    }
  }

  /**
   * Validate errors list
   */
  validateErrorsList(errors, context) {
    if (!Array.isArray(errors)) {
      this.addError(`${context}: errors must be an array`);
      return;
    }
    
    errors.forEach((error, errorIndex) => {
      const errorContext = `${context} error ${errorIndex + 1}`;
      this.validateRequired(error, 'type', errorContext);
      this.validateRequired(error, 'message', errorContext);
      this.validateRequired(error, 'timestamp', errorContext);
      
      if (this.options.validateTimestamps) {
        this.validateTimestamp(error.timestamp, `${errorContext} timestamp`);
      }
    });
  }

  /**
   * Validate screenshots list
   */
  validateScreenshots(screenshots, context) {
    if (!Array.isArray(screenshots)) {
      this.addError(`${context}: screenshots must be an array`);
      return;
    }
    
    screenshots.forEach((screenshot, screenshotIndex) => {
      if (typeof screenshot !== 'string') {
        this.addError(`${context} screenshot ${screenshotIndex + 1}: must be a string path`);
      } else if (!screenshot.trim()) {
        this.addError(`${context} screenshot ${screenshotIndex + 1}: cannot be empty`);
      }
    });
  }

  /**
   * Validate MCP tool response data
   */
  validateToolResponse(responseData, toolName) {
    console.log(`🔍 Validating tool response for ${toolName}...`);
    
    this.validationErrors = [];
    this.validationWarnings = [];
    
    try {
      if (!responseData) {
        this.addError(`${toolName}: No response data received`);
        return this.getValidationResult();
      }
      
      // Check for expected MCP response structure
      if (responseData.extractedJson && Array.isArray(responseData.extractedJson)) {
        responseData.extractedJson.forEach((jsonData, index) => {
          this.validateMCPResponseStructure(jsonData, `${toolName} JSON response ${index + 1}`);
        });
      }
      
      // Validate basic response properties
      if (responseData.text && typeof responseData.text !== 'string') {
        this.addError(`${toolName}: response text must be a string`);
      }
      
      if (responseData.timestamp) {
        this.validateTimestamp(responseData.timestamp, `${toolName} response timestamp`);
      }
      
      return this.getValidationResult();
    } catch (error) {
      this.addError(`${toolName}: Validation failed - ${error.message}`);
      return this.getValidationResult();
    }
  }

  /**
   * Validate MCP response structure
   */
  validateMCPResponseStructure(data, context) {
    // Check for common MCP response patterns
    if (data.content && Array.isArray(data.content)) {
      data.content.forEach((content, index) => {
        if (content.type && typeof content.type !== 'string') {
          this.addError(`${context} content ${index + 1}: type must be a string`);
        }
        
        if (content.text !== undefined && typeof content.text !== 'string') {
          this.addError(`${context} content ${index + 1}: text must be a string`);
        }
      });
    }
    
    // Check for error responses
    if (data.error) {
      this.addWarning(`${context}: Response contains error - ${data.error.message || 'Unknown error'}`);
    }
    
    // Check for progress notifications
    if (data.progress !== undefined) {
      if (typeof data.progress !== 'number' || data.progress < 0 || data.progress > 100) {
        this.addError(`${context}: progress must be a number between 0 and 100`);
      }
    }
  }

  /**
   * Validate resource response data
   */
  validateResourceResponse(responseData, resourceName) {
    console.log(`🔍 Validating resource response for ${resourceName}...`);
    
    this.validationErrors = [];
    this.validationWarnings = [];
    
    try {
      if (!responseData) {
        this.addError(`${resourceName}: No response data received`);
        return this.getValidationResult();
      }
      
      // Resource-specific validation could be added here
      if (responseData.extractedJson) {
        responseData.extractedJson.forEach((jsonData, index) => {
          // Check for resource-specific structure
          if (jsonData.uri && typeof jsonData.uri !== 'string') {
            this.addError(`${resourceName} JSON ${index + 1}: uri must be a string`);
          }
          
          if (jsonData.mimeType && typeof jsonData.mimeType !== 'string') {
            this.addError(`${resourceName} JSON ${index + 1}: mimeType must be a string`);
          }
        });
      }
      
      return this.getValidationResult();
    } catch (error) {
      this.addError(`${resourceName}: Validation failed - ${error.message}`);
      return this.getValidationResult();
    }
  }

  /**
   * Helper method to validate required fields
   */
  validateRequired(obj, field, context) {
    if (obj[field] === undefined || obj[field] === null) {
      this.addError(`${context}: Missing required field '${field}'`);
    }
  }

  /**
   * Helper method to validate timestamps
   */
  validateTimestamp(timestamp, context) {
    if (!timestamp) {
      this.addError(`${context}: Missing timestamp`);
      return;
    }
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      this.addError(`${context}: Invalid timestamp format '${timestamp}'`);
    }
    
    // Check if timestamp is in the future (with some tolerance)
    const now = new Date();
    const tolerance = 60000; // 1 minute tolerance
    if (date.getTime() > now.getTime() + tolerance) {
      this.addWarning(`${context}: Timestamp is in the future`);
    }
  }

  /**
   * Helper method to validate time order
   */
  validateTimeOrder(startTime, endTime, context) {
    if (!startTime || !endTime) return;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    
    if (end.getTime() < start.getTime()) {
      this.addError(`${context}: End time is before start time`);
    }
  }

  /**
   * Add validation error
   */
  addError(message) {
    this.validationErrors.push({
      type: 'error',
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add validation warning
   */
  addWarning(message) {
    this.validationWarnings.push({
      type: 'warning',
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get validation result
   */
  getValidationResult() {
    return {
      isValid: this.validationErrors.length === 0,
      errors: [...this.validationErrors],
      warnings: [...this.validationWarnings],
      summary: {
        errorCount: this.validationErrors.length,
        warningCount: this.validationWarnings.length
      }
    };
  }

  /**
   * Reset validation state
   */
  reset() {
    this.validationErrors = [];
    this.validationWarnings = [];
  }
}

export default DataValidator;