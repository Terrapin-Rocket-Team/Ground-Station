cmake_minimum_required(VERSION 3.10.0)
set(CMAKE_CXX_COMPILER g++)

project(gsm-utils)

set(PROJECT_INCLUDE "${CMAKE_CURRENT_LIST_DIR}/") # Define PROJECT_INCLUDE to be the path to the include directory of the project

include(${CMAKE_CURRENT_LIST_DIR}/../../serial/RadioMessage/CMakeLists.txt)

add_executable(mux-gsm mux-gsm.cpp)

target_link_libraries(mux-gsm Message)

target_include_directories(mux-gsm PUBLIC "${PROJECT_INCLUDE}")


if("${CMAKE_SYSTEM_NAME}" STREQUAL "MSYS")
    set(CMAKE_CXX_FLAGS "-fPIC -static -static-libgcc -static-libstdc++")

# if this is not an elseif msys makes cmake think it's building on both windows and linux
elseif(UNIX AND NOT APPLE)
endif()

target_sources(mux-gsm PUBLIC
        "${CMAKE_CURRENT_LIST_DIR}/mux-gsm.cpp")