mod sync;

#[tauri::command]
fn print_receipt(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            print_receipt,
            sync::initialize_local,
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
            sync::set_local_student_status,
            sync::local_payment_summary,
            sync::local_pending_report,
            sync::export_local_payments,
            sync::local_payment_general_report,
            sync::export_local_general_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running Escuela Futbol desktop application");
}
