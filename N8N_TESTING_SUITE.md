# 🧪 Roo n8n Testing & Validation Suite

## 🎯 Comprehensive Testing Framework

Complete testing infrastructure to ensure the n8n workflow maintains 100% compatibility with the original Node.js implementation.

## 📋 Testing Strategy

### Test Levels
1. **Unit Tests**: Individual node functionality
2. **Integration Tests**: API connectivity and data flow
3. **End-to-End Tests**: Complete workflow execution
4. **Performance Tests**: Load and stress testing
5. **Regression Tests**: Compatibility validation
6. **User Acceptance Tests**: Real-world scenarios

## 🔬 Test Implementation

### 1. Workflow Validation Framework

```javascript
// test-framework.js - n8n Workflow Testing Framework
import axios from 'axios';
import fs from 'fs';
import path from 'path';

class N8NWorkflowTester {
  constructor(n8nHost, apiKey) {
    this.n8nHost = n8nHost;
    this.apiKey = apiKey;
    this.testResults = [];
  }

  // Execute workflow with test data
  async executeWorkflow(workflowId, testData) {
    try {
      const response = await axios.post(
        `${this.n8nHost}/api/v1/workflows/${workflowId}/execute`,
        { data: testData },
        { headers: { Authorization: `Bearer ${this.apiKey}` } }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Workflow execution failed: ${error.message}`);
    }
  }

  // Validate workflow structure
  async validateWorkflowStructure(workflowId) {
    const workflow = await this.getWorkflow(workflowId);
    const validationResults = {
      nodeCount: workflow.nodes.length,
      requiredNodes: this.validateRequiredNodes(workflow.nodes),
      connections: this.validateConnections(workflow.connections),
      credentials: this.validateCredentials(workflow.nodes)
    };
    
    return validationResults;
  }

  // Compare outputs with reference implementation
  async compareWithReference(workflowOutput, referenceOutput) {
    const comparison = {
      contentMatch: this.compareContent(workflowOutput.script, referenceOutput.script),
      metadataMatch: this.compareMetadata(workflowOutput, referenceOutput),
      timingComparison: this.compareTiming(workflowOutput, referenceOutput),
      qualityScore: this.calculateQualityScore(workflowOutput, referenceOutput)
    };
    
    return comparison;
  }

  // Generate test report
  generateTestReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: this.testResults.length,
      passed: this.testResults.filter(t => t.status === 'PASS').length,
      failed: this.testResults.filter(t => t.status === 'FAIL').length,
      details: this.testResults
    };
    
    fs.writeFileSync('./test-results.json', JSON.stringify(report, null, 2));
    return report;
  }
}
```

### 2. Episode Generation Test Suite

```javascript
// episode-generation-tests.js - Test episode content generation
import { N8NWorkflowTester } from './test-framework.js';

class EpisodeGenerationTests {
  constructor(tester) {
    this.tester = tester;
    this.testCases = [
      {
        name: 'Main Episode - Trauma Response',
        type: 'main',
        topic: 'Understanding Fight Flight Freeze Response',
        publishDate: '15/01/2024',
        expectedSections: 9,
        expectedWordCount: 9500
      },
      {
        name: 'Friday Healing - Self Compassion',
        type: 'friday', 
        topic: 'Practicing Self-Compassion When Triggered',
        publishDate: '19/01/2024',
        expectedSections: 6,
        expectedWordCount: 3200
      },
      {
        name: 'Edge Case - Empty Topic',
        type: 'main',
        topic: '',
        publishDate: '22/01/2024',
        shouldFail: true
      }
    ];
  }

  async runAllTests() {
    const results = [];
    
    for (const testCase of this.testCases) {
      console.log(`🧪 Running test: ${testCase.name}`);
      const result = await this.runTest(testCase);
      results.push(result);
    }
    
    return results;
  }

  async runTest(testCase) {
    try {
      const startTime = Date.now();
      
      // Execute workflow with test data
      const workflowResult = await this.tester.executeWorkflow('roo-workflow', {
        episode: testCase
      });
      
      const executionTime = Date.now() - startTime;
      
      // Validate results
      const validation = this.validateGeneration(workflowResult, testCase);
      
      return {
        testName: testCase.name,
        status: validation.passed ? 'PASS' : 'FAIL',
        executionTime,
        validation,
        output: workflowResult
      };
      
    } catch (error) {
      return {
        testName: testCase.name,
        status: testCase.shouldFail ? 'PASS' : 'FAIL',
        error: error.message
      };
    }
  }

  validateGeneration(result, testCase) {
    const validation = {
      passed: true,
      issues: []
    };

    // Check section count
    if (result.sections.length !== testCase.expectedSections) {
      validation.passed = false;
      validation.issues.push(
        `Section count mismatch: expected ${testCase.expectedSections}, got ${result.sections.length}`
      );
    }

    // Check word count
    const totalWords = result.sections.reduce((sum, section) => sum + section.wordCount, 0);
    if (Math.abs(totalWords - testCase.expectedWordCount) > 500) {
      validation.passed = false;
      validation.issues.push(
        `Word count outside tolerance: expected ~${testCase.expectedWordCount}, got ${totalWords}`
      );
    }

    // Check content quality
    if (!this.validateContentQuality(result.script)) {
      validation.passed = false;
      validation.issues.push('Content quality validation failed');
    }

    return validation;
  }

  validateContentQuality(script) {
    // Check for required elements
    const hasWelcome = script.includes('welcome') || script.includes('Welcome');
    const hasSuppotersClub = script.includes('Supporters Club');
    const hasPersonalStory = script.toLowerCase().includes('story') || 
                           script.toLowerCase().includes('experience');
    
    return hasWelcome && hasSuppotersClub && hasPersonalStory;
  }
}
```

### 3. API Integration Tests

```javascript
// api-integration-tests.js - Test external API integrations
class APIIntegrationTests {
  constructor() {
    this.endpoints = {
      openai: 'https://api.openai.com/v1',
      googleSheets: 'https://sheets.googleapis.com/v4',
      spreaker: 'https://api.spreaker.com/v2'
    };
  }

  async testOpenAIIntegration() {
    console.log('🔍 Testing OpenAI API integration...');
    
    const tests = [
      {
        name: 'Chat Completion',
        endpoint: '/chat/completions',
        payload: {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Test message' }],
          max_tokens: 100
        }
      },
      {
        name: 'Text-to-Speech',
        endpoint: '/audio/speech',
        payload: {
          model: 'tts-1',
          voice: 'fable',
          input: 'Test audio generation'
        }
      }
    ];

    const results = [];
    for (const test of tests) {
      try {
        const response = await this.makeAPICall('openai', test.endpoint, test.payload);
        results.push({
          name: test.name,
          status: 'PASS',
          responseTime: response.duration,
          statusCode: response.status
        });
      } catch (error) {
        results.push({
          name: test.name,
          status: 'FAIL',
          error: error.message
        });
      }
    }
    
    return results;
  }

  async testGoogleSheetsIntegration() {
    console.log('🔍 Testing Google Sheets API integration...');
    
    try {
      // Test reading from sheets
      const readResult = await this.readTestSheet();
      
      // Test writing to sheets
      const writeResult = await this.writeTestData();
      
      return {
        read: readResult,
        write: writeResult,
        status: readResult.status === 'PASS' && writeResult.status === 'PASS' ? 'PASS' : 'FAIL'
      };
      
    } catch (error) {
      return {
        status: 'FAIL',
        error: error.message
      };
    }
  }

  async testSprekerIntegration() {
    console.log('🔍 Testing Spreaker API integration...');
    
    const tests = [
      {
        name: 'Token Refresh',
        action: () => this.testTokenRefresh()
      },
      {
        name: 'Show Information',
        action: () => this.testShowInfo()
      },
      {
        name: 'Upload Validation',
        action: () => this.testUploadValidation()
      }
    ];

    const results = [];
    for (const test of tests) {
      try {
        const result = await test.action();
        results.push({
          name: test.name,
          status: result.success ? 'PASS' : 'FAIL',
          details: result
        });
      } catch (error) {
        results.push({
          name: test.name,
          status: 'FAIL',
          error: error.message
        });
      }
    }
    
    return results;
  }
}
```

### 4. Performance Test Suite

```javascript
// performance-tests.js - Load and performance testing
class PerformanceTests {
  constructor(n8nHost, apiKey) {
    this.n8nHost = n8nHost;
    this.apiKey = apiKey;
    this.metrics = {
      executionTimes: [],
      memoryUsage: [],
      cpuUsage: [],
      errorRates: []
    };
  }

  async runLoadTest(concurrentExecutions = 5, duration = 300000) {
    console.log(`🏋️ Running load test: ${concurrentExecutions} concurrent executions for ${duration/1000}s`);
    
    const startTime = Date.now();
    const promises = [];
    
    // Start concurrent workflow executions
    for (let i = 0; i < concurrentExecutions; i++) {
      promises.push(this.runContinuousExecution(startTime + duration));
    }
    
    // Monitor system metrics
    const monitoringPromise = this.monitorSystemMetrics(startTime + duration);
    promises.push(monitoringPromise);
    
    // Wait for test completion
    await Promise.all(promises);
    
    return this.generatePerformanceReport();
  }

  async runContinuousExecution(endTime) {
    while (Date.now() < endTime) {
      try {
        const start = Date.now();
        await this.executeTestWorkflow();
        const duration = Date.now() - start;
        
        this.metrics.executionTimes.push({
          timestamp: new Date().toISOString(),
          duration
        });
        
        // Wait before next execution
        await new Promise(resolve => setTimeout(resolve, 10000));
        
      } catch (error) {
        this.metrics.errorRates.push({
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    }
  }

  async executeTestWorkflow() {
    const testData = {
      episode: {
        type: 'main',
        topic: 'Performance Test Episode',
        publishDate: '01/01/2024'
      }
    };
    
    return await axios.post(
      `${this.n8nHost}/api/v1/workflows/roo-workflow/execute`,
      { data: testData },
      { 
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 120000
      }
    );
  }

  generatePerformanceReport() {
    const avgExecutionTime = this.metrics.executionTimes.reduce((sum, m) => sum + m.duration, 0) / this.metrics.executionTimes.length;
    const maxExecutionTime = Math.max(...this.metrics.executionTimes.map(m => m.duration));
    const minExecutionTime = Math.min(...this.metrics.executionTimes.map(m => m.duration));
    const errorRate = (this.metrics.errorRates.length / this.metrics.executionTimes.length) * 100;

    return {
      summary: {
        totalExecutions: this.metrics.executionTimes.length,
        avgExecutionTime: Math.round(avgExecutionTime),
        maxExecutionTime,
        minExecutionTime,
        errorRate: errorRate.toFixed(2)
      },
      recommendations: this.generateRecommendations(avgExecutionTime, errorRate),
      rawMetrics: this.metrics
    };
  }
}
```

### 5. Regression Test Suite

```javascript
// regression-tests.js - Ensure compatibility with reference implementation
class RegressionTests {
  constructor() {
    this.referenceResults = this.loadReferenceData();
    this.tolerances = {
      wordCount: 0.05, // 5% tolerance
      executionTime: 0.2, // 20% tolerance
      contentSimilarity: 0.95 // 95% similarity required
    };
  }

  async runRegressionSuite() {
    console.log('🔄 Running regression test suite...');
    
    const tests = [
      this.testContentGeneration,
      this.testMetadataGeneration,
      this.testAudioSynthesis,
      this.testSpreaderUpload,
      this.testErrorHandling
    ];

    const results = [];
    for (const test of tests) {
      const result = await test.call(this);
      results.push(result);
    }
    
    return this.generateRegressionReport(results);
  }

  async testContentGeneration() {
    console.log('  📝 Testing content generation...');
    
    const testCases = this.referenceResults.contentGeneration;
    const results = [];
    
    for (const testCase of testCases) {
      const n8nResult = await this.generateContent(testCase.input);
      const comparison = this.compareContent(n8nResult, testCase.expected);
      
      results.push({
        input: testCase.input,
        similarity: comparison.similarity,
        wordCountMatch: comparison.wordCountMatch,
        passed: comparison.similarity >= this.tolerances.contentSimilarity
      });
    }
    
    return {
      testName: 'Content Generation',
      results,
      overallPass: results.every(r => r.passed)
    };
  }

  compareContent(generated, reference) {
    // Calculate content similarity using various metrics
    const wordCountDiff = Math.abs(generated.wordCount - reference.wordCount) / reference.wordCount;
    const similarity = this.calculateCosineSimilarity(generated.text, reference.text);
    
    return {
      similarity,
      wordCountMatch: wordCountDiff <= this.tolerances.wordCount,
      structureMatch: this.compareStructure(generated, reference)
    };
  }

  calculateCosineSimilarity(text1, text2) {
    // Implement cosine similarity calculation
    const words1 = text1.toLowerCase().split(/\W+/);
    const words2 = text2.toLowerCase().split(/\W+/);
    
    const vocabulary = [...new Set([...words1, ...words2])];
    
    const vector1 = vocabulary.map(word => words1.filter(w => w === word).length);
    const vector2 = vocabulary.map(word => words2.filter(w => w === word).length);
    
    const dotProduct = vector1.reduce((sum, a, i) => sum + a * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, a) => sum + a * a, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, a) => sum + a * a, 0));
    
    return dotProduct / (magnitude1 * magnitude2);
  }
}
```

## 🎮 Test Automation Scripts

### Comprehensive Test Runner

```bash
#!/bin/bash
# run-tests.sh - Comprehensive test execution

set -e

echo "🧪 Roo n8n Comprehensive Test Suite"

# Configuration
N8N_HOST=${N8N_HOST:-"http://localhost:5678"}
N8N_API_KEY=${N8N_API_KEY:-"your_api_key"}
TEST_RESULTS_DIR="./test-results"

# Create results directory
mkdir -p $TEST_RESULTS_DIR

# Function to run test and capture results
run_test() {
    local test_name=$1
    local test_script=$2
    
    echo "🔍 Running $test_name..."
    
    if node $test_script > "$TEST_RESULTS_DIR/${test_name,,}.log" 2>&1; then
        echo "✅ $test_name PASSED"
        return 0
    else
        echo "❌ $test_name FAILED"
        return 1
    fi
}

# Test execution sequence
echo "📋 Test Execution Plan:"
echo "  1. Environment Validation"
echo "  2. Workflow Structure Tests"
echo "  3. API Integration Tests"
echo "  4. Episode Generation Tests"
echo "  5. Performance Tests"
echo "  6. Regression Tests"
echo ""

# Initialize test results
TOTAL_TESTS=0
PASSED_TESTS=0

# 1. Environment Validation
echo "🔧 Phase 1: Environment Validation"
if run_test "Environment_Validation" "tests/environment-validation.js"; then
    ((PASSED_TESTS++))
fi
((TOTAL_TESTS++))

# 2. Workflow Structure Tests
echo "🏗️ Phase 2: Workflow Structure Tests"
if run_test "Workflow_Structure" "tests/workflow-structure-tests.js"; then
    ((PASSED_TESTS++))
fi
((TOTAL_TESTS++))

# 3. API Integration Tests
echo "🔗 Phase 3: API Integration Tests"
if run_test "API_Integration" "tests/api-integration-tests.js"; then
    ((PASSED_TESTS++))
fi
((TOTAL_TESTS++))

# 4. Episode Generation Tests
echo "📝 Phase 4: Episode Generation Tests"
if run_test "Episode_Generation" "tests/episode-generation-tests.js"; then
    ((PASSED_TESTS++))
fi
((TOTAL_TESTS++))

# 5. Performance Tests (optional)
if [[ "${RUN_PERFORMANCE_TESTS:-false}" == "true" ]]; then
    echo "🏋️ Phase 5: Performance Tests"
    if run_test "Performance" "tests/performance-tests.js"; then
        ((PASSED_TESTS++))
    fi
    ((TOTAL_TESTS++))
fi

# 6. Regression Tests
echo "🔄 Phase 6: Regression Tests"
if run_test "Regression" "tests/regression-tests.js"; then
    ((PASSED_TESTS++))
fi
((TOTAL_TESTS++))

# Generate final report
echo ""
echo "📊 Test Results Summary"
echo "====================="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $((TOTAL_TESTS - PASSED_TESTS))"
echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"

# Generate HTML report
node tests/generate-html-report.js

echo ""
echo "📄 Detailed results available in: $TEST_RESULTS_DIR/"
echo "🌐 HTML report: $TEST_RESULTS_DIR/test-report.html"

# Exit with error if any tests failed
if [ $PASSED_TESTS -ne $TOTAL_TESTS ]; then
    echo ""
    echo "❌ Some tests failed. Please review the logs above."
    exit 1
else
    echo ""
    echo "✅ All tests passed! The n8n workflow is ready for production."
    exit 0
fi
```

### Continuous Testing Setup

```yaml
# .github/workflows/test-n8n-workflow.yml
name: Test n8n Workflow

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM

jobs:
  test-workflow:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: n8n_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Start n8n
      run: |
        docker run -d \
          --name n8n-test \
          --network host \
          -e DB_TYPE=postgresdb \
          -e DB_POSTGRESDB_HOST=localhost \
          -e DB_POSTGRESDB_DATABASE=n8n_test \
          -e DB_POSTGRESDB_USER=postgres \
          -e DB_POSTGRESDB_PASSWORD=test_password \
          -e QUEUE_BULL_REDIS_HOST=localhost \
          n8nio/n8n:latest

    - name: Wait for n8n
      run: |
        timeout 60 bash -c 'until curl -f http://localhost:5678/healthz; do sleep 2; done'

    - name: Install test dependencies
      run: npm install

    - name: Import test workflow
      run: |
        curl -X POST http://localhost:5678/api/v1/workflows/import \
          -H "Content-Type: application/json" \
          -d @n8n-workflow.json

    - name: Run test suite
      env:
        N8N_HOST: http://localhost:5678
        N8N_API_KEY: ${{ secrets.N8N_API_KEY }}
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        GOOGLE_SERVICE_ACCOUNT_JSON: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}
        SPREAKER_CLIENT_ID: ${{ secrets.SPREAKER_CLIENT_ID }}
        SPREAKER_CLIENT_SECRET: ${{ secrets.SPREAKER_CLIENT_SECRET }}
      run: ./run-tests.sh

    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results
        path: test-results/

    - name: Comment PR with results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const results = JSON.parse(fs.readFileSync('test-results/summary.json'));
          
          const comment = `## 🧪 Test Results
          
          **Total Tests:** ${results.total}
          **Passed:** ${results.passed}
          **Failed:** ${results.failed}
          **Success Rate:** ${results.successRate}%
          
          ${results.failed > 0 ? '❌ Some tests failed. Please review the logs.' : '✅ All tests passed!'}
          `;
          
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: comment
          });
```

This comprehensive testing suite ensures the n8n workflow maintains complete compatibility and reliability compared to the original Node.js implementation.