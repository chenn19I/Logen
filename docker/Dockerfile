# Pinned, reproducible toolchain for building and testing the Logen contracts.
# Usage: see Makefile (`make docker-judge`) or README "Reproduce".
FROM rust:1.86-bookworm

RUN rustup target add wasm32-unknown-unknown \
 && apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates pkg-config libssl-dev libudev-dev clang make jq \
 && rm -rf /var/lib/apt/lists/*

# cargo-near: builds NEAR-compatible wasm (MVP features + wasm-opt)
RUN curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/cargo-near/releases/latest/download/cargo-near-installer.sh | sh

ENV CARGO_TARGET_DIR=/target
WORKDIR /work
