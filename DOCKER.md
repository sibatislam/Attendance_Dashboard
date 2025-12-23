# Docker Setup Guide

This guide explains how to run the Attendance Monitoring Dashboard using Docker.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine + Docker Compose (Linux)
- At least 4GB of available RAM
- 10GB of free disk space

## Quick Start

### 1. Environment Setup

Create a `.env.docker` file in the project root (or copy from `env.docker.example`):

```bash
# Database Configuration
DB_USER=root
DB_PASSWORD=rootpassword
DB_HOST=db
DB_PORT=3306
DB_NAME=attendance_db

# Backend Configuration
BACKEND_PORT=8081
JWT_SECRET_KEY=your-secret-key-change-in-production

# Frontend Configuration
FRONTEND_PORT=5173
```

**Important:** Change `JWT_SECRET_KEY` to a strong random string in production!

### 2. Build and Run

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v
```

### 3. Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8081
- **API Docs:** http://localhost:8081/docs
- **MySQL:** localhost:3306 (user: root, password: from .env.docker)

## Development Mode

For development with hot-reload:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

This will:
- Enable hot-reload for backend (FastAPI --reload)
- Enable hot-reload for frontend (Vite dev server)
- Mount source code as volumes

## Services

### Backend (FastAPI)
- **Container:** `attendance_backend`
- **Port:** 8081
- **Health Check:** http://localhost:8081/health
- **Logs:** `docker-compose logs backend`

### Frontend (React/Vite)
- **Container:** `attendance_frontend`
- **Port:** 5173 (mapped to nginx port 80)
- **Logs:** `docker-compose logs frontend`

### Database (MySQL 8.0)
- **Container:** `attendance_db`
- **Port:** 3306
- **Data Persistence:** Docker volume `mysql_data`
- **Logs:** `docker-compose logs db`

## Common Commands

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Restart a specific service
docker-compose restart backend

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# Execute commands in containers
docker-compose exec backend python -m app.init_db
docker-compose exec db mysql -u root -p attendance_db

# Remove everything (including volumes)
docker-compose down -v

# Rebuild specific service
docker-compose build --no-cache backend
docker-compose up -d backend
```

## Database Initialization

The database is automatically initialized on first start. To manually initialize:

```bash
# Access MySQL container
docker-compose exec db mysql -u root -p

# Or run initialization script
docker-compose exec backend python -m app.init_db
```

## Troubleshooting

### Port Already in Use

If ports 3306, 8081, or 5173 are already in use:

1. Stop the conflicting service, or
2. Change ports in `.env.docker`:
   ```
   DB_PORT=3307
   BACKEND_PORT=8082
   FRONTEND_PORT=5174
   ```

### Database Connection Issues

1. Check if MySQL container is healthy:
   ```bash
   docker-compose ps
   ```

2. Check MySQL logs:
   ```bash
   docker-compose logs db
   ```

3. Verify environment variables:
   ```bash
   docker-compose exec backend env | grep DB_
   ```

### Frontend Can't Connect to Backend

1. Check backend is running:
   ```bash
   curl http://localhost:8081/health
   ```

2. Verify CORS settings in `backend/app/main.py`

3. Check frontend environment variable `VITE_API_BASE` in docker-compose.yml

### Rebuild After Code Changes

```bash
# Rebuild and restart
docker-compose up -d --build

# Or rebuild specific service
docker-compose build backend
docker-compose up -d backend
```

## Production Deployment

For production, consider:

1. **Security:**
   - Use strong `JWT_SECRET_KEY`
   - Change default database passwords
   - Restrict CORS origins
   - Use environment-specific `.env` files

2. **Performance:**
   - Use production-optimized nginx config
   - Enable database connection pooling
   - Configure proper resource limits

3. **Monitoring:**
   - Add logging aggregation
   - Set up health check monitoring
   - Configure backup strategies

4. **Example production docker-compose:**
   ```yaml
   # Add resource limits
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '1'
             memory: 1G
   ```

## Data Persistence

- **MySQL data:** Stored in Docker volume `mysql_data`
- **Backend uploads:** Stored in Docker volume `backend_data` (if configured)

To backup database:
```bash
docker-compose exec db mysqldump -u root -p attendance_db > backup.sql
```

To restore:
```bash
docker-compose exec -T db mysql -u root -p attendance_db < backup.sql
```

## Cleanup

```bash
# Remove containers and networks
docker-compose down

# Remove containers, networks, and volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Complete cleanup (containers, volumes, images)
docker-compose down -v --rmi all
```

