# Attendance Monitoring Dashboard - Docker Deployment Guide (Windows)

This comprehensive guide explains how to deploy and manage the Attendance Monitoring Dashboard system using Docker containers on **Windows**.

## 📋 **Table of Contents**

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Services Overview](#services-overview)
- [Configuration](#configuration)
- [🚀 Quick Commands Reference](#-quick-commands-reference)
- [Health Checks](#health-checks)
- [File Uploads](#file-uploads)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Monitoring](#monitoring)
- [Updates and Maintenance](#updates-and-maintenance)
- [Support](#support)

## Prerequisites

- **Docker Desktop for Windows** (20.10+) - Already installed and running
- **Docker Compose** (2.0+) - Included with Docker Desktop
- At least **4GB RAM** available for containers
- Ports **8081** (backend), **5173** (frontend), and **3310** (MySQL) available on your system

## Quick Start

1. **Open PowerShell and navigate to the project directory:**
   ```powershell
   cd C:\path\to\Attendance_Dashboard_React
   ```

2. **Start all services:**
   ```powershell
   docker-compose up -d
   ```

3. **Check service status:**
   ```powershell
   docker-compose ps
   ```

4. **View logs:**
   ```powershell
   docker-compose logs -f
   ```

## Services Overview

The application consists of three services:

> **Note:** Ports have been configured to use non-default ports to avoid conflicts:
> - MySQL: 3310 (external) to avoid conflict with system MySQL on 3306
> - Backend: 8081 (external and internal)
> - Frontend: 5173 (external)

### 1. MySQL Database (`db`)
- **Container Name:** `attendance-dashboard-mysql`
- **Image:** `attendance-dashboard-mysql:latest`
- **Port:** 3310 (external), 3306 (internal)
- **Database:** attendance_db
- **User:** root
- **Password:** rootpassword
- **Root Password:** rootpassword

### 2. Backend API (`backend`)
- **Container Name:** `attendance-dashboard-backend`
- **Image:** `attendance-dashboard-backend:latest`
- **Port:** 8081 (external and internal)
- **Health Check:** http://localhost:8081/health
- **API Docs:** http://localhost:8081/docs
- **Environment:** Production Python/FastAPI

### 3. Frontend Web App (`frontend`)
- **Container Name:** `attendance-dashboard-frontend`
- **Image:** `attendance-dashboard-frontend:latest`
- **Port:** 5173 (external), 80 (internal)
- **URL:** http://localhost:5173
- **Serves:** React build with Nginx

## Configuration

### Database Initialization

The database is automatically initialized with the schema when the MySQL container starts for the first time. To manually initialize:

```powershell
docker-compose exec backend python -m app.init_db
```

## 🚀 **Quick Commands Reference**

### **Initial Setup (First Time)**

```powershell
# Navigate to project folder
cd C:\path\to\Attendance_Dashboard_React

# Build and start all containers
docker-compose up -d --build

# Check if everything is running
docker-compose ps
```

### **Start Services**

```powershell
# Start all services in background
docker-compose up -d

# Start and view logs
docker-compose up
```

### **Stop Services**

```powershell
# Stop all services (keeps data, networks, and images)
docker-compose down

# Stop and remove everything INCLUDING DATA (WARNING: Deletes database)
docker-compose down -v
# or
docker-compose down --volumes

# Stop, remove images, and volumes (COMPLETE CLEANUP)
docker-compose down --rmi all --volumes
# This removes:
#   ✅ Containers
#   ✅ Networks  
#   ✅ All images used by services (--rmi all)
#   ✅ All volumes including database data (--volumes)
#   ⚠️  WARNING: This deletes ALL data permanently!
```

**What Each Command Does:**

| Command | Containers | Networks | Images | Volumes | Use Case |
|---------|-----------|----------|--------|---------|----------|
| `docker-compose down` | ✅ Removed | ✅ Removed | ❌ Kept | ❌ Kept | Normal shutdown, keep data |
| `docker-compose down -v` | ✅ Removed | ✅ Removed | ❌ Kept | ✅ Removed | Fresh database, keep images |
| `docker-compose down --rmi all` | ✅ Removed | ✅ Removed | ✅ Removed | ❌ Kept | Remove images, keep data |
| `docker-compose down --rmi all --volumes` | ✅ Removed | ✅ Removed | ✅ Removed | ✅ Removed | **Complete cleanup** |

> **⚠️ Important:** `--volumes` flag deletes database data, uploaded files, and all persisted data. Always backup before using `--volumes` in production!

### **Status & Monitoring**

```powershell
# Check container status
docker-compose ps

# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# Check resource usage
docker stats
```

### **Updates & Rebuilds**

#### **Update Application (Keep Database)**

```powershell
# Pull latest code from Git (if using Git)
git pull

# ⚠️ IMPORTANT: Stop running containers first!
docker-compose down

# Rebuild and restart (keeps database data)
docker-compose up -d --build

# Restart without rebuild (env changes only)
docker-compose up -d
```

#### **Update Specific Service**

```powershell
# Rebuild specific service
docker-compose build backend
docker-compose up -d backend

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
docker-compose restart db
```

#### **Update Without Removing Database**

```powershell
# Method 1: Standard update (recommended)
docker-compose down          # Stops containers, keeps volumes
docker-compose up -d --build # Rebuilds images, keeps database

# Method 2: Force rebuild with cache clear
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Method 3: Update specific service only
docker-compose stop backend
docker-compose build backend
docker-compose up -d backend
```

> **💡 Tip:** Using `docker-compose down` (without `-v`) keeps all volumes intact, preserving your database and uploaded files.

### **Database Management**

```powershell
# Connect to MySQL container
docker-compose exec db mysql -u root -p attendance_db
# Password is from .env file (DB_PASSWORD)

# Access MySQL shell as root
docker-compose exec db mysql -u root -p

# Create database backup
docker-compose exec db mysqldump -u root -p attendance_db > backup.sql

# Restore database
Get-Content backup.sql | docker-compose exec -T db mysql -u root -p attendance_db

# Reset database (WARNING: Deletes all data)
docker-compose down -v
docker-compose up -d --build
```

### **Cleanup Commands**

```powershell
# Remove unused containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes (CAREFUL: May delete data)
docker volume prune

# Full cleanup (CAREFUL: Removes everything)
docker system prune -a

# Clean Docker build cache (frees up disk space)
docker builder prune -a

# Remove all unused data, images, containers, and volumes (nuclear option)
docker system prune -a --volumes
```

### **Remove Everything (Complete Cleanup)**

```powershell
# Complete cleanup - removes containers, networks, images, and volumes
docker-compose down --rmi all --volumes

# Verify everything is removed
docker-compose ps
docker images | Select-String "attendance-dashboard"
docker volume ls | Select-String "attendance-dashboard"

# To start fresh after cleanup
docker-compose up -d --build
docker-compose exec backend python -m app.init_db
```

**What Gets Removed:**
- ✅ All containers (`attendance-dashboard-frontend`, `attendance-dashboard-backend`, `attendance-dashboard-mysql`)
- ✅ All networks (`attendance-dashboard_attendance_network`)
- ✅ All images (`attendance-dashboard-frontend:latest`, `attendance-dashboard-backend:latest`, `attendance-dashboard-mysql:latest`)
- ✅ All volumes (`attendance-dashboard_mysql_data`, `attendance-dashboard_backend_data`)

> **⚠️ WARNING:** This permanently deletes ALL data including database, uploaded files, and all persisted data!

### **Quick Health Check**

```powershell
# 1. Check containers are running
docker-compose ps

# 2. Test backend health
Invoke-WebRequest -Uri http://localhost:8081/health

# 3. Test frontend
Invoke-WebRequest -Uri http://localhost:5173

# 4. Test API documentation
Start-Process http://localhost:8081/docs

# 5. Check logs for errors
docker-compose logs --tail=50
```

### **Emergency Commands**

```powershell
# Force restart everything (keeps data)
docker-compose down
docker-compose up -d --build

# Reset everything - fresh database (WARNING: Deletes data)
docker-compose down -v
docker-compose up -d --build
docker-compose exec backend python -m app.init_db

# Complete cleanup - remove everything including images (WARNING: Deletes ALL data)
docker-compose down --rmi all --volumes
docker-compose up -d --build
docker-compose exec backend python -m app.init_db

# View detailed container info
docker inspect attendance-dashboard-backend
docker inspect attendance-dashboard-frontend
docker inspect attendance-dashboard-mysql
```

## Health Checks

Each service includes health checks:

- **MySQL:** `mysqladmin ping`
- **Backend:** `GET /health` endpoint
- **Frontend:** Nginx default health check

Check health status:
```powershell
docker-compose ps
```

All services should show `(healthy)` status.

## File Uploads

Uploaded files are stored in Docker volumes and are persisted across container restarts. The database stores file metadata and row data.

## Production Deployment

### 1. Security Considerations

- Change default passwords in `.env` file
- Use strong `JWT_SECRET_KEY` (minimum 32 characters)
- Configure proper firewall rules
- Use HTTPS in production (configure reverse proxy)
- Restrict CORS origins in `backend/app/main.py`

### 2. Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  db:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
  
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'
  
  frontend:
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.1'
```

### 3. Backup Strategy

```powershell
# Create backup script (PowerShell)
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
docker-compose exec db mysqldump -u root -p attendance_db > "backup_$timestamp.sql"

# Automated backup script
$backupDir = "C:\backups\attendance-dashboard"
New-Item -ItemType Directory -Force -Path $backupDir
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
docker-compose exec db mysqldump -u root -p$env:DB_PASSWORD attendance_db > "$backupDir\backup_$timestamp.sql"
```

### 4. Firewall Configuration

```powershell
# Open ports for network access (Run as Administrator)
New-NetFirewallRule -DisplayName "Attendance Dashboard Frontend" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Attendance Dashboard Backend" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Attendance Dashboard MySQL" -Direction Inbound -LocalPort 3310 -Protocol TCP -Action Allow
```

## Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```powershell
   # Check what's using ports (Windows)
   netstat -ano | findstr :8081
   netstat -ano | findstr :5173
   netstat -ano | findstr :3310
   
   # Kill process using port (replace PID)
   taskkill /PID <PID> /F
   ```

2. **Database connection issues:**
   ```powershell
   # Check MySQL logs
   docker-compose logs db
   
   # Test database connection
   docker-compose exec db mysql -u root -p -e "SHOW DATABASES;"
   
   # Verify environment variables
   docker-compose exec backend env | Select-String "DB_"
   ```

3. **Frontend not loading:**
   ```powershell
   # Check frontend logs
   docker-compose logs frontend
   
   # Rebuild frontend
   docker-compose up -d --build frontend
   
   # Check nginx configuration
   docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
   ```

4. **Backend health check failing:**
   ```powershell
   # Check backend logs
   docker-compose logs backend
   
   # Restart backend
   docker-compose restart backend
   
   # Test health endpoint directly
   Invoke-WebRequest -Uri http://localhost:8081/health
   
   # Check if backend can connect to database
   docker-compose exec backend python -c "from app.db import engine; print(engine.connect())"
   ```

5. **Container keeps restarting:**
   ```powershell
   # Check logs for errors
   docker-compose logs --tail=100
   
   # Check container status
   docker-compose ps
   
   # Inspect container
   docker inspect attendance-dashboard-backend
   ```

### Reset Everything

```powershell
# Option 1: Reset database but keep images
docker-compose down -v
docker-compose up -d --build
docker-compose exec backend python -m app.init_db

# Option 2: Complete cleanup (removes images and volumes)
docker-compose down --rmi all --volumes
docker-compose up -d --build
docker-compose exec backend python -m app.init_db

# Option 3: Step-by-step (if you need more control)
docker-compose down          # Stop containers
docker-compose down --rmi all --volumes  # Remove images and volumes
docker-compose up -d --build  # Rebuild and start fresh
docker-compose exec backend python -m app.init_db  # Initialize database
```

**What Happens:**
- All containers, networks, images, and volumes are removed
- On next `docker-compose up`, everything is rebuilt from scratch
- Database is recreated and initialized
- All data is permanently deleted

> **⚠️ WARNING:** Always backup your database before using `--volumes` flag!

## Monitoring

### Resource Usage
```powershell
# View resource usage
docker stats

# View specific service stats
docker stats attendance-dashboard-mysql attendance-dashboard-backend attendance-dashboard-frontend
```

### Application Logs
```powershell
# Real-time logs
docker-compose logs -f --tail=100

# Export logs
docker-compose logs > application.log

# View logs for specific time period
docker-compose logs --since 30m
```

## Updates and Maintenance

### Update Application (Keep Database)

```powershell
# Pull latest changes (if using Git)
git pull

# Stop containers (keeps volumes/database)
docker-compose down

# Rebuild and restart (database preserved)
docker-compose up -d --build

# Verify services are running
docker-compose ps
```

### Update Dependencies

```powershell
# Rebuild with no cache
docker-compose build --no-cache

# Restart services
docker-compose up -d
```

### Update Without Removing Database

```powershell
# Standard update procedure (recommended)
docker-compose down          # Stops containers, preserves volumes
docker-compose up -d --build # Rebuilds images, keeps database intact
```

## Support

For issues or questions:
1. Check the logs: `docker-compose logs -f`
2. Verify service health: `docker-compose ps`
3. Check resource usage: `docker stats`
4. Review this documentation

---

**Note:** This Docker setup is configured for development and testing. For production deployment, consider additional security measures, monitoring, and backup strategies.

