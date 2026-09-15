$adminRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (-not (Test-Path $python)) { $python = "python" }
Set-Location $adminRoot
& $python ".\local_server.py"
