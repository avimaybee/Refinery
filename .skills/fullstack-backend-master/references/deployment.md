# Deployment Checklist Reference

## Pre-Deployment

### Code Quality
- [ ] All tests passing (unit, integration, E2E)
- [ ] No linter errors or warnings
- [ ] Code review approved
- [ ] No TODO/FIXME in critical paths
- [ ] Dependencies updated and audited (`npm audit`)

### Database
- [ ] Migrations tested on staging
- [ ] Rollback scripts tested
- [ ] Backup verified and recent
- [ ] Index analysis complete
- [ ] Connection pool sized appropriately

### Configuration
- [ ] Environment variables set for production
- [ ] Secrets rotated if needed
- [ ] Feature flags configured
- [ ] Third-party API keys validated

## Security Checklist

### Transport Security
- [ ] TLS 1.2+ enforced
- [ ] HSTS header enabled (`Strict-Transport-Security`)
- [ ] Certificate valid and not expiring soon

### HTTP Headers
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
```

### Authentication
- [ ] Password hashing cost factor adequate (bcrypt ≥ 12)
- [ ] JWT secrets are strong (256+ bits)
- [ ] Token expiry configured correctly
- [ ] Rate limiting on auth endpoints

### Input Validation
- [ ] All inputs validated server-side
- [ ] File uploads restricted (type, size)
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified

## Infrastructure Checklist

### Compute
- [ ] Instance size appropriate for load
- [ ] Auto-scaling configured
- [ ] Health checks configured
- [ ] Graceful shutdown implemented

### Database
- [ ] Read replicas if needed
- [ ] Connection limits configured
- [ ] Slow query logging enabled
- [ ] Automated backups configured

### Caching
- [ ] Redis/Memcached configured
- [ ] Cache invalidation tested
- [ ] Cache eviction policy set

### CDN/Static Assets
- [ ] Static assets on CDN
- [ ] Cache headers configured
- [ ] Gzip/Brotli compression enabled

## Monitoring Setup

### Metrics to Track
```
# Latency
- p50, p95, p99 response times
- Database query times

# Throughput
- Requests per second
- Background job processing rate

# Errors
- 5xx rate
- 4xx rate (especially 429, 401, 403)
- Unhandled exceptions

# Saturation
- CPU usage
- Memory usage
- Database connections
- Queue depth
```

### Alerting Rules
| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | > 1% | > 5% |
| p99 latency | > 1s | > 3s |
| CPU usage | > 70% | > 90% |
| Memory usage | > 80% | > 95% |
| Queue depth | > 1000 | > 5000 |

### Logging
- [ ] Structured JSON logging
- [ ] Log aggregation configured (ELK, Datadog, etc.)
- [ ] Correlation IDs implemented
- [ ] Sensitive data redacted
- [ ] Log retention policy set

## Deployment Process

### Blue-Green Deployment
```bash
# 1. Deploy to green environment
deploy --env green

# 2. Run smoke tests
curl https://green.myapp.com/health

# 3. Switch traffic
switch-traffic --from blue --to green

# 4. Monitor for issues (15-30 min)

# 5. Decommission blue (or keep for rollback)
```

### Canary Deployment
```bash
# 1. Deploy to canary (5% traffic)
deploy --env canary --traffic 5%

# 2. Monitor metrics for 30 min

# 3. Gradually increase
deploy --env canary --traffic 25%
deploy --env canary --traffic 50%
deploy --env canary --traffic 100%
```

### Rollback Plan
```bash
# Immediate rollback
rollback --to previous-version

# Database rollback (if needed)
migrate:rollback --step 1
```

## Post-Deployment

### Immediate (First 30 min)
- [ ] Smoke tests passing
- [ ] Error rate stable
- [ ] Latency stable
- [ ] No memory leaks
- [ ] Logs showing expected behavior

### Short-term (First 24 hours)
- [ ] Monitor error rates
- [ ] Check for memory growth
- [ ] Verify background jobs completing
- [ ] Customer-reported issues investigated

### Documentation
- [ ] Changelog updated
- [ ] Runbook updated if needed
- [ ] Post-mortem if issues occurred

## Environment-Specific Notes

### Staging
- Use production-like data (anonymized)
- Run full integration tests
- Test with production-like load

### Production
- Never deploy on Fridays (unless urgent)
- Deploy during low-traffic windows
- Always have rollback ready
- Notify team before and after

## Quick Commands

```bash
# Health check
curl -f https://api.myapp.com/health

# View recent logs
kubectl logs -f deployment/api --tail=100

# Check pod status
kubectl get pods -l app=api

# Scale up
kubectl scale deployment/api --replicas=5

# Rollback
kubectl rollout undo deployment/api
```
