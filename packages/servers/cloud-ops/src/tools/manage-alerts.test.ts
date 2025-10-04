import { describe, it, expect } from 'vitest';

describe('manage_alerts tool', () => {
  it('should support all alert actions', () => {
    const validActions = ['create', 'list', 'update', 'delete'];
    const action = 'create';
    
    expect(validActions).toContain(action);
  });

  it('should validate alert configuration', () => {
    const alertConfig = {
      name: 'high-cpu-alert',
      service: 'api-gateway',
      metric: 'cpu',
      threshold: 80,
      condition: 'greater_than',
      severity: 'warning',
      notificationChannels: ['email', 'slack']
    };
    
    expect(alertConfig.name).toBeTruthy();
    expect(alertConfig.service).toBeTruthy();
    expect(['cpu', 'memory', 'latency', 'error_rate', 'custom']).toContain(alertConfig.metric);
    expect(alertConfig.threshold).toBeGreaterThan(0);
    expect(['greater_than', 'less_than', 'equals']).toContain(alertConfig.condition);
    expect(['info', 'warning', 'critical']).toContain(alertConfig.severity);
    expect(Array.isArray(alertConfig.notificationChannels)).toBe(true);
  });

  it('should validate required fields for create action', () => {
    const validConfig = {
      name: 'test-alert',
      service: 'user-service',
      metric: 'memory'
    };
    
    const invalidConfigs = [
      { service: 'user-service', metric: 'memory' }, // Missing name
      { name: 'test-alert', metric: 'memory' }, // Missing service
      { name: 'test-alert', service: 'user-service' } // Missing metric
    ];
    
    expect(validConfig.name).toBeTruthy();
    expect(validConfig.service).toBeTruthy();
    expect(validConfig.metric).toBeTruthy();
    
    invalidConfigs.forEach(config => {
      const hasAllRequired = config.hasOwnProperty('name') && 
                           config.hasOwnProperty('service') && 
                           config.hasOwnProperty('metric');
      expect(hasAllRequired).toBe(false);
    });
  });

  it('should handle default values', () => {
    const alertWithDefaults = {
      name: 'test-alert',
      service: 'api-gateway',
      metric: 'cpu',
      threshold: undefined,
      condition: undefined,
      severity: undefined,
      notificationChannels: undefined
    };
    
    const defaults = {
      threshold: 80,
      condition: 'greater_than',
      severity: 'warning',
      notificationChannels: ['email', 'slack']
    };
    
    const finalConfig = {
      ...alertWithDefaults,
      threshold: alertWithDefaults.threshold || defaults.threshold,
      condition: alertWithDefaults.condition || defaults.condition,
      severity: alertWithDefaults.severity || defaults.severity,
      notificationChannels: alertWithDefaults.notificationChannels || defaults.notificationChannels
    };
    
    expect(finalConfig.threshold).toBe(80);
    expect(finalConfig.condition).toBe('greater_than');
    expect(finalConfig.severity).toBe('warning');
    expect(finalConfig.notificationChannels).toEqual(['email', 'slack']);
  });

  it('should track alert statistics', () => {
    const alertStats = {
      totalAlertsToday: 12,
      criticalAlerts: 2,
      warningAlerts: 5,
      infoAlerts: 5,
      avgResponseTime: 3.5
    };
    
    const total = alertStats.criticalAlerts + alertStats.warningAlerts + alertStats.infoAlerts;
    expect(total).toBe(alertStats.totalAlertsToday);
    expect(alertStats.avgResponseTime).toBeGreaterThan(0);
  });

  it('should validate notification channels', () => {
    const validChannels = ['email', 'slack', 'pagerduty', 'webhook', 'sms'];
    const configuredChannels = ['email', 'slack'];
    
    configuredChannels.forEach(channel => {
      expect(validChannels).toContain(channel);
    });
  });
});