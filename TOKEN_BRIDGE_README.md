# Token Bridge Service Integration

The Token Bridge Service provides a reliable, separate service for managing Spreaker OAuth token refresh operations. This service acts as a fallback mechanism when direct token refresh fails, implementing robust one-time-use token rotation and comprehensive error handling.

## Overview

The bridge service was created to address token refresh reliability issues by providing:

- **Separate Service Architecture**: Independent token management that doesn't rely on the main application
- **One-Time-Use Token Enforcement**: Prevents token burning by ensuring proper token lifecycle management
- **Comprehensive Error Handling**: Detailed logging and diagnostics for troubleshooting
- **REST API**: Easy integration with the main application and external tools
- **Security**: Token-based authentication and masked sensitive data in logs

## Bridge Service Deployment

**Note**: This application integrates with an external bridge service that should be deployed separately (e.g., on Railway). The bridge service is not included in this repository.

### Required Bridge Service Features

Your external bridge service should provide these API endpoints:

- `GET /health` - Health check endpoint
- `GET /token/status` - Get current token status (requires auth)
- `POST /token/refresh` - Refresh access token (requires auth)
- `POST /token/update` - Update refresh token (requires auth)

### Configure Main Application

Set these environment variables in your main application:

```bash
TOKEN_BRIDGE_URL=https://your-bridge-service.up.railway.app
BRIDGE_SECRET=your_strong_random_secret_key
```

## API Endpoints

### Health Check
```
GET /health
```
Public endpoint that returns service status and diagnostics.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-09-02T20:13:55.122Z",
  "version": "1.0.0",
  "service": "token-bridge",
  "token_status": {
    "has_access_token": false,
    "has_refresh_token": true,
    "token_expires_at": 1725307435122,
    "token_expired": false,
    "last_updated": "2025-09-02T19:50:35.122Z",
    "rotation_count": 3
  },
  "environment": {
    "has_client_id": true,
    "has_client_secret": true,
    "has_bridge_secret": true,
    "bridge_secret_secure": true
  },
  "clock_drift": {
    "timestamp": "2025-09-02T20:13:55.122Z",
    "hasDrift": false,
    "driftSeconds": 0,
    "serverTime": "2025-09-02T20:13:55.122Z",
    "warning": null
  }
}
```

### Token Status
```
GET /token/status
Authorization: Bearer {BRIDGE_SECRET}
```
Get current token status (protected endpoint).

### Token Refresh
```
POST /token/refresh
Authorization: Bearer {BRIDGE_SECRET}
Content-Type: application/json

{
  "force": false  // Optional: force refresh even if token is still valid
}
```
Refresh the access token, with automatic caching if the current token is still valid.

### Update Refresh Token
```
POST /token/update
Authorization: Bearer {BRIDGE_SECRET}
Content-Type: application/json

{
  "refresh_token": "new_refresh_token_from_oauth"
}
```
Manually update the refresh token (useful for initial setup or token recovery).

## Integration with Main Application

The main application automatically uses the bridge service as a fallback when:

1. **Bridge Service is Configured**: `TOKEN_BRIDGE_URL` and `BRIDGE_SECRET` are set
2. **Direct Token Refresh Fails**: Primary OAuth request to Spreaker API fails
3. **Bridge Service is Healthy**: Health check passes before attempting fallback

### Example Integration

```javascript
import { checkBridgeHealth, refreshTokenViaBridge } from './src/bridge-client.js';

// Check if bridge is available
const health = await checkBridgeHealth();
if (health.healthy) {
  // Use bridge as fallback
  const result = await refreshTokenViaBridge();
  console.log('Token refreshed via bridge:', result.access_token);
}
```

## Security Features

### Authentication
- All protected endpoints require `Authorization: Bearer {BRIDGE_SECRET}` header
- Bridge secret validation prevents unauthorized access
- Automatic rejection of default/insecure secrets

### Data Protection
- Sensitive token data is masked in logs (only last 8 characters shown)
- No tokens stored in plain text logs
- Secure token lifecycle management

### One-Time-Use Token Rotation
- Automatically uses new refresh tokens when provided by Spreaker
- Discards old refresh tokens to prevent reuse
- Tracks rotation count for monitoring

## Monitoring and Diagnostics

### Logging
The bridge service provides comprehensive logging:

```
🕒 [2025-09-02T20:13:31.827Z] Bridge: Service started
🕒 [2025-09-02T20:13:45.123Z] Bridge: Token refresh started  
🕒 [2025-09-02T20:13:45.456Z] Bridge: Token refresh completed
```

### Metrics
- Token refresh attempts and success rates
- Token rotation count
- Clock drift detection
- Service uptime and health

### Clock Drift Detection
The service automatically detects system clock drift and warns if drift exceeds 2 seconds:

```
⚠️ System clock drift detected: 3500ms
```

## Troubleshooting

### Common Issues

#### Bridge Service Won't Start
```
Error: Bridge secret not configured
```
**Solution**: Set `BRIDGE_SECRET` environment variable to a strong random string.

#### Token Refresh Fails
```
🚨 Invalid grant error - refresh token may be expired or invalid
```
**Solution**: 
1. Generate a new refresh token using `oauth-server.js`
2. Update the bridge service via `/token/update` endpoint
3. Update `SPREAKER_REFRESH_TOKEN` environment variable

#### Main Application Can't Connect to Bridge
```
Bridge authentication failed - check BRIDGE_SECRET
```
**Solution**: Ensure `BRIDGE_SECRET` matches between bridge service and main application.

### Debug Mode

Start the bridge service with debug logging:

```bash
DEBUG=1 npm run bridge
```

## Deployment

### External Bridge Service

The bridge service should be deployed separately from this main application. Popular deployment options include:

- **Railway**: Deploy the bridge service as a separate Railway app
- **Heroku**: Deploy as a standalone Heroku application  
- **Vercel**: Deploy as serverless functions
- **Digital Ocean**: Deploy on droplets or app platform
- **AWS/GCP/Azure**: Deploy on cloud platforms

### Environment-Specific Configuration

```bash
# Development (if running bridge locally for testing)
TOKEN_BRIDGE_URL=http://localhost:5000

# Production  
TOKEN_BRIDGE_URL=https://your-bridge-service.up.railway.app

# Staging
TOKEN_BRIDGE_URL=https://staging-bridge.your-domain.com
```

## Testing

### Test Bridge Health
```bash
curl https://your-bridge-service.up.railway.app/health | jq '.'
```

### Test Token Refresh
```bash
curl -X POST https://your-bridge-service.up.railway.app/token/refresh \
  -H "Authorization: Bearer your_bridge_secret" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### Use Test Script
```bash
BRIDGE_SECRET=your_secret node test-bridge-client.js
```

## Best Practices

1. **Use Strong Bridge Secrets**: Generate cryptographically secure random strings
2. **Monitor Bridge Health**: Set up monitoring for the `/health` endpoint
3. **Regular Token Rotation**: Let the service handle automatic token rotation
4. **Separate Deployment**: Deploy bridge service separately from main application
5. **Environment Isolation**: Use different bridge secrets for different environments
6. **Backup Strategy**: Keep backup of working refresh tokens
7. **Log Monitoring**: Monitor logs for token rotation and error patterns

## Support

For issues with the bridge service:

1. Check the bridge service logs for detailed error messages
2. Verify environment variables are correctly set
3. Test the `/health` endpoint to ensure service is running
4. Use the test script to validate bridge client connectivity
5. Check Spreaker API status if token refresh continues to fail