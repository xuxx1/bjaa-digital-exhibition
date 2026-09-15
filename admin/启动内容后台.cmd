@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "CMS_PYTHON=C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%CMS_PYTHON%" set "CMS_PYTHON=python"
echo 正在启动北京画院内容管理后台...
echo 浏览器地址：http://127.0.0.1:8787
"%CMS_PYTHON%" local_server.py
pause
