# 🎮 Roo n8n Developer Experience Toolkit

## 🎯 Complete Developer Toolkit

Advanced tools and utilities for developing, debugging, and maintaining the Roo n8n podcast automation workflow.

## 🛠️ Development Environment Setup

### VS Code Integration

```json
// .vscode/settings.json
{
  "n8n.instanceUrl": "http://localhost:5678",
  "n8n.webhookUrl": "http://localhost:5678",
  "files.associations": {
    "*.n8n": "json"
  },
  "json.schemas": [
    {
      "fileMatch": ["*.n8n", "n8n-workflow.json"],
      "url": "https://raw.githubusercontent.com/n8n-io/n8n/master/packages/nodes-base/dist/nodes/n8n-nodes-base.json"
    }
  ],
  "emmet.includeLanguages": {
    "n8n": "javascript"
  }
}

// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start n8n Development",
      "type": "shell",
      "command": "docker-compose -f docker-compose.dev.yml up -d",
      "group": "build",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "Import Workflow",
      "type": "shell",
      "command": "./scripts/import-workflow.sh",
      "group": "build"
    },
    {
      "label": "Run Tests",
      "type": "shell",
      "command": "./run-tests.sh",
      "group": "test"
    },
    {
      "label": "Validate Workflow",
      "type": "shell",
      "command": "node scripts/validate-workflow.js",
      "group": "test"
    }
  ]
}

// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Workflow Execution",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/debug/workflow-debugger.js",
      "env": {
        "N8N_HOST": "http://localhost:5678",
        "DEBUG_WORKFLOW_ID": "roo-workflow"
      }
    },
    {
      "name": "Test Episode Generation",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/debug/test-episode.js",
      "args": ["--episode", "test-episode.json"]
    }
  ]
}
```

### Development Docker Compose

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  n8n-dev:
    image: n8nio/n8n:latest
    container_name: roo-n8n-dev
    restart: unless-stopped
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres-dev
      - DB_POSTGRESDB_DATABASE=n8n_dev
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=dev_password
      - N8N_BASIC_AUTH_ACTIVE=false
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678/
      - N8N_LOG_LEVEL=debug
      - N8N_METRICS=true
      - QUEUE_BULL_REDIS_HOST=redis-dev
      - N8N_ENCRYPTION_KEY=dev_encryption_key_32_characters
      # Development environment variables
      - GOOGLE_SHEETS_SPREADSHEET_ID=${DEV_GOOGLE_SHEETS_ID}
      - GOOGLE_SHEETS_TAB_NAME=Episodes
      - GOOGLE_SERVICE_ACCOUNT_JSON=${DEV_GOOGLE_SERVICE_ACCOUNT_JSON}
      - OPENAI_API_KEY=${DEV_OPENAI_API_KEY}
      - OPENAI_TEXT_MODEL=gpt-4o
      - SPREAKER_CLIENT_ID=${DEV_SPREAKER_CLIENT_ID}
      - SPREAKER_CLIENT_SECRET=${DEV_SPREAKER_CLIENT_SECRET}
      - SPREAKER_REFRESH_TOKEN=${DEV_SPREAKER_REFRESH_TOKEN}
      - SPREAKER_SHOW_ID=${DEV_SPREAKER_SHOW_ID}
      - MAX_EPISODES_PER_RUN=1
      - DRY_RUN=true
      - EPISODE_TIMEZONE=UTC
    ports:
      - "5678:5678"
    volumes:
      - n8n_dev_data:/home/node/.n8n
      - ./workflows:/home/node/.n8n/workflows
      - ./scripts:/scripts:ro
    depends_on:
      - postgres-dev
      - redis-dev
    networks:
      - roo-dev-network

  postgres-dev:
    image: postgres:15-alpine
    container_name: roo-postgres-dev
    restart: unless-stopped
    environment:
      - POSTGRES_DB=n8n_dev
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=dev_password
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    networks:
      - roo-dev-network

  redis-dev:
    image: redis:7-alpine
    container_name: roo-redis-dev
    restart: unless-stopped
    networks:
      - roo-dev-network

  # Development tools
  workflow-validator:
    build:
      context: .
      dockerfile: Dockerfile.validator
    container_name: roo-validator
    volumes:
      - ./:/workspace
    networks:
      - roo-dev-network
    profiles:
      - tools

volumes:
  n8n_dev_data:
  postgres_dev_data:

networks:
  roo-dev-network:
    driver: bridge
```

## 🔧 Development Scripts

### Workflow Development CLI

```javascript
#!/usr/bin/env node
// roo-dev-cli.js - Development CLI for Roo workflow

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('roo-dev')
  .description('Roo n8n Development CLI')
  .version('1.0.0');

// Workflow commands
program
  .command('import')
  .description('Import workflow to development n8n instance')
  .option('-f, --file <file>', 'Workflow file path', 'n8n-workflow.json')
  .action(async (options) => {
    console.log(chalk.blue('📥 Importing workflow...'));
    await importWorkflow(options.file);
  });

program
  .command('export')
  .description('Export workflow from n8n instance')
  .option('-i, --id <id>', 'Workflow ID')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    console.log(chalk.blue('📤 Exporting workflow...'));
    await exportWorkflow(options.id, options.output);
  });

program
  .command('validate')
  .description('Validate workflow structure and configuration')
  .option('-f, --file <file>', 'Workflow file path', 'n8n-workflow.json')
  .action(async (options) => {
    console.log(chalk.blue('🔍 Validating workflow...'));
    await validateWorkflow(options.file);
  });

// Episode commands
program
  .command('test-episode')
  .description('Test episode generation with sample data')
  .option('-t, --type <type>', 'Episode type (main|friday)', 'main')
  .option('--topic <topic>', 'Episode topic')
  .option('--dry-run', 'Run without uploading')
  .action(async (options) => {
    console.log(chalk.blue('🧪 Testing episode generation...'));
    await testEpisodeGeneration(options);
  });

program
  .command('debug-execution')
  .description('Debug workflow execution step by step')
  .option('-e, --execution <id>', 'Execution ID')
  .action(async (options) => {
    console.log(chalk.blue('🐛 Starting execution debugger...'));
    await debugExecution(options.execution);
  });

// Environment commands
program
  .command('setup-env')
  .description('Interactive environment setup')
  .action(async () => {
    console.log(chalk.blue('⚙️ Setting up development environment...'));
    await setupEnvironment();
  });

program
  .command('check-apis')
  .description('Check API connectivity and credentials')
  .action(async () => {
    console.log(chalk.blue('🔗 Checking API connections...'));
    await checkAPIs();
  });

// Utility functions
async function importWorkflow(filePath) {
  try {
    const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Import to n8n
    const response = await fetch('http://localhost:5678/api/v1/workflows/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(chalk.green(`✅ Workflow imported successfully. ID: ${result.id}`));
    } else {
      console.log(chalk.red(`❌ Import failed: ${await response.text()}`));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function validateWorkflow(filePath) {
  try {
    const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const validator = new WorkflowValidator(workflow);
    const results = validator.validate();
    
    if (results.valid) {
      console.log(chalk.green('✅ Workflow validation passed'));
      console.log(`📊 Statistics:`);
      console.log(`   - Nodes: ${results.nodeCount}`);
      console.log(`   - Connections: ${results.connectionCount}`);
      console.log(`   - Credentials: ${results.credentialCount}`);
    } else {
      console.log(chalk.red('❌ Workflow validation failed'));
      results.errors.forEach(error => {
        console.log(chalk.red(`   - ${error}`));
      });
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function testEpisodeGeneration(options) {
  const episode = {
    type: options.type,
    topic: options.topic || 'Sample Episode Topic',
    publish_date: new Date().toLocaleDateString('en-GB'),
    _inputString: `${options.type} episode test`
  };

  try {
    const response = await fetch('http://localhost:5678/api/v1/workflows/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowData: { 
          name: 'Roo Podcast Automation',
          nodes: [] // Simplified for testing
        },
        runData: {
          'Initialize Workflow': [{
            json: { 
              config: { 
                DRY_RUN: options.dryRun || true,
                MAX_EPISODES: 1
              }
            }
          }],
          'Filter Episodes': [{
            json: episode
          }]
        }
      })
    });

    const result = await response.json();
    
    if (result.finished) {
      console.log(chalk.green('✅ Episode generation completed'));
      console.log('📝 Generated content preview:');
      // Display content preview
    } else {
      console.log(chalk.red('❌ Episode generation failed'));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function setupEnvironment() {
  const questions = [
    {
      type: 'input',
      name: 'googleSheetsId',
      message: 'Google Sheets Spreadsheet ID:'
    },
    {
      type: 'input',
      name: 'openaiApiKey',
      message: 'OpenAI API Key:'
    },
    {
      type: 'input',
      name: 'sprekerClientId',
      message: 'Spreaker Client ID:'
    },
    {
      type: 'input',
      name: 'sprekerShowId',
      message: 'Spreaker Show ID:'
    }
  ];

  const answers = await inquirer.prompt(questions);
  
  // Generate .env.dev file
  const envContent = Object.entries(answers)
    .map(([key, value]) => `DEV_${key.toUpperCase()}=${value}`)
    .join('\n');
    
  fs.writeFileSync('.env.dev', envContent);
  console.log(chalk.green('✅ Environment configuration saved to .env.dev'));
}

class WorkflowValidator {
  constructor(workflow) {
    this.workflow = workflow;
    this.errors = [];
  }

  validate() {
    this.validateNodes();
    this.validateConnections();
    this.validateCredentials();
    
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      nodeCount: this.workflow.nodes?.length || 0,
      connectionCount: Object.keys(this.workflow.connections || {}).length,
      credentialCount: this.countCredentials()
    };
  }

  validateNodes() {
    if (!this.workflow.nodes || !Array.isArray(this.workflow.nodes)) {
      this.errors.push('No nodes found in workflow');
      return;
    }

    const requiredNodes = [
      'Weekly Trigger',
      'Initialize Workflow', 
      'Read Episode Data',
      'Filter Episodes',
      'Generate Content',
      'Upload to Spreaker'
    ];

    const nodeNames = this.workflow.nodes.map(n => n.name);
    const missingNodes = requiredNodes.filter(name => !nodeNames.includes(name));
    
    if (missingNodes.length > 0) {
      this.errors.push(`Missing required nodes: ${missingNodes.join(', ')}`);
    }
  }

  validateConnections() {
    // Validate that all nodes are properly connected
    const connections = this.workflow.connections || {};
    const nodeIds = this.workflow.nodes.map(n => n.id);
    
    for (const nodeId of nodeIds) {
      if (!connections[nodeId] && nodeId !== 'Weekly Trigger') {
        this.errors.push(`Node ${nodeId} has no connections`);
      }
    }
  }

  validateCredentials() {
    const requiredCredentials = ['openai-credentials'];
    // Add validation logic for credentials
  }
}

program.parse();
```

### Workflow Debugger

```javascript
// debug/workflow-debugger.js - Interactive workflow debugger
import readline from 'readline';
import chalk from 'chalk';

class WorkflowDebugger {
  constructor(n8nHost, workflowId) {
    this.n8nHost = n8nHost;
    this.workflowId = workflowId;
    this.executionId = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log(chalk.blue('🐛 Roo Workflow Debugger'));
    console.log(chalk.gray('Commands: start, step, inspect <node>, vars, continue, quit'));
    
    this.prompt();
  }

  prompt() {
    this.rl.question(chalk.cyan('debug> '), async (input) => {
      await this.handleCommand(input.trim());
      this.prompt();
    });
  }

  async handleCommand(command) {
    const [cmd, ...args] = command.split(' ');
    
    switch (cmd) {
      case 'start':
        await this.startExecution();
        break;
      case 'step':
        await this.stepExecution();
        break;
      case 'inspect':
        await this.inspectNode(args[0]);
        break;
      case 'vars':
        await this.showVariables();
        break;
      case 'continue':
        await this.continueExecution();
        break;
      case 'quit':
        this.rl.close();
        process.exit(0);
      default:
        console.log(chalk.red('Unknown command. Try: start, step, inspect, vars, continue, quit'));
    }
  }

  async startExecution() {
    try {
      console.log(chalk.blue('▶️ Starting workflow execution...'));
      
      const response = await fetch(`${this.n8nHost}/api/v1/workflows/${this.workflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: 'manual',
          startNodes: ['Weekly Trigger'],
          runData: {}
        })
      });
      
      const result = await response.json();
      this.executionId = result.executionId;
      
      console.log(chalk.green(`✅ Execution started. ID: ${this.executionId}`));
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  async stepExecution() {
    if (!this.executionId) {
      console.log(chalk.red('❌ No active execution. Use "start" first.'));
      return;
    }

    try {
      // Get current execution status
      const response = await fetch(`${this.n8nHost}/api/v1/executions/${this.executionId}`);
      const execution = await response.json();
      
      console.log(chalk.blue(`📍 Current Status: ${execution.status}`));
      console.log(chalk.blue(`📊 Completed Nodes: ${Object.keys(execution.data.runData || {}).length}`));
      
      // Show next node to execute
      const nextNode = this.getNextNode(execution);
      if (nextNode) {
        console.log(chalk.yellow(`⏭️ Next Node: ${nextNode}`));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  async inspectNode(nodeName) {
    if (!this.executionId) {
      console.log(chalk.red('❌ No active execution. Use "start" first.'));
      return;
    }

    try {
      const response = await fetch(`${this.n8nHost}/api/v1/executions/${this.executionId}`);
      const execution = await response.json();
      
      const nodeData = execution.data.runData[nodeName];
      if (nodeData) {
        console.log(chalk.green(`🔍 Node: ${nodeName}`));
        console.log(chalk.gray('Input Data:'));
        console.log(JSON.stringify(nodeData[0]?.data?.main?.[0] || {}, null, 2));
        
        if (nodeData[0]?.error) {
          console.log(chalk.red('❌ Error:'));
          console.log(nodeData[0].error.message);
        }
      } else {
        console.log(chalk.red(`❌ Node "${nodeName}" not found or not executed yet`));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  async showVariables() {
    if (!this.executionId) {
      console.log(chalk.red('❌ No active execution. Use "start" first.'));
      return;
    }

    try {
      const response = await fetch(`${this.n8nHost}/api/v1/executions/${this.executionId}`);
      const execution = await response.json();
      
      console.log(chalk.green('📋 Execution Variables:'));
      
      // Show environment variables
      console.log(chalk.blue('Environment:'));
      const envVars = Object.keys(process.env)
        .filter(key => key.startsWith('GOOGLE_') || key.startsWith('OPENAI_') || key.startsWith('SPREAKER_'))
        .reduce((obj, key) => {
          obj[key] = key.includes('SECRET') || key.includes('TOKEN') || key.includes('KEY') 
            ? '***HIDDEN***' 
            : process.env[key];
          return obj;
        }, {});
      
      console.log(JSON.stringify(envVars, null, 2));
      
      // Show workflow data
      if (execution.data.runData) {
        console.log(chalk.blue('Workflow Data:'));
        const nodeCount = Object.keys(execution.data.runData).length;
        console.log(`Executed nodes: ${nodeCount}`);
        Object.keys(execution.data.runData).forEach(nodeName => {
          const data = execution.data.runData[nodeName][0]?.data?.main?.[0]?.[0]?.json;
          if (data) {
            console.log(`  ${nodeName}: ${Object.keys(data).length} properties`);
          }
        });
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  getNextNode(execution) {
    // Logic to determine next node in workflow
    const runData = execution.data.runData || {};
    const completedNodes = Object.keys(runData);
    
    // This would need to be enhanced based on workflow structure
    const nodeOrder = [
      'Weekly Trigger',
      'Initialize Workflow',
      'Read Episode Data',
      'Filter Episodes',
      'Generate Content',
      'Upload to Spreaker'
    ];
    
    return nodeOrder.find(node => !completedNodes.includes(node));
  }
}

// Start debugger
if (process.env.DEBUG_WORKFLOW_ID) {
  const debugger = new WorkflowDebugger(
    process.env.N8N_HOST || 'http://localhost:5678',
    process.env.DEBUG_WORKFLOW_ID
  );
  debugger.start();
}
```

### Performance Monitor

```javascript
// monitor/performance-monitor.js - Real-time performance monitoring
import EventEmitter from 'events';
import chalk from 'chalk';

class PerformanceMonitor extends EventEmitter {
  constructor(n8nHost) {
    super();
    this.n8nHost = n8nHost;
    this.metrics = {
      executions: [],
      errors: [],
      performance: {}
    };
    this.isMonitoring = false;
  }

  async start() {
    console.log(chalk.blue('📊 Starting performance monitor...'));
    this.isMonitoring = true;
    
    // Monitor workflow executions
    setInterval(() => this.checkExecutions(), 5000);
    
    // Monitor system metrics
    setInterval(() => this.collectSystemMetrics(), 10000);
    
    // Display dashboard
    setInterval(() => this.displayDashboard(), 30000);
    
    console.log(chalk.green('✅ Performance monitor started'));
  }

  async checkExecutions() {
    if (!this.isMonitoring) return;

    try {
      const response = await fetch(`${this.n8nHost}/api/v1/executions?limit=10`);
      const executions = await response.json();
      
      executions.data.forEach(execution => {
        if (!this.metrics.executions.find(e => e.id === execution.id)) {
          this.metrics.executions.push({
            id: execution.id,
            status: execution.status,
            startTime: execution.startedAt,
            endTime: execution.stoppedAt,
            duration: execution.stoppedAt 
              ? new Date(execution.stoppedAt) - new Date(execution.startedAt)
              : null
          });
          
          if (execution.status === 'error') {
            this.metrics.errors.push(execution);
            this.emit('error', execution);
          }
          
          if (execution.status === 'success') {
            this.emit('success', execution);
          }
        }
      });
    } catch (error) {
      console.log(chalk.red(`❌ Monitor error: ${error.message}`));
    }
  }

  async collectSystemMetrics() {
    // Collect system performance metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime()
    };
    
    this.metrics.performance[metrics.timestamp] = metrics;
    
    // Keep only last 100 measurements
    const keys = Object.keys(this.metrics.performance);
    if (keys.length > 100) {
      const toDelete = keys.slice(0, keys.length - 100);
      toDelete.forEach(key => delete this.metrics.performance[key]);
    }
  }

  displayDashboard() {
    console.clear();
    console.log(chalk.blue.bold('🎙️ Roo Podcast Automation - Performance Dashboard\n'));
    
    // Execution statistics
    const recent = this.metrics.executions.slice(-10);
    const successful = recent.filter(e => e.status === 'success').length;
    const failed = recent.filter(e => e.status === 'error').length;
    const running = recent.filter(e => e.status === 'running').length;
    
    console.log(chalk.green(`📊 Executions (Last 10):`));
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   🔄 Running: ${running}`);
    console.log(`   📈 Success Rate: ${successful > 0 ? (successful / (successful + failed) * 100).toFixed(1) : 0}%\n`);
    
    // Performance metrics
    const latestMetrics = Object.values(this.metrics.performance).slice(-1)[0];
    if (latestMetrics) {
      console.log(chalk.blue(`🖥️ System Performance:`));
      console.log(`   💾 Memory Usage: ${(latestMetrics.memory.heapUsed / 1024 / 1024).toFixed(1)} MB`);
      console.log(`   ⏱️ Uptime: ${(latestMetrics.uptime / 3600).toFixed(1)} hours\n`);
    }
    
    // Recent errors
    const recentErrors = this.metrics.errors.slice(-3);
    if (recentErrors.length > 0) {
      console.log(chalk.red(`🚨 Recent Errors:`));
      recentErrors.forEach(error => {
        console.log(`   - ${error.startedAt}: ${error.data?.lastNodeExecuted || 'Unknown node'}`);
      });
      console.log('');
    }
    
    // Average execution time
    const durations = recent
      .filter(e => e.duration)
      .map(e => e.duration);
      
    if (durations.length > 0) {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(chalk.yellow(`⏱️ Average Execution Time: ${(avgDuration / 1000).toFixed(1)} seconds\n`));
    }
    
    console.log(chalk.gray(`Last updated: ${new Date().toLocaleTimeString()}`));
    console.log(chalk.gray('Press Ctrl+C to stop monitoring\n'));
  }

  stop() {
    this.isMonitoring = false;
    console.log(chalk.blue('📊 Performance monitor stopped'));
  }
}

// Event handlers
const monitor = new PerformanceMonitor(process.env.N8N_HOST || 'http://localhost:5678');

monitor.on('error', (execution) => {
  console.log(chalk.red(`🚨 Execution failed: ${execution.id}`));
});

monitor.on('success', (execution) => {
  console.log(chalk.green(`✅ Execution completed: ${execution.id}`));
});

// Start monitoring
if (require.main === module) {
  monitor.start();
  
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });
}

export { PerformanceMonitor };
```

## 🎯 IDE Extensions and Tools

### n8n Workflow Language Support

```json
// n8n-workflow-language.json - VS Code language definition
{
  "scopeName": "source.n8n",
  "patterns": [
    {
      "include": "#workflow"
    }
  ],
  "repository": {
    "workflow": {
      "patterns": [
        {
          "include": "#nodes"
        },
        {
          "include": "#connections"
        },
        {
          "include": "#metadata"
        }
      ]
    },
    "nodes": {
      "begin": "\"nodes\"\\s*:",
      "end": "(?=\\])",
      "patterns": [
        {
          "include": "#node-definition"
        }
      ]
    },
    "node-definition": {
      "begin": "\\{",
      "end": "\\}",
      "patterns": [
        {
          "match": "\"(id|name|type|position)\"",
          "name": "entity.name.tag.n8n"
        },
        {
          "match": "\"parameters\"",
          "name": "entity.name.function.n8n"
        }
      ]
    }
  }
}
```

### Workflow Snippet Library

```json
// .vscode/snippets/n8n.json
{
  "OpenAI Chat Node": {
    "prefix": "openai-chat",
    "body": [
      "{",
      "  \"parameters\": {",
      "    \"model\": \"gpt-4o\",",
      "    \"messages\": [",
      "      {",
      "        \"role\": \"user\",",
      "        \"content\": \"$1\"",
      "      }",
      "    ],",
      "    \"temperature\": 0.7,",
      "    \"max_tokens\": $2",
      "  },",
      "  \"id\": \"$3\",",
      "  \"name\": \"$4\",",
      "  \"type\": \"@n8n/n8n-nodes-langchain.openAi\",",
      "  \"typeVersion\": 1.3,",
      "  \"position\": [$5, $6]",
      "}"
    ],
    "description": "OpenAI Chat Completion Node"
  },
  "Google Sheets Read": {
    "prefix": "sheets-read",
    "body": [
      "{",
      "  \"parameters\": {",
      "    \"authentication\": \"serviceAccount\",",
      "    \"serviceAccountJSON\": \"={{ \\$vars.GOOGLE_SERVICE_ACCOUNT_JSON }}\",",
      "    \"documentId\": \"={{ \\$vars.GOOGLE_SHEETS_SPREADSHEET_ID }}\",",
      "    \"sheetName\": \"{{ \\$vars.GOOGLE_SHEETS_TAB_NAME }}\",",
      "    \"operation\": \"readRows\"",
      "  },",
      "  \"id\": \"$1\",",
      "  \"name\": \"$2\",",
      "  \"type\": \"n8n-nodes-base.googleSheets\",",
      "  \"typeVersion\": 4,",
      "  \"position\": [$3, $4]",
      "}"
    ],
    "description": "Google Sheets Read Operation"
  },
  "Episode Filter Logic": {
    "prefix": "episode-filter",
    "body": [
      "// Filter episodes for processing",
      "const rows = \\$input.all();",
      "const config = \\$('Initialize Workflow').first().json.config;",
      "const now = new Date();",
      "",
      "const candidates = [];",
      "for (const item of rows) {",
      "  const row = item.json;",
      "  const pubRaw = row['publish_date'] || row['date'] || '';",
      "  ",
      "  if (!pubRaw || pubRaw.trim() === '') continue;",
      "  ",
      "  // Parse date logic here",
      "  $1",
      "}",
      "",
      "return candidates.map(episode => ({ json: episode }));"
    ],
    "description": "Episode filtering logic template"
  }
}
```

This comprehensive developer toolkit provides everything needed for efficient development, debugging, and maintenance of the Roo n8n workflow system.