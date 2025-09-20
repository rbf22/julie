export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export async function runPythonModule(mod: string, args: string[] = []) {
  const r = await fetch(`${API_BASE}/api/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ module: mod, args, timeout: 20 })
  });
  return r.json();
}

export async function aiComplete(prompt: string, context: string) {
  // Mock LLM (server echoes). Later: connect to Tauri/Ollama.
  const r = await fetch(`${API_BASE}/api/ai`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, context })
  });
  return r.json();
}
