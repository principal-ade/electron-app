#!/bin/bash
# Helper script to run electron-builder with increased stack size to avoid stack overflow

echo "Running electron-builder with increased stack size..."
node --stack-size=4096 ./node_modules/.bin/electron-builder build --publish always "$@"
