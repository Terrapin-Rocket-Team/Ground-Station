cmake_minimum_required(VERSION 3.10.0)
set(CMAKE_CXX_COMPILER g++)

project(gsm-utils)

set(PROJECT_INCLUDE "${CMAKE_CURRENT_LIST_DIR}/") # Define PROJECT_INCLUDE to be the path to the include directory of the project

# stolen from Radio Message CMakeLists
set(LIB_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../serial/RadioMessage/src)

add_library(Message STATIC ${LIB_DIR}/Message.cpp ${LIB_DIR}/Types/PackedNum.cpp ${LIB_DIR}/APRS/APRSCmd.cpp ${LIB_DIR}/APRS/APRSData.cpp ${LIB_DIR}/APRS/APRSTelem.cpp ${LIB_DIR}/APRS/APRSText.cpp ${LIB_DIR}/GroundStation/GSData.cpp ${LIB_DIR}/Video/VideoData.cpp)
target_include_directories(Message PUBLIC ${LIB_DIR})
# stolen from Radio Message CMakeLists

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