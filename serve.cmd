@echo off
REM Serve the Pool Seeder on THIS MACHINE ONLY.
REM Binds to 127.0.0.1 deliberately: this page signs transactions that move real funds,
REM and serving it over plain HTTP to the LAN would let anyone on the network alter the
REM page in transit. For another device use an SSH tunnel or real HTTPS.
cd /d "%~dp0"
echo.
echo   http://localhost:8901/
echo.
echo   Local only. Press Ctrl+C to stop.
echo.
python -m http.server 8901 --bind 127.0.0.1
