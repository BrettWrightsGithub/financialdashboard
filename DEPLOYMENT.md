# Production Deployment Guide

This guide covers deploying the Financial Command Center to production using Docker.

## Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- A Supabase project with the database schema applied
- Environment variables configured

## Quick Start

### 1. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your actual credentials:

```bash
# Required: Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional: Plaid (if using Plaid sync)
# PLAID_CLIENT_ID=your-plaid-client-id
# PLAID_SECRET=your-plaid-secret
# PLAID_ENV=sandbox

NODE_ENV=production
```

**Security Note**: Never commit `.env.local` to version control. It contains sensitive credentials.

### 2. Build and Run

Build and start the container:

```bash
docker-compose up -d --build
```

The application will be available at `http://localhost:3003`

### 3. Verify Deployment

Check the health endpoint:

```bash
curl http://localhost:3003/api/health
```

Expected response (200 OK):
```json
{
  "timestamp": "2026-01-04T06:59:00.000Z",
  "overall": "healthy",
  "checks": [
    {
      "name": "supabase",
      "status": "healthy",
      "latency": 45
    }
  ]
}
```

View container logs:

```bash
docker-compose logs -f financial-dashboard
```

## Docker Architecture

### Multi-Stage Build

The Dockerfile uses a 3-stage build process for optimal image size:

1. **deps**: Installs dependencies
2. **builder**: Builds the Next.js application with standalone output
3. **runner**: Production runtime with minimal dependencies (~150MB)

### Security Features

- Non-root user (`nextjs:nodejs`) runs the application
- Minimal Alpine Linux base image
- No dev dependencies in production image
- Environment variables never baked into image

### Standalone Output

Next.js standalone mode bundles only required dependencies, reducing:
- Image size by ~70%
- Attack surface
- Startup time

## Production Best Practices

### Health Checks

Docker Compose includes automatic health checks:
- Checks `/api/health` every 30 seconds
- 3 retries before marking unhealthy
- 40-second startup grace period

### Logging

Logs are automatically rotated:
- Max file size: 10MB
- Max files: 3 (30MB total)

View logs:
```bash
docker-compose logs -f --tail=100 financial-dashboard
```

### Updates and Rollbacks

To update to a new version:

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build
```

To rollback:

```bash
# Stop current container
docker-compose down

# Checkout previous version
git checkout <previous-commit>

# Rebuild
docker-compose up -d --build
```

### Backup Strategy

**Database**: Supabase handles automatic backups. Configure point-in-time recovery in your Supabase project settings.

**Environment Variables**: Keep a secure backup of `.env.local` in a password manager or secrets vault.

## Troubleshooting

### Container Won't Start

Check logs:
```bash
docker-compose logs financial-dashboard
```

Common issues:
- Missing environment variables
- Invalid Supabase credentials
- Port 3003 already in use

### Health Check Failing

1. Check Supabase connection:
```bash
docker-compose exec financial-dashboard node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

2. Test health endpoint manually:
```bash
docker-compose exec financial-dashboard wget -O- http://localhost:3000/api/health
```

### High Memory Usage

Next.js standalone mode is optimized, but if you see high memory:

1. Check for memory leaks in custom code
2. Limit container memory in `docker-compose.yml`:
```yaml
services:
  financial-dashboard:
    deploy:
      resources:
        limits:
          memory: 512M
```

### Build Failures

Clear Docker cache and rebuild:
```bash
docker-compose down
docker system prune -a
docker-compose up -d --build
```

## Monitoring

### Container Status

```bash
docker-compose ps
```

### Resource Usage

```bash
docker stats financial-command-center
```

### Application Metrics

The health endpoint provides:
- Supabase connection status
- Response latency
- Overall system health

Consider integrating with monitoring tools:
- Prometheus + Grafana
- Datadog
- New Relic
- Sentry (for error tracking)

## Production Deployment Platforms

### Self-Hosted (VPS/Dedicated Server)

1. Install Docker and Docker Compose on your server
2. Clone repository and configure `.env.local`
3. Run `docker-compose up -d --build`
4. Configure reverse proxy (nginx/Caddy) for HTTPS
5. Set up automatic updates and monitoring

### Cloud Platforms

#### AWS ECS/Fargate
- Use the Dockerfile as-is
- Store secrets in AWS Secrets Manager
- Configure ALB for load balancing

#### Google Cloud Run
- Build: `docker build -t gcr.io/PROJECT_ID/financial-dashboard .`
- Push: `docker push gcr.io/PROJECT_ID/financial-dashboard`
- Deploy: `gcloud run deploy --image gcr.io/PROJECT_ID/financial-dashboard`

#### Azure Container Instances
- Build and push to Azure Container Registry
- Deploy using Azure Portal or CLI

#### DigitalOcean App Platform
- Connect GitHub repository
- Use Dockerfile for deployment
- Configure environment variables in dashboard

## Security Checklist

- [ ] `.env.local` is not committed to git
- [ ] Supabase RLS policies are enabled
- [ ] Service role key is only used server-side
- [ ] HTTPS is configured (via reverse proxy)
- [ ] Container runs as non-root user
- [ ] Regular security updates applied
- [ ] Secrets stored securely (not in plain text)
- [ ] Database backups configured
- [ ] Monitoring and alerting set up

## Performance Optimization

### Image Optimization

Next.js automatically optimizes images. For external images, add domains to `next.config.ts`:

```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'example.com',
    },
  ],
}
```

### Caching

Consider adding Redis for:
- Session storage
- API response caching
- Rate limiting

### CDN

For static assets, consider:
- Cloudflare
- AWS CloudFront
- Vercel Edge Network

## Support

For issues specific to:
- **Next.js**: https://nextjs.org/docs
- **Docker**: https://docs.docker.com
- **Supabase**: https://supabase.com/docs

For application-specific issues, check:
- Application logs: `docker-compose logs`
- Health endpoint: `/api/health`
- Database logs in Supabase dashboard
