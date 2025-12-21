from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
# Import KPI models to ensure tables are created
from .models_kpi import OnTimeKPI, WorkHourKPI, WorkHourLostKPI, LeaveAnalysisKPI
from .routers.upload import router as upload_router
from .routers.files import router as files_router
from .routers.kpi import router as kpi_router
from .routers.work_hour import router as work_hour_router
from .routers.dashboard import router as dashboard_router
from .routers.kpi_rebuild import router as kpi_rebuild_router
from .routers.teams_upload import router as teams_upload_router
from .routers.teams_files import router as teams_files_router
from .routers.teams_analytics import router as teams_analytics_router
from .routers.teams_app_upload import router as teams_app_upload_router
from .routers.teams_app_files import router as teams_app_files_router
from .routers.teams_app_analytics import router as teams_app_analytics_router
from .routers.employee_upload import router as employee_upload_router
from .routers.employee_files import router as employee_files_router
from .routers.cxo import router as cxo_router

# Import auth routers with error handling
try:
    from .routers.auth import router as auth_router
    print("✓ Auth router imported successfully")
except Exception as e:
    print(f"✗ Failed to import auth router: {e}")
    auth_router = None

try:
    from .routers.users import router as users_router
    print("✓ Users router imported successfully")
except Exception as e:
    print(f"✗ Failed to import users router: {e}")
    users_router = None


def create_app() -> FastAPI:
    app = FastAPI(title="Attendance Monitoring Dashboard API", version="1.0.0")

    # CORS for local frontend
    origins = ["*"]  # dev: allow all; tighten in prod
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    # Routers
    if auth_router:
        app.include_router(auth_router, prefix="/auth", tags=["auth"])
        print("✓ Auth routes registered at /auth")
    if users_router:
        app.include_router(users_router, prefix="/users", tags=["users"])
        print("✓ Users routes registered at /users")
    
        # Attendance module routers
        app.include_router(upload_router, prefix="/upload", tags=["upload"])
        app.include_router(files_router, prefix="/files", tags=["files"])
        app.include_router(kpi_router, prefix="/kpi", tags=["kpi"])
        app.include_router(work_hour_router, prefix="/work_hour", tags=["work_hour"])
        app.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
        app.include_router(kpi_rebuild_router, prefix="/kpi", tags=["kpi"])
    
        # MS Teams module routers
        app.include_router(teams_upload_router, prefix="/teams/upload", tags=["teams"])
        app.include_router(teams_files_router, prefix="/teams/files", tags=["teams"])
        app.include_router(teams_analytics_router, prefix="/teams/analytics", tags=["teams"])
        app.include_router(teams_app_upload_router, prefix="/teams/app/upload", tags=["teams-app"])
        app.include_router(teams_app_files_router, prefix="/teams/app/files", tags=["teams-app"])
        app.include_router(teams_app_analytics_router, prefix="/teams/app/analytics", tags=["teams-app"])
        
        # Employee List module routers
        app.include_router(employee_upload_router, prefix="/employee/upload", tags=["employee"])
        app.include_router(employee_files_router, prefix="/employee/files", tags=["employee"])
        
        # CXO Management router
        app.include_router(cxo_router, prefix="/cxo", tags=["cxo"])

    @app.get("/health")
    def health():
        return {"status": "ok"}
    
    @app.get("/debug/routes")
    def debug_routes():
        """List all registered routes for debugging."""
        routes = []
        for route in app.routes:
            if hasattr(route, 'path') and hasattr(route, 'methods'):
                routes.append({
                    "path": route.path,
                    "methods": list(route.methods),
                    "name": route.name
                })
        return {"routes": routes, "auth_loaded": auth_router is not None, "users_loaded": users_router is not None}

    return app


app = create_app()

# Initialize default admin user after app creation
from .init_db import init_db
try:
    init_db()
except Exception as e:
    print(f"Warning: Failed to initialize admin user: {e}")

