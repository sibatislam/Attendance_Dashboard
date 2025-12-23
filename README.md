Attendance Monitoring Dashboard
================================

Full-stack app to upload, store, view, and delete attendance files (CSV/XLSX) preserving exact headers and values.

Stack
-----
- Frontend: React (Vite), TailwindCSS, React Router, React Query
- Backend: FastAPI, SQLAlchemy, openpyxl (XLSX), xlrd (XLS), csv
- DB: MySQL (XAMPP)

Ports
-----
- Frontend: http://localhost:5173
- Backend: http://localhost:8081
- Apache: http://localhost:8080
- MySQL: localhost:3310

Project Structure
-----------------
- `backend/` FastAPI app
- `frontend/` Vite React app
- `Input Files/` sample Excel files (not used directly by code)

Database Setup (XAMPP MySQL)
----------------------------
1) Start MySQL in XAMPP
2) Create database:
   - Open phpMyAdmin (http://localhost:8080/phpmyadmin) or MySQL CLI and run:
     - `CREATE DATABASE attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
3) (Optional) Create a dedicated user and grant privileges, or use root during development.

Backend Setup
-------------
1) Create and activate a virtual environment (recommended)
2) Install requirements:
   - `pip install -r backend/requirements.txt`
3) Environment variables: create a `.env` file in `backend/` with:
   - `DB_USER=root`
   - `DB_PASSWORD=`
   - `DB_HOST=localhost`
   - `DB_PORT=3310`
   - `DB_NAME=attendance_db`
4) Run the API:
   - `uvicorn app.main:app --reload --port 8081 --app-dir backend`
5) API docs:
   - `http://localhost:8081/docs`

Frontend Setup
--------------
1) `cd frontend`
2) Install dependencies: `npm install`
3) Start dev server: `npm run dev`
4) Open: `http://localhost:5173`

Confirm Functionality
---------------------
✅ Upload 1+ files (CSV/XLSX) via Upload Files page
✅ View exact data in table (sticky header, horizontal scroll)
✅ Delete files (cascade) from Uploaded Batches
✅ Preserves header order and values as text

Implementation Notes
--------------------
- Parsers read all cells as strings to avoid datetime/time coercion
- Headers are stored as-is in `uploaded_file.header_order` (JSON)
- Rows are stored as JSON in `uploaded_row.data`
- Deleting an uploaded file cascades and removes linked rows
- CORS enabled for `http://localhost:5173`

Common Commands
---------------
- Backend: `uvicorn app.main:app --reload --port 8081 --app-dir backend`
- Frontend: `cd frontend && npm run dev`

Windows Shortcuts (.bat)
------------------------
- One-click start both (from project root):
  - `scripts\windows\start_all.bat`
- Backend setup (venv, deps, .env):
  - `scripts\windows\setup_backend.bat`
- Run backend only:
  - `scripts\windows\run_backend.bat`
- Run frontend only:
  - `scripts\windows\run_frontend.bat`

Docker Setup
------------
For containerized deployment, see `DOCKER.md` for detailed instructions.

Quick start:
1. Copy `env.docker.example` to `.env.docker` and configure
2. Run: `docker-compose up -d`
3. Access: http://localhost:5173 (frontend), http://localhost:8081 (backend)

For development with hot-reload:
- `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up`


