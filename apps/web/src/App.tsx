import React, { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export default function App() {
  const [name, setName] = useState("World");
  const [out, setOut] = useState("Output will appear here...");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setOut("Running...");
    try {
      const resp = await fetch(`${API_BASE}/api/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          module: "your_app.main",
          args: [name],
          timeout: 20,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        setOut(`HTTP ${resp.status} ${resp.statusText}\n${text}`);
        console.error("API error:", resp.status, resp.statusText, text);
        return;
      }

      const j = await resp.json();
      const text = (j.stdout || j.stderr || JSON.stringify(j)).trim();
      setOut(text || "(no output)");
      console.log("API response:", j);
    } catch (e: any) {
      setOut(`Fetch error: ${e?.message || String(e)}`);
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>pyide</h1>
      <p>
        Quick sanity check: run <code>your_app.main</code> via the mock server (
        <code>{API_BASE}</code>).
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={run} disabled={busy}>{busy ? "Running…" : "Run"}</button>
      </div>

      <pre style={{ background: "#111", color: "#0f0", padding: 12, marginTop: 16, minHeight: 120 }}>
{out}
      </pre>
    </div>
  );
}