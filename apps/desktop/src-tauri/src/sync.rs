use hmac::{Hmac, Mac};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tauri::Manager;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trainer {
    id: String,
    name: String,
    #[serde(default)]
    client_mutation_id: Option<String>,
    #[serde(default)]
    sync_status: Option<String>,
}

fn merge_trainer_outbox(conn: &Connection) -> Result<()> {
    conn.execute("INSERT INTO trainers(id, name, payload)
        SELECT json_extract(o.payload, '$.id'), json_extract(o.payload, '$.name'), o.payload
        FROM trainer_outbox o WHERE NOT EXISTS (
            SELECT 1 FROM trainers t WHERE t.id = json_extract(o.payload, '$.id')
            OR json_extract(t.payload, '$.clientMutationId') = o.client_mutation_id)", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn read_trainers(conn: &Connection, pending: bool) -> Result<Vec<Trainer>> {
    let sql = if pending {
        "SELECT payload FROM trainer_outbox WHERE server_id IS NULL ORDER BY rowid"
    } else {
        "SELECT payload FROM trainers ORDER BY name, id"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|row| serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())).collect()
}

fn title_case_name(name: &str) -> String {
    name.split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn enqueue_trainer_local(conn: &mut Connection, mut trainer: Trainer) -> Result<Trainer> {
    if !valid_uuid(&trainer.id) || trainer.id != trainer.id.to_lowercase()
        || trainer.client_mutation_id.as_deref() != Some(trainer.id.as_str())
        || trainer.name.trim().is_empty() {
        return Err("Datos de entrenador inválidos.".into());
    }
    trainer.name = title_case_name(trainer.name.trim());
    // Local-only: the row is final once committed, so there is no pending state.
    trainer.sync_status = None;
    let payload = serde_json::to_string(&trainer).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO trainer_outbox(client_mutation_id, payload) VALUES (?1, ?2)
        ON CONFLICT(client_mutation_id) DO NOTHING", params![trainer.id, payload]).map_err(|e| e.to_string())?;
    merge_trainer_outbox(&tx)?;
    let saved: String = tx.query_row("SELECT payload FROM trainer_outbox WHERE client_mutation_id = ?1",
        [&trainer.id], |row| row.get(0)).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    serde_json::from_str(&saved).map_err(|e| e.to_string())
}

fn acknowledge_trainer_local(conn: &mut Connection, client_mutation_id: &str, mut trainer: Trainer) -> Result<()> {
    if !valid_uuid(client_mutation_id) || trainer.id != client_mutation_id
        || trainer.client_mutation_id.as_deref() != Some(client_mutation_id)
        || trainer.name.trim().is_empty() {
        return Err("Respuesta de sincronización inválida.".into());
    }
    trainer.sync_status = Some("synced".into());
    let payload = serde_json::to_string(&trainer).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let changed = tx.execute("UPDATE trainer_outbox SET payload = ?1, server_id = ?2
        WHERE client_mutation_id = ?3 AND (server_id IS NULL OR server_id = ?2)",
        params![payload, trainer.id, client_mutation_id]).map_err(|e| e.to_string())?;
    if changed != 1 { return Err("Entrenador pendiente no encontrado.".into()); }
    tx.execute("INSERT INTO trainers(id, name, payload) VALUES (?1, ?2, ?3)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, payload = excluded.payload",
        params![trainer.id, trainer.name, payload]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_local_trainers(app: tauri::AppHandle) -> Result<Vec<Trainer>> {
    read_trainers(&open(&app)?, false)
}

#[tauri::command]
pub fn list_pending_trainers(app: tauri::AppHandle) -> Result<Vec<Trainer>> {
    read_trainers(&open(&app)?, true)
}

#[tauri::command]
pub fn enqueue_trainer(app: tauri::AppHandle, trainer: Trainer) -> Result<Trainer> {
    enqueue_trainer_local(&mut open(&app)?, trainer)
}

#[tauri::command]
pub fn acknowledge_trainer(app: tauri::AppHandle, client_mutation_id: String, trainer: Trainer) -> Result<()> {
    acknowledge_trainer_local(&mut open(&app)?, &client_mutation_id, trainer)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Student {
    #[serde(default)]
    trainer_id: Option<String>,
    id: String,
    name: String,
    document: Option<String>,
    phone: Option<String>,
    is_active: bool,
    activation_month: String,
    #[serde(default)]
    client_mutation_id: Option<String>,
    #[serde(default)]
    sync_status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Payment {
    id: String,
    student_id: String,
    receipt_number: Option<i64>,
    payment_date: String,
    amount: i64,
    method: String,
    concept: Option<String>,
    note: Option<String>,
    #[serde(default)]
    client_mutation_id: Option<String>,
    #[serde(default)]
    sync_status: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    #[serde(default)]
    trainers: Vec<Trainer>,
    students: Vec<Student>,
    payments: Vec<Payment>,
    generated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    generated_at: Option<String>,
}

type Result<T> = std::result::Result<T, String>;

/// One-time marker for the v0.2.3 release. Sync failed on some machines, so the
/// first launch of 0.2.3 wipes local-only data once so those PCs start clean.
/// Remote/API data and the administrator (never stored locally) are untouched.
const RESET_0_2_3_MARKER: &str = "reset-local-data-v0.2.3";

fn initialize(conn: &Connection) -> Result<()> {
    conn.busy_timeout(std::time::Duration::from_secs(5)).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS trainers (
            id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS trainer_outbox (
            client_mutation_id TEXT PRIMARY KEY NOT NULL,
            payload TEXT NOT NULL, server_id TEXT);
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY NOT NULL,
            student_id TEXT NOT NULL REFERENCES students(id),
            payment_date TEXT NOT NULL, payload TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS payments_student ON payments(student_id, payment_date);
        CREATE TABLE IF NOT EXISTS sync_state (
            id INTEGER PRIMARY KEY CHECK(id = 1), generated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS payment_outbox (
            client_mutation_id TEXT PRIMARY KEY NOT NULL,
            student_id TEXT NOT NULL, payment_date TEXT NOT NULL,
            payload TEXT NOT NULL, server_id TEXT);
        CREATE TABLE IF NOT EXISTS student_outbox (
            client_mutation_id TEXT PRIMARY KEY NOT NULL,
            payload TEXT NOT NULL, server_id TEXT);
        CREATE TABLE IF NOT EXISTS migration_markers (
            id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS admins (
            id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS admin_sessions (
            token_hash TEXT PRIMARY KEY NOT NULL,
            admin_id TEXT NOT NULL REFERENCES admins(id),
            created_at TEXT NOT NULL);")
        .map_err(|e| e.to_string())?;
    apply_one_time_resets(conn)
}

// Clears local-only tables exactly once per marker. Administrators and their
// sessions are never wiped: admins are local-only now, so the reset must not
// lock the owner out. Schema and markers persist across launches.
fn apply_one_time_resets(conn: &Connection) -> Result<()> {
    let applied: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM migration_markers WHERE id = ?1)",
        [RESET_0_2_3_MARKER], |row| row.get(0)).map_err(|e| e.to_string())?;
    if applied { return Ok(()); }
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute_batch("DELETE FROM payments;
        DELETE FROM students;
        DELETE FROM trainers;
        DELETE FROM trainer_outbox;
        DELETE FROM payment_outbox;
        DELETE FROM student_outbox;
        DELETE FROM sync_state;").map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO migration_markers(id, applied_at) VALUES (?1, datetime('now'))",
        [RESET_0_2_3_MARKER]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

fn open(app: &tauri::AppHandle) -> Result<Connection> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(dir.join("historical.sqlite3")).map_err(|e| e.to_string())?;
    initialize(&conn)?;
    Ok(conn)
}

// Typed payloads preserve receipt/concept fields without exposing SQL to the webview.
fn replace(conn: &mut Connection, snapshot: Snapshot) -> Result<()> {
    if snapshot.generated_at.trim().is_empty() {
        return Err("La instantánea no tiene fecha de sincronización.".into());
    }
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute_batch("DELETE FROM payments; DELETE FROM students;").map_err(|e| e.to_string())?;
    for trainer in snapshot.trainers {
        if !valid_uuid(&trainer.id) || trainer.name.trim().is_empty() {
            return Err("Entrenador inválido.".into());
        }
        let payload = serde_json::to_string(&trainer).map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO trainers(id, name, payload) VALUES (?1, ?2, ?3)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, payload = excluded.payload",
            params![trainer.id, trainer.name, payload]).map_err(|e| e.to_string())?;
    }
    merge_trainer_outbox(&tx)?;
    for student in snapshot.students {
        if student.id.is_empty() || student.name.trim().is_empty() {
            return Err("Estudiante inválido.".into());
        }
        let payload = serde_json::to_string(&student).map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO students(id, name, payload) VALUES (?1, ?2, ?3)",
            params![student.id, student.name, payload]).map_err(|e| e.to_string())?;
    }
    merge_student_outbox(&tx)?;
    for payment in snapshot.payments {
        if payment.id.is_empty() {
            return Err("Pago inválido.".into());
        }
        let payload = serde_json::to_string(&payment).map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO payments(id, student_id, payment_date, payload) VALUES (?1, ?2, ?3, ?4)",
            params![payment.id, payment.student_id, payment.payment_date, payload]).map_err(|e| e.to_string())?;
    }
    tx.execute("INSERT INTO sync_state(id, generated_at) VALUES (1, ?1)
        ON CONFLICT(id) DO UPDATE SET generated_at = excluded.generated_at",
        params![snapshot.generated_at]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn initialize_local(app: tauri::AppHandle) -> Result<()> {
    open(&app).map(|_| ())
}

#[tauri::command]
pub fn replace_snapshot(app: tauri::AppHandle, snapshot: Snapshot) -> Result<()> {
    replace(&mut open(&app)?, snapshot)
}

#[tauri::command]
pub fn local_sync_status(app: tauri::AppHandle) -> Result<SyncStatus> {
    let generated_at = open(&app)?.query_row(
        "SELECT generated_at FROM sync_state WHERE id = 1", [], |row| row.get(0))
        .optional().map_err(|e| e.to_string())?;
    Ok(SyncStatus { generated_at })
}

#[tauri::command]
pub fn list_local_students(app: tauri::AppHandle) -> Result<Vec<Student>> {
    local_students(&open(&app)?)
}

fn local_students(conn: &Connection) -> Result<Vec<Student>> {
    let mut stmt = conn.prepare("SELECT payload FROM students ORDER BY name, id").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|row| serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())).collect()
}

// Retain acknowledged rows as a bridge across stale snapshots. Server rows win;
// the UUID identity is unchanged, so existing payment references remain valid.
fn merge_student_outbox(conn: &Connection) -> Result<()> {
    conn.execute("INSERT INTO students(id, name, payload)
        SELECT json_extract(o.payload, '$.id'), json_extract(o.payload, '$.name'), o.payload
        FROM student_outbox o WHERE NOT EXISTS (
            SELECT 1 FROM students s WHERE s.id = json_extract(o.payload, '$.id')
            OR json_extract(s.payload, '$.clientMutationId') = o.client_mutation_id)", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn enqueue_student_local(conn: &mut Connection, mut student: Student) -> Result<Student> {
    if !valid_uuid(&student.id) || student.id != student.id.to_lowercase()
        || student.client_mutation_id.as_deref() != Some(student.id.as_str())
        || student.name.trim().is_empty()
        || student.document.as_deref().map_or(true, |v| v.trim().is_empty())
        || student.phone.as_deref().map_or(true, |v| v.trim().is_empty())
        || !valid_date(&format!("{}-01", student.activation_month)) {
        return Err("Datos de estudiante inválidos.".into());
    }
    let trainer_id = student.trainer_id.as_deref().ok_or("Seleccioná un entrenador.")?;
    let exists: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM trainers WHERE id = ?1)",
        [trainer_id], |row| row.get(0)).map_err(|e| e.to_string())?;
    if !valid_uuid(trainer_id) || !exists { return Err("Entrenador no encontrado.".into()); }
    student.name = student.name.trim().into();
    // New enqueues require document and phone; only trim them here.
    student.document = student.document.map(|v| v.trim().to_string());
    student.phone = student.phone.map(|v| v.trim().to_string());
    student.is_active = true;
    // Local-only: the row is final once committed, so there is no pending state.
    student.sync_status = None;
    let payload = serde_json::to_string(&student).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO student_outbox(client_mutation_id, payload) VALUES (?1, ?2)
        ON CONFLICT(client_mutation_id) DO NOTHING", params![student.id, payload])
        .map_err(|e| e.to_string())?;
    merge_student_outbox(&tx)?;
    let saved: String = tx.query_row("SELECT payload FROM student_outbox WHERE client_mutation_id = ?1",
        [&student.id], |row| row.get(0)).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    serde_json::from_str(&saved).map_err(|e| e.to_string())
}

fn pending_students(conn: &Connection) -> Result<Vec<Student>> {
    let mut stmt = conn.prepare("SELECT payload FROM student_outbox WHERE server_id IS NULL ORDER BY rowid")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|row| serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())).collect()
}

fn acknowledge_student_local(conn: &mut Connection, client_mutation_id: &str, mut student: Student) -> Result<()> {
    if !valid_uuid(client_mutation_id) || student.id != client_mutation_id
        || student.client_mutation_id.as_deref() != Some(client_mutation_id)
        || student.name.trim().is_empty() {
        return Err("Respuesta de sincronización inválida.".into());
    }
    student.sync_status = Some("synced".into());
    let payload = serde_json::to_string(&student).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let changed = tx.execute("UPDATE student_outbox SET payload = ?1, server_id = ?2
        WHERE client_mutation_id = ?3 AND (server_id IS NULL OR server_id = ?2)",
        params![payload, student.id, client_mutation_id]).map_err(|e| e.to_string())?;
    if changed != 1 { return Err("Estudiante pendiente no encontrado.".into()); }
    tx.execute("INSERT INTO students(id, name, payload) VALUES (?1, ?2, ?3)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, payload = excluded.payload",
        params![student.id, student.name, payload]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn enqueue_student(app: tauri::AppHandle, student: Student) -> Result<Student> {
    enqueue_student_local(&mut open(&app)?, student)
}

#[tauri::command]
pub fn list_pending_students(app: tauri::AppHandle) -> Result<Vec<Student>> {
    pending_students(&open(&app)?)
}

#[tauri::command]
pub fn acknowledge_student(app: tauri::AppHandle, client_mutation_id: String, student: Student) -> Result<()> {
    acknowledge_student_local(&mut open(&app)?, &client_mutation_id, student)
}

#[tauri::command]
pub fn list_local_payments(app: tauri::AppHandle, student_id: String) -> Result<Vec<Payment>> {
    local_payments(&open(&app)?, &student_id)
}

fn local_payments(conn: &Connection, student_id: &str) -> Result<Vec<Payment>> {
    // Keep acknowledged payloads as a bridge until snapshots include them. Even a
    // stale snapshot cannot erase a locally recorded payment or show it twice.
    let mut stmt = conn.prepare("SELECT payload FROM (
        SELECT payload, payment_date, id FROM payments
        WHERE student_id = ?1 AND NOT EXISTS (
            SELECT 1 FROM payment_outbox o WHERE o.server_id IS NULL
            AND o.client_mutation_id = json_extract(payments.payload, '$.clientMutationId'))
        UNION ALL
        SELECT payload, payment_date, client_mutation_id AS id FROM payment_outbox
        WHERE student_id = ?1 AND (server_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM payments p WHERE p.id = payment_outbox.server_id))
        ) ORDER BY payment_date DESC, id")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([student_id], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|row| serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())).collect()
}

fn valid_uuid(value: &str) -> bool {
    value.len() == 36 && value.bytes().enumerate().all(|(i, c)| {
        if [8, 13, 18, 23].contains(&i) { c == b'-' } else { c.is_ascii_hexdigit() }
    })
}

fn days_in_month(year: u32, month: u32) -> Option<u32> {
    match month {
        4 | 6 | 9 | 11 => Some(30),
        2 if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) => Some(29),
        2 => Some(28),
        1 | 3 | 5 | 7 | 8 | 10 | 12 => Some(31),
        _ => None,
    }
}

fn valid_date(value: &str) -> bool {
    let parts: Vec<_> = value.split('-').collect();
    if parts.len() != 3 || parts[0].len() != 4 || parts[1].len() != 2 || parts[2].len() != 2 {
        return false;
    }
    let (Ok(year), Ok(month), Ok(day)) = (
        parts[0].parse::<u32>(), parts[1].parse::<u32>(), parts[2].parse::<u32>()
    ) else { return false; };
    year > 0 && day > 0 && day <= days_in_month(year, month).unwrap_or(0)
}

// Local payment payloads store date-only strings ("2026-02-01") while snapshot
// rows carry server timestamps. Reports compare calendar days, so both formats
// reduce to their first 10 characters.
fn date_prefix(value: &str) -> Option<&str> {
    let date = value.get(..10)?;
    valid_date(date).then_some(date)
}

fn valid_month(value: &str) -> bool {
    value.len() == 7 && valid_date(&format!("{value}-01"))
}

// Gregorian calendar conversion (Howard Hinnant's civil_from_days) so the
// reactivation rule can stamp the current month without chrono.
fn current_month() -> String {
    let days = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() / 86_400)
        .unwrap_or(0) as i64;
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let y = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * y + y / 4 - y / 100);
    let mp = (5 * doy + 2) / 153;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = y + era * 400 + if month <= 2 { 1 } else { 0 };
    format!("{year:04}-{month:02}")
}

fn enqueue(conn: &Connection, mut payment: Payment) -> Result<Payment> {
    if !valid_uuid(&payment.id) || payment.client_mutation_id.as_deref() != Some(payment.id.as_str())
        || !valid_uuid(&payment.student_id) || !valid_date(&payment.payment_date)
        || payment.amount <= 0 || payment.amount > i32::MAX as i64
        || payment.method.trim().is_empty()
        || payment.concept.as_deref().map_or(true, |v| v.trim().is_empty() || v.chars().count() > 160)
        || payment.note.as_deref().map_or(false, |v| v.chars().count() > 280) {
        return Err("Datos de pago inválidos.".into());
    }
    let exists: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM students WHERE id = ?1)",
        [&payment.student_id], |row| row.get(0)).map_err(|e| e.to_string())?;
    if !exists { return Err("Estudiante no encontrado en los datos locales.".into()); }
    payment.receipt_number = None;
    // Local-only: the row is final once committed, so there is no pending state.
    payment.sync_status = None;
    let payload = serde_json::to_string(&payment).map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO payment_outbox(client_mutation_id, student_id, payment_date, payload)
        VALUES (?1, ?2, ?3, ?4) ON CONFLICT(client_mutation_id) DO NOTHING",
        params![payment.id, payment.student_id, payment.payment_date, payload]).map_err(|e| e.to_string())?;
    let saved: String = conn.query_row("SELECT payload FROM payment_outbox WHERE client_mutation_id = ?1",
        [&payment.id], |row| row.get(0)).map_err(|e| e.to_string())?;
    serde_json::from_str(&saved).map_err(|e| e.to_string())
}

fn pending(conn: &Connection) -> Result<Vec<Payment>> {
    let mut stmt = conn.prepare("SELECT payload FROM payment_outbox WHERE server_id IS NULL ORDER BY rowid")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|row| serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())).collect()
}

fn acknowledge(conn: &Connection, client_mutation_id: &str, mut payment: Payment) -> Result<()> {
    if payment.client_mutation_id.as_deref() != Some(client_mutation_id)
        || !valid_uuid(&payment.id) || payment.receipt_number.unwrap_or(0) <= 0 {
        return Err("Respuesta de sincronización inválida.".into());
    }
    payment.sync_status = Some("synced".into());
    let payload = serde_json::to_string(&payment).map_err(|e| e.to_string())?;
    let changed = conn.execute("UPDATE payment_outbox SET payload = ?1, server_id = ?2
        WHERE client_mutation_id = ?3 AND student_id = ?4 AND (server_id IS NULL OR server_id = ?2)",
        params![payload, payment.id, client_mutation_id, payment.student_id]).map_err(|e| e.to_string())?;
    if changed != 1 { return Err("Pago pendiente no encontrado.".into()); }
    Ok(())
}

#[tauri::command]
pub fn enqueue_payment(app: tauri::AppHandle, payment: Payment) -> Result<Payment> {
    enqueue(&open(&app)?, payment)
}

#[tauri::command]
pub fn list_pending_payments(app: tauri::AppHandle) -> Result<Vec<Payment>> {
    pending(&open(&app)?)
}

#[tauri::command]
pub fn acknowledge_payment(app: tauri::AppHandle, client_mutation_id: String, payment: Payment) -> Result<()> {
    acknowledge(&open(&app)?, &client_mutation_id, payment)
}

// Local-only data operations. The desktop SQLite database is the source of
// truth, so edits, status changes, and reports never leave the machine.

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentUpdate {
    concept: String,
    payment_date: String,
    amount: i64,
    method: String,
    #[serde(default)]
    note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaidStudentReport {
    student_id: String,
    name: String,
    total_paid: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentSummaryReport {
    total_collected: i64,
    students_paid_count: usize,
    payments_count: usize,
    paid_students: Vec<PaidStudentReport>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingStudentReport {
    student_id: String,
    name: String,
    status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingReport {
    month: String,
    paid_count: usize,
    pending_count: usize,
    students: Vec<PendingStudentReport>,
}

fn validate_payment_update(update: &PaymentUpdate) -> Result<()> {
    if !valid_date(&update.payment_date)
        || update.amount <= 0 || update.amount > i32::MAX as i64
        || update.method.trim().is_empty()
        || update.concept.trim().is_empty() || update.concept.chars().count() > 160
        || update.note.as_deref().map_or(false, |v| v.chars().count() > 280) {
        return Err("Datos de pago inválidos.".into());
    }
    Ok(())
}

fn apply_payment_update(payment: &mut Payment, update: &PaymentUpdate) {
    payment.concept = Some(update.concept.trim().to_string());
    payment.payment_date = update.payment_date.clone();
    payment.amount = update.amount;
    payment.method = update.method.trim().to_string();
    payment.note = update.note.as_deref().map(|v| v.trim().to_string());
}

// Snapshot (server-synced) rows live in `payments`; pending offline rows live
// in `payment_outbox` keyed by their client mutation id. Both are editable so
// corrections work before and after synchronization. A pending offline student
// or acknowledged bridge row can exist in both tables, so every match updates.
fn update_payment_local(conn: &Connection, id: &str, update: &PaymentUpdate) -> Result<Payment> {
    validate_payment_update(update)?;
    let mut result: Option<Payment> = None;
    let stored: Option<String> = conn.query_row("SELECT payload FROM payments WHERE id = ?1",
        [id], |row| row.get(0)).optional().map_err(|e| e.to_string())?;
    if let Some(stored) = stored {
        let mut payment: Payment = serde_json::from_str(&stored).map_err(|e| e.to_string())?;
        apply_payment_update(&mut payment, update);
        let payload = serde_json::to_string(&payment).map_err(|e| e.to_string())?;
        conn.execute("UPDATE payments SET payload = ?1, payment_date = ?2 WHERE id = ?3",
            params![payload, payment.payment_date, id]).map_err(|e| e.to_string())?;
        result = Some(payment);
    }
    let stored: Option<String> = conn.query_row("SELECT payload FROM payment_outbox WHERE client_mutation_id = ?1",
        [id], |row| row.get(0)).optional().map_err(|e| e.to_string())?;
    if let Some(stored) = stored {
        let mut payment: Payment = serde_json::from_str(&stored).map_err(|e| e.to_string())?;
        apply_payment_update(&mut payment, update);
        let payload = serde_json::to_string(&payment).map_err(|e| e.to_string())?;
        conn.execute("UPDATE payment_outbox SET payload = ?1, payment_date = ?2 WHERE client_mutation_id = ?3",
            params![payload, payment.payment_date, id]).map_err(|e| e.to_string())?;
        if result.is_none() { result = Some(payment); }
    }
    result.ok_or_else(|| "Pago no encontrado.".into())
}

fn apply_student_status(student: &mut Student, is_active: bool) {
    // Reactivating a student restarts billing at the current month, mirroring
    // the API rule; deactivation keeps the original activation month.
    if is_active && !student.is_active {
        student.activation_month = current_month();
    }
    student.is_active = is_active;
}

fn set_student_status_local(conn: &Connection, id: &str, is_active: bool) -> Result<Student> {
    let mut result: Option<Student> = None;
    let stored: Option<String> = conn.query_row("SELECT payload FROM students WHERE id = ?1",
        [id], |row| row.get(0)).optional().map_err(|e| e.to_string())?;
    if let Some(stored) = stored {
        let mut student: Student = serde_json::from_str(&stored).map_err(|e| e.to_string())?;
        apply_student_status(&mut student, is_active);
        let payload = serde_json::to_string(&student).map_err(|e| e.to_string())?;
        conn.execute("UPDATE students SET name = ?1, payload = ?2 WHERE id = ?3",
            params![student.name, payload, id]).map_err(|e| e.to_string())?;
        result = Some(student);
    }
    let stored: Option<String> = conn.query_row("SELECT payload FROM student_outbox WHERE client_mutation_id = ?1",
        [id], |row| row.get(0)).optional().map_err(|e| e.to_string())?;
    if let Some(stored) = stored {
        let mut student: Student = serde_json::from_str(&stored).map_err(|e| e.to_string())?;
        apply_student_status(&mut student, is_active);
        let payload = serde_json::to_string(&student).map_err(|e| e.to_string())?;
        conn.execute("UPDATE student_outbox SET payload = ?1 WHERE client_mutation_id = ?2",
            params![payload, id]).map_err(|e| e.to_string())?;
        if result.is_none() { result = Some(student); }
    }
    result.ok_or_else(|| "Estudiante no encontrado.".into())
}

// Every payment visible to the UI: snapshot rows that no pending offline edit
// shadows, plus outbox rows (pending, or acknowledged rows a stale snapshot has
// not caught up with). Acknowledged rows already present in `payments` are
// excluded so reports never double-count.
fn all_visible_payments(conn: &Connection) -> Result<Vec<Payment>> {
    let mut stmt = conn.prepare("SELECT payload FROM (
        SELECT payload, payment_date, id FROM payments WHERE NOT EXISTS (
            SELECT 1 FROM payment_outbox o WHERE o.server_id IS NULL
            AND o.client_mutation_id = json_extract(payments.payload, '$.clientMutationId'))
        UNION ALL
        SELECT payload, payment_date, client_mutation_id AS id FROM payment_outbox
        WHERE server_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM payments p WHERE p.id = payment_outbox.server_id)
        ) ORDER BY payment_date, id").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|row| serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())).collect()
}

fn validate_range(from: &str, to: &str, trainer_id: Option<&str>) -> Result<()> {
    if !valid_date(from) || !valid_date(to) || from > to {
        return Err("Rango de fechas inválido.".into());
    }
    if trainer_id.map_or(false, |id| !valid_uuid(id)) {
        return Err("Entrenador inválido.".into());
    }
    Ok(())
}

fn summary_report_local(conn: &Connection, from: &str, to: &str, trainer_id: Option<&str>) -> Result<PaymentSummaryReport> {
    validate_range(from, to, trainer_id)?;
    let students = local_students(conn)?;
    let by_id: HashMap<&str, &Student> = students.iter().map(|student| (student.id.as_str(), student)).collect();
    let mut total_collected = 0i64;
    let mut payments_count = 0usize;
    let mut totals: HashMap<String, (String, i64)> = HashMap::new();
    for payment in all_visible_payments(conn)? {
        let Some(date) = date_prefix(&payment.payment_date) else { continue; };
        if date < from || date > to { continue; }
        let Some(student) = by_id.get(payment.student_id.as_str()) else { continue; };
        if trainer_id.map_or(false, |id| student.trainer_id.as_deref() != Some(id)) { continue; }
        total_collected += payment.amount;
        payments_count += 1;
        let entry = totals.entry(payment.student_id.clone())
            .or_insert_with(|| (student.name.clone(), 0));
        entry.1 += payment.amount;
    }
    let mut paid_students: Vec<PaidStudentReport> = totals.into_iter()
        .map(|(student_id, (name, total_paid))| PaidStudentReport { student_id, name, total_paid })
        .collect();
    paid_students.sort_by(|a, b| a.name.cmp(&b.name).then_with(|| a.student_id.cmp(&b.student_id)));
    let students_paid_count = paid_students.len();
    Ok(PaymentSummaryReport { total_collected, students_paid_count, payments_count, paid_students })
}

fn pending_report_local(conn: &Connection, month: &str) -> Result<PendingReport> {
    if !valid_month(month) {
        return Err("Mes inválido.".into());
    }
    let year: u32 = month[..4].parse().map_err(|_| "Mes inválido.".to_string())?;
    let month_number: u32 = month[5..7].parse().map_err(|_| "Mes inválido.".to_string())?;
    let last_day = days_in_month(year, month_number).ok_or("Mes inválido.")?;
    let range_start = format!("{month}-01");
    let range_end = format!("{month}-{last_day:02}");
    let paid_ids: std::collections::HashSet<String> = all_visible_payments(conn)?.into_iter()
        .filter_map(|payment| {
            let date = date_prefix(&payment.payment_date)?;
            (date >= range_start.as_str() && date <= range_end.as_str())
                .then_some(payment.student_id)
        })
        .collect();
    let mut rows: Vec<PendingStudentReport> = local_students(conn)?.into_iter()
        .filter(|student| student.is_active && student.activation_month.as_str() <= month)
        .map(|student| {
            let status = if paid_ids.contains(&student.id) { "paid" } else { "pending" };
            PendingStudentReport { student_id: student.id, name: student.name, status: status.into() }
        })
        .collect();
    rows.sort_by(|a, b| a.name.cmp(&b.name).then_with(|| a.student_id.cmp(&b.student_id)));
    let paid_count = rows.iter().filter(|row| row.status == "paid").count();
    Ok(PendingReport {
        month: month.into(),
        paid_count,
        pending_count: rows.len() - paid_count,
        students: rows,
    })
}

fn csv_cell(value: &str) -> String {
    if value.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

// Local-safe replacement for the server XLSX export: the same rows and columns
// as CSV (Excel opens it directly), produced entirely in Rust. The BOM helps
// Excel detect UTF-8 accents.
fn export_payments_local(conn: &Connection, from: &str, to: &str, trainer_id: Option<&str>) -> Result<String> {
    validate_range(from, to, trainer_id)?;
    let students = local_students(conn)?;
    let by_id: HashMap<&str, &Student> = students.iter().map(|student| (student.id.as_str(), student)).collect();
    let mut rows: Vec<(String, String, String, i64, String, String)> = Vec::new();
    for payment in all_visible_payments(conn)? {
        let Some(date) = date_prefix(&payment.payment_date) else { continue; };
        if date < from || date > to { continue; };
        let Some(student) = by_id.get(payment.student_id.as_str()) else { continue; };
        if trainer_id.map_or(false, |id| student.trainer_id.as_deref() != Some(id)) { continue; }
        let formatted_date = format!("{}/{}/{}", &date[8..10], &date[5..7], &date[0..4]);
        let method = if payment.method.trim() == "cash" { "Efectivo".into() } else { payment.method.clone() };
        rows.push((
            student.name.clone(),
            student.document.clone().unwrap_or_default(),
            formatted_date,
            payment.amount,
            method,
            payment.note.clone().unwrap_or_default(),
        ));
    }
    rows.sort_by(|a, b| a.2.cmp(&b.2).then_with(|| a.0.cmp(&b.0)));
    let mut csv = String::from("\u{FEFF}Estudiante,Documento,Fecha de pago,Valor,Método,Observación\n");
    for (name, document, date, amount, method, note) in rows {
        csv.push_str(&format!("{},{},{},{},{},{}\n",
            csv_cell(&name), csv_cell(&document), date, amount, csv_cell(&method), csv_cell(&note)));
    }
    Ok(csv)
}

#[tauri::command]
pub fn update_local_payment(app: tauri::AppHandle, id: String, update: PaymentUpdate) -> Result<Payment> {
    update_payment_local(&open(&app)?, &id, &update)
}

#[tauri::command]
pub fn set_local_student_status(app: tauri::AppHandle, id: String, is_active: bool) -> Result<Student> {
    set_student_status_local(&open(&app)?, &id, is_active)
}

#[tauri::command]
pub fn local_payment_summary(app: tauri::AppHandle, from: String, to: String, trainer_id: Option<String>) -> Result<PaymentSummaryReport> {
    summary_report_local(&open(&app)?, &from, &to, trainer_id.as_deref())
}

#[tauri::command]
pub fn local_pending_report(app: tauri::AppHandle, month: String) -> Result<PendingReport> {
    pending_report_local(&open(&app)?, &month)
}

#[tauri::command]
pub fn export_local_payments(app: tauri::AppHandle, from: String, to: String, trainer_id: Option<String>) -> Result<String> {
    export_payments_local(&open(&app)?, &from, &to, trainer_id.as_deref())
}

// Local-only administrator accounts. SQLite is the source of truth for desktop
// auth; passwords are stored as PBKDF2-HMAC-SHA256 with a per-admin random
// salt and are never included in error messages.
const PBKDF2_ITERATIONS: u32 = 210_000;
const SALT_LEN: usize = 16;
const KEY_LEN: usize = 32;
const TOKEN_LEN: usize = 32;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    needs_setup: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminSession {
    token: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewAdmin {
    name: String,
    email: String,
    password: String,
}

fn pbkdf2_key(password: &[u8], salt: &[u8], iterations: u32) -> [u8; KEY_LEN] {
    let base = HmacSha256::new_from_slice(password).expect("HMAC accepts keys of any size");
    let mut first = base.clone();
    first.update(salt);
    first.update(&1u32.to_be_bytes());
    let mut block: [u8; KEY_LEN] = first.finalize().into_bytes().into();
    let mut result = block;
    for _ in 1..iterations {
        let mut mac = base.clone();
        mac.update(&block);
        block = mac.finalize().into_bytes().into();
        for i in 0..KEY_LEN {
            result[i] ^= block[i];
        }
    }
    result
}

fn hashes_equal(expected: &[u8; KEY_LEN], actual: &[u8; KEY_LEN]) -> bool {
    expected.iter().zip(actual.iter()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn from_hex(value: &str) -> Option<Vec<u8>> {
    if value.len() % 2 != 0 || !value.bytes().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    (0..value.len() / 2)
        .map(|i| u8::from_str_radix(&value[2 * i..2 * i + 2], 16).ok())
        .collect()
}

fn random_bytes(len: usize) -> Result<Vec<u8>> {
    let mut bytes = vec![0u8; len];
    getrandom::getrandom(&mut bytes).map_err(|e| e.to_string())?;
    Ok(bytes)
}

fn hash_password(password: &str) -> Result<String> {
    let salt = random_bytes(SALT_LEN)?;
    let key = pbkdf2_key(password.as_bytes(), &salt, PBKDF2_ITERATIONS);
    Ok(format!("pbkdf2${PBKDF2_ITERATIONS}${}${}", to_hex(&salt), to_hex(&key)))
}

// Verifies a password against the stored envelope. Runs the same derivation for
// unknown accounts so response times do not reveal whether an email exists.
fn verify_password(password: &str, stored: Option<&str>) -> bool {
    let parsed = stored.and_then(|value| {
        let parts: Vec<&str> = value.split('$').collect();
        match parts.as_slice() {
            ["pbkdf2", iterations, salt, hash] => {
                iterations.parse::<u32>().ok()?;
                Some((*salt, *hash))
            }
            _ => None,
        }
    });
    let (salt, expected) = match parsed {
        Some((salt, hash)) => match (from_hex(salt), from_hex(hash)) {
            (Some(salt), Some(hash)) if salt.len() == SALT_LEN && hash.len() == KEY_LEN => (salt, hash),
            _ => return false,
        },
        None => (random_bytes(SALT_LEN).unwrap_or_default(), vec![0u8; KEY_LEN]),
    };
    let key = pbkdf2_key(password.as_bytes(), &salt, PBKDF2_ITERATIONS);
    let expected: [u8; KEY_LEN] = expected.as_slice().try_into().unwrap_or([0u8; KEY_LEN]);
    hashes_equal(&expected, &key)
}

fn create_session(conn: &Connection, admin_id: &str) -> Result<AdminSession> {
    let token = to_hex(&random_bytes(TOKEN_LEN)?);
    let token_hash = to_hex(&Sha256::digest(token.as_bytes()));
    conn.execute("INSERT INTO admin_sessions(token_hash, admin_id, created_at) VALUES (?1, ?2, datetime('now'))",
        params![token_hash, admin_id]).map_err(|e| e.to_string())?;
    Ok(AdminSession { token })
}

fn valid_email(email: &str) -> bool {
    if email.is_empty() || email.len() > 254 || email.chars().any(char::is_whitespace) {
        return false;
    }
    let Some((local, domain)) = email.split_once('@') else { return false };
    !local.is_empty() && !domain.is_empty() && !domain.starts_with('.') && !domain.ends_with('.')
        && domain.contains('.')
}

fn valid_password(password: &str) -> bool {
    password.chars().count() >= 8 && password.chars().count() <= 128
}

fn admin_count(conn: &Connection) -> Result<i64> {
    conn.query_row("SELECT count(*) FROM admins", [], |row| row.get(0)).map_err(|e| e.to_string())
}

fn setup_status(conn: &Connection) -> Result<SetupStatus> {
    Ok(SetupStatus { needs_setup: admin_count(conn)? == 0 })
}

fn create_first_admin_local(conn: &mut Connection, admin: NewAdmin) -> Result<AdminSession> {
    let name = admin.name.trim();
    let email = admin.email.trim();
    if name.is_empty() || name.chars().count() > 120 {
        return Err("Ingresá un nombre válido.".into());
    }
    if !valid_email(email) {
        return Err("Ingresá un correo válido.".into());
    }
    if !valid_password(&admin.password) {
        return Err("La contraseña debe tener al menos 8 caracteres.".into());
    }
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    if admin_count(&tx)? != 0 {
        return Err("La cuenta administradora ya fue creada. Iniciá sesión.".into());
    }
    let id = uuid_v4();
    let password_hash = hash_password(&admin.password)?;
    tx.execute("INSERT INTO admins(id, name, email, password_hash, created_at) VALUES (?1, ?2, ?3, ?4, datetime('now'))",
        params![id, name, email, password_hash]).map_err(|e| e.to_string())?;
    let session = create_session(&tx, &id)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(session)
}

fn login_local(conn: &Connection, email: &str, password: &str) -> Result<AdminSession> {
    let admin = conn.query_row("SELECT id, password_hash FROM admins WHERE email = ?1 COLLATE NOCASE",
        [email.trim()], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .optional().map_err(|e| e.to_string())?;
    let Some((admin_id, password_hash)) = admin else {
        // Keep timing and messaging identical for unknown accounts.
        verify_password(password, None);
        return Err("Correo o contraseña incorrectos.".into());
    };
    if !verify_password(password, Some(&password_hash)) {
        return Err("Correo o contraseña incorrectos.".into());
    }
    create_session(conn, &admin_id)
}

fn logout_local(conn: &Connection, token: &str) -> Result<()> {
    let token_hash = to_hex(&Sha256::digest(token.as_bytes()));
    conn.execute("DELETE FROM admin_sessions WHERE token_hash = ?1", [token_hash]).map_err(|e| e.to_string())?;
    Ok(())
}

fn uuid_v4() -> String {
    let bytes = random_bytes(16).unwrap_or_default();
    let mut value = to_hex(&bytes);
    value.insert(20, '-');
    value.insert(16, '-');
    value.insert(12, '-');
    value.insert(8, '-');
    // RFC 4122 version 4 + variant bits.
    value.replace_range(14..15, &format!("{:x}", 4 | bytes[6] & 0x0f));
    value.replace_range(19..20, &format!("{:x}", 8 | bytes[8] & 0x03));
    value
}

#[tauri::command]
pub fn local_setup_status(app: tauri::AppHandle) -> Result<SetupStatus> {
    setup_status(&open(&app)?)
}

#[tauri::command]
pub fn create_first_admin(app: tauri::AppHandle, admin: NewAdmin) -> Result<AdminSession> {
    create_first_admin_local(&mut open(&app)?, admin)
}

#[tauri::command]
pub fn login_local_admin(app: tauri::AppHandle, email: String, password: String) -> Result<AdminSession> {
    login_local(&open(&app)?, &email, &password)
}

#[tauri::command]
pub fn logout_local_admin(app: tauri::AppHandle, token: String) -> Result<()> {
    logout_local(&open(&app)?, &token)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot() -> Snapshot {
        serde_json::from_value(serde_json::json!({
            "generatedAt": "2026-01-01T00:00:00Z",
            "students": [{"id":"s", "name":"Student", "document":null, "phone":null,
                "isActive":false, "activationMonth":"2026-01"}],
            "payments": [{"id":"p", "studentId":"s", "receiptNumber":42,
                "paymentDate":"2026-01-01T00:00:00Z", "amount":100, "method":"cash",
                "concept":"Monthly", "note":null}]
        })).unwrap()
    }

    const STUDENT_ID: &str = "b3f1a2c4-1111-4b2b-9c3d-1234567890ab";
    const MUTATION_ID: &str = "c3f1a2c4-1111-4b2b-9c3d-1234567890ab";
    const SERVER_ID: &str = "d3f1a2c4-1111-4b2b-9c3d-1234567890ab";

    fn local_snapshot() -> Snapshot {
        let mut result = snapshot();
        result.students[0].id = STUDENT_ID.into();
        result.payments[0].student_id = STUDENT_ID.into();
        result
    }

    fn local_payment() -> Payment {
        serde_json::from_value(serde_json::json!({
            "id": MUTATION_ID, "clientMutationId": MUTATION_ID,
            "studentId": STUDENT_ID, "receiptNumber": null,
            "paymentDate": "2026-02-01", "amount": 100, "method": "cash",
            "concept": "Mensualidad", "note": null
        })).unwrap()
    }

    fn server_payment() -> Payment {
        let mut payment = local_payment();
        payment.id = SERVER_ID.into();
        payment.receipt_number = Some(43);
        payment.payment_date = "2026-02-01T00:00:00.000Z".into();
        payment
    }

    fn offline_trainer() -> Trainer {
        Trainer { id: SERVER_ID.into(), client_mutation_id: Some(SERVER_ID.into()),
            name: " Trainer ".into(), sync_status: None }
    }

    #[test]
    fn trainer_outbox_is_idempotent_and_bridges_snapshots() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        assert_eq!(enqueue_trainer_local(&mut conn, offline_trainer()).unwrap().name, "Trainer");
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        initialize(&conn).unwrap();
        assert_eq!(read_trainers(&conn, true).unwrap().len(), 1);
        let mut fresh = local_snapshot();
        fresh.trainers.push(offline_trainer());
        replace(&mut conn, fresh).unwrap();
        assert_eq!(read_trainers(&conn, false).unwrap().len(), 1);
        // Local-only create: the merged row carries no pending marker.
        assert_eq!(read_trainers(&conn, false).unwrap()[0].sync_status.as_deref(), None);
        assert!(acknowledge_trainer_local(&mut conn, MUTATION_ID, offline_trainer()).is_err());
        assert_eq!(read_trainers(&conn, true).unwrap().len(), 1);
        for _ in 0..2 { acknowledge_trainer_local(&mut conn, SERVER_ID, offline_trainer()).unwrap(); }
        replace(&mut conn, local_snapshot()).unwrap();
        assert!(read_trainers(&conn, true).unwrap().is_empty());
        assert_eq!(read_trainers(&conn, false).unwrap().len(), 1);
        enqueue_student_local(&mut conn, offline_student()).unwrap();
        assert_eq!(local_students(&conn).unwrap().iter().find(|s| s.id == MUTATION_ID).unwrap().trainer_id.as_deref(), Some(SERVER_ID));
    }

    #[test]
    fn trainer_validation_and_required_assignment_do_not_damage_history() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        replace(&mut conn, local_snapshot()).unwrap();
        assert!(enqueue_student_local(&mut conn, offline_student()).is_err());
        for case in 0..3 {
            let mut trainer = offline_trainer();
            match case { 0 => trainer.name = " ".into(), 1 => trainer.id = "bad".into(), _ => trainer.client_mutation_id = None }
            assert!(enqueue_trainer_local(&mut conn, trainer).is_err());
        }
        assert!(read_trainers(&conn, true).unwrap().is_empty());
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        let mut student = offline_student();
        student.trainer_id = None;
        assert!(enqueue_student_local(&mut conn, student).is_err());
        assert!(pending_students(&conn).unwrap().is_empty());
        assert_eq!(local_students(&conn).unwrap().len(), 1);
        assert_eq!(local_payments(&conn, STUDENT_ID).unwrap()[0].receipt_number, Some(42));
    }

    fn offline_student() -> Student {
        serde_json::from_value(serde_json::json!({
            "id": MUTATION_ID, "clientMutationId": MUTATION_ID,
            "trainerId": SERVER_ID,
            "name": " New student ", "document": " 1030456789 ", "phone": "3001234567",
            "isActive": true, "activationMonth": "2026-02"
        })).unwrap()
    }

    #[test]
    fn students_are_durable_idempotent_and_survive_empty_snapshots() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        let saved = enqueue_student_local(&mut conn, offline_student()).unwrap();
        assert_eq!(saved.name, "New student");
        // Local-only create: durable immediately, with no pending/synced state.
        assert_eq!(saved.sync_status.as_deref(), None);
        let mut retry = offline_student();
        retry.name = "Changed".into();
        assert_eq!(enqueue_student_local(&mut conn, retry).unwrap().name, "New student");
        initialize(&conn).unwrap();
        assert_eq!(pending_students(&conn).unwrap().len(), 1);
        replace(&mut conn, Snapshot { trainers: vec![], students: vec![], payments: vec![], generated_at: "stale".into() }).unwrap();
        assert_eq!(local_students(&conn).unwrap().len(), 1);
        assert_eq!(local_students(&conn).unwrap()[0].id, MUTATION_ID);
        let mut payment = local_payment();
        payment.student_id = MUTATION_ID.into();
        enqueue(&conn, payment).unwrap();
        assert_eq!(pending(&conn).unwrap().len(), 1);
    }

    #[test]
    fn student_acknowledgements_bridge_stale_snapshots_without_duplicates() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        enqueue_student_local(&mut conn, offline_student()).unwrap();
        let mut fresh = local_snapshot();
        let mut server = offline_student();
        server.name = "Server name".into();
        fresh.students.push(server);
        // A lost POST response followed by a snapshot still shows one pending row.
        replace(&mut conn, fresh).unwrap();
        let visible = local_students(&conn).unwrap();
        assert_eq!(visible.len(), 2);
        // Local-only: server and outbox copies surface without a pending marker.
        assert_eq!(visible.iter().find(|s| s.id == MUTATION_ID).unwrap().sync_status.as_deref(), None);
        for _ in 0..2 {
            acknowledge_student_local(&mut conn, MUTATION_ID, offline_student()).unwrap();
        }
        assert!(pending_students(&conn).unwrap().is_empty());
        replace(&mut conn, local_snapshot()).unwrap();
        let visible = local_students(&conn).unwrap();
        assert_eq!(visible.len(), 2);
        assert_eq!(visible.iter().find(|s| s.id == MUTATION_ID).unwrap().sync_status.as_deref(), Some("synced"));
        let mut fresh = local_snapshot();
        let mut edited = offline_student();
        edited.name = "Updated on server".into();
        edited.is_active = false;
        fresh.students.push(edited);
        replace(&mut conn, fresh).unwrap();
        let visible = local_students(&conn).unwrap();
        assert_eq!(visible.len(), 2);
        let student = visible.iter().find(|s| s.id == MUTATION_ID).unwrap();
        assert_eq!(student.name, "Updated on server");
        assert!(!student.is_active);
    }

    #[test]
    fn invalid_students_and_mismatched_acknowledgements_leave_queues_unchanged() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        for case in 0..7 {
            let mut student = offline_student();
            match case {
                0 => student.name = " ".into(),
                1 => student.client_mutation_id = None,
                2 => student.activation_month = "2026-13".into(),
                3 => student.id = "bad".into(),
                4 => student.document = None,
                5 => student.document = Some("   ".into()),
                _ => student.phone = Some(" ".into()),
            }
            assert!(enqueue_student_local(&mut conn, student).is_err());
        }
        assert!(local_students(&conn).unwrap().is_empty());
        assert!(pending_students(&conn).unwrap().is_empty());
        enqueue_student_local(&mut conn, offline_student()).unwrap();
        let saved = enqueue_student_local(&mut conn, offline_student()).unwrap();
        assert_eq!(saved.document.as_deref(), Some("1030456789"));
        assert_eq!(saved.phone.as_deref(), Some("3001234567"));
        assert_eq!(pending_students(&conn).unwrap().len(), 1);
        let mut wrong = offline_student();
        wrong.id = SERVER_ID.into();
        assert!(acknowledge_student_local(&mut conn, MUTATION_ID, wrong).is_err());
        assert!(acknowledge_student_local(&mut conn, SERVER_ID, offline_student()).is_err());
        assert_eq!(pending_students(&conn).unwrap().len(), 1);
    }

    #[test]
    fn student_snapshot_merge_preserves_payment_references_and_rollback() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        enqueue_student_local(&mut conn, offline_student()).unwrap();
        acknowledge_student_local(&mut conn, MUTATION_ID, offline_student()).unwrap();
        let mut snapshot = local_snapshot();
        snapshot.students.clear();
        snapshot.payments[0].student_id = MUTATION_ID.into();
        replace(&mut conn, snapshot).unwrap();
        assert_eq!(local_payments(&conn, MUTATION_ID).unwrap().len(), 1);
        let mut bad = local_snapshot();
        bad.payments[0].student_id = "missing".into();
        assert!(replace(&mut conn, bad).is_err());
        assert_eq!(local_students(&conn).unwrap().len(), 1);
        assert_eq!(local_payments(&conn, MUTATION_ID).unwrap().len(), 1);
        assert!(pending_students(&conn).unwrap().is_empty());
    }

    #[test]
    fn outbox_is_immediately_visible_idempotent_and_preserved_by_initialization() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        replace(&mut conn, local_snapshot()).unwrap();
        let saved = enqueue(&conn, local_payment()).unwrap();
        assert_eq!(saved.sync_status.as_deref(), None);
        assert_eq!(saved.receipt_number, None);
        enqueue(&conn, local_payment()).unwrap();
        initialize(&conn).unwrap(); // additive migration must preserve both tables
        assert_eq!(pending(&conn).unwrap().len(), 1);
        let visible = local_payments(&conn, STUDENT_ID).unwrap();
        assert_eq!(visible.len(), 2);
        assert_eq!(visible[0].id, MUTATION_ID);
        assert_eq!(visible[1].receipt_number, Some(42));
        replace(&mut conn, local_snapshot()).unwrap();
        assert_eq!(pending(&conn).unwrap().len(), 1);
        assert_eq!(local_payments(&conn, STUDENT_ID).unwrap().len(), 2);
    }

    #[test]
    fn local_creates_report_null_sync_status_and_stay_durable() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        let trainer = read_trainers(&conn, false).unwrap().pop().unwrap();
        assert_eq!(trainer.sync_status.as_deref(), None);
        let student = enqueue_student_local(&mut conn, offline_student()).unwrap();
        assert_eq!(student.sync_status.as_deref(), None);
        let mut local = local_payment();
        local.student_id = MUTATION_ID.into();
        let payment = enqueue(&conn, local).unwrap();
        assert_eq!(payment.sync_status.as_deref(), None);
        // Reopening the database (or reinitializing it) must not lose local rows
        // nor turn them into anything pending.
        initialize(&conn).unwrap();
        let visible = local_students(&conn).unwrap();
        assert_eq!(visible.iter().find(|s| s.id == MUTATION_ID).unwrap().sync_status.as_deref(), None);
        let history = local_payments(&conn, MUTATION_ID).unwrap();
        assert_eq!(history.len(), 1);
        assert!(history.iter().all(|payment| payment.sync_status.is_none()));
        let report = summary_report_local(&conn, "2026-01-01", "2026-12-31", None).unwrap();
        assert_eq!(report.payments_count, 1);
        assert_eq!(report.total_collected, 100);
    }

    #[test]
    fn acknowledgement_survives_stale_snapshots_and_prefers_current_server_data() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        replace(&mut conn, local_snapshot()).unwrap();
        enqueue(&conn, local_payment()).unwrap();
        acknowledge(&conn, MUTATION_ID, server_payment()).unwrap();
        acknowledge(&conn, MUTATION_ID, server_payment()).unwrap();
        assert!(pending(&conn).unwrap().is_empty());
        replace(&mut conn, local_snapshot()).unwrap();
        let visible = local_payments(&conn, STUDENT_ID).unwrap();
        assert_eq!(visible.len(), 2);
        assert_eq!(visible[0].id, SERVER_ID);
        assert_eq!(visible[0].receipt_number, Some(43));
        assert_eq!(visible[0].sync_status.as_deref(), Some("synced"));
        let mut fresh = local_snapshot();
        let mut edited = server_payment();
        edited.amount = 200;
        fresh.payments.push(edited);
        replace(&mut conn, fresh).unwrap();
        let visible = local_payments(&conn, STUDENT_ID).unwrap();
        assert_eq!(visible.len(), 2);
        assert_eq!(visible[0].amount, 200);
    }

    #[test]
    fn lost_response_keeps_one_pending_row_even_if_snapshot_contains_payment() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        replace(&mut conn, local_snapshot()).unwrap();
        enqueue(&conn, local_payment()).unwrap();
        let mut fresh = local_snapshot();
        fresh.payments.push(server_payment());
        replace(&mut conn, fresh).unwrap();
        assert_eq!(local_payments(&conn, STUDENT_ID).unwrap().len(), 2);
        assert_eq!(pending(&conn).unwrap()[0].client_mutation_id.as_deref(), Some(MUTATION_ID));
        let mut invalid = server_payment();
        invalid.client_mutation_id = None;
        assert!(acknowledge(&conn, MUTATION_ID, invalid).is_err());
        assert_eq!(pending(&conn).unwrap().len(), 1);
        acknowledge(&conn, MUTATION_ID, server_payment()).unwrap();
        assert!(pending(&conn).unwrap().is_empty());
        assert_eq!(local_payments(&conn, STUDENT_ID).unwrap().len(), 2);
    }

    #[test]
    fn invalid_local_payments_never_enter_outbox() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        assert!(enqueue(&conn, local_payment()).is_err());
        replace(&mut conn, local_snapshot()).unwrap();
        for case in 0..5 {
            let mut payment = local_payment();
            match case {
                0 => payment.amount = 0,
                1 => payment.payment_date = "2026-02-30".into(),
                2 => payment.client_mutation_id = None,
                3 => payment.concept = Some(" ".into()),
                _ => payment.note = Some("x".repeat(281)),
            }
            assert!(enqueue(&conn, payment).is_err());
        }
        assert!(pending(&conn).unwrap().is_empty());
    }

    #[test]
    fn replacement_rolls_back_on_duplicate_or_orphan() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        replace(&mut conn, snapshot()).unwrap();
        for duplicate in [false, true] {
            let mut bad = snapshot();
            bad.generated_at = "changed".into();
            if duplicate {
                bad.students.push(snapshot().students.remove(0));
            } else {
                bad.payments[0].student_id = "missing".into();
            }
            assert!(replace(&mut conn, bad).is_err());
            let date: String = conn.query_row("SELECT generated_at FROM sync_state", [], |r| r.get(0)).unwrap();
            assert_eq!(date, "2026-01-01T00:00:00Z");
            let payload: String = conn.query_row("SELECT payload FROM payments", [], |r| r.get(0)).unwrap();
            let payment: Payment = serde_json::from_str(&payload).unwrap();
            assert_eq!(payment.receipt_number, Some(42));
            assert_eq!(payment.concept.as_deref(), Some("Monthly"));
        }
        replace(&mut conn, Snapshot { trainers: vec![], students: vec![], payments: vec![], generated_at: "empty".into() }).unwrap();
        let count: i64 = conn.query_row("SELECT count(*) FROM students", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);
    }

    fn count_rows(conn: &Connection, table: &str) -> i64 {
        conn.query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0)).unwrap()
    }

    #[test]
    fn release_0_2_3_reset_clears_seeded_local_data_once() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        // Simulate a pre-0.2.3 database: data from the old build, no marker yet.
        conn.execute("DELETE FROM migration_markers", []).unwrap();
        replace(&mut conn, local_snapshot()).unwrap();
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        enqueue_student_local(&mut conn, offline_student()).unwrap();
        enqueue(&conn, local_payment()).unwrap();
        assert!(count_rows(&conn, "payments") > 0);
        assert!(count_rows(&conn, "student_outbox") > 0);
        initialize(&conn).unwrap();
        assert_eq!(count_rows(&conn, "payments"), 0);
        assert_eq!(count_rows(&conn, "students"), 0);
        assert_eq!(count_rows(&conn, "trainers"), 0);
        assert_eq!(count_rows(&conn, "trainer_outbox"), 0);
        assert_eq!(count_rows(&conn, "student_outbox"), 0);
        assert_eq!(count_rows(&conn, "payment_outbox"), 0);
        assert_eq!(count_rows(&conn, "sync_state"), 0);
        assert_eq!(count_rows(&conn, "migration_markers"), 1);
        // Schema survives the reset so new data can be created immediately.
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        assert_eq!(count_rows(&conn, "trainer_outbox"), 1);
    }

    #[test]
    fn release_0_2_3_reset_does_not_repeat_after_new_data() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap(); // first 0.2.3 launch: reset fires and records the marker
        replace(&mut conn, local_snapshot()).unwrap();
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        enqueue(&conn, local_payment()).unwrap();
        initialize(&conn).unwrap(); // later launches must not erase new data
        assert_eq!(local_students(&conn).unwrap().len(), 1);
        assert_eq!(read_trainers(&conn, false).unwrap().len(), 1);
        assert_eq!(local_payments(&conn, STUDENT_ID).unwrap().len(), 2);
        assert_eq!(pending(&conn).unwrap().len(), 1);
        assert_eq!(pending_students(&conn).unwrap().len(), 0);
        assert_eq!(count_rows(&conn, "migration_markers"), 1);
        let generated_at: Option<String> = conn.query_row("SELECT generated_at FROM sync_state WHERE id = 1",
            [], |r| r.get(0)).optional().unwrap();
        assert_eq!(generated_at.as_deref(), Some("2026-01-01T00:00:00Z"));
    }

    fn new_admin() -> NewAdmin {
        NewAdmin { name: " Admin ".into(), email: "Admin@Escuela.LOCAL ".into(), password: "clave-segura-1".into() }
    }

    fn payment_update() -> PaymentUpdate {
        PaymentUpdate { concept: " Mensualidad ".into(), payment_date: "2026-03-15".into(),
            amount: 250, method: " transfer ".into(), note: Some(" ajuste ".into()) }
    }

    #[test]
    fn update_payment_edits_snapshot_rows_and_pending_outbox_rows() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        replace(&mut conn, local_snapshot()).unwrap();
        let updated = update_payment_local(&conn, "p", &payment_update()).unwrap();
        assert_eq!(updated.concept.as_deref(), Some("Mensualidad"));
        assert_eq!(updated.payment_date, "2026-03-15");
        assert_eq!(updated.amount, 250);
        assert_eq!(updated.method, "transfer");
        assert_eq!(updated.note.as_deref(), Some("ajuste"));
        assert_eq!(updated.receipt_number, Some(42));
        // The stored row keeps its index column in sync for date-ordered reads.
        let date: String = conn.query_row("SELECT payment_date FROM payments WHERE id = 'p'", [], |r| r.get(0)).unwrap();
        assert_eq!(date, "2026-03-15");
        // A pending offline payment is editable through its client mutation id.
        enqueue(&conn, local_payment()).unwrap();
        let updated = update_payment_local(&conn, MUTATION_ID, &payment_update()).unwrap();
        assert_eq!(updated.amount, 250);
        assert!(pending(&conn).unwrap()[0].payment_date == "2026-03-15");
        assert_eq!(local_payments(&conn, STUDENT_ID).unwrap()[0].amount, 250);
    }

    #[test]
    fn update_payment_rejects_invalid_data_and_unknown_ids() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        replace(&mut conn, local_snapshot()).unwrap();
        for case in 0..6 {
            let mut update = payment_update();
            match case {
                0 => update.amount = 0,
                1 => update.amount = i32::MAX as i64 + 1,
                2 => update.payment_date = "2026-02-30".into(),
                3 => update.concept = " ".into(),
                4 => update.concept = "x".repeat(161),
                _ => update.note = Some("x".repeat(281)),
            }
            assert!(update_payment_local(&conn, "p", &update).is_err());
        }
        assert!(update_payment_local(&conn, "missing", &payment_update()).is_err());
        // Nothing changed after the rejected attempts.
        let visible = local_payments(&conn, STUDENT_ID).unwrap();
        assert_eq!(visible.len(), 1);
        assert_eq!(visible[0].amount, 100);
        assert_eq!(visible[0].receipt_number, Some(42));
    }

    #[test]
    fn student_status_deactivates_and_reactivation_sets_current_month() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        replace(&mut conn, local_snapshot()).unwrap();
        let deactivated = set_student_status_local(&conn, STUDENT_ID, false).unwrap();
        assert!(!deactivated.is_active);
        assert_eq!(deactivated.activation_month, "2026-01");
        let reactivated = set_student_status_local(&conn, STUDENT_ID, true).unwrap();
        assert!(reactivated.is_active);
        assert_eq!(reactivated.activation_month, current_month());
        // The visible payload reflects the change after a fresh read.
        let visible = local_students(&conn).unwrap();
        assert!(visible[0].is_active);
        assert_eq!(visible[0].activation_month, current_month());
        // A pending offline student is status-editable through its mutation id.
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        enqueue_student_local(&mut conn, offline_student()).unwrap();
        let pending_row = set_student_status_local(&conn, MUTATION_ID, false).unwrap();
        assert!(!pending_row.is_active);
        assert_eq!(pending_students(&conn).unwrap()[0].is_active, false);
        assert!(set_student_status_local(&conn, "missing", false).is_err());
    }

    #[test]
    fn summary_report_filters_by_range_and_trainer_and_aggregates() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        enqueue_trainer_local(&mut conn, offline_trainer()).unwrap();
        enqueue_student_local(&mut conn, offline_student()).unwrap();
        let mut snapshot = local_snapshot();
        snapshot.students[0].trainer_id = Some(SERVER_ID.into());
        snapshot.students.push(serde_json::from_value(serde_json::json!({
            "id": "e3f1a2c4-1111-4b2b-9c3d-1234567890ab",
            "name": "Second student", "document": null, "phone": null,
            "isActive": true, "activationMonth": "2026-01" })).unwrap());
        snapshot.payments[0].amount = 100;
        snapshot.payments.push(serde_json::from_value(serde_json::json!({
            "id": "f3f1a2c4-1111-4b2b-9c3d-1234567890ab",
            "studentId": "e3f1a2c4-1111-4b2b-9c3d-1234567890ab",
            "receiptNumber": 44,
            "paymentDate": "2026-01-15T00:00:00.000Z", "amount": 300,
            "method": "cash", "concept": "Mensualidad", "note": null })).unwrap());
        replace(&mut conn, snapshot).unwrap();
        // One pending offline payment joins the report without duplicating rows.
        let mut pending_payment = local_payment();
        pending_payment.student_id = STUDENT_ID.into();
        enqueue(&conn, pending_payment).unwrap();
        let all = summary_report_local(&conn, "2026-01-01", "2026-12-31", None).unwrap();
        assert_eq!(all.total_collected, 500);
        assert_eq!(all.payments_count, 3);
        assert_eq!(all.students_paid_count, 2);
        assert_eq!(all.paid_students[0].name, "Second student");
        assert_eq!(all.paid_students[0].total_paid, 300);
        assert_eq!(all.paid_students[1].student_id, STUDENT_ID);
        assert_eq!(all.paid_students[1].total_paid, 200);
        let january = summary_report_local(&conn, "2026-01-01", "2026-01-31", None).unwrap();
        assert_eq!(january.total_collected, 400);
        assert_eq!(january.payments_count, 2);
        let by_trainer = summary_report_local(&conn, "2026-01-01", "2026-12-31", Some(SERVER_ID)).unwrap();
        assert_eq!(by_trainer.total_collected, 200);
        assert_eq!(by_trainer.students_paid_count, 1);
        assert!(summary_report_local(&conn, "2026-02-01", "2026-01-01", None).is_err());
        assert!(summary_report_local(&conn, "nope", "2026-01-01", None).is_err());
        assert!(summary_report_local(&conn, "2026-01-01", "2026-01-01", Some("bad")).is_err());
    }

    #[test]
    fn pending_report_marks_paid_and_pending_for_the_month() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        let mut snapshot = local_snapshot();
        snapshot.students[0].activation_month = "2026-01".into();
        snapshot.students[0].is_active = true;
        snapshot.students.push(serde_json::from_value(serde_json::json!({
            "id": "a3f1a2c4-1111-4b2b-9c3d-1234567890ab",
            "name": "Pending student", "document": null, "phone": null,
            "isActive": true, "activationMonth": "2026-01" })).unwrap());
        snapshot.students.push(serde_json::from_value(serde_json::json!({
            "id": "e3f1a2c4-1111-4b2b-9c3d-1234567890ab",
            "name": "Future student", "document": null, "phone": null,
            "isActive": true, "activationMonth": "2026-03" })).unwrap());
        snapshot.students.push(serde_json::from_value(serde_json::json!({
            "id": "f3f1a2c4-1111-4b2b-9c3d-1234567890ab",
            "name": "Inactive student", "document": null, "phone": null,
            "isActive": false, "activationMonth": "2026-01" })).unwrap());
        snapshot.payments[0].payment_date = "2026-02-01T00:00:00.000Z".into();
        replace(&mut conn, snapshot).unwrap();
        let report = pending_report_local(&conn, "2026-02").unwrap();
        assert_eq!(report.month, "2026-02");
        assert_eq!(report.students.len(), 2);
        assert_eq!(report.paid_count, 1);
        assert_eq!(report.pending_count, 1);
        assert_eq!(report.students[0].name, "Pending student");
        assert_eq!(report.students[0].status, "pending");
        assert_eq!(report.students[1].name, "Student");
        assert_eq!(report.students[1].status, "paid");
        // A payment dated outside the month does not mark the student as paid.
        let march = pending_report_local(&conn, "2026-03").unwrap();
        assert_eq!(march.students.len(), 3);
        assert_eq!(march.paid_count, 0);
        assert!(pending_report_local(&conn, "2026-13").is_err());
        assert!(pending_report_local(&conn, "02-2026").is_err());
    }

    #[test]
    fn export_matches_report_rows_and_escapes_csv_cells() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        replace(&mut conn, local_snapshot()).unwrap();
        let mut payment = local_payment();
        payment.note = Some("cuota, \"enero\"".into());
        enqueue(&conn, payment).unwrap();
        let csv = export_payments_local(&conn, "2026-01-01", "2026-12-31", None).unwrap();
        assert!(csv.starts_with('\u{FEFF}'));
        assert!(csv.contains("Estudiante,Documento,Fecha de pago,Valor,Método,Observación"));
        assert!(csv.contains("01/02/2026"));
        assert!(csv.contains("\"cuota, \"\"enero\"\"\""));
        assert!(csv.contains("Efectivo"));
        let filtered = export_payments_local(&conn, "2026-03-01", "2026-03-31", None).unwrap();
        assert!(!filtered.contains("01/02/2026"));
        assert!(export_payments_local(&conn, "bad", "2026-01-01", None).is_err());
    }

    #[test]
    fn first_run_requires_setup_then_first_admin_can_login() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        assert!(setup_status(&conn).unwrap().needs_setup);
        let session = create_first_admin_local(&mut conn, new_admin()).unwrap();
        assert!(!session.token.is_empty());
        assert!(!setup_status(&conn).unwrap().needs_setup);
        // Email match is case-insensitive and the stored name is trimmed.
        let logged = login_local(&conn, "admin@escuela.local", "clave-segura-1").unwrap();
        assert_ne!(logged.token, session.token);
        assert_eq!(count_rows(&conn, "admin_sessions"), 2);
        let name: String = conn.query_row("SELECT name FROM admins", [], |r| r.get(0)).unwrap();
        assert_eq!(name, "Admin");
    }

    #[test]
    fn login_rejects_wrong_password_and_unknown_email_identically() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        create_first_admin_local(&mut conn, new_admin()).unwrap();
        let wrong = login_local(&conn, "admin@escuela.local", "otra-clave-123").unwrap_err();
        let unknown = login_local(&conn, "nadie@escuela.local", "clave-segura-1").unwrap_err();
        assert_eq!(wrong, unknown);
        assert!(wrong.contains("incorrectos"));
        // Failed attempts never create sessions.
        assert_eq!(count_rows(&conn, "admin_sessions"), 1);
    }

    #[test]
    fn second_admin_is_rejected_and_admin_survives_the_one_time_reset() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        let session = create_first_admin_local(&mut conn, new_admin()).unwrap();
        // Re-simulate a pre-0.2.3 database: data exists, marker not applied yet.
        conn.execute("DELETE FROM migration_markers", []).unwrap();
        replace(&mut conn, local_snapshot()).unwrap();
        initialize(&conn).unwrap(); // reset fires here
        assert_eq!(count_rows(&conn, "payments"), 0);
        assert_eq!(count_rows(&conn, "admins"), 1);
        assert_eq!(count_rows(&conn, "admin_sessions"), 1);
        login_local(&conn, "admin@escuela.local", "clave-segura-1").unwrap();
        let second = create_first_admin_local(&mut conn,
            NewAdmin { email: "otro@escuela.local".into(), ..new_admin() }).unwrap_err();
        assert!(second.contains("ya fue creada"));
        // Revoking a session never touches the admin account.
        logout_local(&conn, &session.token).unwrap();
        assert_eq!(count_rows(&conn, "admin_sessions"), 1);
        assert_eq!(count_rows(&conn, "admins"), 1);
        assert!(login_local(&conn, "admin@escuela.local", "clave-segura-1").is_ok());
    }

    #[test]
    fn admin_validation_and_storage_never_expose_the_password() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        for case in 0..4 {
            let mut admin = new_admin();
            match case {
                0 => admin.name = " ".into(),
                1 => admin.email = "sin-arroba".into(),
                2 => admin.email = "a b@c.com".into(),
                _ => admin.password = "corta".into(),
            }
            assert!(create_first_admin_local(&mut conn, admin).is_err());
        }
        assert!(setup_status(&conn).unwrap().needs_setup);
        create_first_admin_local(&mut conn, new_admin()).unwrap();
        let stored: String = conn.query_row("SELECT password_hash FROM admins", [], |r| r.get(0)).unwrap();
        assert!(stored.starts_with("pbkdf2$"));
        assert!(!stored.contains("clave-segura-1"));
        let failure = login_local(&conn, "admin@escuela.local", "clave-incorrecta-9").unwrap_err();
        assert!(!failure.contains("pbkdf2"));
        assert!(!failure.contains("clave-segura-1"));
        // Tokens are stored hashed, never in plaintext.
        let session = login_local(&conn, "admin@escuela.local", "clave-segura-1").unwrap();
        let token_rows: i64 = conn.query_row(
            "SELECT count(*) FROM admin_sessions WHERE token_hash = ?1",
            [session.token.clone()], |r| r.get(0)).unwrap();
        assert_eq!(token_rows, 0);
        assert!(valid_uuid(&uuid_v4()));
    }
}
