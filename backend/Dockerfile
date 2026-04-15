# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 · builder
#   - Installs Rust toolchain
#   - Compiles penta_engine (PyO3 extension) via maturin
#   - Installs all Python runtime deps
#   Final image never sees rustc, cargo, gcc, or maturin.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.13-slim AS builder

# System build deps:
#   gcc  → C linker required by maturin to link the .so
#   curl → needed to download rustup installer
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc curl \
 && rm -rf /var/lib/apt/lists/*

# Install Rust stable (minimal profile = rustc + cargo, no docs/clippy/etc.)
# Place under /usr/local so it's available to all users without PATH tricks.
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH="/usr/local/cargo/bin:${PATH}"

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y \
        --default-toolchain stable \
        --profile minimal \
        --no-modify-path

WORKDIR /build

# ── Layer: Python runtime dependencies ───────────────────────────────────────
# Copy only requirements.txt first so this layer is cached until it changes.
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Layer: maturin (build-time only, never goes into final image) ─────────────
RUN pip install --no-cache-dir maturin

# ── Layer: Rust engine ────────────────────────────────────────────────────────
# Copy rust_engine source separately from app code so this expensive Rust
# compile step is only re-run when Cargo.toml or src/ actually changes.
COPY rust_engine/ rust_engine/

# BuildKit cache mounts keep the Cargo registry and incremental build
# artifacts warm across rebuilds, cutting subsequent compile times
# from ~2 min → ~10 s for small changes.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/rust_engine/target \
    pip install --no-cache-dir --prefix=/install rust_engine/

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 · final runtime image
#   Lean python:3.13-slim — no Rust toolchain, no gcc, no maturin.
#   Only the compiled .so and Python packages are carried over.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.13-slim AS final

WORKDIR /app

# Copy installed Python packages + compiled penta_engine .so from builder.
# Both stages share the same Python version so site-packages paths match.
COPY --from=builder /install/lib/python3.13/site-packages \
                    /usr/local/lib/python3.13/site-packages
COPY --from=builder /install/bin \
                    /usr/local/bin

# Copy application source last — it changes most often and must not bust
# the expensive layers above.
COPY . .

# Prevent Python from buffering stdout/stderr (important for Railway logs)
# and skip writing .pyc files to keep the container filesystem clean.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Railway injects $PORT at runtime. Fall back to 8000 for local docker run.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
