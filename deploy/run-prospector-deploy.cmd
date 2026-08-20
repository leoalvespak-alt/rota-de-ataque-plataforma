@echo off
powershell.exe -NoProfile -File "%~dp0deploy-all.ps1" -Only prospector > "%~dp0prospector-deploy.log" 2> "%~dp0prospector-deploy.err"
