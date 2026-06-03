@echo off
echo ==========================================
echo Starting EduPilot Application...
echo ==========================================

echo [1/3] Verifying and setting up Database...
call backend\venv\Scripts\python -m backend.init_db
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Database initialization failed. Please check if MySQL is running and your .env credentials are correct.
    pause
    exit /b %ERRORLEVEL%
)

echo [2/3] Starting backend server in a new window...
start "EduPilot Backend (FastAPI)" cmd /k "backend\venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

echo [3/3] Starting frontend server...
cd frontend
npm run dev
