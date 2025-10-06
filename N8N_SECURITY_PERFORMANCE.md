# 🔐 Roo n8n Security & Performance Optimization

## 🎯 Enterprise Security & Performance Standards

Comprehensive security hardening and performance optimization guide for production Roo n8n deployment.

## 🛡️ Security Hardening

### Authentication & Authorization

```yaml
# security/auth-config.yml - Enhanced authentication configuration
n8n:
  security:
    authentication:
      # Multi-factor authentication
      mfa:
        enabled: true
        provider: "totp"
        backup_codes: true
      
      # JWT configuration
      jwt:
        secret: "${JWT_SECRET_256_BIT}"
        expiration: "1h"
        refresh_expiration: "7d"
        algorithm: "HS256"
      
      # Session management
      session:
        secure: true
        httpOnly: true
        sameSite: "strict"
        maxAge: 3600000
      
      # Rate limiting
      rateLimit:
        enabled: true
        windowMs: 900000  # 15 minutes
        max: 100  # requests per window
        skipSuccessfulRequests: false
    
    authorization:
      # Role-based access control
      rbac:
        enabled: true
        roles:
          - name: "admin"
            permissions: ["*"]
          - name: "operator"
            permissions: ["workflow:read", "workflow:execute", "execution:read"]
          - name: "viewer"
            permissions: ["workflow:read", "execution:read"]
      
      # API key management
      apiKeys:
        encryption: true
        rotation_interval: "30d"
        max_keys_per_user: 3
```

### Network Security

```yaml
# security/network-policy.yml - Kubernetes NetworkPolicy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: roo-n8n-network-policy
  namespace: roo-production
spec:
  podSelector:
    matchLabels:
      app: roo-n8n
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  # Allow traffic from ingress controller
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 5678
  
  # Allow traffic from monitoring
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 9090  # metrics

  egress:
  # Allow DNS resolution
  - to: []
    ports:
    - protocol: UDP
      port: 53
  
  # Allow HTTPS to external APIs
  - to: []
    ports:
    - protocol: TCP
      port: 443
  
  # Allow PostgreSQL
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  
  # Allow Redis
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379

---
# Security-enhanced ingress with SSL termination
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: roo-n8n-secure-ingress
  namespace: roo-production
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: roo-basic-auth
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/server-snippet: |
      add_header X-Frame-Options DENY;
      add_header X-Content-Type-Options nosniff;
      add_header X-XSS-Protection "1; mode=block";
      add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
      add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.openai.com https://api.spreaker.com https://sheets.googleapis.com;";
spec:
  tls:
  - hosts:
    - n8n.yourdomain.com
    secretName: n8n-tls-secret
  rules:
  - host: n8n.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: roo-n8n-service
            port:
              number: 80
```

### Secret Management

```yaml
# security/sealed-secrets.yml - Encrypted secret management
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: roo-n8n-secrets
  namespace: roo-production
spec:
  encryptedData:
    # All secrets encrypted with kubeseal
    n8n-encryption-key: AgBy3i4OJSWK+PiTySYZZA9rO4...
    openai-api-key: AgBj8F2vPz4Kl3mR9vZ8...
    spreaker-client-secret: AgBm7Nd9K2lP8xC6...
    google-service-account-json: AgBs3K9L7mN2pQ...
    postgres-password: AgBx4N8M6kJ9rL...
    redis-password: AgBy5P2L8mR7tK...
  template:
    metadata:
      name: roo-n8n-secrets
      namespace: roo-production
    type: Opaque

---
# External secrets operator configuration
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: roo-production
spec:
  provider:
    vault:
      server: "https://vault.yourdomain.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "roo-n8n"

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: roo-n8n-vault-secrets
  namespace: roo-production
spec:
  refreshInterval: 15s
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: roo-n8n-secrets
    creationPolicy: Owner
  data:
  - secretKey: openai-api-key
    remoteRef:
      key: roo/openai
      property: api-key
  - secretKey: spreaker-client-secret
    remoteRef:
      key: roo/spreaker
      property: client-secret
```

### Security Scanning & Monitoring

```dockerfile
# docker/Dockerfile.security-hardened
FROM n8nio/n8n:latest as base

# Create non-root user
RUN addgroup -g 1001 -S n8n && \
    adduser -u 1001 -S n8n -G n8n

# Install security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Security hardening
RUN chmod -R 755 /home/node && \
    chown -R n8n:n8n /home/node

# Remove unnecessary packages and clean up
RUN apk del --purge \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

# Use non-root user
USER n8n

# Security labels
LABEL security.scan.level="hardened" \
      security.compliance="SOC2,GDPR" \
      security.last_scan="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:5678/healthz || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["n8n"]
```

### Security Monitoring

```yaml
# security/falco-rules.yml - Runtime security monitoring
- rule: Roo n8n Suspicious Network Activity
  desc: Detect suspicious network connections from n8n container
  condition: >
    spawned_process and
    container and
    container.image.repository contains "n8n" and
    (proc.name = "nc" or proc.name = "ncat" or proc.name = "telnet")
  output: >
    Suspicious network tool executed in n8n container
    (user=%user.name command=%proc.cmdline container=%container.name image=%container.image.repository)
  priority: WARNING

- rule: Roo n8n Privilege Escalation
  desc: Detect privilege escalation attempts in n8n container
  condition: >
    spawned_process and
    container and
    container.image.repository contains "n8n" and
    (proc.name = "sudo" or proc.name = "su" or proc.args contains "chmod +s")
  output: >
    Privilege escalation attempt in n8n container
    (user=%user.name command=%proc.cmdline container=%container.name)
  priority: ERROR

- rule: Roo n8n File System Modification
  desc: Detect unauthorized file system modifications
  condition: >
    open_write and
    container and
    container.image.repository contains "n8n" and
    (fd.name startswith "/etc" or fd.name startswith "/usr/bin" or fd.name startswith "/bin")
  output: >
    Unauthorized file modification in n8n container
    (user=%user.name file=%fd.name container=%container.name)
  priority: WARNING
```

## ⚡ Performance Optimization

### Database Optimization

```sql
-- performance/postgresql-tuning.sql
-- PostgreSQL performance tuning for n8n

-- Connection and memory settings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET effective_cache_size = '2GB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Query optimization
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET seq_page_cost = 1.0;

-- Logging for performance monitoring
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_lock_waits = on;

-- Apply settings
SELECT pg_reload_conf();

-- Create performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_workflow_id_started 
ON execution_entity (workflow_id, started_at DESC) 
WHERE started_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_status_started
ON execution_entity (status, started_at DESC)
WHERE started_at IS NOT NULL;

-- Partition large tables by date
CREATE TABLE execution_entity_y2024m01 PARTITION OF execution_entity
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Auto-vacuum tuning
ALTER TABLE execution_entity SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_cost_limit = 1000
);
```

### Redis Optimization

```conf
# performance/redis.conf - Redis performance configuration
# Memory optimization
maxmemory 1gb
maxmemory-policy allkeys-lru
maxmemory-samples 10

# Network optimization
tcp-keepalive 60
tcp-backlog 511
timeout 300

# Persistence optimization
save 900 1
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes

# AOF configuration for durability
appendonly yes
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Performance tuning
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
list-compress-depth 0
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64

# Client optimization
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60

# Slow log
slowlog-log-slower-than 10000
slowlog-max-len 128
```

### Application Performance Tuning

```javascript
// performance/n8n-optimization.js - n8n performance configuration
export const n8nPerformanceConfig = {
  // Queue configuration
  queue: {
    bull: {
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: 0,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxLoadingTimeout: 2000,
        // Connection pooling
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        // Performance optimization
        keyPrefix: 'n8n:',
        enableOfflineQueue: false
      },
      settings: {
        stalledInterval: 30000,
        maxStalledCount: 1,
        retryProcessDelay: 50000,
        // Concurrency control
        concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10'),
        // Job cleanup
        removeOnComplete: 100,
        removeOnFail: 500
      }
    }
  },

  // Database optimization
  database: {
    type: 'postgresdb',
    host: process.env.DB_POSTGRESDB_HOST,
    port: parseInt(process.env.DB_POSTGRESDB_PORT || '5432'),
    database: process.env.DB_POSTGRESDB_DATABASE,
    username: process.env.DB_POSTGRESDB_USER,
    password: process.env.DB_POSTGRESDB_PASSWORD,
    // Connection pooling
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    // Performance settings
    logging: process.env.NODE_ENV === 'development',
    synchronize: false,
    migrationsRun: true,
    // Query optimization
    cache: {
      type: 'redis',
      options: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: 1
      }
    }
  },

  // Memory optimization
  memory: {
    // Garbage collection tuning
    maxOldSpaceSize: parseInt(process.env.NODE_MAX_OLD_SPACE_SIZE || '4096'),
    // V8 optimization flags
    v8Flags: [
      '--max-old-space-size=4096',
      '--optimize-for-size',
      '--gc-interval=100'
    ]
  },

  // Request optimization
  http: {
    timeout: 120000,
    maxRedirects: 5,
    maxContentLength: 50 * 1024 * 1024, // 50MB
    // Keep-alive
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 256,
    maxFreeSockets: 256
  },

  // Workflow execution optimization
  execution: {
    // Parallel processing
    maxParallelExecutions: parseInt(process.env.MAX_PARALLEL_EXECUTIONS || '5'),
    // Timeout settings
    timeout: parseInt(process.env.EXECUTION_TIMEOUT || '1200'), // 20 minutes
    // Memory management
    maxExecutionDataSize: 50 * 1024 * 1024, // 50MB
    // Cleanup
    pruneDataAfter: parseInt(process.env.EXECUTION_DATA_PRUNE_AFTER || '336'), // 14 days
    // Retry configuration
    defaultRetryAttempts: 3,
    defaultRetryWaitTime: 1000
  }
};

// Performance monitoring
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      executionTimes: [],
      memoryUsage: [],
      cpuUsage: []
    };
    
    // Start monitoring
    setInterval(() => this.collectMetrics(), 30000);
  }

  collectMetrics() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    });
    
    this.metrics.cpuUsage.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system
    });
    
    // Keep only last 1000 measurements
    if (this.metrics.memoryUsage.length > 1000) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-1000);
    }
    if (this.metrics.cpuUsage.length > 1000) {
      this.metrics.cpuUsage = this.metrics.cpuUsage.slice(-1000);
    }
  }

  getPerformanceReport() {
    const memoryStats = this.calculateStats(this.metrics.memoryUsage.map(m => m.heapUsed));
    const executionStats = this.calculateStats(this.metrics.executionTimes);
    
    return {
      memory: {
        average: Math.round(memoryStats.average / 1024 / 1024), // MB
        peak: Math.round(memoryStats.max / 1024 / 1024), // MB
        current: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) // MB
      },
      execution: {
        averageTime: Math.round(executionStats.average),
        medianTime: Math.round(executionStats.median),
        p95Time: Math.round(executionStats.p95)
      },
      uptime: Math.round(process.uptime() / 3600 * 100) / 100 // hours
    };
  }

  calculateStats(values) {
    if (values.length === 0) return { average: 0, median: 0, max: 0, p95: 0 };
    
    const sorted = values.sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      average: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
  }
}
```

### Kubernetes Resource Optimization

```yaml
# performance/optimized-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: roo-n8n-optimized
  namespace: roo-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: roo-n8n
  template:
    metadata:
      labels:
        app: roo-n8n
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      # Performance optimization
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - roo-n8n
              topologyKey: kubernetes.io/hostname
      
      # Resource optimization
      containers:
      - name: n8n
        image: roo-n8n:optimized
        ports:
        - containerPort: 5678
        - containerPort: 9090  # metrics
        
        # Resource management
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        
        # JVM optimization
        env:
        - name: NODE_OPTIONS
          value: "--max-old-space-size=3072 --optimize-for-size"
        - name: UV_THREADPOOL_SIZE
          value: "16"
        
        # Health checks
        livenessProbe:
          httpGet:
            path: /healthz
            port: 5678
          initialDelaySeconds: 60
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /healthz
            port: 5678
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          successThreshold: 1
          failureThreshold: 3
        
        # Volume mounts for persistence
        volumeMounts:
        - name: n8n-data
          mountPath: /home/node/.n8n
        - name: tmp-volume
          mountPath: /tmp
        
      # Init container for database migrations
      initContainers:
      - name: migrate-db
        image: roo-n8n:optimized
        command: ['n8n', 'migrations:up']
        env:
        - name: DB_TYPE
          value: "postgresdb"
        envFrom:
        - secretRef:
            name: roo-n8n-secrets
        - configMapRef:
            name: roo-n8n-config
      
      # Volumes
      volumes:
      - name: n8n-data
        persistentVolumeClaim:
          claimName: n8n-data-pvc
      - name: tmp-volume
        emptyDir:
          sizeLimit: 1Gi

---
# Horizontal Pod Autoscaler for performance scaling
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: roo-n8n-hpa
  namespace: roo-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: roo-n8n-optimized
  minReplicas: 2
  maxReplicas: 10
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
  - type: Pods
    pods:
      metric:
        name: n8n_execution_queue_length
      target:
        type: AverageValue
        averageValue: "10"
  
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 600
      policies:
      - type: Percent
        value: 25
        periodSeconds: 120

---
# Persistent Volume for optimized storage
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: n8n-data-pvc
  namespace: roo-production
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: ssd-fast
  resources:
    requests:
      storage: 100Gi
```

### Monitoring & Alerting

```yaml
# monitoring/performance-alerts.yml
groups:
- name: roo-n8n-performance
  rules:
  # High memory usage
  - alert: RooN8NHighMemoryUsage
    expr: container_memory_usage_bytes{pod=~"roo-n8n.*"} / container_spec_memory_limit_bytes > 0.8
    for: 5m
    labels:
      severity: warning
      component: n8n
    annotations:
      summary: "High memory usage detected"
      description: "n8n pod {{ $labels.pod }} memory usage is above 80%"

  # High CPU usage
  - alert: RooN8NHighCPUUsage
    expr: rate(container_cpu_usage_seconds_total{pod=~"roo-n8n.*"}[5m]) > 0.8
    for: 5m
    labels:
      severity: warning
      component: n8n
    annotations:
      summary: "High CPU usage detected"
      description: "n8n pod {{ $labels.pod }} CPU usage is above 80%"

  # Execution queue buildup
  - alert: RooN8NExecutionQueueHigh
    expr: n8n_execution_queue_length > 50
    for: 2m
    labels:
      severity: critical
      component: n8n
    annotations:
      summary: "Execution queue is building up"
      description: "n8n execution queue length is {{ $value }}"

  # Database connection issues
  - alert: RooN8NDatabaseConnectionFailed
    expr: n8n_database_connection_errors_total > 5
    for: 1m
    labels:
      severity: critical
      component: database
    annotations:
      summary: "Database connection failures"
      description: "n8n database connection errors: {{ $value }}"

  # Slow execution times
  - alert: RooN8NSlowExecutions
    expr: histogram_quantile(0.95, rate(n8n_execution_duration_seconds_bucket[5m])) > 300
    for: 3m
    labels:
      severity: warning
      component: n8n
    annotations:
      summary: "Slow workflow executions detected"
      description: "95th percentile execution time is {{ $value }}s"
```

This comprehensive security and performance optimization guide ensures the Roo n8n system operates at enterprise standards with maximum security and optimal performance.