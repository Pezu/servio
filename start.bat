@echo off
setlocal

:: Configuration
set REPO_URL=https://github.com/Pezu/servio.git
set REPO_DIR=servio
set COMPOSE_FILE=api\src\main\resources\docker-compose-all.yaml

:: Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed or not in PATH
    pause
    exit /b 1
)

:: Check if docker is installed
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH
    pause
    exit /b 1
)

:: Clone or pull the repository
if exist "%REPO_DIR%" (
    echo Repository exists, pulling latest changes...
    cd %REPO_DIR%
    git pull
) else (
    echo Cloning repository...
    git clone %REPO_URL% %REPO_DIR%
    cd %REPO_DIR%
)

:: Check if clone/pull was successful
if %errorlevel% neq 0 (
    echo ERROR: Git operation failed
    pause
    exit /b 1
)

:: Run docker-compose with rebuild
echo.
echo Starting Docker containers with rebuild...
echo.
docker compose -f %COMPOSE_FILE% up --build -d

if %errorlevel% neq 0 (
    echo ERROR: Docker compose failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Application started successfully!
echo ========================================
echo.
echo Frontend:    http://localhost
echo API:         http://localhost:8080
echo MinIO:       http://localhost:9001
echo Kibana:      http://localhost:5601
echo.
echo To view logs: docker compose -f %COMPOSE_FILE% logs -f
echo To stop:      docker compose -f %COMPOSE_FILE% down
echo.
pause