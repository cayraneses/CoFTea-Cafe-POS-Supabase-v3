@echo off
cd /d "%~dp0"
echo ========================================
echo      CoF/Tea Cafe POS - Windows Build
echo ========================================
echo.
echo Installing dependencies...
call npm install
if errorlevel 1 goto ERROR

echo.
echo Building Windows installer...
call npm run build:win
if errorlevel 1 goto ERROR

echo.
echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo.
echo Your installer is inside the dist folder.
echo Look for a file ending in .exe
pause
exit /b 0
:ERROR
echo.
echo BUILD FAILED. Please take a screenshot of this window.
pause
exit /b 1
