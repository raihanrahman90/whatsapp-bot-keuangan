@echo off
REM Copy this file to .docker-build.config.bat, then set your Docker Hub name.
REM That personal config file is ignored by Git and is not uploaded.

set "DOCKERHUB_USERNAME=YOUR_DOCKERHUB_USERNAME"

REM Standard Intel/AMD Linux VPS. Use linux/arm64 for an ARM VPS.
set "VPS_PLATFORM=linux/amd64"
