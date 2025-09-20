import express from "express";
import cors from "cors";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import path from "node:path";

const app = express();
app.use(express.json());

// (Optional) CORS is harmless, but we won't need it once everything is same-origin
app.use(cors({ origin: true }));

// --- API routes (keep these FIRST) ---
app.get("/health", (_req, res) => res.type("text/plain").send("OK: pyide server"));
app.post("/api/run", (req, res) => {
  const { module, args = [], timeout = 20 } = req.body ?? {};
  const cwd = resolve(process.cwd(), "../python");
  const cmd = "uv";
  const argv = ["run", "python", "-m", module, ...args];

  execFile(
    cmd,
    argv,
    {
      cwd,
      timeout: timeout * 1000,
      env: { ...process.env, PYTHONPATH: resolve(cwd, "src") }, // src-layout fix
    },
    (err, stdout, stderr) => {
      res.json({
        ok: !err,
        exit: (err && (err as any).code) ?? 0,
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? ""),
      });
    }
  );
});

app.post("/api/ai", (req, res) => {
  const { prompt } = req.body ?? {};
  res.json({ completion: `MOCK: ${String(prompt ?? "").slice(0, 64)}...` });
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