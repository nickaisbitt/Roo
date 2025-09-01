import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Development tools for the Roo project
 * Provides initialization, file search, and project context utilities
 */

/**
 * Escape file paths and patterns for cross-platform compatibility
 * Handles Unicode characters and whitespace properly
 */
export function escapeFilePath(filePath) {
  if (!filePath) return '';
  
  // On Windows, handle backslashes and spaces
  if (os.platform() === 'win32') {
    return `"${filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  
  // On Unix-like systems, escape spaces and special characters
  return filePath.replace(/([\\"])/g, '\\$1').replace(/ /g, '\\ ');
}

/**
 * Search files with proper Unicode and whitespace handling
 * Compatible with ripgrep and other search tools
 */
export function createSearchPattern(pattern, options = {}) {
  const {
    ignoreCase = true,
    wholeWord = false,
    escapeSpaces = true
  } = options;
  
  let searchPattern = pattern;
  
  // Escape regex special characters while preserving Unicode
  searchPattern = searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Handle word boundaries if requested
  if (wholeWord) {
    searchPattern = `\\b${searchPattern}\\b`;
  }
  
  // Add case insensitive flag if needed
  const flags = ignoreCase ? 'iu' : 'u'; // 'u' for Unicode support
  
  return new RegExp(searchPattern, flags);
}

/**
 * Safe file search that handles Unicode filenames and content
 */
export async function searchFiles(directory, pattern, options = {}) {
  const {
    extensions = ['.js', '.ts', '.json', '.md'],
    excludeDirs = ['node_modules', '.git', 'dist', 'build'],
    maxResults = 100
  } = options;
  
  const results = [];
  const searchRegex = createSearchPattern(pattern, options);
  
  async function searchDirectory(dir) {
    if (results.length >= maxResults) return;
    
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (results.length >= maxResults) break;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (!excludeDirs.includes(entry.name)) {
            await searchDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          // Check file extension
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            try {
              // Read file with proper encoding for Unicode support
              const content = await fs.promises.readFile(fullPath, 'utf8');
              const lines = content.split('\n');
              
              lines.forEach((line, lineNumber) => {
                if (searchRegex.test(line)) {
                  results.push({
                    file: fullPath,
                    line: lineNumber + 1,
                    content: line.trim(),
                    match: pattern
                  });
                }
              });
            } catch (error) {
              // Skip files that can't be read (binary files, permission issues, etc.)
              console.warn(`Warning: Could not read file ${fullPath}: ${error.message}`);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
    }
  }
  
  await searchDirectory(directory);
  return results;
}

/**
 * Cross-platform command execution with proper environment handling
 */
export function createCommand(command, args = [], options = {}) {
  const {
    shell = true,
    cwd = process.cwd(),
    env = process.env
  } = options;
  
  // Handle Windows vs Unix command differences
  let finalCommand = command;
  let finalArgs = args;
  
  if (os.platform() === 'win32') {
    // On Windows, use cmd.exe for shell commands
    if (shell && typeof command === 'string') {
      finalCommand = 'cmd';
      finalArgs = ['/c', command, ...args];
    }
  } else {
    // On Unix-like systems, use sh for shell commands
    if (shell && typeof command === 'string') {
      finalCommand = 'sh';
      finalArgs = ['-c', `${command} ${args.join(' ')}`];
    }
  }
  
  return {
    command: finalCommand,
    args: finalArgs,
    options: {
      cwd,
      env: {
        ...env,
        // Ensure UTF-8 encoding
        LC_ALL: 'C.UTF-8',
        LANG: 'C.UTF-8'
      },
      shell,
      stdio: 'inherit'
    }
  };
}

/**
 * Create ripgrep command with proper file pattern escaping
 * Handles Unicode filenames and patterns with spaces/special characters
 */
export function createRipgrepCommand(pattern, options = {}) {
  const {
    directory = '.',
    fileTypes = [],
    excludeDirs = ['node_modules', '.git', 'dist', 'build'],
    caseSensitive = false,
    wholeWords = false,
    maxCount = 100
  } = options;
  
  const args = ['rg'];
  
  // Add basic flags
  if (!caseSensitive) {
    args.push('-i'); // case insensitive
  }
  
  if (wholeWords) {
    args.push('-w'); // whole words only
  }
  
  args.push('--no-heading'); // Don't show filename headers
  args.push('--line-number'); // Show line numbers
  args.push('--max-count', maxCount.toString()); // Limit results per file
  args.push('--max-filesize', '10M'); // Skip very large files
  
  // Handle Unicode properly
  args.push('--encoding', 'utf8');
  
  // Add file type restrictions
  if (fileTypes.length > 0) {
    fileTypes.forEach(type => {
      // Remove leading dot if present
      const cleanType = type.startsWith('.') ? type.slice(1) : type;
      args.push('-t', cleanType);
    });
  }
  
  // Add directory exclusions
  excludeDirs.forEach(dir => {
    args.push('--glob', `!${escapeGlobPattern(dir)}/`);
  });
  
  // Escape the search pattern properly for ripgrep
  const escapedPattern = escapeRipgrepPattern(pattern);
  args.push(escapedPattern);
  
  // Escape the directory path
  const escapedDirectory = escapeFilePath(directory);
  args.push(escapedDirectory);
  
  return createCommand('rg', args.slice(1), { cwd: directory });
}

/**
 * Escape glob patterns for file matching
 */
function escapeGlobPattern(pattern) {
  // Escape special glob characters while preserving Unicode
  return pattern.replace(/([*?[\]{}])/g, '\\$1');
}

/**
 * Escape patterns for ripgrep search
 */
function escapeRipgrepPattern(pattern) {
  // For ripgrep, we need to handle regex special characters
  // but preserve Unicode characters
  return pattern.replace(/([\\^$.*+?()[\]{}|])/g, '\\$1');
}

/**
 * Execute ripgrep search with error handling and Unicode support
 */
export async function executeRipgrepSearch(pattern, options = {}) {
  const { spawn } = await import('child_process');
  
  // Check if ripgrep is available
  try {
    const checkCommand = createCommand('rg', ['--version'], { shell: false });
    await new Promise((resolve, reject) => {
      const child = spawn(checkCommand.command, checkCommand.args, { 
        ...checkCommand.options,
        stdio: 'pipe'
      });
      child.on('close', code => code === 0 ? resolve() : reject(new Error('ripgrep not available')));
      child.on('error', reject);
    });
  } catch (error) {
    throw new Error('ripgrep is not installed or not available in PATH. Please install ripgrep (rg) first.');
  }
  
  const command = createRipgrepCommand(pattern, options);
  
  return new Promise((resolve, reject) => {
    const results = [];
    const child = spawn(command.command, command.args, {
      ...command.options,
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    
    child.stdout?.on('data', (data) => {
      stdout += data;
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data;
    });
    
    child.on('close', (code) => {
      if (code === 0 || code === 1) { // 0 = found results, 1 = no results found
        // Parse ripgrep output
        const lines = stdout.trim().split('\n').filter(Boolean);
        
        lines.forEach(line => {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            const [, file, lineNumber, content] = match;
            results.push({
              file: file.trim(),
              line: parseInt(lineNumber, 10),
              content: content.trim(),
              match: pattern
            });
          }
        });
        
        resolve(results);
      } else {
        reject(new Error(`ripgrep failed with exit code ${code}: ${stderr}`));
      }
    });
    
    child.on('error', (error) => {
      reject(new Error(`Failed to execute ripgrep: ${error.message}`));
    });
  });
}

/**
 * Scan project structure and generate context documentation
 */
export async function scanProjectStructure(projectRoot = process.cwd()) {
  const structure = {
    root: projectRoot,
    files: {},
    directories: {},
    summary: {
      totalFiles: 0,
      totalDirectories: 0,
      fileTypes: {},
      largestFiles: [],
      recentFiles: []
    }
  };
  
  async function scanDirectory(dir, relativePath = '') {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common build and dependency directories
          if (!['node_modules', '.git', 'dist', 'build', '.next', '.nuxt'].includes(entry.name)) {
            structure.summary.totalDirectories++;
            structure.directories[relPath] = {
              name: entry.name,
              path: fullPath,
              relativePath: relPath
            };
            await scanDirectory(fullPath, relPath);
          }
        } else if (entry.isFile()) {
          try {
            const stats = await fs.promises.stat(fullPath);
            const ext = path.extname(entry.name);
            
            structure.summary.totalFiles++;
            structure.summary.fileTypes[ext] = (structure.summary.fileTypes[ext] || 0) + 1;
            
            structure.files[relPath] = {
              name: entry.name,
              path: fullPath,
              relativePath: relPath,
              size: stats.size,
              modified: stats.mtime,
              extension: ext
            };
            
            // Track largest files
            structure.summary.largestFiles.push({
              path: relPath,
              size: stats.size
            });
            
            // Track recent files
            structure.summary.recentFiles.push({
              path: relPath,
              modified: stats.mtime
            });
          } catch (error) {
            console.warn(`Warning: Could not stat file ${fullPath}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
    }
  }
  
  await scanDirectory(projectRoot);
  
  // Sort and limit summary data
  structure.summary.largestFiles = structure.summary.largestFiles
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);
    
  structure.summary.recentFiles = structure.summary.recentFiles
    .sort((a, b) => b.modified - a.modified)
    .slice(0, 10);
  
  return structure;
}

/**
 * Generate comprehensive project context and documentation
 */
export async function initializeProject(projectRoot = process.cwd()) {
  console.log('🚀 Initializing Roo project analysis...');
  
  const context = {
    timestamp: new Date().toISOString(),
    platform: {
      os: os.platform(),
      arch: os.arch(),
      node: process.version,
      cwd: projectRoot
    },
    structure: null,
    packageInfo: null,
    documentation: []
  };
  
  // Scan project structure
  console.log('📁 Scanning project structure...');
  context.structure = await scanProjectStructure(projectRoot);
  
  // Read package.json if it exists
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageContent = await fs.promises.readFile(packageJsonPath, 'utf8');
      context.packageInfo = JSON.parse(packageContent);
      console.log(`📦 Found package: ${context.packageInfo.name} v${context.packageInfo.version}`);
    } catch (error) {
      console.warn(`Warning: Could not parse package.json: ${error.message}`);
    }
  }
  
  // Find and catalog documentation files
  const docPatterns = /\.(md|txt|rst|adoc)$/i;
  for (const [filePath, fileInfo] of Object.entries(context.structure.files)) {
    if (docPatterns.test(fileInfo.extension)) {
      context.documentation.push({
        path: filePath,
        name: fileInfo.name,
        size: fileInfo.size,
        modified: fileInfo.modified
      });
    }
  }
  
  // Generate summary report
  console.log('📊 Project Analysis Summary:');
  console.log(`   Files: ${context.structure.summary.totalFiles}`);
  console.log(`   Directories: ${context.structure.summary.totalDirectories}`);
  console.log(`   Documentation files: ${context.documentation.length}`);
  console.log(`   File types: ${Object.keys(context.structure.summary.fileTypes).join(', ')}`);
  
  // Save context to file
  const contextPath = path.join(projectRoot, '.roo-context.json');
  await fs.promises.writeFile(contextPath, JSON.stringify(context, null, 2), 'utf8');
  console.log(`💾 Project context saved to: ${contextPath}`);
  
  return context;
}