@echo off
powershell.exe -NoProfile -File "%~dp0deploy-all.ps1" -Only prospector -ReuseWorkerImage > "%~dp0prospector-authfix.log" 2> "%~dp0prospector-authfix.err"
