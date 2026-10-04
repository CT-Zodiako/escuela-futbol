# Windows no console window

## Goal
Prevent the Windows desktop executable from opening a terminal/console window alongside the main GUI window on every launch.

## Tasks
- [x] Add the Windows subsystem directive so the binary is a GUI app only.
- [x] Verify the local macOS build still compiles (directive is Windows-only).
- [x] Commit the fix and record the commit identity. (`54d56c4`)
- [x] Publish a signed Windows release so the production machine stops seeing the extra console window. (v0.3.8, run 37208866623)

## Constraints
- Keep macOS/Linux builds unaffected.
- Preserve all existing Tauri commands and behavior.

## Evidence
- `apps/desktop/src-tauri/src/main.rs` currently has no `#![windows_subsystem = "windows"]` directive.
- User reports a terminal window opens every time the app starts on Windows, in addition to the real app window.

## Implementation notes
Adding `#![windows_subsystem = "windows"]` at the top of `main.rs` tells the Windows linker to mark the executable as a GUI subsystem process, so no console/terminal window is allocated on launch. This directive is ignored on non-Windows targets.
