import express from "express";
import { execFile } from "node:child_process";
import { resolve } from "node:path";

const app = express();
app.use(express.json());

app.post("/api/run", (req, res) => {
  // runs python module via uv inside ./python
  const { module, args = [], timeout = 20 } = req.body ?? {};
  const cwd = resolve(process.cwd(), "../python");
  const cmd = "uv";
  const argv = ["run", "python", "-m", module, ...args];

  const child = execFile(cmd, argv, { cwd, timeout: timeout * 1000 }, (err, stdout, stderr) => {
    res.json({
      ok: !err,
      exit: (err && (err as any).code) ?? 0,
      stdout: String(stdout ?? ""),
      stderr: String(stderr ?? "")
    });
  });
});

app.post("/api/ai", (req, res) => {
  const { prompt, context } = req.body ?? {};
  res.json({ completion: `MOCK: ${prompt.slice(0,64)}...` });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`mock server on :${port}`));
