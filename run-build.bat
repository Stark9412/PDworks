@echo off
setlocal
set "ROOT=%~dp0"
set "NODE_TOOLS=C:\Users\kenaz1\Desktop\CODEX\tools\node"
set "PATH=%NODE_TOOLS%;%PATH%"
cd /d "%ROOT%"
if not exist node_modules (
  call "%NODE_TOOLS%\npm.cmd" install
)
call "%NODE_TOOLS%\npm.cmd" run build
