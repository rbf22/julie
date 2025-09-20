# **Julie** – Agent-Driven Python Development Environment

> *A structured, agent-first environment for building, testing, and deploying Python code with precision and safety.*

---

## **Overview**

**Julie** is a next-generation, **AI-driven coding environment** designed to be more **structured and auditable** than free-form coding assistants like ChatGPT or Google Jules.  
It focuses exclusively on **Python projects**, providing a secure, sandboxed environment where **AI agents** plan, generate, modify, and execute code safely using well-defined **tools**.

Instead of editing files directly, agents operate like a **team of specialists**:
- **Planner** decides *what* needs to be done.
- **Implementer** writes and edits the code.
- **Reviewer** checks quality and safety.
- **Tester** validates correctness with automated tests.

Every step is captured as an **auditable, reproducible trail**:
```
Plan → Patch → Test → Run → Commit
```

This structured workflow gives humans **visibility and trust**, while empowering AI to take on complex tasks autonomously.

---

## **Why This Matters**

Traditional LLM coding workflows:
- Are **free-form** — agents or humans can do anything, anywhere, in any file.
- Lack **safety rails** — bugs or dangerous changes can slip through unnoticed.
- Are hard to **audit** after the fact.

By contrast, **Julie**:
- Restricts all edits to a controlled **Python workspace** (`python/` folder).
- Requires every modification to arrive as a **unified diff** (like a Git patch).
- Automatically **formats**, **lints**, and **tests** every change before it’s applied.
- Stores an explicit **action log** for every agent decision.

Think of it as the **"Amazon Kiro"** model applied to open source:
a clean, safe, auditable development environment for both humans and AI agents.

---

## **Ollama-Powered Agents**

### **Why Ollama**
[Ollama](https://ollama.ai/) is a lightweight, local LLM serving layer for running open-source models like LLaMA 3, CodeLLaMA, Mistral, and DeepSeek.  
It’s ideal for Julie because it provides:
- **Fully local and private execution** — no external API keys required.
- Ability to run **multiple models**, one per agent persona.
- **Streaming responses** with low latency.
- Easy scaling for **multi-agent orchestration**.

This lets Julie operate entirely offline or on private infrastructure while maintaining strong performance.

---

### **Agent Roles**

| Agent         | Example Model        | Responsibilities |
|---------------|----------------------|-----------------|
| **Planner**   | `llama3:8b` or `mistral:7b` | Break down high-level tasks into a clear execution plan |
| **Implementer** | `codellama:13b` or `deepseek-coder:6.7b` | Generate code and patches for the Python workspace |
| **Reviewer**  | `llama3:8b-instruct` | Analyze patches for quality, safety, and style issues |
| **Tester**    | Same as Reviewer     | Create new tests and validate coverage |

Each agent runs in **its own Ollama session**, connected via Julie’s backend.

---

### **How Julie Integrates With Ollama**

1. **Julie connects to Ollama** via its local HTTP API (`http://localhost:11434`).
2. Each agent role has:
   - A **prompt template** describing its unique responsibilities.
   - Access to a subset of Julie’s **tool APIs** (`pytest`, `ruff`, `uv`, etc.).
3. A task flows like this:
   - Planner generates a **step-by-step plan**.
   - Implementer generates a **patch (diff)**.
   - Reviewer evaluates it.
   - Tester runs validations.
   - Julie applies the patch and logs all outputs.

Example request to the Implementer agent:
```json
{
  "task": "Add fibonacci function",
  "context": {
    "files": ["utils.py"],
    "tests": ["test_utils.py"]
  },
  "tools": ["pytest", "ruff"]
}
```

Agent response:
```json
{
  "diff": "diff --git a/python/src/julie_app/utils.py ..."
}
```

---

### **Ollama Configuration**

Julie expects several models to be available in Ollama.

Example `ollama.yaml`:
```yaml
models:
  - name: planner
    model: llama3:8b
  - name: implementer
    model: codellama:13b
  - name: reviewer
    model: llama3:8b-instruct
```

Start Ollama:
```bash
ollama serve
```

Verify it works:
```bash
curl http://localhost:11434/api/generate   -d '{"model":"llama3:8b","prompt":"Hello from Julie"}'
```

---

## **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                      Julie Frontend                     │
│                                                         │
│  - Minimal console UI                                   │
│  - Displays agent plans, patches, test results          │
│  - Transparent logs and audit trail                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      Julie Backend                      │
│                                                         │
│  - Python sandbox execution with uv                     │
│  - Patch application and validation                     │
│  - Tool APIs: pytest, ruff, mypy                        │
│  - Git versioning and rollback                          │
│  - **Ollama agent orchestration**                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                     Python Workspace                    │
│                                                         │
│  python/                                                │
│   └── src/julie_app/                                    │
│       ├── main.py                                       │
│       └── ...                                           │
│                                                         │
│  All code lives here.                                   │
│  Tests, modules, and configs are isolated and versioned │
└─────────────────────────────────────────────────────────┘
```

---

## **Example Agent Workflow**

1. **Planner Agent**
   ```
   POST /api/agent/planner
   {
     "goal": "Add Fibonacci calculator",
     "context": "Project uses pytest and utils.py for math functions."
   }
   ```
   Returns:
   ```json
   {
     "plan": [
       "1. Add fibonacci function to utils.py",
       "2. Add test cases to test_utils.py",
       "3. Run pytest to confirm everything passes"
     ]
   }
   ```

2. **Implementer Agent**
   ```
   POST /api/agent/implementer
   {
     "task": "Implement fibonacci function",
     "files": ["utils.py"]
   }
   ```
   Returns:
   ```json
   {
     "diff": "diff --git a/python/src/julie_app/utils.py ..."
   }
   ```

3. **Reviewer Agent**
   ```
   POST /api/agent/reviewer
   {
     "diff": "...",
     "tests": ["test_utils.py"]
   }
   ```
   Returns:
   ```json
   {
     "feedback": "Code quality is good, but add edge-case tests."
   }
   ```

4. Julie applies the patch, runs `pytest` and `ruff`, and displays the final result in the web UI.

---

## **Getting Started**

### 1. Install Ollama
MacOS:
```bash
brew install ollama
```

Linux:
```bash
curl https://ollama.ai/install.sh | sh
```

Windows:
- Download installer from [ollama.ai](https://ollama.ai).

### 2. Pull Required Models
```bash
ollama pull llama3:8b
ollama pull codellama:13b
```

### 3. Start Ollama
```bash
ollama serve
```

### 4. Start Julie
In one terminal:
```bash
pnpm -C server dev
```

In another terminal:
```bash
pnpm -C apps/web build
pnpm -C server dev
```

Open the browser at:
```
http://localhost:3000
```

---

## **Tech Stack**

| Layer        | Tech |
|--------------|------|
| **Frontend** | React + Vite + Zustand |
| **Backend**  | Node.js + Express |
| **Agents**   | Ollama (local LLMs: LLaMA3, CodeLLaMA, Mistral) |
| **Python Env** | uv, pytest, ruff, mypy |
| **Version Control** | Git |
| **Deployment** | GitHub Codespaces, Docker |

---

## **Roadmap**

| Phase | Goal |
|-------|------|
| **0.1 MVP** | Implementer agent generates and runs Python code patches |
| **0.2** | Add Planner and Reviewer agents for structured workflows |
| **0.3** | Full multi-agent orchestration and conflict resolution |
| **0.4** | Secure remote agent hosting and authentication |
| **0.5** | Human-in-the-loop review mode with advanced diff visualization |

---

## **Philosophy**

1. **Agents should have narrow roles and clear tools**  
2. **Local-first execution with Ollama ensures privacy**  
3. **All outputs are structured and auditable**  
4. **Nothing runs without passing validation and tests**  
5. **Start with Python, design for multi-language support later**

---

## **Summary**

Julie is your **structured, agent-first Python development partner**, combining:
- **Ollama-powered AI agents** for planning, coding, reviewing, and testing.
- A **sandboxed Python environment** for safe and isolated execution.
- A **transparent, auditable process** for every code change.

By focusing on privacy, structure, and accountability, Julie provides a safe alternative to free-form LLM coding assistants—bringing the vision of **Google Jules** and **Amazon Kiro** to open source development.
