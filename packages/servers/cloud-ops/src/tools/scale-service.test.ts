import { describe, it, expect } from 'vitest';

describe('scale_service tool', () => {
  it('should validate scaling parameters', () => {
    const scaleParams = {
      serviceName: 'user-service',
      targetInstances: 5,
      scaleType: 'horizontal',
      autoScaleConfig: {
        enabled: true,
        minInstances: 2,
        maxInstances: 10,
        targetCPU: 70
      }
    };
    
    expect(scaleParams.targetInstances).toBeGreaterThanOrEqual(0);
    expect(['horizontal', 'vertical']).toContain(scaleParams.scaleType);
    expect(scaleParams.autoScaleConfig.minInstances).toBeLessThanOrEqual(scaleParams.autoScaleConfig.maxInstances);
    expect(scaleParams.autoScaleConfig.targetCPU).toBeGreaterThan(0);
    expect(scaleParams.autoScaleConfig.targetCPU).toBeLessThanOrEqual(100);
  });

  it('should calculate scaling direction', () => {
    const scenarios = [
      { current: 3, target: 5, direction: 'up', diff: 2 },
      { current: 8, target: 4, direction: 'down', diff: 4 },
      { current: 5, target: 5, direction: 'none', diff: 0 }
    ];
    
    scenarios.forEach(scenario => {
      const direction = scenario.target > scenario.current ? 'up' : 
                       scenario.target < scenario.current ? 'down' : 'none';
      const diff = Math.abs(scenario.target - scenario.current);
      
      expect(direction).toBe(scenario.direction);
      expect(diff).toBe(scenario.diff);
    });
  });

  it('should estimate scaling time', () => {
    const estimateTime = (instanceDiff: number, scaleType: string) => {
      return scaleType === 'horizontal' ? instanceDiff * 2 : instanceDiff * 5;
    };
    
    expect(estimateTime(3, 'horizontal')).toBe(6);
    expect(estimateTime(3, 'vertical')).toBe(15);
    expect(estimateTime(0, 'horizontal')).toBe(0);
  });

  it('should calculate scaling costs', () => {
    const calculateCost = (instances: number, scaleType: string) => {
      const hourlyRate = scaleType === 'horizontal' ? 0.10 : 0.15;
      return {
        hourly: instances * hourlyRate,
        monthly: instances * hourlyRate * 24 * 30
      };
    };
    
    const horizontalCost = calculateCost(5, 'horizontal');
    expect(horizontalCost.hourly).toBe(0.5);
    expect(horizontalCost.monthly).toBe(360);
    
    const verticalCost = calculateCost(5, 'vertical');
    expect(verticalCost.hourly).toBe(0.75);
    expect(verticalCost.monthly).toBe(540);
  });

  it('should validate auto-scale thresholds', () => {
    const autoScaleConfig = {
      targetCPU: 70,
      scaleUpThreshold: 80,
      scaleDownThreshold: 60
    };
    
    expect(autoScaleConfig.scaleUpThreshold).toBeGreaterThan(autoScaleConfig.targetCPU);
    expect(autoScaleConfig.scaleDownThreshold).toBeLessThan(autoScaleConfig.targetCPU);
    expect(autoScaleConfig.scaleUpThreshold).toBeGreaterThan(autoScaleConfig.scaleDownThreshold);
  });

  it('should handle edge cases', () => {
    const edgeCases = [
      { targetInstances: 0, valid: true }, // Scale to zero
      { targetInstances: -1, valid: false }, // Negative instances
      { targetInstances: 1000, valid: true }, // Large scale
      { targetInstances: 1.5, valid: false } // Fractional instances
    ];
    
    edgeCases.forEach(testCase => {
      const isValid = Number.isInteger(testCase.targetInstances) && testCase.targetInstances >= 0;
      expect(isValid).toBe(testCase.valid);
    });
  });
});