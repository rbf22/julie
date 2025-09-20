#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod python_env;
mod runner;

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      runner::run_python_entry
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
