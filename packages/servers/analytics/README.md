# Analytics Server

MCP server providing data analysis and statistical computation capabilities.

## Features

### Tools
- **analyze_csv**: Analyze CSV files and provide statistical insights
- **generate_sample_data**: Generate sample datasets for testing (JSON/CSV)
- **calculate_statistics**: Calculate statistical measures for numeric data

### Resources
- **sample_datasets**: Access to pre-generated sample datasets

### Prompts
- **data_analysis_workflow**: Guided data analysis process

## Usage

```bash
# Build the server
pnpm build

# Start the server
pnpm start

# Development mode
pnpm dev
```

## Testing with MCP Inspector

1. Build the server: `pnpm build`
2. Open MCP Inspector
3. Add server with command: `node packages/servers/analytics/dist/index.js`
4. Test the tools, resources, and prompts

## Dependencies

- **csv-parser**: CSV file parsing
- **json2csv**: JSON to CSV conversion
- **d3**: Statistical calculations and data processing