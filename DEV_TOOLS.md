# Roo Development Tools

The Roo project now includes comprehensive development tools to help with codebase exploration, project initialization, and file operations with proper Unicode support.

## 🚀 Quick Start

### Initialize Project Analysis
```bash
npm run init
# or
node roo-dev.js init
```

This command will:
- Scan the entire project structure 
- Generate a comprehensive context file (`.roo-context.json`)
- Identify all documentation files
- Provide memory usage statistics
- Create a searchable index of the codebase

### Search Files
```bash
npm run search "pattern"
# or
node roo-dev.js search "OAuth" --ext .js --ext .md --max 20
```

Features:
- **Unicode Support**: Handles files with Unicode characters in names and content
- **Whitespace Handling**: Properly escapes spaces and special characters
- **Cross-platform**: Works on Windows, Linux, and macOS
- **Multiple Extensions**: Search across different file types
- **Result Limiting**: Control output with `--max` parameter

### Fast Search with Ripgrep (Optional)
```bash
node roo-dev.js rg "OAuth" --type js --whole-word
```

If ripgrep is installed, this provides much faster searching with:
- Advanced pattern matching
- Better performance on large codebases
- Automatic fallback to built-in search if ripgrep isn't available

## 📋 Available Commands

### `init` - Project Initialization
Scans the codebase and generates comprehensive documentation context.

**Usage:**
```bash
node roo-dev.js init [directory]
```

**Options:**
- `directory` - Project root directory (default: current directory)

**Output:**
- `.roo-context.json` - Complete project structure and metadata
- Console summary of files, directories, and documentation

### `search` - Built-in File Search
Unicode-safe search with cross-platform compatibility.

**Usage:**
```bash
node roo-dev.js search <pattern> [options]
```

**Options:**
- `--ext <extension>` - File extensions to search (can be repeated)
- `--dir <directory>` - Search directory (default: current)
- `--case-sensitive` - Enable case-sensitive matching
- `--whole-word` - Match whole words only
- `--max <number>` - Maximum results (default: 100)

**Examples:**
```bash
# Search for "function" in JavaScript files
node roo-dev.js search "function" --ext .js

# Case-sensitive search for OAuth in all supported files
node roo-dev.js search "OAuth" --case-sensitive

# Search with Unicode characters
node roo-dev.js search "café" --dir ./src
```

### `rg` - Ripgrep Fast Search
High-performance search using ripgrep with automatic fallback.

**Usage:**
```bash
node roo-dev.js rg <pattern> [options]
```

**Options:**
- `--type <type>` - File type (e.g., js, md, json)
- `--dir <directory>` - Search directory
- `--case-sensitive` - Case-sensitive search
- `--whole-word` - Whole word matching
- `--max <number>` - Max results per file

**Examples:**
```bash
# Fast search for OAuth in JavaScript files
node roo-dev.js rg "OAuth" --type js

# Search with multiple file types
node roo-dev.js rg "API" --type js --type md
```

## 🛠️ NPM Scripts

The following npm scripts are available for convenience:

```bash
npm run init          # Initialize project analysis
npm run search        # Search files (requires pattern as argument)
npm run dev-help      # Show development CLI help
npm run diagnostics   # Run system diagnostics
```

## 🧠 Memory Management

The development tools include comprehensive memory management utilities:

### TaskManager
- Automatic task cleanup and disposal
- Memory leak prevention
- Resource monitoring
- Graceful shutdown handling

### MemoryMonitor
- Real-time memory usage tracking
- Configurable thresholds and alerts
- Memory statistics and reporting

Example usage:
```javascript
import { TaskManager, MemoryMonitor } from './src/memory-manager.js';

// Create task manager with cleanup
const taskManager = new TaskManager({ maxTasks: 10 });

// Monitor memory usage
const monitor = new MemoryMonitor({ 
  warningThreshold: 500, // MB
  criticalThreshold: 1000 // MB
});
monitor.startMonitoring();
```

## 🌐 Cross-Platform Support

### File Path Handling
- Proper escaping of spaces and Unicode characters
- Windows/Linux path compatibility
- Shell command generation with environment handling

### Unicode Support
- UTF-8 encoding for all file operations
- Proper handling of Unicode filenames
- Search functionality that works with international characters

### Terminal Compatibility
- Cross-platform command execution
- Environment variable handling
- Proper shell integration on Windows and Unix-like systems

## 📊 Integration with Existing Tools

### Enhanced Diagnostics
The existing `diagnostics.sh` script now includes:
- Development tools status
- CLI availability checks
- Project context verification

### Package.json Integration
New scripts added to `package.json`:
```json
{
  "scripts": {
    "init": "node roo-dev.js init",
    "search": "node roo-dev.js search", 
    "dev-help": "node roo-dev.js help",
    "diagnostics": "./diagnostics.sh"
  }
}
```

## 🔧 Advanced Features

### File Pattern Escaping
Proper escaping for tools like ripgrep:
```javascript
import { escapeFilePath, createRipgrepCommand } from './src/dev-tools.js';

// Safe file path handling
const safePath = escapeFilePath('/path/with spaces/file.js');

// Ripgrep command generation
const command = createRipgrepCommand('pattern', {
  fileTypes: ['js', 'ts'],
  excludeDirs: ['node_modules', '.git']
});
```

### Resource Context Management
Automatic cleanup of resources:
```javascript
import { ResourceContext } from './src/memory-manager.js';

const context = new ResourceContext();
context.addResource(fileHandle);
context.addResource(networkConnection);
// Automatic cleanup on disposal
context.dispose();
```

## 📝 Generated Files

### `.roo-context.json`
Contains comprehensive project information:
```json
{
  "timestamp": "2024-09-01T19:50:00.000Z",
  "platform": {
    "os": "linux",
    "arch": "x64", 
    "node": "v20.19.4",
    "cwd": "/path/to/project"
  },
  "structure": {
    "files": { /* all project files */ },
    "directories": { /* directory structure */ },
    "summary": {
      "totalFiles": 24,
      "totalDirectories": 2,
      "fileTypes": { ".js": 12, ".md": 5, ".json": 3 }
    }
  },
  "documentation": [ /* documentation files found */ ]
}
```

This file serves as a comprehensive reference for:
- Project structure understanding
- File organization analysis
- Documentation discovery
- Automated tooling integration

## 🚀 Benefits

1. **Improved Developer Experience**: Easy project exploration and understanding
2. **Unicode/Whitespace Safe**: Handles international characters and complex filenames
3. **Cross-Platform**: Works consistently across Windows, Linux, and macOS
4. **Memory Leak Prevention**: Automatic resource cleanup and monitoring
5. **Fast Search**: Ripgrep integration with built-in fallback
6. **Documentation Generation**: Automated project context creation
7. **Integration Ready**: Works with existing Roo project workflows

## 🛡️ Error Handling

- Graceful fallback when external tools aren't available
- Comprehensive error reporting with helpful suggestions
- Memory monitoring with configurable alerts
- Resource cleanup on errors or process termination

The development tools are designed to enhance the Roo project's maintainability and developer productivity while providing robust Unicode support and cross-platform compatibility.