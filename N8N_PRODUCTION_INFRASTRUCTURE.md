# 🏗️ Roo n8n Production Infrastructure

## 🎯 Enterprise-Grade Deployment Architecture

Complete infrastructure-as-code deployment for production-ready Roo podcast automation using n8n.

## 📋 Infrastructure Components

### Core Services
- **n8n Workflow Engine**: Visual automation platform
- **PostgreSQL Database**: Workflow state and execution history
- **Redis Cache**: Performance optimization and session storage
- **Nginx Reverse Proxy**: Load balancing and SSL termination
- **Prometheus Monitoring**: Metrics collection and alerting
- **Grafana Dashboard**: Visual monitoring and analytics

### Supporting Services
- **Backup System**: Automated database and workflow backups
- **Log Aggregation**: Centralized logging with ELK stack
- **Secret Management**: Encrypted credential storage
- **Health Monitoring**: Service availability and performance tracking

## 🐳 Docker Compose Infrastructure

### Production Docker Compose

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  # Main n8n application
  n8n:
    image: n8nio/n8n:latest
    container_name: roo-n8n
    restart: unless-stopped
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_AUTH_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_AUTH_PASSWORD}
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://${N8N_HOST}/
      - GENERIC_TIMEZONE=${TIMEZONE}
      - N8N_LOG_LEVEL=info
      - N8N_METRICS=true
      - QUEUE_BULL_REDIS_HOST=redis
      - QUEUE_BULL_REDIS_PORT=6379
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      # Roo-specific environment variables
      - GOOGLE_SHEETS_SPREADSHEET_ID=${GOOGLE_SHEETS_SPREADSHEET_ID}
      - GOOGLE_SHEETS_TAB_NAME=${GOOGLE_SHEETS_TAB_NAME}
      - GOOGLE_SERVICE_ACCOUNT_JSON=${GOOGLE_SERVICE_ACCOUNT_JSON}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_TEXT_MODEL=${OPENAI_TEXT_MODEL}
      - SPREAKER_CLIENT_ID=${SPREAKER_CLIENT_ID}
      - SPREAKER_CLIENT_SECRET=${SPREAKER_CLIENT_SECRET}
      - SPREAKER_REFRESH_TOKEN=${SPREAKER_REFRESH_TOKEN}
      - SPREAKER_SHOW_ID=${SPREAKER_SHOW_ID}
      - MAX_EPISODES_PER_RUN=${MAX_EPISODES_PER_RUN}
      - DRY_RUN=${DRY_RUN}
      - EPISODE_TIMEZONE=${EPISODE_TIMEZONE}
      - SPREAKER_PUBLISH_TIME_UTC=${SPREAKER_PUBLISH_TIME_UTC}
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - postgres
      - redis
    networks:
      - roo-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  # PostgreSQL database
  postgres:
    image: postgres:15-alpine
    container_name: roo-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=n8n
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - roo-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U n8n"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis cache
  redis:
    image: redis:7-alpine
    container_name: roo-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - roo-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: roo-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - n8n
    networks:
      - roo-network

  # Prometheus monitoring
  prometheus:
    image: prom/prometheus:latest
    container_name: roo-prometheus
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - roo-network

  # Grafana dashboard
  grafana:
    image: grafana/grafana:latest
    container_name: roo-grafana
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    networks:
      - roo-network

  # Backup service
  backup:
    image: postgres:15-alpine
    container_name: roo-backup
    restart: "no"
    environment:
      - POSTGRES_DB=n8n
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - PGPASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - ./backups:/backups
      - ./scripts:/scripts:ro
    networks:
      - roo-network
    command: /scripts/backup.sh
    profiles:
      - backup

volumes:
  n8n_data:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
  nginx_logs:

networks:
  roo-network:
    driver: bridge
```

### Environment Configuration

```bash
# .env.production
# Database Configuration
POSTGRES_PASSWORD=your_secure_postgres_password_here
REDIS_PASSWORD=your_secure_redis_password_here

# n8n Configuration
N8N_AUTH_USER=admin
N8N_AUTH_PASSWORD=your_secure_n8n_password_here
N8N_HOST=your-domain.com
N8N_ENCRYPTION_KEY=your_32_character_encryption_key_here
TIMEZONE=UTC

# Monitoring Configuration
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your_secure_grafana_password_here

# Roo Podcast Automation Configuration
GOOGLE_SHEETS_SPREADSHEET_ID=your_google_sheets_id
GOOGLE_SHEETS_TAB_NAME=Episodes
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
OPENAI_API_KEY=sk-your_openai_api_key
OPENAI_TEXT_MODEL=gpt-4o
SPREAKER_CLIENT_ID=your_spreaker_client_id
SPREAKER_CLIENT_SECRET=your_spreaker_client_secret
SPREAKER_REFRESH_TOKEN=your_spreaker_refresh_token
SPREAKER_SHOW_ID=your_spreaker_show_id
MAX_EPISODES_PER_RUN=2
DRY_RUN=false
EPISODE_TIMEZONE=UTC
SPREAKER_PUBLISH_TIME_UTC=08:00:00
```

## 🎮 Kubernetes Deployment

### Kubernetes Manifests

```yaml
# k8s-namespace.yml
apiVersion: v1
kind: Namespace
metadata:
  name: roo-automation
  labels:
    app: roo-podcast

---
# k8s-secrets.yml
apiVersion: v1
kind: Secret
metadata:
  name: roo-secrets
  namespace: roo-automation
type: Opaque
stringData:
  postgres-password: your_secure_postgres_password_here
  redis-password: your_secure_redis_password_here
  n8n-auth-user: admin
  n8n-auth-password: your_secure_n8n_password_here
  n8n-encryption-key: your_32_character_encryption_key_here
  openai-api-key: sk-your_openai_api_key
  spreaker-client-secret: your_spreaker_client_secret
  spreaker-refresh-token: your_spreaker_refresh_token

---
# k8s-configmap.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: roo-config
  namespace: roo-automation
data:
  N8N_HOST: "your-domain.com"
  TIMEZONE: "UTC"
  GOOGLE_SHEETS_SPREADSHEET_ID: "your_google_sheets_id"
  GOOGLE_SHEETS_TAB_NAME: "Episodes"
  OPENAI_TEXT_MODEL: "gpt-4o"
  SPREAKER_CLIENT_ID: "your_spreaker_client_id"
  SPREAKER_SHOW_ID: "your_spreaker_show_id"
  MAX_EPISODES_PER_RUN: "2"
  DRY_RUN: "false"
  EPISODE_TIMEZONE: "UTC"
  SPREAKER_PUBLISH_TIME_UTC: "08:00:00"

---
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: roo-n8n
  namespace: roo-automation
spec:
  replicas: 1
  selector:
    matchLabels:
      app: roo-n8n
  template:
    metadata:
      labels:
        app: roo-n8n
    spec:
      containers:
      - name: n8n
        image: n8nio/n8n:latest
        ports:
        - containerPort: 5678
        env:
        - name: DB_TYPE
          value: "postgresdb"
        - name: DB_POSTGRESDB_HOST
          value: "roo-postgres"
        - name: DB_POSTGRESDB_DATABASE
          value: "n8n"
        - name: DB_POSTGRESDB_USER
          value: "n8n"
        - name: DB_POSTGRESDB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: roo-secrets
              key: postgres-password
        envFrom:
        - configMapRef:
            name: roo-config
        - secretRef:
            name: roo-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 5678
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /healthz
            port: 5678
          initialDelaySeconds: 10
          periodSeconds: 10

---
# k8s-service.yml
apiVersion: v1
kind: Service
metadata:
  name: roo-n8n-service
  namespace: roo-automation
spec:
  selector:
    app: roo-n8n
  ports:
  - port: 80
    targetPort: 5678
  type: ClusterIP
```

## 🛠️ Deployment Scripts

### One-Click Deployment

```bash
#!/bin/bash
# deploy.sh - One-click production deployment

set -e

echo "🚀 Roo n8n Production Deployment"

# Validate environment
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production file not found"
    echo "📋 Please copy .env.production.example and configure your values"
    exit 1
fi

# Load environment variables
source .env.production

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."
./scripts/validate-environment.sh
./scripts/check-dependencies.sh

# Deploy infrastructure
echo "🏗️ Deploying infrastructure..."
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
./scripts/wait-for-services.sh

# Import n8n workflow
echo "📥 Importing Roo workflow..."
./scripts/import-workflow.sh

# Set up monitoring
echo "📊 Configuring monitoring..."
./scripts/setup-monitoring.sh

# Run health checks
echo "🏥 Running health checks..."
./scripts/health-check.sh

echo "✅ Deployment complete!"
echo "🌐 n8n Dashboard: https://${N8N_HOST}"
echo "📊 Grafana Dashboard: https://${N8N_HOST}:3000"
echo "📈 Prometheus: https://${N8N_HOST}:9090"
```

### Service Management

```bash
#!/bin/bash
# manage.sh - Service management commands

COMMAND=$1

case $COMMAND in
  start)
    echo "🚀 Starting Roo services..."
    docker-compose -f docker-compose.production.yml up -d
    ;;
  stop)
    echo "⏹️ Stopping Roo services..."
    docker-compose -f docker-compose.production.yml down
    ;;
  restart)
    echo "🔄 Restarting Roo services..."
    docker-compose -f docker-compose.production.yml restart
    ;;
  status)
    echo "📊 Service status:"
    docker-compose -f docker-compose.production.yml ps
    ;;
  logs)
    echo "📜 Service logs:"
    docker-compose -f docker-compose.production.yml logs -f
    ;;
  backup)
    echo "💾 Creating backup..."
    docker-compose -f docker-compose.production.yml --profile backup up backup
    ;;
  update)
    echo "🔄 Updating services..."
    docker-compose -f docker-compose.production.yml pull
    docker-compose -f docker-compose.production.yml up -d
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|backup|update}"
    exit 1
    ;;
esac
```

## 📊 Monitoring Configuration

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'n8n'
    static_configs:
      - targets: ['n8n:5678']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Roo Podcast Automation",
    "panels": [
      {
        "title": "Workflow Executions",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(n8n_workflow_executions_total[5m])",
            "legendFormat": "Executions/sec"
          }
        ]
      },
      {
        "title": "Episode Processing Success Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(n8n_workflow_executions_success_total[1h]) / rate(n8n_workflow_executions_total[1h]) * 100",
            "legendFormat": "Success Rate %"
          }
        ]
      },
      {
        "title": "OpenAI API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(openai_api_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

## 🚀 Advanced Features

### Auto-Scaling Configuration

```yaml
# k8s-hpa.yml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: roo-n8n-hpa
  namespace: roo-automation
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: roo-n8n
  minReplicas: 1
  maxReplicas: 3
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Disaster Recovery

```bash
#!/bin/bash
# disaster-recovery.sh - Automated disaster recovery

echo "🚨 Disaster Recovery Procedure"

# Stop all services
docker-compose -f docker-compose.production.yml down

# Restore from latest backup
echo "💾 Restoring from backup..."
./scripts/restore-backup.sh latest

# Restart services
echo "🚀 Restarting services..."
docker-compose -f docker-compose.production.yml up -d

# Validate functionality
echo "✅ Validating functionality..."
./scripts/validate-recovery.sh

echo "✅ Disaster recovery complete"
```

## 📈 Performance Optimization

### Database Tuning

```sql
-- postgresql.conf optimizations
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 128MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

### Redis Configuration

```conf
# redis.conf optimizations
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

This production infrastructure provides enterprise-grade reliability, monitoring, and scalability for the Roo podcast automation system.