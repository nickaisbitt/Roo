#!/usr/bin/env node

/**
 * Roo Development CLI
 * Provides development utilities for the Roo podcast automation project
 */

import { initializeProject, searchFiles, escapeFilePath, createCommand, executeRipgrepSearch } from './src/dev-tools.js';
import { spawn } from 'child_process';
import path from 'path';
import process from 'process';

const COMMANDS = {
  init: 'Initialize project scan and generate documentation/context',
  search: 'Search files with Unicode and whitespace support',
  rg: 'Fast search using ripgrep (if installed)',
  help: 'Show this help message'
};

function showHelp() {
  console.log('🎙️  Roo Development CLI\n');
  console.log('Usage: node roo-dev.js <command> [options]\n');
  console.log('Commands:');
  
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(10)} ${desc}`);
  }
  
  console.log('\nExamples:');
  console.log('  node roo-dev.js init                    # Initialize project analysis');
  console.log('  node roo-dev.js search "function"       # Search for "function" in code');
  console.log('  node roo-dev.js search "OAuth" --ext .js --ext .md');
  console.log('  node roo-dev.js rg "OAuth" --type js    # Fast search using ripgrep');
  console.log('');
}

async function handleInit(args) {
  const projectRoot = args[0] || process.cwd();
  
  try {
    console.log(`🚀 Initializing project at: ${projectRoot}`);
    const context = await initializeProject(projectRoot);
    
    console.log('\n✅ Project initialization complete!');
    console.log('\nGenerated files:');
    console.log(`   📄 .roo-context.json - Project structure and metadata`);
    
    if (context.documentation.length > 0) {
      console.log('\n📚 Found documentation files:');
      context.documentation.forEach(doc => {
        console.log(`   📖 ${doc.path}`);
      });
    }
    
    console.log('\n💡 Next steps:');
    console.log('   • Review generated context file');
    console.log('   • Use search command to explore codebase');
    console.log('   • Check diagnostics with: ./diagnostics.sh');
    
  } catch (error) {
    console.error('❌ Error during initialization:', error.message);
    process.exit(1);
  }
}

async function handleRipgrepSearch(args, options = {}) {
  if (args.length === 0) {
    console.error('❌ Search pattern is required');
    console.log('Usage: node roo-dev.js rg <pattern> [options]');
    console.log('Options:');
    console.log('  --type <type>        File type to search (e.g., js, md, json)');
    console.log('  --dir <directory>    Directory to search in (default: current directory)');
    console.log('  --case-sensitive     Enable case-sensitive search');
    console.log('  --whole-word         Match whole words only');
    console.log('  --max <number>       Maximum number of results per file (default: 100)');
    process.exit(1);
  }
  
  const pattern = args[0];
  const directory = options.dir || process.cwd();
  const fileTypes = options.type ? (Array.isArray(options.type) ? options.type : [options.type]) : [];
  const maxCount = parseInt(options.max) || 100;
  
  console.log(`⚡ Fast search for "${pattern}" using ripgrep`);
  console.log(`   Directory: ${directory}`);
  if (fileTypes.length > 0) {
    console.log(`   File types: ${fileTypes.join(', ')}`);
  }
  console.log(`   Max results per file: ${maxCount}`);
  console.log('');
  
  try {
    const results = await executeRipgrepSearch(pattern, {
      directory,
      fileTypes,
      maxCount,
      caseSensitive: options.caseSensitive,
      wholeWords: options.wholeWord
    });
    
    if (results.length === 0) {
      console.log('No matches found.');
      return;
    }
    
    console.log(`Found ${results.length} matches:\n`);
    
    let currentFile = '';
    results.forEach(result => {
      if (result.file !== currentFile) {
        currentFile = result.file;
        console.log(`📁 ${path.relative(directory, result.file)}`);
      }
      console.log(`   ${result.line}: ${result.content}`);
    });
    
  } catch (error) {
    console.error('❌ Ripgrep search failed:', error.message);
    console.log('\n💡 Falling back to built-in search...');
    
    // Fallback to built-in search
    await handleSearch(args, {
      ...options,
      ext: fileTypes.length > 0 ? fileTypes.map(t => `.${t}`) : undefined
    });
  }
}

async function handleSearch(args, options = {}) {
  if (args.length === 0) {
    console.error('❌ Search pattern is required');
    console.log('Usage: node roo-dev.js search <pattern> [options]');
    console.log('Options:');
    console.log('  --ext <extension>    File extensions to search (can be used multiple times)');
    console.log('  --dir <directory>    Directory to search in (default: current directory)');
    console.log('  --case-sensitive     Enable case-sensitive search');
    console.log('  --whole-word         Match whole words only');
    console.log('  --max <number>       Maximum number of results (default: 100)');
    process.exit(1);
  }
  
  const pattern = args[0];
  const directory = options.dir || process.cwd();
  const extensions = Array.isArray(options.ext) ? options.ext : (options.ext ? [options.ext] : ['.js', '.ts', '.json', '.md']);
  const maxResults = parseInt(options.max) || 100;
  
  console.log(`🔍 Searching for "${pattern}" in ${directory}`);
  console.log(`   Extensions: ${extensions.join(', ')}`);
  console.log(`   Max results: ${maxResults}`);
  console.log('');
  
  try {
    const results = await searchFiles(directory, pattern, {
      extensions: Array.isArray(extensions) ? extensions : [extensions],
      maxResults,
      ignoreCase: !options.caseSensitive,
      wholeWord: options.wholeWord
    });
    
    if (results.length === 0) {
      console.log('No matches found.');
      return;
    }
    
    console.log(`Found ${results.length} matches:\n`);
    
    let currentFile = '';
    results.forEach(result => {
      if (result.file !== currentFile) {
        currentFile = result.file;
        console.log(`📁 ${path.relative(directory, result.file)}`);
      }
      console.log(`   ${result.line}: ${result.content}`);
    });
    
    if (results.length >= maxResults) {
      console.log(`\n⚠️  Results limited to ${maxResults}. Use --max to increase limit.`);
    }
    
  } catch (error) {
    console.error('❌ Error during search:', error.message);
    process.exit(1);
  }
}

function parseArgs(argv) {
  const args = [];
  const options = {};
  
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];
      
      if (nextArg && !nextArg.startsWith('--')) {
        // Option with value
        if (options[key]) {
          // Convert to array if multiple values
          if (Array.isArray(options[key])) {
            options[key].push(nextArg);
          } else {
            options[key] = [options[key], nextArg];
          }
        } else {
          options[key] = nextArg;
        }
        i++; // Skip next arg since we consumed it
      } else {
        // Boolean flag
        options[key] = true;
      }
    } else {
      args.push(arg);
    }
  }
  
  return { args, options };
}

async function main() {
  const { args, options } = parseArgs(process.argv);
  const command = args[0];
  const commandArgs = args.slice(1);
  
  switch (command) {
    case 'init':
      await handleInit(commandArgs);
      break;
      
    case 'search':
      await handleSearch(commandArgs, options);
      break;
      
    case 'rg':
      await handleRipgrepSearch(commandArgs, options);
      break;
      
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      showHelp();
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('Use "node roo-dev.js help" to see available commands.');
      process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled promise rejection:', reason);
  process.exit(1);
});

// Run the CLI
main().catch(error => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});