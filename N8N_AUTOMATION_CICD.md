# 🚀 Roo n8n Advanced Automation & CI/CD

## 🎯 Complete CI/CD Pipeline for n8n Workflows

Comprehensive automation infrastructure for deploying, testing, and maintaining the Roo podcast automation workflow.

## 📋 CI/CD Architecture

### Pipeline Overview
1. **Development**: Local workflow development with hot reload
2. **Testing**: Automated validation and regression testing
3. **Staging**: Production-like environment for final validation
4. **Production**: Automated deployment with zero-downtime
5. **Monitoring**: Real-time performance and error tracking
6. **Rollback**: Automated rollback on failure detection

## 🔄 GitHub Actions Workflows

### Complete CI/CD Pipeline

```yaml
# .github/workflows/n8n-cicd.yml
name: Roo n8n CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'n8n-workflow.json'
      - 'N8N_*.md'
      - '.github/workflows/**'
  pull_request:
    branches: [ main ]
    paths:
      - 'n8n-workflow.json'
      - 'N8N_*.md'

env:
  N8N_VERSION: latest
  DOCKER_REGISTRY: ghcr.io
  IMAGE_NAME: roo-n8n-automation

jobs:
  # Validate workflow structure and dependencies
  validate:
    name: 🔍 Validate Workflow
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate workflow schema
        run: |
          node scripts/validate-workflow-schema.js n8n-workflow.json

      - name: Check required nodes
        run: |
          node scripts/check-required-nodes.js n8n-workflow.json

      - name: Validate environment variables
        run: |
          node scripts/validate-env-vars.js

      - name: Generate workflow documentation
        run: |
          node scripts/generate-workflow-docs.js > workflow-docs.md

      - name: Upload validation artifacts
        uses: actions/upload-artifact@v4
        with:
          name: validation-results
          path: |
            workflow-docs.md
            validation-report.json

  # Run comprehensive test suite
  test:
    name: 🧪 Test Workflow
    runs-on: ubuntu-latest
    needs: validate
    
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
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Start n8n test instance
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
            -e N8N_ENCRYPTION_KEY=test_encryption_key_32_characters \
            -e N8N_BASIC_AUTH_ACTIVE=false \
            -e N8N_LOG_LEVEL=debug \
            n8nio/n8n:${{ env.N8N_VERSION }}

      - name: Wait for n8n startup
        run: |
          timeout 120 bash -c 'until curl -f http://localhost:5678/healthz; do sleep 2; done'

      - name: Import workflow
        run: |
          curl -X POST http://localhost:5678/api/v1/workflows/import \
            -H "Content-Type: application/json" \
            -d @n8n-workflow.json

      - name: Run unit tests
        env:
          N8N_HOST: http://localhost:5678
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GOOGLE_SERVICE_ACCOUNT_JSON: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON_TEST }}
          SPREAKER_CLIENT_ID: ${{ secrets.SPREAKER_CLIENT_ID_TEST }}
          SPREAKER_CLIENT_SECRET: ${{ secrets.SPREAKER_CLIENT_SECRET_TEST }}
        run: |
          npm run test:unit

      - name: Run integration tests
        env:
          N8N_HOST: http://localhost:5678
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GOOGLE_SERVICE_ACCOUNT_JSON: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON_TEST }}
          SPREAKER_CLIENT_ID: ${{ secrets.SPREAKER_CLIENT_ID_TEST }}
          SPREAKER_CLIENT_SECRET: ${{ secrets.SPREAKER_CLIENT_SECRET_TEST }}
        run: |
          npm run test:integration

      - name: Run end-to-end tests
        env:
          N8N_HOST: http://localhost:5678
          DRY_RUN: true
          MAX_EPISODES_PER_RUN: 1
        run: |
          npm run test:e2e

      - name: Collect test coverage
        run: |
          npm run test:coverage

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: |
            test-results/
            coverage/

      - name: Comment PR with test results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('test-results/summary.json'));
            
            const comment = `## 🧪 Test Results
            
            **Tests Run:** ${results.total}
            **Passed:** ${results.passed} ✅
            **Failed:** ${results.failed} ${results.failed > 0 ? '❌' : ''}
            **Coverage:** ${results.coverage}%
            
            ${results.failed > 0 ? '⚠️ Some tests failed. Please review the logs.' : '🎉 All tests passed!'}
            
            [View detailed results](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

  # Build and push Docker images
  build:
    name: 🏗️ Build Images
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.DOCKER_REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.DOCKER_REGISTRY }}/${{ github.repository }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix=sha-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./docker/Dockerfile.production
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            N8N_VERSION=${{ env.N8N_VERSION }}
            BUILD_DATE=${{ github.event.head_commit.timestamp }}
            VCS_REF=${{ github.sha }}

  # Deploy to staging environment
  deploy-staging:
    name: 🚀 Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    environment: staging
    
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        env:
          KUBECONFIG_DATA: ${{ secrets.STAGING_KUBECONFIG }}
          IMAGE_TAG: ${{ needs.build.outputs.image-tag }}
        run: |
          echo "$KUBECONFIG_DATA" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig
          
          # Update image tag in deployment
          sed -i "s|image: .*|image: $IMAGE_TAG|" k8s/staging/deployment.yml
          
          # Apply staging configuration
          kubectl apply -f k8s/staging/

      - name: Wait for deployment
        run: |
          kubectl rollout status deployment/roo-n8n-staging -n roo-staging --timeout=300s

      - name: Run staging smoke tests
        env:
          STAGING_URL: ${{ secrets.STAGING_N8N_URL }}
          STAGING_API_KEY: ${{ secrets.STAGING_N8N_API_KEY }}
        run: |
          npm run test:smoke -- --url="$STAGING_URL"

  # Deploy to production
  deploy-production:
    name: 🎯 Deploy to Production
    runs-on: ubuntu-latest
    needs: [build, deploy-staging]
    environment: production
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        env:
          KUBECONFIG_DATA: ${{ secrets.PRODUCTION_KUBECONFIG }}
          IMAGE_TAG: ${{ needs.build.outputs.image-tag }}
        run: |
          echo "$KUBECONFIG_DATA" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig
          
          # Create backup of current deployment
          kubectl get deployment roo-n8n-production -n roo-production -o yaml > deployment-backup.yml
          
          # Update image tag in deployment
          sed -i "s|image: .*|image: $IMAGE_TAG|" k8s/production/deployment.yml
          
          # Apply production configuration with rolling update
          kubectl apply -f k8s/production/

      - name: Wait for deployment
        run: |
          kubectl rollout status deployment/roo-n8n-production -n roo-production --timeout=600s

      - name: Run production health checks
        env:
          PRODUCTION_URL: ${{ secrets.PRODUCTION_N8N_URL }}
          PRODUCTION_API_KEY: ${{ secrets.PRODUCTION_N8N_API_KEY }}
        run: |
          npm run test:health -- --url="$PRODUCTION_URL"

      - name: Update deployment status
        if: success()
        run: |
          echo "🎉 Production deployment successful!"
          echo "Version: ${{ needs.build.outputs.image-tag }}"
          echo "Commit: ${{ github.sha }}"

      - name: Rollback on failure
        if: failure()
        run: |
          echo "❌ Production deployment failed, rolling back..."
          kubectl apply -f deployment-backup.yml
          kubectl rollout status deployment/roo-n8n-production -n roo-production --timeout=300s

  # Post-deployment monitoring
  monitor:
    name: 📊 Post-Deployment Monitoring
    runs-on: ubuntu-latest
    needs: deploy-production
    if: success()
    
    steps:
      - name: Monitor deployment for 5 minutes
        env:
          PRODUCTION_URL: ${{ secrets.PRODUCTION_N8N_URL }}
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
        run: |
          # Monitor for 5 minutes and alert on issues
          for i in {1..10}; do
            if curl -f "$PRODUCTION_URL/healthz" > /dev/null 2>&1; then
              echo "✅ Health check $i/10 passed"
            else
              echo "❌ Health check $i/10 failed"
              # Send alert
              curl -X POST -H 'Content-type: application/json' \
                --data '{"text":"🚨 Roo n8n production deployment health check failed!"}' \
                "$SLACK_WEBHOOK"
              exit 1
            fi
            sleep 30
          done
          
          echo "🎉 Post-deployment monitoring completed successfully"
```

### Automated Testing Workflow

```yaml
# .github/workflows/automated-testing.yml
name: Automated Testing

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  regression-test:
    name: 🔄 Regression Testing
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        episode-type: [main, friday]
        test-scenario: [normal, edge-case, error-handling]
    
    steps:
      - uses: actions/checkout@v4

      - name: Setup test environment
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30

      - name: Run regression tests
        env:
          EPISODE_TYPE: ${{ matrix.episode-type }}
          TEST_SCENARIO: ${{ matrix.test-scenario }}
        run: |
          npm run test:regression -- --type="$EPISODE_TYPE" --scenario="$TEST_SCENARIO"

      - name: Upload test artifacts
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: regression-test-${{ matrix.episode-type }}-${{ matrix.test-scenario }}
          path: test-results/

  performance-test:
    name: 🏋️ Performance Testing
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4

      - name: Setup performance test environment
        run: |
          docker-compose -f docker-compose.perf.yml up -d
          sleep 60

      - name: Run load tests
        run: |
          npm run test:load -- --duration=300 --concurrent=5

      - name: Generate performance report
        run: |
          npm run test:perf-report

      - name: Check performance thresholds
        run: |
          node scripts/check-performance-thresholds.js

  security-scan:
    name: 🔒 Security Scanning
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Scan workflow for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
```

## 🛠️ Advanced Automation Scripts

### Automated Deployment Script

```bash
#!/bin/bash
# scripts/deploy.sh - Automated production deployment

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_LOG="$PROJECT_ROOT/deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

# Pre-deployment checks
pre_deployment_checks() {
    log "🔍 Running pre-deployment checks..."
    
    # Check required tools
    command -v kubectl >/dev/null 2>&1 || error "kubectl is required but not installed"
    command -v docker >/dev/null 2>&1 || error "docker is required but not installed"
    command -v helm >/dev/null 2>&1 || error "helm is required but not installed"
    
    # Check environment variables
    [ -z "${KUBECONFIG:-}" ] && error "KUBECONFIG environment variable is required"
    [ -z "${DOCKER_REGISTRY:-}" ] && error "DOCKER_REGISTRY environment variable is required"
    
    # Validate workflow file
    if ! node "$SCRIPT_DIR/validate-workflow.js" "$PROJECT_ROOT/n8n-workflow.json"; then
        error "Workflow validation failed"
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info >/dev/null 2>&1; then
        error "Cannot connect to Kubernetes cluster"
    fi
    
    success "Pre-deployment checks passed"
}

# Build and push container image
build_and_push_image() {
    log "🏗️ Building and pushing container image..."
    
    local image_tag="$DOCKER_REGISTRY/roo-n8n:$(git rev-parse --short HEAD)"
    
    # Build image
    docker build \
        -f "$PROJECT_ROOT/docker/Dockerfile.production" \
        -t "$image_tag" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VCS_REF="$(git rev-parse HEAD)" \
        "$PROJECT_ROOT"
    
    # Push image
    docker push "$image_tag"
    
    echo "$image_tag" > "$PROJECT_ROOT/.image-tag"
    success "Image built and pushed: $image_tag"
}

# Deploy to staging
deploy_to_staging() {
    log "🚀 Deploying to staging environment..."
    
    local image_tag
    image_tag="$(cat "$PROJECT_ROOT/.image-tag")"
    
    # Update Helm values for staging
    helm upgrade --install roo-n8n-staging \
        "$PROJECT_ROOT/helm/roo-n8n" \
        --namespace roo-staging \
        --create-namespace \
        --values "$PROJECT_ROOT/helm/values-staging.yml" \
        --set image.tag="${image_tag##*:}" \
        --wait \
        --timeout=10m
    
    # Run staging smoke tests
    log "🧪 Running staging smoke tests..."
    if ! npm run test:smoke -- --environment=staging; then
        error "Staging smoke tests failed"
    fi
    
    success "Staging deployment completed"
}

# Deploy to production with blue-green strategy
deploy_to_production() {
    log "🎯 Deploying to production environment..."
    
    local image_tag
    image_tag="$(cat "$PROJECT_ROOT/.image-tag")"
    
    # Create backup of current production deployment
    kubectl get deployment roo-n8n-production -n roo-production -o yaml > "$PROJECT_ROOT/backup-deployment.yml" 2>/dev/null || true
    
    # Deploy with blue-green strategy
    helm upgrade --install roo-n8n-production \
        "$PROJECT_ROOT/helm/roo-n8n" \
        --namespace roo-production \
        --create-namespace \
        --values "$PROJECT_ROOT/helm/values-production.yml" \
        --set image.tag="${image_tag##*:}" \
        --set deployment.strategy.type=BlueGreen \
        --wait \
        --timeout=15m
    
    # Validate production deployment
    log "🏥 Running production health checks..."
    if ! npm run test:health -- --environment=production; then
        warning "Production health checks failed, initiating rollback..."
        rollback_production
        error "Production deployment failed"
    fi
    
    success "Production deployment completed"
}

# Rollback production deployment
rollback_production() {
    log "🔄 Rolling back production deployment..."
    
    if [ -f "$PROJECT_ROOT/backup-deployment.yml" ]; then
        kubectl apply -f "$PROJECT_ROOT/backup-deployment.yml"
        kubectl rollout status deployment/roo-n8n-production -n roo-production --timeout=10m
        success "Production rollback completed"
    else
        error "No backup deployment found for rollback"
    fi
}

# Post-deployment monitoring
post_deployment_monitoring() {
    log "📊 Starting post-deployment monitoring..."
    
    # Monitor for 10 minutes
    for i in {1..20}; do
        if curl -f "${PRODUCTION_URL}/healthz" >/dev/null 2>&1; then
            log "Health check $i/20 passed"
        else
            error "Health check $i/20 failed"
        fi
        sleep 30
    done
    
    # Generate deployment report
    cat > "$PROJECT_ROOT/deployment-report.md" << EOF
# Deployment Report

**Date**: $(date)
**Commit**: $(git rev-parse HEAD)
**Image**: $(cat "$PROJECT_ROOT/.image-tag")
**Environment**: Production

## Deployment Steps
- ✅ Pre-deployment checks
- ✅ Image build and push
- ✅ Staging deployment
- ✅ Production deployment
- ✅ Health monitoring

## Metrics
- **Deployment Duration**: $SECONDS seconds
- **Health Checks**: 20/20 passed
- **Status**: Success ✅

EOF
    
    success "Post-deployment monitoring completed"
}

# Main deployment function
main() {
    log "🚀 Starting Roo n8n automated deployment"
    
    # Cleanup function
    cleanup() {
        log "🧹 Cleaning up temporary files..."
        rm -f "$PROJECT_ROOT/.image-tag" "$PROJECT_ROOT/backup-deployment.yml"
    }
    trap cleanup EXIT
    
    # Run deployment steps
    pre_deployment_checks
    build_and_push_image
    deploy_to_staging
    
    # Confirm production deployment
    if [ "${AUTO_DEPLOY_PRODUCTION:-false}" = "true" ]; then
        deploy_to_production
    else
        read -p "Deploy to production? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            deploy_to_production
        else
            warning "Production deployment skipped"
            exit 0
        fi
    fi
    
    post_deployment_monitoring
    
    success "🎉 Deployment completed successfully!"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
```

### Workflow Synchronization Tool

```javascript
// scripts/sync-workflow.js - Sync workflow between environments
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';

class WorkflowSyncer {
  constructor(sourceHost, targetHost, sourceApiKey, targetApiKey) {
    this.sourceHost = sourceHost;
    this.targetHost = targetHost;
    this.sourceApiKey = sourceApiKey;
    this.targetApiKey = targetApiKey;
  }

  async syncWorkflow(workflowId) {
    console.log(chalk.blue('🔄 Starting workflow synchronization...'));

    try {
      // Export from source
      console.log(chalk.gray(`📤 Exporting from ${this.sourceHost}...`));
      const sourceWorkflow = await this.exportWorkflow(this.sourceHost, this.sourceApiKey, workflowId);

      // Validate workflow
      console.log(chalk.gray('🔍 Validating workflow...'));
      const validation = this.validateWorkflow(sourceWorkflow);
      if (!validation.valid) {
        throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
      }

      // Import to target
      console.log(chalk.gray(`📥 Importing to ${this.targetHost}...`));
      const targetWorkflow = await this.importWorkflow(this.targetHost, this.targetApiKey, sourceWorkflow);

      // Verify sync
      console.log(chalk.gray('✅ Verifying synchronization...'));
      const syncVerification = await this.verifySynchronization(sourceWorkflow, targetWorkflow);

      if (syncVerification.success) {
        console.log(chalk.green('🎉 Workflow synchronization completed successfully!'));
        return {
          success: true,
          sourceId: workflowId,
          targetId: targetWorkflow.id,
          syncedAt: new Date().toISOString()
        };
      } else {
        throw new Error(`Sync verification failed: ${syncVerification.errors.join(', ')}`);
      }

    } catch (error) {
      console.log(chalk.red(`❌ Synchronization failed: ${error.message}`));
      throw error;
    }
  }

  async exportWorkflow(host, apiKey, workflowId) {
    const response = await axios.get(`${host}/api/v1/workflows/${workflowId}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    return response.data;
  }

  async importWorkflow(host, apiKey, workflow) {
    // Remove environment-specific data
    const cleanWorkflow = this.cleanWorkflowForImport(workflow);
    
    const response = await axios.post(`${host}/api/v1/workflows/import`, cleanWorkflow, {
      headers: { 
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  }

  cleanWorkflowForImport(workflow) {
    // Remove environment-specific properties
    const cleaned = { ...workflow };
    delete cleaned.id;
    delete cleaned.createdAt;
    delete cleaned.updatedAt;
    delete cleaned.versionId;
    
    // Update environment variables if needed
    if (process.env.TARGET_ENVIRONMENT) {
      cleaned.nodes = cleaned.nodes.map(node => {
        if (node.parameters && typeof node.parameters === 'object') {
          // Update environment-specific parameters
          return this.updateNodeParameters(node);
        }
        return node;
      });
    }
    
    return cleaned;
  }

  updateNodeParameters(node) {
    // Update node parameters for target environment
    const envMappings = {
      'GOOGLE_SHEETS_SPREADSHEET_ID': process.env.TARGET_GOOGLE_SHEETS_ID,
      'SPREAKER_SHOW_ID': process.env.TARGET_SPREAKER_SHOW_ID,
      'DRY_RUN': process.env.TARGET_DRY_RUN || 'true'
    };

    const updatedNode = { ...node };
    
    // Recursively update parameters
    const updateParameters = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.startsWith('={{ $vars.')) {
          const varName = value.match(/\$vars\.(\w+)/)?.[1];
          if (varName && envMappings[varName]) {
            obj[key] = `={{ $vars.${varName} }}`;
          }
        } else if (typeof value === 'object' && value !== null) {
          updateParameters(value);
        }
      }
    };

    if (updatedNode.parameters) {
      updateParameters(updatedNode.parameters);
    }

    return updatedNode;
  }

  validateWorkflow(workflow) {
    const errors = [];
    
    // Check required properties
    if (!workflow.name) errors.push('Workflow name is required');
    if (!workflow.nodes || workflow.nodes.length === 0) errors.push('Workflow must have nodes');
    
    // Check node structure
    workflow.nodes.forEach((node, index) => {
      if (!node.id) errors.push(`Node ${index} missing id`);
      if (!node.name) errors.push(`Node ${index} missing name`);
      if (!node.type) errors.push(`Node ${index} missing type`);
    });
    
    // Check connections
    if (workflow.connections) {
      const nodeIds = workflow.nodes.map(n => n.id);
      Object.keys(workflow.connections).forEach(nodeId => {
        if (!nodeIds.includes(nodeId)) {
          errors.push(`Connection references non-existent node: ${nodeId}`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async verifySynchronization(sourceWorkflow, targetWorkflow) {
    const errors = [];
    
    // Compare node count
    if (sourceWorkflow.nodes.length !== targetWorkflow.nodes.length) {
      errors.push('Node count mismatch');
    }
    
    // Compare node types
    const sourceNodeTypes = sourceWorkflow.nodes.map(n => n.type).sort();
    const targetNodeTypes = targetWorkflow.nodes.map(n => n.type).sort();
    
    if (JSON.stringify(sourceNodeTypes) !== JSON.stringify(targetNodeTypes)) {
      errors.push('Node types mismatch');
    }
    
    // Compare workflow structure
    if (sourceWorkflow.name !== targetWorkflow.name) {
      errors.push('Workflow name mismatch');
    }
    
    return {
      success: errors.length === 0,
      errors
    };
  }

  async batchSync(workflowIds) {
    console.log(chalk.blue(`🔄 Starting batch synchronization of ${workflowIds.length} workflows...`));
    
    const results = [];
    
    for (const workflowId of workflowIds) {
      try {
        console.log(chalk.gray(`\n📋 Syncing workflow: ${workflowId}`));
        const result = await this.syncWorkflow(workflowId);
        results.push({ workflowId, ...result });
      } catch (error) {
        results.push({ 
          workflowId, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    // Generate sync report
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(chalk.blue('\n📊 Batch Synchronization Report:'));
    console.log(chalk.green(`✅ Successful: ${successful}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));
    
    if (failed > 0) {
      console.log(chalk.red('\nFailed workflows:'));
      results.filter(r => !r.success).forEach(r => {
        console.log(chalk.red(`  - ${r.workflowId}: ${r.error}`));
      });
    }
    
    return results;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const syncer = new WorkflowSyncer(
    process.env.SOURCE_N8N_HOST,
    process.env.TARGET_N8N_HOST,
    process.env.SOURCE_N8N_API_KEY,
    process.env.TARGET_N8N_API_KEY
  );

  const workflowId = process.argv[2];
  if (!workflowId) {
    console.log(chalk.red('Usage: node sync-workflow.js <workflow-id>'));
    process.exit(1);
  }

  syncer.syncWorkflow(workflowId)
    .then(result => {
      console.log(chalk.green('\n🎉 Synchronization completed!'));
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.log(chalk.red('\n❌ Synchronization failed!'));
      console.error(error.message);
      process.exit(1);
    });
}

export { WorkflowSyncer };
```

This comprehensive CI/CD and automation framework provides enterprise-grade deployment, testing, and synchronization capabilities for the Roo n8n workflow system.