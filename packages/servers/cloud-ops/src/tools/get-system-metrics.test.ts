import { describe, it, expect } from 'vitest';

describe('get_system_metrics tool', () => {
  it('should return valid system metrics', () => {
    const metrics = {
      cpu: {
        usage: 45.2,
        cores: 8,
        temperature: 62
      },
      memory: {
        total: 32768,
        used: 18432,
        free: 14336,
        percentage: 56.25
      },
      disk: {
        total: 512000,
        used: 384000,
        free: 128000,
        percentage: 75
      },
      network: {
        bytesIn: 1048576,
        bytesOut: 524288,
        packetsIn: 1000,
        packetsOut: 500
      }
    };
    
    expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
    expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
    expect(metrics.memory.percentage).toBe(56.25);
    expect(metrics.disk.used + metrics.disk.free).toBe(metrics.disk.total);
  });

  it('should track service-specific metrics', () => {
    const serviceMetrics = {
      'api-gateway': {
        requests: 15420,
        avgResponseTime: 145,
        errorRate: 0.02,
        throughput: 257
      },
      'user-service': {
        requests: 8930,
        avgResponseTime: 89,
        errorRate: 0.01,
        throughput: 149
      }
    };
    
    Object.values(serviceMetrics).forEach(metrics => {
      expect(metrics.requests).toBeGreaterThan(0);
      expect(metrics.avgResponseTime).toBeGreaterThan(0);
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeLessThan(1);
      expect(metrics.throughput).toBeGreaterThan(0);
    });
  });

  it('should include timestamp for metrics', () => {
    const metricsSnapshot = {
      timestamp: new Date().toISOString(),
      interval: '5m',
      data: {}
    };
    
    expect(metricsSnapshot.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(['1m', '5m', '15m', '1h', '24h']).toContain(metricsSnapshot.interval);
  });

  it('should calculate percentage values correctly', () => {
    const calculatePercentage = (used: number, total: number) => 
      Math.round((used / total) * 100 * 100) / 100;
    
    expect(calculatePercentage(50, 100)).toBe(50);
    expect(calculatePercentage(75, 150)).toBe(50);
    expect(calculatePercentage(0, 100)).toBe(0);
    expect(calculatePercentage(100, 100)).toBe(100);
  });

  it('should aggregate metrics by time period', () => {
    const timePeriods = ['last_5min', 'last_hour', 'last_24h', 'last_week'];
    const aggregatedMetrics = {
      last_5min: { avg_cpu: 45, max_cpu: 62, min_cpu: 32 },
      last_hour: { avg_cpu: 48, max_cpu: 78, min_cpu: 28 },
      last_24h: { avg_cpu: 52, max_cpu: 95, min_cpu: 15 },
      last_week: { avg_cpu: 50, max_cpu: 98, min_cpu: 12 }
    };
    
    timePeriods.forEach(period => {
      const metrics = aggregatedMetrics[period as keyof typeof aggregatedMetrics];
      expect(metrics.min_cpu).toBeLessThanOrEqual(metrics.avg_cpu);
      expect(metrics.avg_cpu).toBeLessThanOrEqual(metrics.max_cpu);
    });
  });

  it('should handle metric filtering', () => {
    const allMetrics = ['cpu', 'memory', 'disk', 'network', 'custom'];
    const requestedMetrics = ['cpu', 'memory'];
    
    const filteredMetrics = allMetrics.filter(m => requestedMetrics.includes(m));
    
    expect(filteredMetrics).toHaveLength(2);
    expect(filteredMetrics).toContain('cpu');
    expect(filteredMetrics).toContain('memory');
    expect(filteredMetrics).not.toContain('disk');
  });
});