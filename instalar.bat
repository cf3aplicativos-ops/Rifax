@echo off
echo === RIFAX API - Instalacion ===
call npm install
if not exist ".env" copy ".env.example" ".env"
echo.
echo Instalacion completa. Edita el archivo .env con tu DATABASE_URL de Neon.
echo Luego ejecuta: migrar.bat  y despues  iniciar.bat
pause
