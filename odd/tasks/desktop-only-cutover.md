# Desktop-only product cutover

## Goal
Retire the public web service and make the single Windows desktop installation the only production client, while keeping the React package as the frontend embedded by Tauri and keeping Railway PostgreSQL/API as cloud backup and synchronization infrastructure.

## Scope
- Remove the Railway web service from infrastructure definition.
- Document the single production Windows machine and Mac-only development role.
- Preserve `apps/web` as an internal Tauri frontend source.
- Keep SQLite as the production operational database and Railway as backup/sync.

## Tasks
- [x] Remove public web service infrastructure.
- [x] Document desktop-only operations and database roles.
- [ ] Verify API/desktop builds remain healthy.

## Evidence

- `.railway/railway.ts` now provisions only PostgreSQL and the API; the public `web` service is no longer declared.
- `apps/web` remains the embedded React frontend required by Tauri and is explicitly not a public deployment target.
- The desktop README documents the single Windows production machine, Mac development role, and SQLite/Railway responsibilities.

## Non-goals
- Delete the embedded React source.
- Remove Railway API or PostgreSQL.
- Support multiple production desktop writers.
