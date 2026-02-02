# Deployment Guide

This guide covers setting up and deploying the Financial Dashboard.

## Prerequisites

- Node.js 20+
- A Supabase project
- (Optional) Docker 20.10+ and Docker Compose 2.0+

## Quick Start (Docker)

```bash
# 1. Copy environment template
cp .env.local.example .env.local

# 2. Edit .env.local with your Supabase credentials
# Get these from https://app.supabase.com/project/_/settings/api

# 3. Build and start
docker-compose up -d --build

# 4. Check health
curl http://localhost:3003/api/health
```

The application will be available at `http://localhost:3003`

## Quick Start (Local Dev)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Run dev server
npm run dev
```

Open http://localhost:3000

## Environment Variables

Required in `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Environment
NODE_ENV=development  # or production
```

**Security Note:** Never commit `.env.local` to version control.

## Docker Deployment

### Build and Run

```bash
docker-compose up -d --build
```

### Common Docker Commands

```bash
# Stop containers
docker-compose down

# View logs
docker-compose logs -f financial-dashboard

# Rebuild after code changes
docker-compose up -d --build

# Check container status
docker-compose ps

# Execute command in container
docker-compose exec financial-dashboard sh
```

### Docker Architecture

The Dockerfile uses a 3-stage build process:

1. **deps** — Installs dependencies
2. **builder** — Builds Next.js with standalone output
3. **runner** — Production runtime with minimal dependencies (~150MB)

### Health Check

The health endpoint is available at `/api/health`:

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

## Supabase Setup

### 1. Create Project

1. Go to https://supabase.com and create a new project
2. Wait for the database to be ready

### 2. Apply Migrations

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Link your project
supabase link --project-ref your-project-id

# Apply migrations
supabase db push
```

Or manually run the migration files from `supabase/migrations/` in the Supabase SQL editor.

### 3. Configure Row Level Security (RLS)

Ensure RLS policies are enabled on all tables. See `supabase/migrations/` for policy examples.

## Production Deployment

### Self-Hosted (VPS)

1. Install Docker and Docker Compose on your server
2. Clone repository and configure `.env.local`
3. Run `docker-compose up -d --build`
4. Configure reverse proxy (nginx/Caddy) for HTTPS
5. Set up automatic updates and monitoring

### Cloud Platforms

#### Vercel (Recommended for Next.js)

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy — Vercel handles build and hosting automatically

#### Google Cloud Run

```bash
# Build image
docker build -t gcr.io/PROJECT_ID/financial-dashboard .

# Push
docker push gcr.io/PROJECT_ID/financial-dashboard

# Deploy
gcloud run deploy --image gcr.io/PROJECT_ID/financial-dashboard
```

#### AWS ECS/Fargate

- Use the Dockerfile as-is
- Store secrets in AWS Secrets Manager
- Configure ALB for load balancing

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
curl http://localhost:3003/api/health
```

### Clear Docker Cache

```bash
docker-compose down
docker system prune -a
docker-compose up -d --build
```

## Security Checklist

- [ ] `.env.local` is not committed to git
- [ ] Supabase RLS policies are enabled
- [ ] Service role key is only used server-side
- [ ] HTTPS is configured in production
- [ ] Container runs as non-root user
- [ ] Database backups configured
- [ ] Monitoring and alerting set up

## Monitoring

### Check Container Status

```bash
docker-compose ps
```

### View Resource Usage

```bash
docker stats financial-command-center
```

### Application Logs

```bash
docker-compose logs -f --tail=100 financial-dashboard
```

## Updates

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

## Support

For issues specific to:
- **Next.js**: https://nextjs.org/docs
- **Docker**: https://docs.docker.com
- **Supabase**: https://supabase.com/docs
