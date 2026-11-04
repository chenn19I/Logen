.PHONY: all build test judge attack web-test web-build docker-judge clean

all: judge

# Build NEAR smart contracts to WebAssembly (wasm32-unknown-unknown)
build:
	cargo build --target wasm32-unknown-unknown --release -p pusaka-vault -p pusaka-registry

# Run all Rust unit, property, receipt-interleaving (LM), and cross-contract tests
test:
	cargo test --workspace

# Run frontend unit tests (NEP-413 Borsh/Ed25519, T2 pair-check, session HMAC)
web-test:
	pnpm --dir web test

# Production build of Next.js web application
web-build:
	pnpm --dir web build

# One-command reproducibility suite for Claude Code, Codex, and human judges
judge:
	node scripts/pusaka-cli.mjs judge

# Run the Attack Lab suite (A1-A12 seller & gate exploits) and generate attack-report.json
attack:
	node scripts/pusaka-cli.mjs attack

# Reproducible Linux container verification (runs L0 + LM + L1 near-workspaces sandbox)
docker-judge:
	docker build -t pusaka-builder -f docker/Dockerfile docker
	docker run --rm -v "$(CURDIR):/work" pusaka-builder sh -c "cargo test --workspace && cargo build --target wasm32-unknown-unknown --release && cargo test --manifest-path tests/sandbox/Cargo.toml"

clean:
	cargo clean
