import { describe, it, expect } from 'vitest';

// Simple statistical functions for testing
function calculateMean(values: number[]): number {
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  } else {
    return sorted[mid]!;
  }
}

function calculateStandardDeviation(values: number[]): number {
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const avgSquaredDiff = calculateMean(squaredDiffs);
  return Math.sqrt(avgSquaredDiff);
}

describe('calculate_statistics tool', () => {
  const sampleData = [10, 20, 30, 40, 50];

  it('should calculate mean correctly', () => {
    const result = calculateMean(sampleData);
    
    expect(result).toBe(30);
  });

  it('should calculate median correctly for odd length array', () => {
    const result = calculateMedian(sampleData);
    
    expect(result).toBe(30);
  });

  it('should calculate median correctly for even length array', () => {
    const evenData = [10, 20, 30, 40];
    const result = calculateMedian(evenData);
    
    expect(result).toBe(25);
  });

  it('should calculate standard deviation correctly', () => {
    const result = calculateStandardDeviation(sampleData);
    
    expect(result).toBeCloseTo(14.142, 2);
  });

  it('should handle single value arrays', () => {
    const singleValue = [42];
    
    expect(calculateMean(singleValue)).toBe(42);
    expect(calculateMedian(singleValue)).toBe(42);
    expect(calculateStandardDeviation(singleValue)).toBe(0);
  });

  it('should handle negative numbers', () => {
    const negativeData = [-10, -5, 0, 5, 10];
    
    expect(calculateMean(negativeData)).toBe(0);
    expect(calculateMedian(negativeData)).toBe(0);
  });

  it('should handle decimal numbers', () => {
    const decimalData = [1.5, 2.7, 3.2, 4.8, 5.1];
    
    const mean = calculateMean(decimalData);
    expect(mean).toBeCloseTo(3.46, 2);
    
    const median = calculateMedian(decimalData);
    expect(median).toBe(3.2);
  });

  it('should find minimum and maximum values', () => {
    const values = [15, 3, 42, 8, 27];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    expect(min).toBe(3);
    expect(max).toBe(42);
  });

  it('should calculate sum correctly', () => {
    const sum = sampleData.reduce((acc, val) => acc + val, 0);
    
    expect(sum).toBe(150);
  });

  it('should handle zero values', () => {
    const dataWithZeros = [0, 0, 5, 0, 10];
    
    expect(calculateMean(dataWithZeros)).toBe(3);
    expect(calculateMedian(dataWithZeros)).toBe(0);
  });
});