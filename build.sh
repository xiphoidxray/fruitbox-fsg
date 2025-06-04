#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

echo "Starting deployment..."
cd frontend
bun install
bun run build
cd ..
cargo build --release

echo "Deployment complete."
