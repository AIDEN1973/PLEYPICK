# BrickBox 모든 서비스 자동 시작 PowerShell 스크립트

Write-Host "🚀 BrickBox 모든 서비스 자동 시작" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

# 포트 설정
Write-Host "📋 포트 설정 중..." -ForegroundColor Yellow
npm run port-setup

# 기존 프로세스 정리
Write-Host "🔄 기존 프로세스 정리 중..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 서비스 정보 표시
Write-Host ""
Write-Host "🚀 모든 서비스 시작 중..." -ForegroundColor Green
Write-Host "- Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "- Training API: http://localhost:3010" -ForegroundColor Cyan
Write-Host "- Synthetic API: http://localhost:3011" -ForegroundColor Cyan
Write-Host "- Worker: http://localhost:3020" -ForegroundColor Cyan
Write-Host "- Manual Upload: http://localhost:3030" -ForegroundColor Cyan
Write-Host "- Monitoring: http://localhost:3040" -ForegroundColor Cyan
Write-Host ""

# 자동 시작 실행 (자동 포트 정리 포함)
Write-Host "🚀 dev:full 실행 중 (자동 포트 정리 포함)..." -ForegroundColor Green
npm run dev:full

Write-Host "✅ 서비스 시작 완료" -ForegroundColor Green
Read-Host "Press Enter to continue"
