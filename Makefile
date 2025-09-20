# Makefile for Julie
PYTHON_DIR=python
SERVER_DIR=server
WEB_DIR=apps/web
BACKEND_URL=http://localhost:3000
TEST_NAME=Valeria

.DEFAULT_GOAL := help

help:
	@echo "Targets:"
	@echo "  make install      -> Install JS + Python deps (uv) (Ollama models optional)"
	@echo "  make dev          -> Run server (:3000) + Vite dev (:5173) (two ports)"
	@echo "  make web-build    -> Build web UI into apps/web/dist"
	@echo "  make serve        -> Build web then serve everything from :3000 (single-origin)"
	@echo "  make test         -> Curl test to /api/run"
	@echo "  make stop         -> Stop backgrounded serve process"
	@echo "  make clean        -> Stop dev processes (Vite + server)"
	@echo "  make reset        -> Clean env and reinstall deps"

install: install-js install-python
	@echo "✅ Julie deps ready."

install-js:
	pnpm install --filter $(SERVER_DIR) --filter $(WEB_DIR)

install-python:
	cd $(PYTHON_DIR) && uv sync

install-ollama:
	@echo ">>> Pulling Ollama models (optional)..."
	-ollama pull Hudson/pythia:14m-q8_0 || true
	-ollama pull Hudson/pythia:70m-q8_0 || true

# Two-port dev: Vite on 5173 + API server on 3000
dev:
	@echo ">>> Starting server (:3000) and Vite dev (:5173). Press Ctrl+C to stop."
	@pnpm -C $(SERVER_DIR) dev & \
	 pnpm -C $(WEB_DIR) dev & \
	 wait

# Build web UI for production
web-build:
	pnpm -C $(WEB_DIR) build

# Serve both UI and backend from port 3000
serve: web-build
	@echo ">>> Starting Julie backend (serving built UI) in background..."
	@pnpm -C $(SERVER_DIR) dev & echo $$! > .serve_pid
	@echo "Julie is running at http://localhost:3000 (PID `cat .serve_pid`)"

# Stop backgrounded serve process
stop:
	@if [ -f .serve_pid ]; then \
		echo ">>> Stopping Julie (PID `cat .serve_pid`)"; \
		kill `cat .serve_pid` || true; \
		rm .serve_pid; \
	else \
		echo "No running Julie process found."; \
	fi

# Curl-based quick sanity test
test:
	@echo ">>> Curl test to $(BACKEND_URL)/api/run"
	@curl -s -X POST $(BACKEND_URL)/api/run \
		-H "Content-Type: application/json" \
		-d '{"module":"your_app.main","args":["$(TEST_NAME)"]}' | jq '.'

# Stop dev processes started by "make dev"
clean:
	- pkill -f "pnpm -C $(SERVER_DIR) dev" || true
	- pkill -f "pnpm -C $(WEB_DIR) dev" || true
	@echo "Cleaned up background dev processes."

reset: clean
	rm -rf node_modules
	rm -rf $(PYTHON_DIR)/.venv
	make install
