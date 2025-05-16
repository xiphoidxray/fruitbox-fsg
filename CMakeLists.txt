cmake_minimum_required(VERSION 3.20)

project(FruitBoxServer LANGUAGES C CXX)
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


# Project sources only
file(GLOB_RECURSE PROJECT_SOURCES CONFIGURE_DEPENDS
    ${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/*.h
)

foreach(file ${PROJECT_SOURCES})
    message(STATUS "Found project source file: ${file}")
endforeach()

# Define executable
add_executable(fruitbox_server ${PROJECT_SOURCES})

# Apply clang-tidy only to your project
foreach(source_file ${PROJECT_SOURCES})
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


target_compile_options(fruitbox_server PRIVATE
    -Wall -Wextra -Werror -Wpedantic -Wconversion -Wsign-conversion -Wshadow
)

FetchContent_Declare(
  uSockets_content
  GIT_REPOSITORY https://github.com/uNetworking/uSockets
  GIT_TAG v0.8.5
  GIT_SHALLOW ON
  GIT_SUBMODULES ""
)
FetchContent_MakeAvailable(uSockets_content)

file(GLOB_RECURSE USOCKETS_SOURCES ${usockets_content_SOURCE_DIR}/src/*.c)
add_library(uSockets ${USOCKETS_SOURCES})
target_include_directories(uSockets
    SYSTEM                                                    # <- mark as system
    PUBLIC ${usockets_content_SOURCE_DIR}/src)
target_compile_definitions(uSockets PRIVATE LIBUS_NO_SSL)

FetchContent_Declare(
  uWebSockets_content
  GIT_REPOSITORY https://github.com/uNetworking/uWebSockets
  GIT_TAG v20.37.0
  GIT_SHALLOW ON
  GIT_SUBMODULES ""
)
FetchContent_MakeAvailable(uWebSockets_content)
find_package(ZLIB REQUIRED)
add_library(uWebSockets INTERFACE)
target_include_directories(uWebSockets
    SYSTEM                                                    # <- mark as system
    INTERFACE ${uwebsockets_content_SOURCE_DIR}/src)
target_link_libraries(uWebSockets INTERFACE uSockets ${ZLIB_LIBRARIES})
target_compile_options(uWebSockets INTERFACE -Wno-deprecated-declarations)

target_link_libraries(fruitbox_server PRIVATE nlohmann_json::nlohmann_json)
target_link_libraries(fruitbox_server PRIVATE uWebSockets)
# Install target
install(TARGETS fruitbox_server DESTINATION bin)

# Optional: Enable testing if needed
include(CTest)
enable_testing()
