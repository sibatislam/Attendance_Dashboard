# Project Docker Configuration Table

## Project Name: Attendance Monitoring Dashboard

| Project Name | Container | Frontend | Web Server | Frontend Port | Frontend Access | Backend | Backend Port | Backend Access | Database | Database Port |
|--------------|-----------|----------|------------|--------------|----------------|---------|--------------|----------------|----------|---------------|
| Attendance Monitoring Dashboard | Docker | React | Nginx | 5173:80 | http://localhost:5173 | FastAPI (Python) | 8081:8081 | http://localhost:8081<br>http://localhost:8081/docs | MySQL | 3310:3306 |

---

## Docker Container Details

### Frontend Service
| Docker Container Name | Image | Port Mapping |
|----------------------|-------|--------------|
| attendance-dashboard-frontend | attendance-dashboard-frontend:latest | 5173:80 |

### Backend Service
| Docker Container Name | Image | Port Mapping |
|----------------------|-------|--------------|
| attendance-dashboard-backend | attendance-dashboard-backend:latest | 8081:8081 |

### Database Service
| Docker Container Name | Image | Port Mapping |
|----------------------|-------|--------------|
| attendance-dashboard-mysql | attendance-dashboard-mysql:latest | 3310:3306 |

