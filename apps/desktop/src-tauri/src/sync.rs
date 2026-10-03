use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Student {
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

fn initialize(conn: &Connection) -> Result<()> {
    conn.busy_timeout(std::time::Duration::from_secs(5)).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;
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
            payload TEXT NOT NULL, server_id TEXT);")
        .map_err(|e| e.to_string())
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
    let mut stmt = conn.prepare("SELECT CASE WHEN EXISTS (
        SELECT 1 FROM student_outbox o WHERE o.server_id IS NULL
        AND o.client_mutation_id = json_extract(s.payload, '$.clientMutationId'))
        THEN json_set(s.payload, '$.syncStatus', 'pending') ELSE s.payload END
        FROM students s ORDER BY name, id").map_err(|e| e.to_string())?;
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
        || !valid_date(&format!("{}-01", student.activation_month)) {
        return Err("Datos de estudiante inválidos.".into());
    }
    student.name = student.name.trim().into();
    student.document = student.document.map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
    student.phone = student.phone.map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
    student.is_active = true;
    student.sync_status = Some("pending".into());
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

fn valid_date(value: &str) -> bool {
    let parts: Vec<_> = value.split('-').collect();
    if parts.len() != 3 || parts[0].len() != 4 || parts[1].len() != 2 || parts[2].len() != 2 {
        return false;
    }
    let (Ok(year), Ok(month), Ok(day)) = (
        parts[0].parse::<u32>(), parts[1].parse::<u32>(), parts[2].parse::<u32>()
    ) else { return false; };
    let days = match month {
        4 | 6 | 9 | 11 => 30,
        2 if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) => 29,
        2 => 28,
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        _ => return false,
    };
    year > 0 && day > 0 && day <= days
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
    payment.sync_status = Some("pending".into());
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

    fn offline_student() -> Student {
        serde_json::from_value(serde_json::json!({
            "id": MUTATION_ID, "clientMutationId": MUTATION_ID,
            "name": " New student ", "document": null, "phone": null,
            "isActive": true, "activationMonth": "2026-02"
        })).unwrap()
    }

    #[test]
    fn students_are_durable_idempotent_and_survive_empty_snapshots() {
        let mut conn = Connection::open_in_memory().unwrap();
        initialize(&conn).unwrap();
        let saved = enqueue_student_local(&mut conn, offline_student()).unwrap();
        assert_eq!(saved.name, "New student");
        assert_eq!(saved.sync_status.as_deref(), Some("pending"));
        let mut retry = offline_student();
        retry.name = "Changed".into();
        assert_eq!(enqueue_student_local(&mut conn, retry).unwrap().name, "New student");
        initialize(&conn).unwrap();
        assert_eq!(pending_students(&conn).unwrap().len(), 1);
        replace(&mut conn, Snapshot { students: vec![], payments: vec![], generated_at: "stale".into() }).unwrap();
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
        enqueue_student_local(&mut conn, offline_student()).unwrap();
        let mut fresh = local_snapshot();
        let mut server = offline_student();
        server.name = "Server name".into();
        fresh.students.push(server);
        // A lost POST response followed by a snapshot still shows one pending row.
        replace(&mut conn, fresh).unwrap();
        let visible = local_students(&conn).unwrap();
        assert_eq!(visible.len(), 2);
        assert_eq!(visible.iter().find(|s| s.id == MUTATION_ID).unwrap().sync_status.as_deref(), Some("pending"));
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
        for case in 0..4 {
            let mut student = offline_student();
            match case {
                0 => student.name = " ".into(),
                1 => student.client_mutation_id = None,
                2 => student.activation_month = "2026-13".into(),
                _ => student.id = "bad".into(),
            }
            assert!(enqueue_student_local(&mut conn, student).is_err());
        }
        assert!(local_students(&conn).unwrap().is_empty());
        assert!(pending_students(&conn).unwrap().is_empty());
        enqueue_student_local(&mut conn, offline_student()).unwrap();
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
        assert_eq!(saved.sync_status.as_deref(), Some("pending"));
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
        replace(&mut conn, Snapshot { students: vec![], payments: vec![], generated_at: "empty".into() }).unwrap();
        let count: i64 = conn.query_row("SELECT count(*) FROM students", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);
    }
}
