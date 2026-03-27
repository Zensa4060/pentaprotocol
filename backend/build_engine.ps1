# build_engine.ps1
# Run this on your local Windows machine to enable the high-performance Rust engine.

Write-Host "--- Building High-Performance Bot Engine ---" -ForegroundColor Cyan
Set-Location "backend/rust_engine"
pip install .

Write-Host "`n--- Verifying Installation ---" -ForegroundColor Cyan
Set-Location ".."
python -c "import sys; sys.path.append('.'); from app.routers.bot import _HAS_RUST; print(f'Rust Engine Active: {_HAS_RUST}')"

Write-Host "`nDone! Restart your backend to apply changes." -ForegroundColor Green
