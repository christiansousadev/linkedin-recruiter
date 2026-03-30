@echo off
title Pipeline de Recrutamento

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo erro: node.js nao encontrado. instale-o primeiro.
    pause
    exit /b
)

:: garante que o script rode na pasta onde o arquivo .bat esta salvo
cd /d "%~dp0"

:: CONFIGURA BACKEND
IF EXIST backend (
    cd backend
    if not exist node_modules (
        echo instalando dependencias do backend
        call npm install
        
        echo instalando binarios do playwright
        call npx playwright install chromium
    )
    cd ..
) else (
    echo erro: pasta backend nao encontrada.
    pause
    exit /b
)

:: CONFIGURA FRONTEND
IF EXIST frontend (
    cd frontend
    if not exist node_modules (
        echo instalando dependencias do frontend
        call npm install
    )
    cd ..
) else (
    echo erro: pasta frontend nao encontrada.
    pause
    exit /b
)

echo iniciando backend porta 3001
start cmd /k "cd /d "%~dp0backend" && node server.js"

echo iniciando frontend porta 3000
start cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: aguarda o boot dos servicos
timeout /t 5 /nobreak >nul
start chrome http://localhost:3000