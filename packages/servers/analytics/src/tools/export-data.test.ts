import { describe, it, expect } from 'vitest';

// Helper function to test CSV export logic
function exportToCSV(data: Array<Record<string, any>>): string {
  if (data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]!);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma or quote
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(',')
    )
  ];
  return csvRows.join('\n');
}

// Helper function to test JSON export logic
function exportToJSON(data: Array<Record<string, any>>): string {
  return JSON.stringify(data, null, 2);
}

describe('export_data tool', () => {
  const sampleData = [
    { id: 1, name: 'Alice', value: 100 },
    { id: 2, name: 'Bob', value: 200 },
    { id: 3, name: 'Charlie', value: 300 }
  ];

  it('should export data to JSON format', () => {
    const result = exportToJSON(sampleData);
    
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
    expect(result).toContain('Charlie');
    expect(() => JSON.parse(result)).not.toThrow();
    
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual({ id: 1, name: 'Alice', value: 100 });
  });

  it('should export data to CSV format', () => {
    const result = exportToCSV(sampleData);
    
    expect(result).toContain('id,name,value');
    expect(result).toContain('1,Alice,100');
    expect(result).toContain('2,Bob,200');
    expect(result).toContain('3,Charlie,300');
    
    const lines = result.split('\n');
    expect(lines).toHaveLength(4); // Header + 3 data rows
  });

  it('should handle empty data arrays', () => {
    const csvResult = exportToCSV([]);
    const jsonResult = exportToJSON([]);
    
    expect(csvResult).toBe('');
    expect(jsonResult).toBe('[]');
  });

  it('should escape CSV values with commas', () => {
    const dataWithCommas = [
      { id: 1, description: 'Item with, comma' }
    ];
    
    const result = exportToCSV(dataWithCommas);
    
    expect(result).toContain('"Item with, comma"');
  });

  it('should escape CSV values with quotes', () => {
    const dataWithQuotes = [
      { id: 1, description: 'Item with "quotes"' }
    ];
    
    const result = exportToCSV(dataWithQuotes);
    
    expect(result).toContain('"Item with ""quotes"""');
  });

  it('should handle various data types in JSON export', () => {
    const mixedData = [
      { id: 1, active: true, score: 95.5, tags: null }
    ];
    
    const result = exportToJSON(mixedData);
    const parsed = JSON.parse(result);
    
    expect(parsed[0]?.id).toBe(1);
    expect(parsed[0]?.active).toBe(true);
    expect(parsed[0]?.score).toBe(95.5);
    expect(parsed[0]?.tags).toBeNull();
  });

  it('should maintain field order in CSV export', () => {
    const orderedData = [
      { c: 3, a: 1, b: 2 }
    ];
    
    const result = exportToCSV(orderedData);
    const lines = result.split('\n');
    
    expect(lines[0]).toBe('c,a,b'); // Should match object key order
    expect(lines[1]).toBe('3,1,2');
  });
});