@echo off
setlocal
cd /d C:\Users\user\Desktop\tcg-express
echo === TCG Express: move partner-routes work to a branch ===
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set BASE=%%b
echo Current branch: %BASE%
echo.
git checkout -b feature/partner-routes || goto :fail
git add "sql/2026-09-20-partner-routes.sql" "lib/partner-webhook.js" "app/api/external/routes/route.js" "app/api/jobs/[id]/status/route.js" || goto :fail
git commit -m "Partner routes: TCG Fresh morning delivery routes, zone dedicated drivers, fixed fare, partner webhook" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01Agh7gwxUo3Pwf8QCEJxCdx" || goto :fail
git checkout %BASE% || goto :fail
echo.
echo === Done. Branch feature/partner-routes holds the 4 files; %BASE% is untouched. ===
echo Verify below: status/route.js should NOT appear as modified, and the 3 new files should be gone.
git status --short
git log --oneline -1 feature/partner-routes
echo.
echo Branch is local only (not pushed). Push later with:
echo   git push -u origin feature/partner-routes
pause
exit /b 0
:fail
echo.
echo *** Something failed. Nothing else was changed. Send me the text above. ***
pause
exit /b 1
