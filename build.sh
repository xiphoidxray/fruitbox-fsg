#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

echo "Building..."
cd frontend
bun install
bun run build
cd ..
cargo build --release

echo "Build complete."
