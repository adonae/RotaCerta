@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 goto erro
)

echo Aplicando o banco local...
call npx wrangler d1 migrations apply DB --local
if errorlevel 1 goto erro

echo.
echo ============================================
echo  RotaCerta - http://localhost:8787/painel
echo  Senha local inicial: rotacerta
echo  (definida em .dev.vars)
echo ============================================
echo.

call npx wrangler dev --port 8787
goto fim

:erro
echo.
echo Nao foi possivel iniciar. Verifique as mensagens acima.
pause

:fim
endlocal
