import { useEffect, useState } from 'react';

export default function PyodidePanel() {
  const [pyodide, setPyodide] = useState<any>(null);
  const [code, setCode] = useState("print('hello from pyodide')");
  const [out, setOut] = useState("");

  useEffect(() => {
    (async () => {
      // @ts-ignore
      const py = await window.loadPyodide?.() ?? (await import("pyodide"));
      const inst = await py.loadPyodide();
      setPyodide(inst);
    })();
  }, []);

  async function run() {
    if (!pyodide) return;
    try {
      const result = await pyodide.runPythonAsync(code);
      setOut(String(result ?? ""));
    } catch (e:any) {
      setOut(String(e));
    }
  }

  return (
    <div>
      <h3>Safe Scratchpad (Pyodide)</h3>
      <textarea value={code} onChange={e=>setCode(e.target.value)} rows={8} style={{width:'100%'}} />
      <button onClick={run}>Run</button>
      <pre>{out}</pre>
    </div>
  );
}
