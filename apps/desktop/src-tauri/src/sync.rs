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
            id INTEGER PRIMARY KEY CHECK(id = 1), generated_at TEXT NOT NULL);")
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
    let conn = open(&app)?;
    let mut stmt = conn.prepare("SELECT payload FROM students ORDER BY name, id").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|row| serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn list_local_payments(app: tauri::AppHandle, student_id: String) -> Result<Vec<Payment>> {
    let conn = open(&app)?;
    let mut stmt = conn.prepare("SELECT payload FROM payments WHERE student_id = ?1 ORDER BY payment_date DESC, id")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([student_id], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|row| serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())).collect()
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
