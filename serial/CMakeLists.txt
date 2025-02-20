cmake_minimum_required(VERSION 3.5.0)
set(CMAKE_CXX_COMPILER g++)

project(SerialInterface)

#add_executable(DemuxLinux crossPlatformDemux.cpp)
#add_executable(DemuxWindows crossPlatformDemux.cpp)
#add_executable(SerialLinuxTest linuxSerialTest.cpp)
add_executable(NamedPipeLinuxTest linuxPipeTest.cpp)
# test script
add_executable(DemuxShell demuxShell.cpp)

set(PROJECT_INCLUDE "${CMAKE_CURRENT_LIST_DIR}/") # Define PROJECT_INCLUDE to be the path to the include directory of the project

#target_sources(DemuxLinux PUBLIC
#        "${CMAKE_CURRENT_LIST_DIR}/crossPlatformDemux.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxNamedPipe.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxSerialPort.cpp")
#target_sources(DemuxWindows PUBLIC
#        "${CMAKE_CURRENT_LIST_DIR}/crossPlatformDemux.cpp;${CMAKE_CURRENT_LIST_DIR}/WinSerialPort.cpp;${CMAKE_CURRENT_LIST_DIR}/WinNamedPipe.cpp")
#target_sources(SerialLinuxTest PUBLIC "${CMAKE_CURRENT_LIST_DIR}/linuxSerialTest.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxSerialPort.cpp")
target_sources(NamedPipeLinuxTest PUBLIC "${CMAKE_CURRENT_LIST_DIR}/linuxPipeTest.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxNamedPipe.cpp")
#target_sources(DemuxShell PUBLIC
#        "${CMAKE_CURRENT_LIST_DIR}/demuxShell.cpp;${CMAKE_CURRENT_LIST_DIR}/WinSerialPort.cpp;${CMAKE_CURRENT_LIST_DIR}/WinNamedPipe.cpp")

target_sources(DemuxShell PUBLIC
        "${CMAKE_CURRENT_LIST_DIR}/demuxShell.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxSerialPort.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxNamedPipe.cpp")

#target_include_directories(DemuxWindows PUBLIC "${PROJECT_INCLUDE}")
#target_include_directories(DemuxLinux PUBLIC "${PROJECT_INCLUDE}")
#target_include_directories(SerialLinuxTest PUBLIC "${PROJECT_INCLUDE}")
target_include_directories(NamedPipeLinuxTest PUBLIC "${PROJECT_INCLUDE}")
target_include_directories(DemuxShell PUBLIC "${PROJECT_INCLUDE}")


if("${CMAKE_SYSTEM_NAME}" STREQUAL "MSYS")
#    set(CMAKE_CXX_FLAGS "-fPIC -static -static-libgcc -static-libstdc++")
#    target_compile_definitions(DemuxWindows PUBLIC WINDOWS=1)
#    target_compile_definitions(DemuxShell PUBLIC WINDOWS=1)
endif ()

if(UNIX AND NOT APPLE)
    message("test")
    #target_compile_definitions(DemuxLinux PUBLIC LINUX=1)
    target_compile_definitions(DemuxShell PUBLIC LINUX=1)
endif()