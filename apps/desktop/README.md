# Escuela Futbol Desktop

Lightweight Tauri shell for the existing React web application.

## macOS prerequisites

- macOS 11 or newer
- Node.js and pnpm
- Rust toolchain (`rustup`)
- Xcode Command Line Tools

## Development

From the repository root:

```bash
pnpm install
pnpm dev:desktop
```

The shell serves the existing Vite application at `http://localhost:5173`.
Set `VITE_API_URL` before starting the desktop app when the API is not running at the local default:

```bash
VITE_API_URL=https://api.example.com pnpm dev:desktop
```

## Build

```bash
VITE_API_URL=https://api.example.com pnpm build:desktop
```

This milestone is online-first. SQLite local storage and offline synchronization are intentionally deferred to a later milestone.
