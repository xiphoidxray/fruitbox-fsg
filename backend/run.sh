#!/bin/bash
set -e

cd frontend
bun install
bun run dev &

cd ..
cargo watch -x run

wait
