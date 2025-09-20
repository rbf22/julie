import React, { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

// A generic function to call our new API endpoints
async function callApi(endpoint, body) {
  const url = `${API_BASE}${endpoint}`;
  const options = {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const resp = await fetch(url, options);
  if (!resp.ok) {
    const text = await resp.text().catch(() => 'Failed to read error response');
    throw new Error(`API Error: ${resp.status} ${resp.statusText}\n${text}`);
  }
  return await resp.json();
}

export default function App() {
  const [prompt, setPrompt] = useState("Make the greeting friendlier");
  const [transcript, setTranscript] = useState([]);
  const [busy, setBusy] = useState(false);

  // Helper to add to the transcript
  const log = useCallback((...args) => {
    const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)).join(" ");
    setTranscript(prev => [...prev, message]);
    // scroll to bottom
    setTimeout(() => {
      const el = document.getElementById("transcript");
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }, []);

  const handleToolClick = async (toolName, endpoint, body) => {
    setBusy(true);
    log(`> Running ${toolName}...`);
    try {
      const result = await callApi(endpoint, body);
      log(result);
    } catch (e) {
      log(`Error calling ${toolName}:`, e.message);
    }
    setBusy(false);
  };

  const handleAgentRun = async () => {
    setBusy(true);
    log(`\n--- Agent run for prompt: "${prompt}" ---`);

    // This is a mock of a real agent sequence.
    // 1. Agent "thinks" and generates a patch.
    const diff = `--- a/python/src/your_app/main.py
+++ b/python/src/your_app/main.py
@@ -1,2 +1,2 @@
 def greet(name: str) -> str:
-    return f"Hello, {name}!"
+    return f"Well hello there, {name}! What a fine day."`;
    log("🤖 Agent generated a patch:\n" + diff);

    // 2. Preview the patch
    log("> Previewing patch...");
    try {
      const preview = await callApi("/api/patch/preview", { diff });
      log(preview);

      if (preview.ok) {
        // 3. Apply the patch and commit
        log("> Applying patch...");
        const apply = await callApi("/api/patch/apply", { diff, gitCommitMessage: `feat: ${prompt}` });
        log(apply);

        if (apply.ok) {
          // 4. Run tests to validate
          log("> Running tests...");
          const tests = await callApi("/api/tool/pytest", {});
          log(tests);
          if(tests.ok) {
              log("✅ Agent run completed successfully.");
          } else {
              log("❌ Agent run failed: tests did not pass.");
          }
        } else {
          log("❌ Agent run failed: could not apply patch.");
        }
      } else {
          log("❌ Agent run failed: patch preview failed.");
      }
    } catch (e) {
        log(`❌ Agent run failed:`, e.message);
    }

    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", fontFamily: "sans-serif", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <header style={{ textAlign: 'center' }}>
        <h1>Agent-First PyIDE</h1>
        <p>A minimal UI to interact with an agent-driven development environment.</p>
      </header>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ flex: 1, padding: 8, fontSize: "1rem" }}
          placeholder="Enter a prompt for the agent..."
          disabled={busy}
        />
        <button onClick={handleAgentRun} disabled={busy} style={{ padding: "8px 16px", fontSize: "1rem" }}>
          {busy ? "Running..." : "Run Agent"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => handleToolClick("Ruff", "/api/tool/ruff", {})} disabled={busy}>Lint (ruff)</button>
        <button onClick={() => handleToolClick("Pytest", "/api/tool/pytest", {})} disabled={busy}>Test (pytest)</button>
        <button onClick={() => handleToolClick("Run App", "/api/run", { module: "your_app.main", args: ["Agent"] })} disabled={busy}>Run App</button>
        <button onClick={() => handleToolClick("Git Status", "/api/git/status", null)} disabled={busy}>Git Status</button>
      </div>

      <div style={{ border: "1px solid #ccc", borderRadius: 4 }}>
        <h2 style={{ margin: 0, padding: "8px 12px", borderBottom: "1px solid #ccc", background: "#f0f0f0" }}>Transcript</h2>
        <pre id="transcript" style={{ background: "#111", color: "#e0e0e0", padding: 12, margin: 0, minHeight: 400, maxHeight: 600, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "0.875rem" }}>
          {transcript.join('\n')}
        </pre>
      </div>
    </div>
  );
}