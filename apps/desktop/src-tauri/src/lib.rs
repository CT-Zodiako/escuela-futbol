mod sync;

use tauri::Manager;

#[tauri::command]
fn print_receipt(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|error| error.to_string())
}

/// One-time migration: clear the WebView browsing data left behind by old
/// desktop releases (<= v0.3.6) whose shipped PWA service worker kept serving
/// stale cached HTML/JS even after the updater installed a new binary.
///
/// This must run in `.setup()`, before the main webview loads, because the
/// frontend cleanup in `apps/web/src/main.tsx` executes too late: the old
/// service worker has already served the old bundle by the time it runs.
///
/// The clear is guarded by a marker file so WebView storage is only wiped
/// once; it never touches the SQLite database files in this directory.
fn clear_stale_frontend_cache_once(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    const MARKER_FILE_NAME: &str = "frontend-cache-cleared-v0.3.7";

    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;
    let marker_path = app_data_dir.join(MARKER_FILE_NAME);
    if marker_path.exists() {
        return Ok(());
    }

    let window = app
        .get_webview_window("main")
        .ok_or("main webview window is unavailable; cannot clear the stale frontend cache before first load")?;
    window.clear_all_browsing_data()?;

    std::fs::write(&marker_path, "stale PWA service worker/cache cleared once at startup\n")?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            clear_stale_frontend_cache_once(app)?;
            Ok(())
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            print_receipt,
            sync::initialize_local,
            sync::backup_local_data,
            sync::export_database_backup,
            sync::replace_snapshot,
            sync::local_sync_status,
            sync::list_local_trainers,
            sync::enqueue_trainer,
            sync::list_pending_trainers,
            sync::acknowledge_trainer,
            sync::list_local_students,
            sync::list_local_payments,
            sync::enqueue_payment,
            sync::list_pending_payments,
            sync::acknowledge_payment,
            sync::enqueue_student,
            sync::list_pending_students,
            sync::acknowledge_student,
            sync::local_setup_status,
            sync::create_first_admin,
            sync::login_local_admin,
            sync::logout_local_admin,
            sync::update_local_payment,
            sync::update_local_student,
            sync::set_local_student_status,
            sync::delete_local_student,
            sync::local_payment_summary,
            sync::local_pending_report,
            sync::export_local_payments,
            sync::export_payment_records,
            sync::local_payment_general_report,
            sync::export_local_general_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running Escuela Futbol desktop application");
}
