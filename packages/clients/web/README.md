# MCP Web Client

A modern React-based web interface for interacting with Model Context Protocol (MCP) servers.

## Features

- **Visual Server Selection**: Browse and connect to available MCP servers
- **Interactive Interface**: Explore tools, resources, and prompts with a clean UI
- **Real-time Console**: Monitor server interactions and responses
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS

## Technologies

- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Vite**: Fast development server and build tool
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Beautiful SVG icons
- **MCP SDK**: Model Context Protocol integration

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Usage

1. **Start the development server** (`pnpm dev`)
2. **Open your browser** to `http://localhost:3000`
3. **Select a server** from the available options
4. **Click "Connect"** to establish connection
5. **Explore capabilities** using the tabs (Tools, Resources, Prompts)
6. **Execute actions** and monitor output in the console

## Server Integration

The web client connects to the following MCP servers:

- **Development Tools**: Code formatting and file management
- **Data Analytics**: Statistical analysis and data processing
- **Cloud Operations**: Infrastructure monitoring and deployment
- **Knowledge Base**: Document storage and search

## Architecture

```
src/
├── App.tsx          # Main application component
├── main.tsx         # Application entry point
├── index.css        # Global styles with Tailwind
└── vite-env.d.ts    # Vite type definitions
```

## Key Components

### Server Cards
- Visual representation of available servers
- Connection status indicators
- Server descriptions and capabilities

### Capability Explorer
- Tabbed interface for tools, resources, and prompts
- Action buttons for executing operations
- Real-time status updates

### Console Output
- Live feed of server interactions
- Formatted output with timestamps
- Clear functionality for reset

## Customization

The web client is designed to be easily customizable:

- **Add new servers**: Update the `SERVERS` configuration
- **Modify UI theme**: Adjust Tailwind classes
- **Add new features**: Extend the React components
- **Custom styling**: Modify the CSS files

## Production Deployment

```bash
# Build the application
pnpm build

# The dist/ folder contains the production build
# Deploy to any static hosting service
```

## Browser Support

- Modern browsers with ES2020 support
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Note

This is a demonstration web client that simulates MCP server interactions. In a production environment, you would:

1. Implement actual MCP SDK integration
2. Add proper error handling and validation
3. Include authentication and security measures
4. Add more sophisticated state management
5. Implement real-time WebSocket connections