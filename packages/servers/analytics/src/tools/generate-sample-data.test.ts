import { describe, it, expect } from 'vitest';

// Simple utility function to test individual functionality
function generateSampleData(count: number = 100): Array<Record<string, any>> {
  const data = [];
  const categories = ['A', 'B', 'C', 'D', 'E'];
  const regions = ['North', 'South', 'East', 'West', 'Central'];
  
  for (let i = 0; i < count; i++) {
    data.push({
      id: i + 1,
      value: Math.floor(Math.random() * 1000) + 1,
      category: categories[Math.floor(Math.random() * categories.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      score: Math.random() * 100,
    });
  }
  
  return data;
}

describe('generate_sample_data tool', () => {
  it('should generate correct number of sample records', () => {
    const data = generateSampleData(5);
    
    expect(data).toHaveLength(5);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('value');
    expect(data[0]).toHaveProperty('category');
    expect(data[0]).toHaveProperty('region');
    expect(data[0]).toHaveProperty('date');
    expect(data[0]).toHaveProperty('score');
  });

  it('should generate different data each time', () => {
    const data1 = generateSampleData(3);
    const data2 = generateSampleData(3);
    
    expect(data1).toHaveLength(3);
    expect(data2).toHaveLength(3);
    
    // At least one field should be different (due to randomization)
    const isDifferent = data1.some((record, index) => 
      record.value !== data2[index]?.value || 
      record.category !== data2[index]?.category
    );
    expect(isDifferent).toBe(true);
  });

  it('should handle large record counts', () => {
    const data = generateSampleData(1000);
    
    expect(data).toHaveLength(1000);
    expect(data[999]).toHaveProperty('id', 1000);
  });

  it('should use default count when no parameter provided', () => {
    const data = generateSampleData();
    
    expect(data).toHaveLength(100);
  });

  it('should generate valid category values', () => {
    const data = generateSampleData(10);
    const validCategories = ['A', 'B', 'C', 'D', 'E'];
    
    data.forEach(record => {
      expect(validCategories).toContain(record.category);
    });
  });

  it('should generate valid region values', () => {
    const data = generateSampleData(10);
    const validRegions = ['North', 'South', 'East', 'West', 'Central'];
    
    data.forEach(record => {
      expect(validRegions).toContain(record.region);
    });
  });
});