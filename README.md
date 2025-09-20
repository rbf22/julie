# julie

Edits come only from agent personas (not humans in the UI), we cann have a slim UI and beefy tooling API + patch pipeline. Here’s a crisp MVP plan and code you can paste to get there fast.

Where you are (quick)
	•	Single-origin app on :3000 serving the web UI.
	•	/api/run executes uv run python -m <module> … with PYTHONPATH=src.
	•	Python project scaffold + uv env.
	•	Minimal web UI that can issue a run.

Target MVP (agent-first)

A thin console UI for prompts + run output, and a toolbox API the agents call to:
	1.	Plan: propose changes as patches.
	2.	Apply: apply unified diffs safely inside python/.
	3.	Validate: run ruff, pytest, optional mypy.
	4.	Execute: run modules/entrypoints.
	5.	Transact: auto-commit to Git with traceable messages.
	6.	Rollback: revert last change set.

No manual editor needed.

⸻

API surface (server)

Add these HTTP endpoints (all same-origin, JSON). I’ll show code for the key ones.
	•	POST /api/plan (optional): store agent plan text.
	•	POST /api/patch/preview: validate a unified diff against repo.
	•	POST /api/patch/apply: apply diff (idempotent, within allowlist), return changed files.
	•	POST /api/tool/ruff: run ruff (all or subset).
	•	POST /api/tool/pytest: run pytest (all or -k/-m filters).
	•	POST /api/tool/mypy: (optional) type check.
	•	POST /api/run: (you already have) run module/args.
	•	POST /api/git/commit: commit with message/author; GET /api/git/status, POST /api/git/revert.
	•	GET /api/fs/allowlist: return allowed root (e.g., python/).

Implementation notes
	•	Enforce allowlist: all file writes must stay under python/.
	•	Accept unified diff strings. Safer and audit-friendly than sending whole file bodies.
	•	Before apply, run dry checks: paths canonicalization, no symlinks, no ...
	•	After apply, run ruff –fix, then (optionally) pytest -q. Return diagnostics.

⸻

Paste-ready code (server/src/index.ts additions)

Helpers (path safety + run)

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const ROOT = resolve(process.cwd(), "..");          // repo root
const PYROOT = resolve(ROOT, "python");            // allowed root
function assertUnderPyroot(abs: string) {
  const real = resolve(abs);
  if (!real.startsWith(PYROOT + path.sep) && real !== PYROOT) {
    throw new Error(`Path outside allowed root: ${real}`);
  }
}

function runUv(args: string[], opts: { cwd?: string; env?: Record<string,string> } = {}) {
  return new Promise<{code:number;stdout:string;stderr:string}>((resolveP) => {
    const child = spawn("uv", ["run", ...args], {
      cwd: opts.cwd ?? PYROOT,
      env: { ...process.env, PYTHONPATH: resolve(PYROOT, "src"), ...(opts.env ?? {}) }
    });
    let out = "", err = "";
    child.stdout.on("data", b => out += b.toString());
    child.stderr.on("data", b => err += b.toString());
    child.on("close", code => resolveP({ code: code ?? 1, stdout: out, stderr: err }));
  });
}

PATCH: preview/apply (unified diff)

import { createPatch, applyPatch, ParsedDiff, parsePatch } from "diff"; // pnpm add diff

// Preview: validates the diff touches only allowed files, returns file list
app.post("/api/patch/preview", async (req, res) => {
  const { diff } = req.body ?? {};
  if (typeof diff !== "string" || !diff.trim()) return res.status(400).json({ error: "missing diff" });

  let parsed: ParsedDiff[];
  try { parsed = parsePatch(diff); } catch (e:any) { return res.status(400).json({ error: "parse failed", detail: String(e) }); }

  const files: string[] = [];
  for (const h of parsed) {
    // h.newFileName / h.oldFileName like "a/python/..." depending on generator
    const candidates = [h.newFileName, h.oldFileName].filter(Boolean) as string[];
    for (const c of candidates) {
      const rel = c.replace(/^a\//,"").replace(/^b\//,"");
      const abs = resolve(ROOT, rel);
      try { assertUnderPyroot(abs); } catch (e:any) { return res.status(400).json({ error: e.message, file: rel }); }
      if (!files.includes(rel)) files.push(rel);
    }
  }
  return res.json({ ok: true, files });
});

// Apply: actually patches files (line-based). In practice, you may prefer git apply.
app.post("/api/patch/apply", async (req, res) => {
  const { diff, gitCommitMessage } = req.body ?? {};
  if (typeof diff !== "string" || !diff.trim()) return res.status(400).json({ error: "missing diff" });

  let parsed: ParsedDiff[];
  try { parsed = parsePatch(diff); } catch (e:any) { return res.status(400).json({ error: "parse failed", detail: String(e) }); }

  const changed: string[] = [];
  for (const h of parsed) {
    const relOld = (h.oldFileName ?? "").replace(/^a\//,"");
    const relNew = (h.newFileName ?? "").replace(/^b\//,"");
    const rel = relNew || relOld;
    if (!rel) continue;

    const abs = resolve(ROOT, rel);
    assertUnderPyroot(abs);

    const prev = existsSync(abs) ? await fs.readFile(abs, "utf8") : "";
    const next = applyPatch(prev, h);
    if (next === false) {
      return res.status(409).json({ error: "patch failed to apply cleanly", file: rel });
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, next, "utf8");
    changed.push(rel);
  }

  // Optionally auto-format with ruff
  const ruff = await runUv(["ruff", "check", "--fix"]);
  // Optional: run tests quick smoke
  // const tests = await runUv(["pytest", "-q"]);

  // Optional commit
  if (gitCommitMessage) {
    await runGit(["add", ...changed]);
    await runGit(["commit", "-m", gitCommitMessage]);
  }

  return res.json({ ok: true, changed, ruff, /* tests */ });
});

function runGit(args: string[]) {
  return new Promise<{code:number;stdout:string;stderr:string}>((resolveP) => {
    const child = spawn("git", args, { cwd: ROOT });
    let out="", err="";
    child.stdout.on("data", b=> out+=b.toString());
    child.stderr.on("data", b=> err+=b.toString());
    child.on("close", code => resolveP({ code: code ?? 1, stdout: out, stderr: err }));
  });
}

Tools

app.post("/api/tool/ruff", async (req, res) => {
  const { targets = ["."], fix = true } = req.body ?? {};
  const args = ["ruff", "check", ...(fix ? ["--fix"] : []), ...targets];
  const r = await runUv(args);
  res.json({ ok: r.code === 0, ...r });
});

app.post("/api/tool/pytest", async (req, res) => {
  const { k, m, args = [] } = req.body ?? {};
  const full = ["pytest", "-q", ...(k ? ["-k", k] : []), ...(m ? ["-m", m] : []), ...args];
  const r = await runUv(full);
  res.json({ ok: r.code === 0, ...r });
});

app.post("/api/tool/mypy", async (req, res) => {
  const { paths = ["src/"] } = req.body ?? {};
  const r = await runUv(["mypy", ...paths]);
  res.json({ ok: r.code === 0, ...r });
});


⸻

Agent contract (how agents talk to your tools)

1) Propose patch

Agent sends a unified diff with context (git-style OK):

POST /api/patch/preview
{ "diff": "diff --git a/python/src/your_app/main.py b/python/src/your_app/main.py\n--- a/python/src/your_app/main.py\n+++ b/python/src/your_app/main.py\n@@\n-    print(f\"Hello, {name}!\")\n+    print(f\"Hello there, {name}! 👋\")\n" }

If OK → POST /api/patch/apply with same diff and commit message:

{
  "diff": "...",
  "gitCommitMessage": "feat: friendlier greeting"
}

2) Validate

POST /api/tool/ruff       → auto-fix & lint
POST /api/tool/pytest     → run tests
POST /api/tool/mypy       → type check (optional)

3) Execute

POST /api/run
{ "module":"your_app.main", "args":["World"], "timeout": 20 }

The agent loop: plan → patch → lint → test → run → repeat.
You can store plan text in your own agent memory; the server doesn’t need to.

⸻

Minimal UI for humans

Just a console page with:
	•	a prompt box (“What should I do?”),
	•	a transcript area showing tool calls + outputs,
	•	buttons for Run last module, Run tests, Lint,
	•	a “Change set” log (list of last N commits with diffs).

This keeps UX simple while letting personas drive everything.

⸻

Safety rails
	•	Absolute allowlist (python/) for writes; reject symlinks/.. escapes.
	•	Require unified diffs, not arbitrary shell commands.
	•	Enforce timeouts and cap stdout length.
	•	(Optional) Gate /api/patch/apply behind a “preview → apply” two-step to catch path mistakes.
	•	(Optional) “dry run” mode for pytest: pytest --collect-only to smoke-check tests.

⸻

What to implement next (in order)
	1.	Add the patch preview/apply endpoints (above), install deps:

pnpm -C server add diff


	2.	Add ruff/pytest/mypy tool endpoints.
	3.	Add git helpers (commit, status, revert last).
	4.	Trim the web UI to a console that can trigger those endpoints and render outputs (no Monaco).
	5.	Write a simple Agent driver (can be a script or a button that posts a prompt to /api/ai, then calls tools in sequence based on rules).
	6.	Add a tests sample: one pass, one fail — verify the agent surfaces failures and iterates.

⸻

Example: one-button “Agent run” (pseudo)

The UI sends a prompt to /api/ai → your front-end agent interprets → calls:

/api/patch/preview  (if ok)
/api/patch/apply
/api/tool/ruff
/api/tool/pytest
/api/run  (if needed)

Log each step in the transcript area with stdout/stderr. If pytest fails, the agent proposes another diff and repeats.

⸻

If you want, I can:
	•	generate a tiny console UI that sequences these calls,
	•	or add git status/commit/revert endpoints right now.
