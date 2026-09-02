@echo off
rem 1. Importers/Callers: User desktop launcher / Windows Explorer
rem 2. Affected API: Batch execution of node server.js
rem 3. Data Schemas: Windows CMD commands
rem 4. User's Verbatim Instruction: "tôi dùng api của omniroute và bạn không được để nó ở fontend và api omniroute của tôi http://localhost:20128/v1 sk-f3574d44ab943de1-3dc839-53b3b863"

title Francais DELF Studio v2.0
echo ======================================================
echo   Francais DELF Studio v2.0
echo   Khoi dong Backend Proxy & Ung dung luyen tieng Phap
echo ======================================================
echo.
start "" "http://localhost:3000"
node server.js
pause
