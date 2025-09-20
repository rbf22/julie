FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Node + core build tools
RUN apt-get update && apt-get install -y curl git build-essential python3 python3-pip

# Install uv (fast Python manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

# Install Rust toolchain (needed later for Tauri, but fine to have now)
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# PNPM
RUN corepack enable
RUN corepack prepare pnpm@9.0.0 --activate
