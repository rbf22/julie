# .devcontainer/Dockerfile
FROM mcr.microsoft.com/devcontainers/base:ubuntu

ENV DEBIAN_FRONTEND=noninteractive

# System deps
RUN apt-get update && apt-get install -y \
    curl git build-essential python3 python3-pip ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# -----------------------------------------------------------------------------
# Install uv as root, then expose uv/uvx to all users via /usr/local/bin
# -----------------------------------------------------------------------------
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
 && install -m 0755 /root/.local/bin/uv  /usr/local/bin/uv \
 && install -m 0755 /root/.local/bin/uvx /usr/local/bin/uvx

# Optional: keep PATH clean; uv is now in /usr/local/bin for all users
ENV PATH="/usr/local/bin:${PATH}"

# -----------------------------------------------------------------------------
# Rust toolchain (for Tauri later)
# -----------------------------------------------------------------------------
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# (No Node here; devcontainer.json should enable the Node feature like:)
# "features": { "ghcr.io/devcontainers/features/node:1": { "version": "20" } }