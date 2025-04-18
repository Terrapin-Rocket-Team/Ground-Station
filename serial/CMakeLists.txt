cmake_minimum_required(VERSION 3.10.0)
set(CMAKE_CXX_COMPILER g++)

project(SerialDriver)

set(PROJECT_INCLUDE "${CMAKE_CURRENT_LIST_DIR}/") # Define PROJECT_INCLUDE to be the path to the include directory of the project

include(${CMAKE_CURRENT_SOURCE_DIR}/definitions.cmake)

message("Building for target: " ${BUILD_ENV})

include(${CMAKE_CURRENT_SOURCE_DIR}/RadioMessage/CMakeLists.txt)
include(${CMAKE_CURRENT_SOURCE_DIR}/NamedPipe/CMakeLists.txt)
include(${CMAKE_CURRENT_SOURCE_DIR}/SerialPort/CMakeLists.txt)

add_executable(SerialDriver serialDriver.cpp)
add_executable(DriverShell driverShell.cpp)

target_link_libraries(SerialDriver Message NamedPipe SerialPort)
target_link_libraries(DriverShell Message NamedPipe SerialPort)

target_include_directories(SerialDriver PUBLIC "${PROJECT_INCLUDE}")
target_include_directories(DriverShell PUBLIC "${PROJECT_INCLUDE}")

target_sources(SerialDriver PUBLIC "${CMAKE_CURRENT_LIST_DIR}/serialDriver.cpp")
target_sources(DriverShell PUBLIC "${CMAKE_CURRENT_LIST_DIR}/driverShell.cpp")

if ("${BUILD_ENV}" STREQUAL "WINDOWS")
    set(CMAKE_CXX_FLAGS "-fPIC -static -static-libgcc -static-libstdc++")
    target_compile_definitions(SerialDriver PUBLIC WINDOWS=1)
    target_compile_definitions(DriverShell PUBLIC WINDOWS=1)

elseif ("${BUILD_ENV}" STREQUAL "LINUX")

    target_compile_definitions(SerialDriver PUBLIC LINUX=1)
    target_compile_definitions(DriverShell PUBLIC LINUX=1)

endif()


# build tests
if (${BUILD_TESTS})

if (${BUILD_ENV} STREQUAL "LINUX")

    add_executable(LinuxSerialTest linuxSerialTest.cpp)
    add_executable(LinuxNamedPipeTest linuxPipeTest.cpp)

    target_link_libraries(LinuxSerialTest SerialPort)
    target_link_libraries(LinuxNamedPipeTest NamedPipe)

    target_sources(LinuxSerialTest PUBLIC "${CMAKE_CURRENT_LIST_DIR}/linuxSerialTest.cpp")
    target_sources(LinuxNamedPipeTest PUBLIC "${CMAKE_CURRENT_LIST_DIR}/linuxPipeTest.cpp")

    target_include_directories(LinuxSerialTest PUBLIC "${PROJECT_INCLUDE}")
    target_include_directories(LinuxNamedPipeTest PUBLIC "${PROJECT_INCLUDE}")

endif()

endif()