use std::sync::Mutex;
use std::io::Write;
use tauri::{Emitter, Manager};

fn debug_log(msg: &str) {
    eprintln!("{}", msg);
    if let Some(home) = std::env::var_os("HOME") {
        let log_path = std::path::Path::new(&home).join(".context-towel-debug.log");
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&log_path) {
            let _ = writeln!(f, "{}", msg);
        }
    }
}

/// Holds a file path from RunEvent::Opened that arrived before the frontend
/// was ready to listen. The frontend drains this on mount via get_pending_file.
struct PendingFile(Mutex<Option<String>>);

#[tauri::command]
fn get_pending_file(state: tauri::State<'_, PendingFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn open_file_picker() -> Option<String> {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSOpenPanel;

    let mtm = unsafe { MainThreadMarker::new_unchecked() };
    let panel = NSOpenPanel::openPanel(mtm);

    panel.setCanChooseFiles(true);
    panel.setCanChooseDirectories(false);
    panel.setAllowsMultipleSelection(false);
    panel.setShowsHiddenFiles(true);
    panel.setTreatsFilePackagesAsDirectories(true);

    let response = panel.runModal();
    if response == 1 {
        panel
            .URL()
            .and_then(|url| url.path())
            .map(|p| p.to_string())
    } else {
        None
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn open_directory_picker() -> Option<String> {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSOpenPanel;

    let mtm = unsafe { MainThreadMarker::new_unchecked() };
    let panel = NSOpenPanel::openPanel(mtm);

    panel.setCanChooseFiles(false);
    panel.setCanChooseDirectories(true);
    panel.setAllowsMultipleSelection(false);
    panel.setShowsHiddenFiles(true);
    panel.setTreatsFilePackagesAsDirectories(true);

    let response = panel.runModal();
    if response == 1 {
        panel
            .URL()
            .and_then(|url| url.path())
            .map(|p| p.to_string())
    } else {
        None
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn open_file_picker() -> Option<String> {
    None
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn open_directory_picker() -> Option<String> {
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PendingFile(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            open_file_picker,
            open_directory_picker,
            get_pending_file,
        ])
        .setup(|app| {
            debug_log("[context-towel] App starting up");
            let _main_window = app
                .get_webview_window("main")
                .expect("main window not found");

            #[cfg(debug_assertions)]
            _main_window.open_devtools();

            #[cfg(not(target_os = "macos"))]
            {
                let args: Vec<String> = std::env::args().collect();
                if args.len() > 1 {
                    let path = &args[1];
                    if path.ends_with(".md") || path.ends_with(".markdown") {
                        let _ = _main_window.emit("file-opened", path.clone());
                    }
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                debug_log(&format!("[context-towel] RunEvent::Opened with {} urls", urls.len()));
                for url in urls {
                    debug_log(&format!("[context-towel] URL: {}", url));
                    if let Ok(path) = url.to_file_path() {
                        if let Some(ext) = path.extension() {
                            let ext_str = ext.to_string_lossy().to_lowercase();
                            if ext_str == "md" || ext_str == "markdown" {
                                let path_str = path.to_string_lossy().to_string();
                                debug_log(&format!("[context-towel] Opening file: {}", path_str));
                                // Store for frontend to pick up on mount (cold start)
                                if let Some(state) = app.try_state::<PendingFile>() {
                                    *state.0.lock().unwrap() = Some(path_str.clone());
                                }
                                // Also emit for hot path (app already running)
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.emit("file-opened", path_str);
                                }
                            }
                        }
                    }
                }
            }
        });
}
