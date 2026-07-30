@echo off
setlocal
cd /d "%~dp0"
title Primeira Faisca AI Helper

echo ==========================================
echo   PRIMEIRA FAISCA - HELPER LOCAL DE IA
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale o Node.js 20 ou superior e execute este arquivo novamente.
  pause
  exit /b 1
)

where ollama >nul 2>nul
if errorlevel 1 (
  echo AVISO: Ollama nao foi encontrado.
  echo A API key ainda pode funcionar pelo helper, mas downloads de modelos Ollama exigem o Ollama instalado.
) else (
  start "Ollama" /min ollama serve
  timeout /t 2 /nobreak >nul
)

echo Iniciando helper em http://127.0.0.1:8787
echo Mantenha esta janela aberta enquanto usar a IA.
echo.
node server.mjs

echo.
echo O helper foi encerrado.
pause
endlocal