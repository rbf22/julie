use std::{path::PathBuf, process::Stdio};
use tokio::process::Command;
use anyhow::{anyhow, Result};

pub struct PyEnv {
    pub root: PathBuf, // Root of the Python project
}

impl PyEnv {
    /// Create a new PyEnv manager for a given project root
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    /// Ensure that uv is installed and sync the environment
    pub async fn ensure(&self) -> Result<()> {
        // 1. Verify uv is installed
        let status = Command::new("uv")
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await?;

        if !status.success() {
            return Err(anyhow!(
                "`uv` not found. Please install uv (https://github.com/astral-sh/uv)."
            ));
        }

        // 2. Make sure we have a pyproject.toml
        let pyproject_path = self.root.join("pyproject.toml");
        if !pyproject_path.exists() {
            let default_toml = include_str!("pyproject.minimal.toml");
            tokio::fs::write(&pyproject_path, default_toml).await?;
        }

        // 3. Sync dependencies
        let sync_status = Command::new("uv")
            .args(["sync", "--dev"])
            .current_dir(&self.root)
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .status()
            .await?;

        if !sync_status.success() {
            return Err(anyhow!("`uv sync` failed"));
        }

        Ok(())
    }

    /// Run a Python command inside the managed environment
    pub async fn run(&self, args: &[&str]) -> Result<i32> {
        let status = Command::new("uv")
            .args(["run"])
            .args(args)
            .current_dir(&self.root)
            .status()
            .await?;

        Ok(status.code().unwrap_or(1))
    }
}
