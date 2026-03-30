@echo off
title Pipeline de Recrutamento

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo erro: node.js nao encontrado. instale-o primeiro.
    pause
    exit /b
)

cd backend
if not exist node_modules (
    echo instalando dependencias do backend
    call npm install
    
    echo instalando binarios do playwright
    call npx playwright install chromium
)
cd ..

cd frontend
if not exist node_modules (
    echo instalando dependencias do frontend
    call npm install
)
cd ..

echo iniciando backend porta 3001
start cmd /k "cd backend && node server.js"

echo iniciando frontend porta 3000
start cmd /k "cd frontend && npm run dev"

timeout /t 5 /nobreak >nul
start chrome http://localhost:3000