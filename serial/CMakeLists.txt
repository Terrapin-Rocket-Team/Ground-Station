cmake_minimum_required(VERSION 3.5.0)
set(CMAKE_CXX_COMPILER g++)

project(SerialInterface)

add_executable(demux demux.cpp)
add_executable(SerialLinuxTest linuxTest.cpp)

file(GLOB_RECURSE PROJECT_SOURCES CONFIGURE_DEPENDS "${CMAKE_CURRENT_LIST_DIR}/*.cpp") # Define PROJECT_SOURCES as a list of all source files
set(PROJECT_INCLUDE "${CMAKE_CURRENT_LIST_DIR}/") # Define PROJECT_INCLUDE to be the path to the include directory of the project

target_sources(demux PUBLIC "${PROJECT_SOURCES}")
target_sources(SerialLinuxTest PUBLIC "${CMAKE_CURRENT_LIST_DIR}/linuxTest.cpp;${CMAKE_CURRENT_LIST_DIR}/LinuxSerialPort.cpp")

target_include_directories(demux PUBLIC "${PROJECT_INCLUDE}")
target_include_directories(SerialLinuxTest PUBLIC "${PROJECT_INCLUDE}")