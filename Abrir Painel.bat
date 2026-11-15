@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0atualizar_dados.ps1"
start "" "%~dp0index.html"
