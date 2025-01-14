
set(LIB_DIR ${CMAKE_CURRENT_SOURCE_DIR}/SerialPort)

include(${CMAKE_CURRENT_SOURCE_DIR}/definitions.cmake)

if (${BUILD_ENV} STREQUAL "WINDOWS")

    add_library(SerialPort STATIC ${LIB_DIR}/WinSerialPort.cpp)

elseif (${BUILD_ENV} STREQUAL "LINUX")

    add_library(SerialPort STATIC ${LIB_DIR}/LinuxSerialPort.cpp)

endif()

target_include_directories(SerialPort PUBLIC ${LIB_DIR})