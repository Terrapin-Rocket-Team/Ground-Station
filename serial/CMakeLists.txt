cmake_minimum_required(VERSION 3.5.0)
set(CMAKE_CXX_COMPILER g++)

project(SerialInterface)

add_executable(Demux demux.cpp
        crossPlatformDemux.cpp)
add_executable(SerialLinuxTest linuxSerialTest.cpp)
add_executable(NamedPipeLinuxTest linuxPipeTest.cpp)

file(GLOB_RECURSE PROJECT_SOURCES CONFIGURE_DEPENDS "${CMAKE_CURRENT_LIST_DIR}/*.cpp") # Define PROJECT_SOURCES as a list of all source files
set(PROJECT_INCLUDE "${CMAKE_CURRENT_LIST_DIR}/") # Define PROJECT_INCLUDE to be the path to the include directory of the project

target_sources(Demux PUBLIC "${PROJECT_SOURCES}")
target_sources(SerialLinuxTest PUBLIC "${CMAKE_CURRENT_LIST_DIR}/linuxSerialTest.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxSerialPort.cpp")
target_sources(NamedPipeLinuxTest PUBLIC "${CMAKE_CURRENT_LIST_DIR}/linuxPipeTest.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxNamedPipe.cpp")

target_include_directories(Demux PUBLIC "${PROJECT_INCLUDE}")
target_include_directories(SerialLinuxTest PUBLIC "${PROJECT_INCLUDE}")
target_include_directories(NamedPipeLinuxTest PUBLIC "${PROJECT_INCLUDE}")

if(WIN32)
    target_compile_definitions(Demux PUBLIC WINDOWS=1)
endif ()

if(UNIX AND NOT APPLE)
    target_compile_definitions(Demux PUBLIC LINUX=1)
endif()