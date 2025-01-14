
set(LIB_DIR ${CMAKE_CURRENT_SOURCE_DIR}/NamedPipe)

include(${CMAKE_CURRENT_SOURCE_DIR}/definitions.cmake)

if (${BUILD_ENV} STREQUAL "WINDOWS")

    add_library(NamedPipe STATIC ${LIB_DIR}/WinNamedPipe.cpp)

elseif (${BUILD_ENV} STREQUAL "LINUX")

    add_library(NamedPipe STATIC ${LIB_DIR}/LinuxNamedPipe.cpp)

endif()

target_include_directories(NamedPipe PUBLIC ${LIB_DIR})