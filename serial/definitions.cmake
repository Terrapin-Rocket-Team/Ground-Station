# determine build environment
if("${CMAKE_SYSTEM_NAME}" STREQUAL "MSYS")
    set(BUILD_ENV "WINDOWS")
# if this is not an elseif msys makes cmake think it's building on both windows and linux
elseif(UNIX AND NOT APPLE)
    set(BUILD_ENV "LINUX")
elseif(UNIX AND APPLE)
    set(BUILD_ENV "LINUX")
#    message(FATAL_ERROR "Building on Apple is not supported")
endif()
