@echo off
rem simple wrapper to install dependencies and start tracker service on Windows
cd tracker
call npm install
npm run start
