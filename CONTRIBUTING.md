# Contributing to MCP TypeScript Demo

Thank you for your interest in contributing to the MCP TypeScript Demo! This project serves as a comprehensive educational resource and reference implementation for the Model Context Protocol.

## 🎯 Project Goals

This project aims to be:
- **Educational**: Help developers learn MCP through clear, well-documented examples
- **Comprehensive**: Demonstrate all MCP features and capabilities
- **High Quality**: Showcase best practices for MCP implementation
- **Beginner Friendly**: Provide an accessible starting point for new MCP developers

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm 8+
- Git

### Setup
```bash
# Fork and clone the repository
git clone https://github.com/your-username/mcp-typescript-demo.git
cd mcp-typescript-demo

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## 📋 Types of Contributions

We welcome various types of contributions:

### 🐛 Bug Reports
- Use clear, descriptive titles
- Include steps to reproduce the issue
- Provide environment details (Node.js version, OS, etc.)
- Add logs or error messages when relevant

### ✨ Feature Requests
- Explain the educational value of the feature
- Describe how it would help developers learn MCP
- Consider if it demonstrates MCP protocol features

### 📚 Documentation Improvements
- Fix typos or clarify explanations
- Add more code comments for educational clarity
- Improve README files or tutorials
- Create or enhance examples

### 🔧 Code Contributions
- New server examples or client implementations
- Additional tools, resources, or prompts
- Performance improvements
- Test coverage improvements

## 📝 Development Guidelines

### Code Style
- Use TypeScript strict mode
- Follow existing naming conventions
- Add comprehensive JSDoc comments
- Use descriptive variable and function names
- Include educational comments explaining MCP concepts

### MCP Best Practices
- Always validate inputs with Zod schemas
- Use proper error handling with `isError: true`
- Log operations for debugging
- Follow MCP 2025-06-18 specification
- Include metadata in responses when helpful

### Educational Focus
- Write code that teaches MCP concepts
- Add inline comments explaining "why" not just "what"
- Use realistic examples and scenarios
- Make error messages helpful for learning

### Testing
- Write unit tests for new functionality
- Include integration tests for MCP protocol compliance
- Test error scenarios and edge cases
- Use the existing test utilities in `packages/test-utils`

## 🔄 Pull Request Process

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow the development guidelines above
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

4. **Commit Your Changes**
   - Use conventional commit messages
   - Include clear descriptions
   - Reference issues when applicable

5. **Submit Pull Request**
   - Use a clear, descriptive title
   - Explain the educational value of your changes
   - Include screenshots or demos for UI changes
   - Link to related issues

## 📁 Project Structure

```
mcp-typescript-demo/
├── packages/
│   ├── core/               # Shared utilities and types
│   ├── servers/            # MCP server implementations
│   │   ├── dev-tools/      # Development tools server
│   │   ├── analytics/      # Data analytics server
│   │   ├── cloud-ops/      # Cloud operations server
│   │   ├── knowledge/      # Knowledge base server
│   │   └── chat-server/    # Chat aggregation server
│   ├── clients/            # MCP client implementations
│   │   ├── desktop/        # Desktop GUI client
│   │   ├── cli/            # Command-line client
│   │   ├── web/            # Web-based client
│   │   └── claude-chat/    # Enhanced chat UI
│   ├── apps/               # Integrated applications
│   └── test-utils/         # Shared testing utilities
└── docs/                   # Documentation and tutorials
```

## 🎓 Adding New Examples

When adding new servers, tools, or clients:

1. **Choose Educational Value**: Ensure it demonstrates useful MCP concepts
2. **Follow Existing Patterns**: Use the same structure as existing implementations
3. **Add Comprehensive Tests**: Include unit and integration tests
4. **Document Thoroughly**: Add README files and inline comments
5. **Update Main Documentation**: Add to the main README and architecture docs

### New Server Checklist
- [ ] Follows MCP 2025-06-18 specification
- [ ] Implements meaningful tools and resources
- [ ] Includes proper error handling
- [ ] Has comprehensive tests
- [ ] Includes README with usage examples
- [ ] Demonstrates unique MCP features

### New Client Checklist
- [ ] Connects to multiple servers
- [ ] Handles all MCP message types
- [ ] Implements proper error handling
- [ ] Has user-friendly interface
- [ ] Includes usage documentation

## 🧪 Testing Guidelines

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test MCP protocol compliance
- **End-to-End Tests**: Test complete workflows
- **Performance Tests**: Ensure reasonable response times

Use the test utilities:
```typescript
import { createTestServer, mockMCPClient } from '@mcp-demo/test-utils';
```

## 📖 Documentation Standards

- Use clear, simple language
- Include code examples for complex concepts
- Add diagrams for architectural overviews
- Keep tutorials step-by-step and beginner-friendly
- Update architecture diagrams when adding new components

## 🤝 Community Guidelines

- Be respectful and inclusive
- Focus on educational value
- Help others learn MCP
- Provide constructive feedback
- Ask questions when unsure

## 📞 Getting Help

- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Use GitHub Issues for bugs and feature requests
- **Documentation**: Check the comprehensive docs in this repository

## 🏆 Recognition

Contributors will be:
- Listed in the project README
- Credited in release notes
- Acknowledged for their educational contributions

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make MCP more accessible to developers! Your contributions help build a better learning resource for the entire community.