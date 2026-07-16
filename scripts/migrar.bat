@echo off
echo === Aplicando migracion y creando admin ===
call node db\migrate.js
call node db\seed_admin.js
pause
