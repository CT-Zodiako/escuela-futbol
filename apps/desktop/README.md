# Escuela Futbol Desktop

Lightweight Tauri desktop application. The single Windows x64 installation is the only production client; macOS is for development only. The React package is bundled internally by Tauri and is not deployed as a public web application.

SQLite is the operational production database on the Windows machine. Railway PostgreSQL/API is the cloud synchronization and backup service, not a separate user interface.

## Install on Windows 10 Pro (64-bit)

1. Run **Build Windows desktop** from the repository's GitHub Actions tab (or use a completed push build).
2. Download the `escuela-futbol-windows-x64-nsis` artifact and extract the ZIP.
3. Run the extracted `.exe` installer, then launch Escuela Futbol.

Microsoft Edge **WebView2 Evergreen Runtime** is required. The installer downloads and installs it silently if missing, so internet access is required during that step. On managed computers, ask IT to install WebView2 first if policy blocks installation. Node.js, pnpm, Rust, and developer tools are not required on users' computers.

The installer installs for the current user and uses Spanish installer text. It is unsigned: Windows SmartScreen may warn about an unrecognized application. Only run installers obtained from a trusted build of this repository.

CI builds on `windows-latest` with the explicit `x86_64-pc-windows-msvc` target and `--bundles nsis`. The bundled frontend uses `https://api-production-28e26.up.railway.app`; changing that URL requires a new build. The installer is uploaded from:

```text
apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe
```

## macOS development

Prerequisites:

- macOS 11 or newer
- Node.js 22 and pnpm 10 (the version pinned in the root `package.json`)
- Rust toolchain (`rustup`)
- Xcode Command Line Tools (`xcode-select --install`)

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev:desktop
```

The shell serves the existing Vite application at `http://localhost:5173`.
Set `VITE_API_URL` before starting the desktop app when the API is not running at the local default:

```bash
VITE_API_URL=https://api-production-28e26.up.railway.app pnpm dev:desktop
```

## Build on macOS

From the repository root:

```bash
VITE_API_URL=https://api-production-28e26.up.railway.app pnpm build:desktop
```

The default bundle target remains `app`, producing `apps/desktop/src-tauri/target/release/bundle/macos/Escuela Futbol.app` for the Mac's native architecture. Windows CI overrides only the bundle target to NSIS; build each platform on its native operating system. Signing and notarization are not configured.

These packaging steps do not change application behavior or offline SQLite functionality. Do not deploy `apps/web` as a standalone site; build it only as the frontend embedded into Tauri.
