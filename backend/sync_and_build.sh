#!/bin/bash
# sync_and_build.sh
# Run this on your main server to enable the high-performance Rust engine.

echo "--- Building High-Performance Bot Engine ---"
cd backend/rust_engine
pip install .

echo "--- Verifying Installation ---"
cd ..
python -c "import sys; sys.path.append('.'); from app.routers.bot import _HAS_RUST; print(f'Rust Engine Active: {_HAS_RUST}')"

echo "Done! Restart your backend to apply changes."
