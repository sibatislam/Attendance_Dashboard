# Docker Setup Guide

This guide explains how to run the Attendance Monitoring Dashboard using Docker.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine + Docker Compose (Linux)
- At least 4GB of available RAM
- 10GB of free disk space

---

# Docker Setup Instructions

Choose your operating system:

- [Windows Setup](#windows-setup-instructions)
- [Linux Setup](#linux-setup-instructions)

---

## Windows Setup Instructions

### Prerequisites for Windows

- Windows 10/11 or Windows Server 2016+
- Administrator access
- At least 4GB RAM available
- 10GB free disk space

### Step 1: Install Docker Desktop

1. **Download Docker Desktop:**
   - Visit: https://www.docker.com/products/docker-desktop
   - Download "Docker Desktop for Windows"
   - Choose the appropriate version (Intel/AMD64 or ARM64)

2. **Install Docker Desktop:**
   - Run the installer (`Docker Desktop Installer.exe`)
   - Follow the installation wizard
   - **Important:** Enable "Use WSL 2 instead of Hyper-V" if prompted (recommended)
   - Restart your computer when prompted

3. **Start Docker Desktop:**
   - Launch Docker Desktop from Start Menu
   - Wait for Docker to start (whale icon in system tray)
   - Accept the service agreement if prompted

4. **Verify Installation:**
   - Open Command Prompt or PowerShell
   - Run:
     ```cmd
     docker --version
     docker-compose --version
     ```
   - You should see version numbers

### Step 2: Download/Clone the Repository

**Option A: Download ZIP**
1. Download the repository as ZIP file
2. Extract to a location (e.g., `C:\Projects\Attendance_Dashboard_React`)

**Option B: Clone with Git**
```cmd
cd C:\Projects
git clone <repository-url> Attendance_Dashboard_React
cd Attendance_Dashboard_React
```

### Step 3: Navigate to Project Directory

Open **Command Prompt** or **PowerShell**:

```cmd
cd C:\path\to\Attendance_Dashboard_React
```

Replace with your actual path.

### Step 4: Create Environment File

```cmd
copy env.docker.example .env
```

Or in PowerShell:
```powershell
Copy-Item env.docker.example .env
```

### Step 5: Configure Environment Variables

Open `.env` file in Notepad or any text editor:

```notepad
DB_USER=root
DB_PASSWORD=your_secure_password_here
DB_HOST=db
DB_PORT=3310
DB_NAME=attendance_db

BACKEND_PORT=8081
JWT_SECRET_KEY=your-strong-random-secret-key-here

FRONTEND_PORT=5173
```

**Important Security Steps:**
1. Change `DB_PASSWORD` to a strong password
2. Change `JWT_SECRET_KEY` to a random string (minimum 32 characters)

**Generate Secure Keys (PowerShell):**
```powershell
# Generate random password
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})

# Generate JWT secret
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})
```

Save the `.env` file.

### Step 6: Build Docker Images

```cmd
docker-compose build
```

**First time will take 5-10 minutes** as it downloads base images and installs dependencies.

**Expected output:**
```
[+] Building ...
[+] Building 15.2s
 => [backend] ...
 => [frontend] ...
 => [db] ...
Successfully built ...
```

### Step 7: Start All Services

```cmd
docker-compose up -d
```

The `-d` flag runs containers in the background.

**Expected output:**
```
Creating network "attendance-dashboard_attendance_network" ... done
Creating volume "attendance-dashboard_mysql_data" ... done
Creating container "attendance-dashboard-mysql" ... done
Creating container "attendance-dashboard-backend" ... done
Creating container "attendance-dashboard-frontend" ... done
```

### Step 8: Verify Services are Running

```cmd
docker-compose ps
```

**Expected output:**
```
NAME                            STATUS
attendance-dashboard-backend    Up (healthy)
attendance-dashboard-frontend   Up (healthy)
attendance-dashboard-mysql      Up (healthy)
```

### Step 9: Initialize Database

```cmd
docker-compose exec backend python -m app.init_db
```

**Expected output:**
```
✓ Database initialized
✓ Admin user created
```

### Step 10: Configure Windows Firewall (For Network Access)

If you want to access from other computers on the network:

**Using PowerShell (Run as Administrator):**
```powershell
# Frontend port
New-NetFirewallRule -DisplayName "Attendance Dashboard Frontend" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow

# Backend port
New-NetFirewallRule -DisplayName "Attendance Dashboard Backend" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow

# Database port (optional, only if needed externally)
New-NetFirewallRule -DisplayName "Attendance Dashboard MySQL" -Direction Inbound -LocalPort 3310 -Protocol TCP -Action Allow
```

**Using GUI:**
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule"
4. Select "Port" → Next
5. Enter port number (5173, 8081, or 3310)
6. Allow the connection
7. Apply to all profiles
8. Name it (e.g., "Attendance Dashboard Frontend")

### Step 11: Access the Application

**Local Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8081
- API Documentation: http://localhost:8081/docs

**Network Access (from other computers):**
- Frontend: http://your-windows-ip:5173
- Backend API: http://your-windows-ip:8081
- API Documentation: http://your-windows-ip:8081/docs

**Find your Windows IP:**
```cmd
ipconfig
```
Look for "IPv4 Address" under your network adapter.

### Windows Common Commands

```cmd
# View logs
docker-compose logs -f

# Stop all services
docker-compose stop

# Start all services
docker-compose start

# Restart all services
docker-compose restart

# Stop and remove containers
docker-compose down

# Stop and remove containers + data (⚠️ deletes database)
docker-compose down -v

# View container status
docker-compose ps

# Access backend container
docker-compose exec backend bash

# Access database
docker-compose exec db mysql -u root -p
```

### Windows Troubleshooting

**Issue: Docker Desktop won't start**
- Ensure virtualization is enabled in BIOS
- Check Windows Features: Enable "Virtual Machine Platform" and "Windows Subsystem for Linux"
- Restart computer

**Issue: Port already in use**
```cmd
# Find what's using the port
netstat -ano | findstr :8081

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Issue: Permission denied**
- Run Command Prompt/PowerShell as Administrator
- Right-click → "Run as administrator"

---

## Linux Setup Instructions

### Prerequisites for Linux

- Ubuntu 20.04+ / Debian 10+ / CentOS 7+ / RHEL 7+
- Root or sudo access
- At least 4GB RAM available
- 10GB free disk space
- Internet connection

### Step 1: Install Docker

**For Ubuntu/Debian:**
```bash
# Update package index
sudo apt-get update

# Install prerequisites
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (to run without sudo)
sudo usermod -aG docker $USER

# Log out and log back in for group changes to take effect
```

**For CentOS/RHEL:**
```bash
# Install required packages
sudo yum install -y yum-utils

# Add Docker repository
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker Engine
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and log back in
```

**For other Linux distributions:**
```bash
# Use Docker's convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
```

### Step 2: Verify Docker Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker-compose --version

# Test Docker (run without sudo after logging out/in)
docker run hello-world
```

### Step 3: Download/Clone the Repository

**Option A: Clone with Git**
```bash
cd /opt
sudo git clone <repository-url> Attendance_Dashboard_React
cd Attendance_Dashboard_React
sudo chown -R $USER:$USER .
```

**Option B: Download and Extract**
```bash
cd /opt
sudo wget <repository-zip-url> -O Attendance_Dashboard_React.zip
sudo unzip Attendance_Dashboard_React.zip
cd Attendance_Dashboard_React
sudo chown -R $USER:$USER .
```

### Step 4: Navigate to Project Directory

```bash
cd /opt/Attendance_Dashboard_React
# Or your actual path
```

### Step 5: Create Environment File

```bash
cp env.docker.example .env
```

### Step 6: Configure Environment Variables

Edit the `.env` file:

```bash
nano .env
# Or use: vi .env, gedit .env, etc.
```

Update these values:
```
DB_USER=root
DB_PASSWORD=your_secure_password_here
DB_HOST=db
DB_PORT=3310
DB_NAME=attendance_db

BACKEND_PORT=8081
JWT_SECRET_KEY=your-strong-random-secret-key-here

FRONTEND_PORT=5173
```

**Generate Secure Keys:**
```bash
# Generate random password (32 characters)
openssl rand -hex 16

# Generate JWT secret (64 characters)
openssl rand -hex 32
```

Save and exit (in nano: `Ctrl+X`, then `Y`, then `Enter`)

### Step 7: Build Docker Images

```bash
docker-compose build
```

**First time will take 5-10 minutes** as it downloads base images and installs dependencies.

**Expected output:**
```
[+] Building ...
[+] Building 15.2s
 => [backend] ...
 => [frontend] ...
 => [db] ...
Successfully built ...
```

### Step 8: Start All Services

```bash
docker-compose up -d
```

The `-d` flag runs containers in the background.

**Expected output:**
```
Creating network "attendance-dashboard_attendance_network" ... done
Creating volume "attendance-dashboard_mysql_data" ... done
Creating container "attendance-dashboard-mysql" ... done
Creating container "attendance-dashboard-backend" ... done
Creating container "attendance-dashboard-frontend" ... done
```

### Step 9: Verify Services are Running

```bash
docker-compose ps
```

**Expected output:**
```
NAME                            STATUS
attendance-dashboard-backend    Up (healthy)
attendance-dashboard-frontend   Up (healthy)
attendance-dashboard-mysql      Up (healthy)
```

### Step 10: Initialize Database

```bash
docker-compose exec backend python -m app.init_db
```

**Expected output:**
```
✓ Database initialized
✓ Admin user created
```

### Step 11: Configure Firewall (For Network Access)

**For UFW (Ubuntu/Debian):**
```bash
# Allow ports
sudo ufw allow 5173/tcp
sudo ufw allow 8081/tcp
sudo ufw allow 3310/tcp

# Enable firewall (if not already enabled)
sudo ufw enable

# Check status
sudo ufw status
```

**For firewalld (CentOS/RHEL):**
```bash
# Allow ports
sudo firewall-cmd --permanent --add-port=5173/tcp
sudo firewall-cmd --permanent --add-port=8081/tcp
sudo firewall-cmd --permanent --add-port=3310/tcp

# Reload firewall
sudo firewall-cmd --reload

# Check status
sudo firewall-cmd --list-ports
```

**For iptables:**
```bash
sudo iptables -A INPUT -p tcp --dport 5173 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8081 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3310 -j ACCEPT
sudo iptables-save
```

### Step 12: Access the Application

**Local Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8081
- API Documentation: http://localhost:8081/docs

**Network Access (from other computers):**
- Frontend: http://your-linux-ip:5173
- Backend API: http://your-linux-ip:8081
- API Documentation: http://your-linux-ip:8081/docs

**Find your Linux IP:**
```bash
# Method 1
ip addr show

# Method 2
hostname -I

# Method 3
ifconfig
```

### Linux Common Commands

```bash
# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend

# Stop all services
docker-compose stop

# Start all services
docker-compose start

# Restart all services
docker-compose restart

# Stop and remove containers
docker-compose down

# Stop and remove containers + data (⚠️ deletes database)
docker-compose down -v

# View container status
docker-compose ps

# View resource usage
docker stats

# Access backend container
docker-compose exec backend bash

# Access database
docker-compose exec db mysql -u root -p

# Backup database
docker-compose exec db mysqldump -u root -p attendance_db > backup.sql

# Restore database
docker-compose exec -T db mysql -u root -p attendance_db < backup.sql
```

### Linux Troubleshooting

**Issue: Permission denied (docker: permission denied)**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and log back in, or run:
newgrp docker
```

**Issue: Port already in use**
```bash
# Find what's using the port
sudo netstat -tulpn | grep :8081
# Or
sudo lsof -i :8081

# Kill the process (replace PID)
sudo kill -9 <PID>
```

**Issue: Docker service not running**
```bash
# Check status
sudo systemctl status docker

# Start Docker
sudo systemctl start docker

# Enable auto-start
sudo systemctl enable docker
```

**Issue: Out of disk space**
```bash
# Clean up unused images
docker image prune -a

# Clean up unused volumes
docker volume prune

# Full cleanup
docker system prune -a --volumes
```

---

## Dockerize Instructions (Complete Setup from Scratch)

## Detailed Setup Instructions

### 1. Environment Setup

Create a `.env` file in the project root (or copy from `env.docker.example`):

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

### 2. Build Docker Images

```bash
# Build all images (first time takes 5-10 minutes)
docker-compose build

# Rebuild specific service
docker-compose build backend
docker-compose build frontend
docker-compose build db
```

### 3. Start All Services

```bash
# Start in background (detached mode)
docker-compose up -d

# Start and view logs
docker-compose up

# View logs after starting
docker-compose logs -f
```

### 4. Verify Services

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs

# Test backend health
curl http://localhost:8081/health
```

### 5. Initialize Database

```bash
# Create database tables
docker-compose exec backend python -m app.init_db

# Create admin user (if needed)
docker-compose exec backend python -m app.create_admin
```

### 6. Access the Application

- **Frontend:** http://localhost:5173 (or http://your-server-ip:5173)
- **Backend API:** http://localhost:8081 (or http://your-server-ip:8081)
- **API Docs:** http://localhost:8081/docs
- **MySQL:** localhost:3310 (user: root, password: from .env)

## Server Deployment (Production)

### Firewall Configuration

If deploying on a server, open the required ports:

**Windows Firewall:**
```powershell
# Open ports 5173, 8081, 3310
New-NetFirewallRule -DisplayName "Attendance Dashboard Frontend" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Attendance Dashboard Backend" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Attendance Dashboard MySQL" -Direction Inbound -LocalPort 3310 -Protocol TCP -Action Allow
```

**Linux Firewall (UFW):**
```bash
sudo ufw allow 5173/tcp
sudo ufw allow 8081/tcp
sudo ufw allow 3310/tcp
sudo ufw reload
```

### Access from Network

After opening ports, access from other machines:
- Frontend: `http://server-ip:5173`
- Backend: `http://server-ip:8081`
- API Docs: `http://server-ip:8081/docs`

### Production Environment Variables

For production, update `.env` with:
```
DB_PASSWORD=strong_production_password
JWT_SECRET_KEY=very-long-random-secret-key-minimum-32-characters
```

Generate secure keys:
```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

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
- **Container:** `attendance-dashboard-backend`
- **Image:** `attendance-dashboard-backend:latest`
- **Port:** 8081
- **Health Check:** http://localhost:8081/health
- **Logs:** `docker-compose logs backend`

### Frontend (React/Vite)
- **Container:** `attendance-dashboard-frontend`
- **Image:** `attendance-dashboard-frontend:latest`
- **Port:** 5173 (mapped to nginx port 80)
- **Logs:** `docker-compose logs frontend`

### Database (MySQL 8.0)
- **Container:** `attendance-dashboard-mysql`
- **Image:** `attendance-dashboard-mysql:latest`
- **Port:** 3310 (host) → 3306 (container)
- **Data Persistence:** Docker volume `attendance-dashboard_mysql_data`
- **Logs:** `docker-compose logs db`

## Common Commands

### Basic Operations

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Restart services
docker-compose restart

# Restart a specific service
docker-compose restart backend

# View logs
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# Check status
docker-compose ps

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (⚠️ deletes database)
docker-compose down -v
```

### Database Operations

```bash
# Initialize database
docker-compose exec backend python -m app.init_db

# Access MySQL CLI
docker-compose exec db mysql -u root -p

# Backup database
docker-compose exec db mysqldump -u root -p attendance_db > backup.sql

# Restore database
docker-compose exec -T db mysql -u root -p attendance_db < backup.sql
```

### Maintenance

```bash
# Rebuild specific service
docker-compose build --no-cache backend
docker-compose up -d backend

# View container resource usage
docker stats

# Clean up unused images
docker image prune -a

# Clean up unused volumes
docker volume prune

# Full system cleanup (⚠️ removes everything not in use)
docker system prune -a --volumes
```

## Database Initialization

The database needs to be initialized manually on first setup:

```bash
# Initialize database tables
docker-compose exec backend python -m app.init_db

# Create admin user (optional)
docker-compose exec backend python -m app.create_admin

# Access MySQL container directly
docker-compose exec db mysql -u root -p
# Password is from .env file (DB_PASSWORD)
```

## Complete Setup Checklist (New Server)

When setting up on a new server PC:

- [ ] Install Docker and Docker Compose
- [ ] Download/clone the repository
- [ ] Navigate to project directory
- [ ] Copy `env.docker.example` to `.env`
- [ ] Update `.env` with secure passwords and keys
- [ ] Run `docker-compose build`
- [ ] Run `docker-compose up -d`
- [ ] Verify all containers are running: `docker-compose ps`
- [ ] Initialize database: `docker-compose exec backend python -m app.init_db`
- [ ] Open firewall ports (if needed for network access)
- [ ] Test access: http://localhost:5173
- [ ] Test API: http://localhost:8081/docs

## Troubleshooting

### Port Already in Use

If ports 3310, 8081, or 5173 are already in use:

1. Stop the conflicting service, or
2. Change ports in `.env`:
   ```
   DB_PORT=3307
   BACKEND_PORT=8082
   FRONTEND_PORT=5174
   ```
3. Restart: `docker-compose down && docker-compose up -d`

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
   # Or in browser: http://localhost:8081/health
   ```

2. Verify CORS settings in `backend/app/main.py`

3. Check frontend environment variable `VITE_API_BASE` in docker-compose.yml

4. Check if containers are on the same network:
   ```bash
   docker network inspect attendance-dashboard_attendance_network
   ```

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
# Remove containers and networks (keeps data)
docker-compose down

# Remove containers, networks, and volumes (⚠️ deletes database)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Complete cleanup (containers, volumes, images)
docker-compose down -v --rmi all

# Remove specific image
docker rmi attendance-dashboard-frontend:latest
docker rmi attendance-dashboard-backend:latest
docker rmi attendance-dashboard-mysql:latest
```

## Quick Reference Card

### First Time Setup
```bash
cp env.docker.example .env
# Edit .env with secure passwords
docker-compose build
docker-compose up -d
docker-compose exec backend python -m app.init_db
```

### Daily Operations
```bash
# Start
docker-compose up -d

# Stop
docker-compose stop

# View logs
docker-compose logs -f

# Restart
docker-compose restart
```

### Container Names
- Frontend: `attendance-dashboard-frontend`
- Backend: `attendance-dashboard-backend`
- Database: `attendance-dashboard-mysql`

### Image Names
- `attendance-dashboard-frontend:latest`
- `attendance-dashboard-backend:latest`
- `attendance-dashboard-mysql:latest`

