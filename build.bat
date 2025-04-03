@echo off

rem Mingw package dependencies: pacman -S gcc nasm mingw-w64-x86_64-python3 mingw-w64-x86_64-meson diffutils make cmake

if "%~1"=="" goto no_args

set MINGW_PATH=%1

set BUILD_ARGS=
SHIFT
:loop
if "%~1"=="" goto loop_done
set BUILD_ARGS=%1 %BUILD_ARGS%
SHIFT
GOTO loop

:loop_done

"%MINGW_PATH%\msys2_shell.cmd" -defterm -no-start -full-path -mingw64 -here -c "./build.sh %BUILD_ARGS%"

:no_args

echo Error: Path to MinGW must be passed as the first argument