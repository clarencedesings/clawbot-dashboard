@echo off
echo === CLAWBOT Dashboard Deploy ===
echo.
echo Step 1: Pulling latest changes from GitHub...
cd /d C:\Users\clare\Documents\clawbot-dashboard
git pull
if errorlevel 1 (
    echo ERROR: git pull failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Installing backend dependencies...
cd /d C:\Users\clare\Documents\clawbot-dashboard\backend
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo WARNING: pip install had issues, continuing anyway...
)

echo.
echo Step 3: Building frontend...
cd /d C:\Users\clare\Documents\clawbot-dashboard\frontend
call npm install --silent
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)

echo.
echo Step 4: Restarting services...
C:\tools\nssm\nssm.exe restart ClawbotBackend
C:\tools\nssm\nssm.exe restart ClawbotFrontend

echo.
echo Step 5: Waiting for services to start...
timeout /t 3 /nobreak >nul

echo.
echo Step 6: Verifying...
curl -s http://localhost:8002/api/health
echo.
curl -s -o nul -w "Frontend HTTP status: %%{http_code}" http://localhost:5173
echo.

echo.
echo === Deploy complete! ===
pause
