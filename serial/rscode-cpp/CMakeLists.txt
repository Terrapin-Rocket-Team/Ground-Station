
set(LIB_DIR ${CMAKE_CURRENT_SOURCE_DIR}/rscode-cpp/src)

add_library(rscode-cpp STATIC ${LIB_DIR}/rs.cpp ${LIB_DIR}/galois.cpp ${LIB_DIR}/crcgen.cpp ${LIB_DIR}/berlekamp.cpp)
target_include_directories(rscode-cpp PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/rscode-cpp/include ${LIB_DIR})