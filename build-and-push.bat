@echo off
setlocal EnableExtensions DisableDelayedExpansion

REM Build and publish the bot and web UI images for a Linux VPS.
REM Usage: build-and-push.bat [dockerhub-user] [whatsapp-phone]

cd /d "%~dp0"

REM Optional personal settings. Copy .docker-build.config.example.bat to
REM .docker-build.config.bat and set the Docker Hub username there to avoid
REM being prompted each time. The personal config file is gitignored.
if exist ".docker-build.config.bat" call ".docker-build.config.bat"

echo.
echo === Finance WhatsApp Bot: Docker build and push ===
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo ERROR: Docker Desktop is not installed or is not available in PATH.
  goto :fail
)

docker info >nul 2>nul
if errorlevel 1 (
  echo ERROR: Docker is not running. Start Docker Desktop and try again.
  goto :fail
)

docker buildx version >nul 2>nul
if errorlevel 1 (
  echo ERROR: Docker Buildx is unavailable. Update Docker Desktop and try again.
  goto :fail
)

if not "%~1"=="" set "DOCKERHUB_USERNAME=%~1"
if /I "%DOCKERHUB_USERNAME%"=="YOUR_DOCKERHUB_USERNAME" set "DOCKERHUB_USERNAME="
if not defined DOCKERHUB_USERNAME set /p "DOCKERHUB_USERNAME=Docker Hub username: "
if not defined DOCKERHUB_USERNAME (
  echo ERROR: A Docker Hub username is required.
  goto :fail
)

REM Prefer the public WhatsApp number already configured in .env.
set "WHATSAPP_PHONE="
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if "%%A"=="NEXT_PUBLIC_WHATSAPP_BOT_PHONE" set "WHATSAPP_PHONE=%%B"
  )
)
if not "%~2"=="" set "WHATSAPP_PHONE=%~2"

if defined WHATSAPP_PHONE (
  echo Using WhatsApp phone from .env or command line: %WHATSAPP_PHONE%
) else (
  set /p "WHATSAPP_PHONE=WhatsApp phone (digits only, e.g. 628123456789): "
)
if not defined WHATSAPP_PHONE (
  echo ERROR: A WhatsApp phone number is required for the web image.
  goto :fail
)

if not defined VPS_PLATFORM set "VPS_PLATFORM=linux/amd64"
set "PLATFORM=%VPS_PLATFORM%"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "IMAGE_TAG=%%I"

echo.
echo Images to publish:
echo   %DOCKERHUB_USERNAME%/finance-whatsapp-bot:%IMAGE_TAG%
echo   %DOCKERHUB_USERNAME%/finance-web:%IMAGE_TAG%
echo.

echo.
echo Building and pushing the bot image...
docker buildx build --platform %PLATFORM% -t %DOCKERHUB_USERNAME%/finance-whatsapp-bot:%IMAGE_TAG% -t %DOCKERHUB_USERNAME%/finance-whatsapp-bot:latest --push .\bot
if errorlevel 1 goto :fail

echo.
echo Building and pushing the web image...
docker buildx build --platform %PLATFORM% --build-arg BACKEND_URL=http://whatsapp-bot:3001 --build-arg NEXT_PUBLIC_WHATSAPP_BOT_PHONE=%WHATSAPP_PHONE% -t %DOCKERHUB_USERNAME%/finance-web:%IMAGE_TAG% -t %DOCKERHUB_USERNAME%/finance-web:latest --push .\web
if errorlevel 1 goto :fail

echo.
echo SUCCESS: Both images were pushed.
echo.
echo On the VPS, set this in .env and deploy:
echo   DOCKERHUB_USERNAME=%DOCKERHUB_USERNAME%
echo   IMAGE_TAG=%IMAGE_TAG%
echo.
echo   docker compose -f docker-compose.prod.yml pull
echo   docker compose -f docker-compose.prod.yml up -d --no-build
goto :end

:fail
echo.
echo Build/push did not complete. Read the error above, fix it, then run this file again.

:end
echo.
pause
endlocal
