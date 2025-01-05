cmake_minimum_required(VERSION 3.10.0)
set(CMAKE_CXX_COMPILER g++)

project(SerialDriver)

set(PROJECT_INCLUDE "${CMAKE_CURRENT_LIST_DIR}/") # Define PROJECT_INCLUDE to be the path to the include directory of the project

include(${CMAKE_CURRENT_SOURCE_DIR}/RadioMessage/CMakeLists.txt)

add_executable(SerialDriver crossPlatformDemux.cpp)
add_executable(DriverShell demuxShell.cpp)
add_executable(DriverShellForReal demuxShellForReal.cpp)

target_link_libraries(DriverShell Message)
target_link_libraries(DriverShellForReal Message)

target_include_directories(SerialDriver PUBLIC "${PROJECT_INCLUDE}")
target_include_directories(DriverShell PUBLIC "${PROJECT_INCLUDE}")
target_include_directories(DriverShellForReal PUBLIC "${PROJECT_INCLUDE}")


if("${CMAKE_SYSTEM_NAME}" STREQUAL "MSYS")
    set(CMAKE_CXX_FLAGS "-fPIC -static -static-libgcc -static-libstdc++")

    target_sources(SerialDriver PUBLIC
        "${CMAKE_CURRENT_LIST_DIR}/crossPlatformDemux.cpp;${CMAKE_CURRENT_LIST_DIR}/WinSerialPort.cpp;${CMAKE_CURRENT_LIST_DIR}/WinNamedPipe.cpp")
    target_sources(DriverShell PUBLIC
        "${CMAKE_CURRENT_LIST_DIR}/demuxShell.cpp;${CMAKE_CURRENT_LIST_DIR}/WinSerialPort.cpp;${CMAKE_CURRENT_LIST_DIR}/WinNamedPipe.cpp")
    target_sources(DriverShellForReal PUBLIC
        "${CMAKE_CURRENT_LIST_DIR}/demuxShellForReal.cpp;${CMAKE_CURRENT_LIST_DIR}/WinSerialPort.cpp;${CMAKE_CURRENT_LIST_DIR}/WinNamedPipe.cpp")

    target_compile_definitions(SerialDriver PUBLIC WINDOWS=1)
    target_compile_definitions(DriverShell PUBLIC WINDOWS=1)
    target_compile_definitions(DriverShellForReal PUBLIC WINDOWS=1)
# if this is not an elseif msys makes cmake think it's building on both windows and linux
elseif(UNIX AND NOT APPLE)
    add_executable(SerialLinuxTest linuxSerialTest.cpp)
    add_executable(NamedPipeLinuxTest linuxPipeTest.cpp)


    target_sources(SerialDriver PUBLIC
        "${CMAKE_CURRENT_LIST_DIR}/crossPlatformDemux.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxNamedPipe.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxSerialPort.cpp")
    target_sources(SerialLinuxTest PUBLIC "${CMAKE_CURRENT_LIST_DIR}/linuxSerialTest.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxSerialPort.cpp")
    target_sources(NamedPipeLinuxTest PUBLIC "${CMAKE_CURRENT_LIST_DIR}/linuxPipeTest.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxNamedPipe.cpp")
    target_sources(DriverShell PUBLIC
        "${CMAKE_CURRENT_LIST_DIR}/demuxShell.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxNamedPipe.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxSerialPort.cpp")
    target_sources(DriverShellForReal PUBLIC
        "${CMAKE_CURRENT_LIST_DIR}/demuxShell.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxNamedPipe.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxSerialPort.cpp")

    target_include_directories(SerialLinuxTest PUBLIC "${PROJECT_INCLUDE}")
    target_include_directories(NamedPipeLinuxTest PUBLIC "${PROJECT_INCLUDE}")

    target_compile_definitions(SerialDriver PUBLIC LINUX=1)
    target_compile_definitions(DriverShell PUBLIC LINUX=1)
    target_compile_definitions(DriverShellForReal PUBLIC LINUX=1)
endif()