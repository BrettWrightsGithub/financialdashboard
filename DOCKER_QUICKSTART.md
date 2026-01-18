# Docker Quick Start

## First Time Setup

```bash
# 1. Copy environment template
cp .env.local.example .env.local

# 2. Edit .env.local with your Supabase credentials
# (Get these from https://app.supabase.com/project/_/settings/api)

# 3. Build and start
docker-compose up -d --build

# 4. Check health
curl http://localhost:3003/api/health
```

## Common Commands

```bash
# Start containers
docker-compose up -d

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

# View resource usage
docker stats financial-command-center
```

## Troubleshooting

```bash
# Container won't start? Check logs:
docker-compose logs financial-dashboard

# Clear everything and rebuild:
docker-compose down
docker system prune -a
docker-compose up -d --build

# Check environment variables:
docker-compose exec financial-dashboard env | grep SUPABASE
```

## Production Checklist

- [ ] `.env.local` configured with real credentials
- [ ] Supabase database migrations applied
- [ ] Health check returns 200 OK
- [ ] Application accessible at http://localhost:3003
- [ ] Logs show no errors

See `DEPLOYMENT.md` for comprehensive production deployment guide.
