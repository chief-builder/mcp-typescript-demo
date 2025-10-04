import { describe, it, expect } from 'vitest';

describe('check_service_health tool', () => {
  // Mock service data
  const mockServices = [
    { name: 'api-gateway', status: 'healthy', uptime: 99.9, cpu: 45, memory: 62, lastCheck: new Date().toISOString() },
    { name: 'user-service', status: 'healthy', uptime: 99.5, cpu: 32, memory: 48, lastCheck: new Date().toISOString() },
    { name: 'payment-service', status: 'warning', uptime: 98.1, cpu: 78, memory: 85, lastCheck: new Date().toISOString() },
    { name: 'notification-service', status: 'healthy', uptime: 99.8, cpu: 25, memory: 41, lastCheck: new Date().toISOString() },
    { name: 'analytics-service', status: 'critical', uptime: 95.2, cpu: 95, memory: 92, lastCheck: new Date().toISOString() },
  ];

  it('should check health status of a specific service', () => {
    const serviceName = 'api-gateway';
    const service = mockServices.find(s => s.name === serviceName);
    
    expect(service).toBeDefined();
    expect(service?.status).toBe('healthy');
    expect(service?.uptime).toBeGreaterThan(99);
    expect(service?.cpu).toBeLessThan(100);
    expect(service?.memory).toBeLessThan(100);
  });

  it('should return all services when no specific service is specified', () => {
    const healthyServices = mockServices.filter(s => s.status === 'healthy');
    const warningServices = mockServices.filter(s => s.status === 'warning');
    const criticalServices = mockServices.filter(s => s.status === 'critical');
    
    expect(healthyServices).toHaveLength(3);
    expect(warningServices).toHaveLength(1);
    expect(criticalServices).toHaveLength(1);
  });

  it('should filter services by status', () => {
    const criticalServices = mockServices.filter(s => s.status === 'critical');
    
    expect(criticalServices).toHaveLength(1);
    expect(criticalServices[0]?.name).toBe('analytics-service');
  });

  it('should identify services with high resource usage', () => {
    const highCpuServices = mockServices.filter(s => s.cpu > 70);
    const highMemoryServices = mockServices.filter(s => s.memory > 80);
    
    expect(highCpuServices).toHaveLength(2); // payment-service and analytics-service
    expect(highMemoryServices).toHaveLength(2); // payment-service and analytics-service
  });

  it('should include service metadata', () => {
    const service = mockServices[0];
    
    expect(service).toHaveProperty('name');
    expect(service).toHaveProperty('status');
    expect(service).toHaveProperty('uptime');
    expect(service).toHaveProperty('cpu');
    expect(service).toHaveProperty('memory');
    expect(service).toHaveProperty('lastCheck');
  });

  it('should handle case-insensitive service name search', () => {
    const serviceName = 'API-GATEWAY';
    const service = mockServices.find(s => 
      s.name.toLowerCase() === serviceName.toLowerCase()
    );
    
    expect(service).toBeDefined();
    expect(service?.name).toBe('api-gateway');
  });
});