use tokio::process::Command;
use tokio::io::AsyncReadExt;
use std::process::Stdio;
use std::time::Duration;
use serde::Serialize;
use anyhow::{Result, anyhow};
use crate::python_env::PyEnv;

#[derive(Serialize)]
pub struct ExecOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit: i32,
    pub timed_out: bool,
}

#[tauri::command]
pub async fn run_python_entry(
    project_root: String,
    module: String,
    args: Vec<String>,
    seconds: u64,
) -> Result<ExecOutput, String> {
    let env = PyEnv::new(project_root.clone());
    
    // Ensure environment is ready
    if let Err(e) = env.ensure().await {
        return Err(format!("Environment setup failed: {}", e));
    }

    let mut cmd = Command::new("uv");
    cmd.arg("run")
        .arg("python")
        .arg("-m")
        .arg(&module)
        .args(args)
        .current_dir(&project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn process: {}", e))?;

    // Timeout handling
    let timeout = tokio::time::timeout(Duration::from_secs(seconds), child.wait_with_output());
    let out = match timeout.await {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => return Err(format!("Error running code: {}", e)),
        Err(_) => {
            let _ = child.kill().await;
            return Ok(ExecOutput {
                stdout: "".into(),
                stderr: "Timeout".into(),
                exit: 124,
                timed_out: true,
            });
        }
    };

    Ok(ExecOutput {
        stdout: String::from_utf8_lossy(&out.stdout).into(),
        stderr: String::from_utf8_lossy(&out.stderr).into(),
        exit: out.status.code().unwrap_or(1),
        timed_out: false,
    })
}
