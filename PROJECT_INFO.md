# Attendance Monitoring Dashboard - Project Information

## Project Overview

**Project Name:** Attendance Monitoring Dashboard  
**Version:** 1.0.0  
**Type:** Full-Stack Web Application  
**Status:** Production Ready  

---

## Technology Stack

### Frontend
- **Framework:** React 18.3.1
- **Build Tool:** Vite 5.4.10
- **Styling:** TailwindCSS 3.4.14
- **State Management:** TanStack React Query 5.56.2
- **Routing:** React Router DOM 6.28.0
- **Charts:** Recharts 2.12.7
- **HTTP Client:** Axios 1.7.7
- **PDF Export:** jsPDF 2.5.1, html2canvas 1.4.1

### Backend
- **Framework:** FastAPI 0.115.2
- **Server:** Uvicorn 0.30.6
- **ORM:** SQLAlchemy 2.0.36
- **Database:** MySQL 8.0
- **Authentication:** JWT (python-jose 3.3.0)
- **Password Hashing:** bcrypt 4.1.2
- **File Processing:** openpyxl 3.1.5, xlrd 1.2.0

### Infrastructure
- **Containerization:** Docker & Docker Compose
- **Web Server:** Nginx (for production frontend)
- **Database:** MySQL 8.0 (Docker)

---

## Project Structure

```
Attendance_Dashboard_React/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── routers/        # API route modules (17 files)
│   │   ├── services/        # Business logic (9 files)
│   │   ├── models.py        # Database models
│   │   ├── models_kpi.py    # KPI pre-calculation models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── auth.py          # Authentication utilities
│   │   └── main.py          # FastAPI app entry point
│   ├── Dockerfile           # Backend container definition
│   └── requirements.txt     # Python dependencies
│
├── frontend/                # React application
│   ├── src/
│   │   ├── components/     # Reusable components (17 files)
│   │   ├── pages/           # Page components (23 files)
│   │   ├── lib/             # API client & utilities
│   │   └── contexts/        # React contexts
│   ├── Dockerfile           # Frontend container definition
│   ├── nginx.conf           # Nginx configuration
│   └── package.json        # Node.js dependencies
│
├── docker-compose.yml       # Docker orchestration
├── docker-compose.dev.yml   # Development overrides
└── .env                     # Environment variables
```

---

## Features

### Core Modules

1. **Attendance Dashboard**
   - File upload (CSV/XLSX)
   - Data viewing with sticky headers
   - Batch management
   - KPI calculations (On-Time %, Work Hours, Leave Analysis)

2. **MS Teams Analytics**
   - Teams user activity tracking
   - Teams app usage statistics
   - Function/Company-based analytics
   - CXO-specific views

3. **Employee Management**
   - Employee list upload
   - Employee data management
   - Cross-reference with Teams data

4. **User Management & Authentication**
   - JWT-based authentication
   - Role-based access control (Admin/User)
   - Permission system (module & feature level)
   - User CRUD operations

---

## Port Configuration

| Service | Port | URL |
|---------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend API | 8081 | http://localhost:8081 |
| MySQL Database | 3310 | localhost:3310 |
| API Documentation | 8081 | http://localhost:8081/docs |

---

## Database Configuration

- **Database Name:** attendance_db
- **Username:** root
- **Password:** rootpassword (change in production)
- **Host:** db (Docker) / localhost (external)
- **Port:** 3310
- **Character Set:** utf8mb4
- **Collation:** utf8mb4_unicode_ci

---

## Environment Variables

### Database
```
DB_USER=root
DB_PASSWORD=rootpassword
DB_HOST=db
DB_PORT=3310
DB_NAME=attendance_db
```

### Backend
```
BACKEND_PORT=8081
JWT_SECRET_KEY=your-secret-key-change-in-production
```

### Frontend
```
FRONTEND_PORT=5173
VITE_API_BASE=http://localhost:8081
```

---

## Installation & Setup

### Docker Setup (Recommended)
```bash
# 1. Build images
docker-compose build

# 2. Start services
docker-compose up -d

# 3. Initialize database
docker-compose exec backend python -m app.init_db

# 4. Access application
# Frontend: http://localhost:5173
# Backend: http://localhost:8081/docs
```

### Manual Setup
```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8081

# Frontend
cd frontend
npm install
npm run dev
```

---

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /auth/me` - Get current user

### Attendance
- `POST /upload` - Upload attendance files
- `GET /files/` - List uploaded files
- `GET /files/{id}` - Get file details
- `DELETE /files/` - Delete files

### KPIs
- `GET /kpi/simple/{group_by}` - Get On-Time KPI
- `GET /work_hour/completion/{group_by}` - Work hour completion
- `GET /work_hour/lost/{group_by}` - Work hour lost
- `GET /work_hour/leave/{group_by}` - Leave analysis

### Teams Analytics
- `POST /teams/upload` - Upload Teams data
- `GET /teams/analytics/user-activity` - User activity
- `GET /teams/analytics/function-activity` - Function activity

---

## Security Features

- JWT authentication with 24-hour token expiration
- Password hashing with bcrypt (10 rounds)
- Role-based access control (Admin/User)
- Permission-based feature access
- SQL injection protection via SQLAlchemy ORM
- CORS configuration

---

## Development Tools

### Windows Scripts
- `scripts\windows\setup_backend.bat` - Backend setup
- `scripts\windows\run_backend.bat` - Start backend
- `scripts\windows\run_frontend.bat` - Start frontend
- `scripts\windows\start_all.bat` - Start both services

### Docker Commands
```bash
# View logs
docker-compose logs -f

# Restart service
docker-compose restart backend

# Execute command in container
docker-compose exec backend python -m app.init_db

# Stop all services
docker-compose down
```

---

## Dependencies

### Backend (15 packages)
- fastapi, uvicorn, pydantic
- SQLAlchemy, pymysql
- python-jose, passlib, bcrypt
- openpyxl, xlrd
- python-dotenv, python-multipart

### Frontend (9 production, 5 dev)
- react, react-dom, react-router-dom
- @tanstack/react-query
- axios, recharts
- tailwindcss, vite

---

## Project Statistics

- **Backend Routes:** 17 router modules
- **Backend Services:** 9 service modules
- **Frontend Components:** 17 components
- **Frontend Pages:** 23 pages
- **Database Models:** 15+ models
- **KPI Models:** 4 pre-calculated KPI tables

---

## Deployment

### Production Considerations
- Change default passwords
- Use strong JWT_SECRET_KEY
- Restrict CORS origins
- Enable HTTPS
- Configure proper resource limits
- Set up database backups
- Configure logging aggregation

---

## Support & Documentation

- **Main README:** README.md
- **Docker Guide:** DOCKER.md
- **Docker Setup Guide:** DOCKER_SETUP_GUIDE.md
- **API Documentation:** http://localhost:8081/docs (Swagger UI)

---

## License

[Specify your license here]

---

## Contact Information

[Add contact details if needed]

---

**Last Updated:** December 2024  
**Project Status:** Active Development

