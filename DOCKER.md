# Docker – Attendance Dashboard

**Project root:** `D:\Cursor Projects\Attendance_Dashboard`  
Use this path for all Docker and project commands. **Do not use** `C:\xampp\htdocs\Attendance_Dashboard`.

## Quick start (Windows)

```powershell
cd "D:\Cursor Projects\Attendance_Dashboard"
copy env.docker.example .env
# Edit .env if needed (JWT_SECRET_KEY, passwords, ports)
docker-compose up -d --build
docker-compose exec backend python -m app.init_db
```

- **Frontend:** http://localhost:5173  
- **Backend API:** http://localhost:8081  
- **API docs:** http://localhost:8081/docs  

## Full guides

- **Windows:** [DOCKER_WINDOWS.md](DOCKER_WINDOWS.md)
- **Linux:** [DOCKER_LINUX.md](DOCKER_LINUX.md)
- **Step-by-step:** [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md)

## Rebuild when required

After code changes, rebuild the image(s) that changed. Database is not rebuilt unless you change `docker/mysql/` or `init.sql`.

**Rebuild backend only** (e.g. after changing Python/FastAPI code):

```powershell
docker-compose up -d --build backend
```

**Rebuild frontend only** (e.g. after changing React/Vite code):

```powershell
docker-compose up -d --build frontend
```

**Rebuild both frontend and backend** (no cache, for a clean build):

```powershell
docker-compose build --no-cache backend frontend
docker-compose up -d backend frontend
```

**Rebuild everything** (including DB image if you changed MySQL setup):

```powershell
docker-compose up -d --build
```

You can also use the scripts in `scripts/windows/`: `rebuild_backend.bat` and `rebuild_frontend.bat`.

---

## Development (hot reload)

```powershell
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```
