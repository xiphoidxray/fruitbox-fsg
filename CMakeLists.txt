cmake_minimum_required(VERSION 3.20)
project(FruitBoxServer LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Enable link-time optimization if supported
include(CheckIPOSupported)
check_ipo_supported(RESULT LTO_SUPPORTED OUTPUT LTO_ERROR)
if (LTO_SUPPORTED)
    set(CMAKE_INTERPROCEDURAL_OPTIMIZATION ON)
endif()

# Compiler warnings
if (CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    add_compile_options(-Wall -Wextra -Werror -Wpedantic -Wconversion -Wsign-conversion -Wshadow)
elseif (CMAKE_CXX_COMPILER_ID MATCHES "MSVC")
    add_compile_options(/W4 /WX)
endif()

# Source files
file(GLOB_RECURSE SOURCES CONFIGURE_DEPENDS
    src/*.cpp
    src/*.h
)

# Define executable
add_executable(fruitbox_server ${SOURCES})

# Apply clang-tidy only to your own source files (cpp files)
foreach(source_file ${SOURCES})
    if (source_file MATCHES "\\.cpp$")
        set_source_files_properties(${source_file} PROPERTIES
            CXX_CLANG_TIDY "clang-tidy;-checks=*;-header-filter=^/Users/gavinwang/code/fruitbox-multiplayer/.*"
        )
    endif()
endforeach()

# Include directories
target_include_directories(fruitbox_server PRIVATE include)

# Fetch nlohmann/json
include(FetchContent)
FetchContent_Declare(
  json
  URL https://github.com/nlohmann/json/releases/download/v3.11.2/json.tar.xz
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
FetchContent_MakeAvailable(json)

target_link_libraries(fruitbox_server PRIVATE nlohmann_json::nlohmann_json)

# Install target
install(TARGETS fruitbox_server DESTINATION bin)

# Optional: Enable testing if needed
include(CTest)
enable_testing()
