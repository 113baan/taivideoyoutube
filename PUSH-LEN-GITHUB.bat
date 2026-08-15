@echo off
chcp 65001 >nul
title Day VidGrab len GitHub
cd /d "%~dp0"

echo ============================================================
echo   DAY DU AN VIDGRAB LEN GITHUB
echo ============================================================
echo.
echo   Kho luu tru: https://github.com/113baan/taivideoyoutube
echo.
echo   Mot cua so trinh duyet se mo ra de ban dang nhap GitHub.
echo   Hay bam dong y de cap quyen cho Git tren may nay.
echo.
echo   LUU Y: khong go mat khau vao cua so den nay.
echo          Chi dang nhap trong trinh duyet.
echo.
echo ============================================================
echo.
pause

echo.
echo Dang day len...
echo.
git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ============================================================
    echo   THANH CONG
    echo ============================================================
    echo.
    echo   Mo xem tai: https://github.com/113baan/taivideoyoutube
) else (
    echo ============================================================
    echo   CHUA DAY LEN DUOC - ma loi: %ERRORLEVEL%
    echo ============================================================
    echo.
    echo   Hay chup lai toan bo cua so nay va gui lai de duoc ho tro.
)
echo.
pause
