import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { applyPatch, parsePatch, ParsedDiff } from "diff";

const app = express();
app.use(express.json());

// (Optional) CORS is harmless, but we won't need it once everything is same-origin
app.use(cors({ origin: true }));

// --- Helpers (path safety + run) ---
const ROOT = resolve(process.cwd(), ".."); // repo root
const PYROOT = resolve(ROOT, "python"); // allowed root
function assertUnderPyroot(abs: string) {
  const real = resolve(abs);
  if (!real.startsWith(PYROOT + path.sep) && real !== PYROOT) {
    throw new Error(`Path outside allowed root: ${real}`);
  }
}

function runUv(args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolveP) => {
    const child = spawn("uv", ["run", ...args], {
      cwd: opts.cwd ?? PYROOT,
      env: { ...process.env, PYTHONPATH: resolve(PYROOT, "src"), ...(opts.env ?? {}) },
    });
    let out = "",
      err = "";
    child.stdout.on("data", (b) => (out += b.toString()));
    child.stderr.on("data", (b) => (err += b.toString()));
    child.on("close", (code) => resolveP({ code: code ?? 1, stdout: out, stderr: err }));
  });
}

function runGit(args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolveP) => {
    const child = spawn("git", args, { cwd: ROOT });
    let out = "",
      err = "";
    child.stdout.on("data", (b) => (out += b.toString()));
    child.stderr.on("data", (b) => (err += b.toString()));
    child.on("close", (code) => resolveP({ code: code ?? 1, stdout: out, stderr: err }));
  });
}

// --- API routes (keep these FIRST) ---
app.get("/health", (_req, res) => res.type("text/plain").send("OK: pyide server"));

app.post("/api/run", async (req, res) => {
  const { module, args = [], timeout = 20 } = req.body ?? {};
  // Note: timeout is not implemented in runUv yet, but could be with AbortController
  const result = await runUv(["python", "-m", module, ...args]);
  res.json({
    ok: result.code === 0,
    exit: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  });
});

app.post("/api/ai", (req, res) => {
  const { prompt } = req.body ?? {};
  res.json({ completion: `MOCK: ${String(prompt ?? "").slice(0, 64)}...` });
});

// PATCH: preview/apply (unified diff)
app.post("/api/patch/preview", async (req, res) => {
  const { diff } = req.body ?? {};
  if (typeof diff !== "string" || !diff.trim()) return res.status(400).json({ error: "missing diff" });

  let parsed: ParsedDiff[];
  try {
    parsed = parsePatch(diff);
  } catch (e: any) {
    return res.status(400).json({ error: "parse failed", detail: String(e) });
  }

  const files: string[] = [];
  for (const h of parsed) {
    // h.newFileName / h.oldFileName like "a/python/..." depending on generator
    const candidates = [h.newFileName, h.oldFileName].filter(Boolean) as string[];
    for (const c of candidates) {
      const rel = c.replace(/^a\//, "").replace(/^b\//, "");
      const abs = resolve(ROOT, rel);
      try {
        assertUnderPyroot(abs);
      } catch (e: any) {
        return res.status(400).json({ error: e.message, file: rel });
      }
      if (!files.includes(rel)) files.push(rel);
    }
  }
  return res.json({ ok: true, files });
});

app.post("/api/patch/apply", async (req, res) => {
  const { diff, gitCommitMessage } = req.body ?? {};
  if (typeof diff !== "string" || !diff.trim()) return res.status(400).json({ error: "missing diff" });

  let parsed: ParsedDiff[];
  try {
    parsed = parsePatch(diff);
  } catch (e: any) {
    return res.status(400).json({ error: "parse failed", detail: String(e) });
  }

  const changed: string[] = [];
  for (const h of parsed) {
    const relOld = (h.oldFileName ?? "").replace(/^a\//, "");
    const relNew = (h.newFileName ?? "").replace(/^b\//, "");
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

  return res.json({ ok: true, changed, ruff /* tests */ });
});

// Tools
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

// Git Endpoints
app.get("/api/git/status", async (_req, res) => {
  const r = await runGit(["status", "--porcelain"]);
  res.json({ ok: r.code === 0, ...r });
});

app.post("/api/git/commit", async (req, res) => {
  const { message, author } = req.body ?? {};
  if (!message) return res.status(400).json({ error: "missing commit message" });

  const args = ["commit", "-a", "-m", message];
  if (author) args.push(`--author=${author}`);

  const r = await runGit(args);
  res.json({ ok: r.code === 0, ...r });
});

app.post("/api/git/revert", async (_req, res) => {
  // Reverts the last commit. This is a hard reset, discarding changes.
  const r = await runGit(["reset", "--hard", "HEAD~1"]);
  res.json({ ok: r.code === 0, ...r });
});

// --- STATIC WEB (serve the built UI) ---
const webRoot = resolve(process.cwd(), "../apps/web/dist");
app.use(express.static(webRoot));

// Fallback to index.html for client-side routing
app.get("*", (_req, res) => {
  res.sendFile(path.join(webRoot, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`pyide server on :${port}`));