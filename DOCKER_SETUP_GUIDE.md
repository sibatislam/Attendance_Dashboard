# Docker Setup Guide - Step by Step

This guide will walk you through setting up and running the Attendance Dashboard using Docker on Windows.

## Prerequisites Check

✅ **Docker Desktop is installed** (you mentioned you have it)
- Open Docker Desktop and make sure it's running
- You should see the Docker icon in your system tray

## Step 1: Verify Docker is Running

1. Open **Command Prompt** or **PowerShell**
2. Run this command to verify Docker is working:
   ```bash
   docker --version
   docker-compose --version
   ```
   You should see version numbers for both commands.

3. If Docker Desktop is not running, start it from the Start menu.

## Step 2: Navigate to Project Directory

Open Command Prompt or PowerShell and navigate to your project:

```bash
cd C:\xampp\htdocs\Attendance_Dashboard_React
```

## Step 3: Create Environment File

1. Copy the example environment file:
   ```bash
   copy env.docker.example .env.docker
   ```

2. Open `.env.docker` in a text editor (Notepad, VS Code, etc.)

3. Review and adjust these values if needed:
   ```
   DB_USER=root
   DB_PASSWORD=rootpassword
   DB_HOST=db
   DB_PORT=3306
   DB_NAME=attendance_db
   
   BACKEND_PORT=8081
   JWT_SECRET_KEY=your-secret-key-change-in-production-use-strong-random-key
   
   FRONTEND_PORT=5173
   ```

   **Important:** 
   - Change `JWT_SECRET_KEY` to a random string (e.g., use a password generator)
   - If ports 3306, 8081, or 5173 are already in use, change them here

4. Save the file

## Step 4: Build Docker Images

Build all the Docker images (this may take 5-10 minutes the first time):

```bash
docker-compose build
```

**What this does:**
- Downloads base images (Python, Node.js, MySQL, Nginx)
- Installs all backend dependencies
- Installs all frontend dependencies
- Builds the frontend React app

**Expected output:** You'll see lots of build output. Wait until you see "Successfully built" messages.

## Step 5: Start All Services

Start all containers in the background:

```bash
docker-compose up -d
```

**What this does:**
- Starts MySQL database
- Starts FastAPI backend
- Starts React frontend (served by Nginx)
- Creates Docker network for communication

**Expected output:**
```
Creating network "attendance_dashboard_react_attendance_network" ... done
Creating volume "attendance_dashboard_react_mysql_data" ... done
Creating volume "attendance_dashboard_react_backend_data" ... done
Creating attendance_db ... done
Creating attendance_backend ... done
Creating attendance_frontend ... done
```

## Step 6: Check Container Status

Verify all containers are running:

```bash
docker-compose ps
```

**Expected output:** All services should show "Up" status:
```
NAME                  STATUS
attendance_backend    Up (healthy)
attendance_db         Up (healthy)
attendance_frontend   Up (healthy)
```

If any service shows "Restarting" or "Exited", check the logs (see Step 8).

## Step 7: View Logs (Optional but Recommended)

Check if everything started correctly:

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db

# Follow logs in real-time (press Ctrl+C to exit)
docker-compose logs -f
```

**What to look for:**
- Backend: Should show "Application startup complete"
- Frontend: Should show nginx started
- Database: Should show "ready for connections"

## Step 8: Access the Application

Open your web browser and visit:

- **Frontend (Main App):** http://localhost:5173
- **Backend API:** http://localhost:8081
- **API Documentation:** http://localhost:8081/docs
- **Health Check:** http://localhost:8081/health

## Step 9: Initialize Database (First Time Only)

The database tables need to be created. Run this command:

```bash
docker-compose exec backend python -m app.init_db
```

**Expected output:** Should show database initialization messages.

## Step 10: Create Admin User (First Time Only)

Create the default admin user:

```bash
docker-compose exec backend python -m app.create_admin
```

Or use the existing script if available.

## Step 11: Verify Everything Works

1. **Check Frontend:**
   - Open http://localhost:5173
   - You should see the login page or module selection

2. **Check Backend API:**
   - Open http://localhost:8081/docs
   - You should see the FastAPI Swagger documentation

3. **Check Database:**
   ```bash
   docker-compose exec db mysql -u root -prootpassword -e "SHOW DATABASES;"
   ```
   Should show `attendance_db` in the list

## Common Commands Reference

### Stop All Services
```bash
docker-compose stop
```

### Start All Services (after stopping)
```bash
docker-compose start
```

### Restart a Specific Service
```bash
docker-compose restart backend
docker-compose restart frontend
docker-compose restart db
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

### Stop and Remove Everything
```bash
# Stop and remove containers
docker-compose down

# Stop, remove containers AND delete data volumes (⚠️ deletes database!)
docker-compose down -v
```

### Rebuild After Code Changes
```bash
# Rebuild and restart
docker-compose up -d --build

# Rebuild specific service
docker-compose build backend
docker-compose up -d backend
```

### Access Container Shell
```bash
# Backend container
docker-compose exec backend bash

# Database container
docker-compose exec db bash

# Frontend container
docker-compose exec frontend sh
```

### Execute Commands in Containers
```bash
# Run Python script in backend
docker-compose exec backend python -m app.init_db

# Access MySQL
docker-compose exec db mysql -u root -prootpassword attendance_db

# Check Python version
docker-compose exec backend python --version
```

## Troubleshooting

### Issue: Port Already in Use

**Error:** `Bind for 0.0.0.0:8081 failed: port is already allocated`

**Solution:**
1. Check what's using the port:
   ```bash
   netstat -ano | findstr :8081
   ```
2. Either stop the conflicting service, or change the port in `.env.docker`:
   ```
   BACKEND_PORT=8082
   ```
3. Restart: `docker-compose down && docker-compose up -d`

### Issue: Container Keeps Restarting

**Check logs:**
```bash
docker-compose logs backend
```

**Common causes:**
- Database connection failed (check DB credentials in `.env.docker`)
- Port conflict
- Missing environment variables

### Issue: Frontend Can't Connect to Backend

1. Check backend is running:
   ```bash
   curl http://localhost:8081/health
   ```

2. Check backend logs:
   ```bash
   docker-compose logs backend
   ```

3. Verify CORS settings in `backend/app/main.py`

### Issue: Database Connection Error

1. Check database is healthy:
   ```bash
   docker-compose ps db
   ```

2. Check database logs:
   ```bash
   docker-compose logs db
   ```

3. Verify environment variables:
   ```bash
   docker-compose exec backend env | grep DB_
   ```

### Issue: Out of Disk Space

Docker images can take up space. Clean up:

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Full cleanup (⚠️ removes everything not in use)
docker system prune -a --volumes
```

### Issue: Permission Denied (Windows)

If you get permission errors:
1. Make sure Docker Desktop is running as Administrator
2. Right-click Docker Desktop → Run as Administrator
3. Or run Command Prompt as Administrator

## Development Mode (Hot Reload)

For development with automatic code reloading:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

This enables:
- Backend hot-reload (code changes auto-restart)
- Frontend hot-reload (Vite dev server)

## Stopping Everything

When you're done:

```bash
# Stop all services (keeps data)
docker-compose stop

# Stop and remove containers (keeps data)
docker-compose down

# Stop, remove containers AND delete all data (⚠️)
docker-compose down -v
```

## Next Steps

Once everything is running:

1. **Login:** Use the admin credentials you created
2. **Upload Files:** Test file upload functionality
3. **Check Dashboard:** Verify KPIs are calculating correctly
4. **Review Logs:** Monitor for any errors

## Getting Help

If you encounter issues:

1. Check logs: `docker-compose logs`
2. Check container status: `docker-compose ps`
3. Verify environment variables in `.env.docker`
4. Check Docker Desktop is running
5. Review the main `DOCKER.md` file for more details

---

**Congratulations!** Your Attendance Dashboard should now be running in Docker! 🎉

