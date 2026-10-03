# Escuela Futbol Desktop

Lightweight Tauri desktop application. The single Windows x64 installation is the only production client; macOS is for development only. The React package (`apps/web`) is bundled internally by Tauri and is never deployed as a public web application.

SQLite is the sole production database on the Windows machine: administrator authentication, trainers, students, payments, reports, and receipt numbering all live in the local SQLite store. There is no hosted API and no cloud database; the desktop bundle is fully self-contained and needs no API URL at build or run time. WhatsApp receipt sharing remains supported (receipt image to the clipboard, WhatsApp opened with a prefilled message).

## Install on Windows 10 Pro (64-bit)

1. Run **Build Windows desktop** from the repository's GitHub Actions tab (or use a completed push build).
2. Download the `escuela-futbol-windows-x64-nsis` artifact and extract the ZIP.
3. Run the extracted `.exe` installer, then launch Escuela Futbol.

Microsoft Edge **WebView2 Evergreen Runtime** is required. The installer downloads and installs it silently if missing, so internet access is required during that step. On managed computers, ask IT to install WebView2 first if policy blocks installation. Node.js, pnpm, Rust, and developer tools are not required on users' computers.

The installer installs for the current user and uses Spanish installer text. It is unsigned: Windows SmartScreen may warn about an unrecognized application. Only run installers obtained from a trusted build of this repository.

CI builds on `windows-latest` with the explicit `x86_64-pc-windows-msvc` target and `--bundles nsis`. The bundle is self-contained: no API URL is injected, so any Windows build works without network services. The installer is uploaded from:

```text
apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe
```

## Signed in-app updates (Windows production)

The first updater-enabled release must be installed manually over the existing **v0.1.2** installation. The old installer cannot gain an updater remotely. Keep the same current-user installation and application identifier (`com.escuelafutbol.desktop`); do not uninstall or delete application data.

In Desktop, select **Actualizaciones** to check GitHub Releases. The panel displays the available version and requires **Confirmar e instalar** before downloading or installing. Save work first: Windows may exit the app as soon as installation begins. Download progress and the verification/install phase are shown; successful installation relaunches the application. Connection, signature, or installation failures are shown without silently installing another artifact.

Updates replace application binaries, not the SQLite database in the application data directory. No database migration, reset, snapshot replacement, or application-data cleanup is added by the updater. Back up production SQLite before the first rollout and verify local records afterward.

### Publish a release

1. The maintainer sets the repository Actions secret `TAURI_SIGNING_PRIVATE_KEY` to the generated private key contents. Never commit, print, or upload this key. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` may be absent or empty for the current unencrypted key. Back up the key securely: future releases must match the embedded public key.
2. Regenerate and commit the pnpm and Cargo lockfiles alongside dependency changes before running CI.
3. Push a stable version tag newer than `v0.1.2`, such as `v0.1.3`. CI injects the tag version into the Tauri bundle, builds signed Windows x64 NSIS artifacts, and creates a draft GitHub Release.
4. CI uploads the installer `.exe`, signed `.nsis.zip`, `.nsis.zip.sig`, and `latest.json`, then publishes the release as latest. The existing Actions installer artifact remains available for manual testing.
5. Verify an upgrade from the first updater-enabled installation to a higher tagged version before production rollout. A failed upload leaves a draft; inspect and resolve that draft before rerunning publication (the workflow deliberately does not overwrite releases).

The HTTPS update endpoint is:

```text
https://github.com/CT-Zodiako/escuela-futbol/releases/latest/download/latest.json
```

Only `windows-x86_64` is published. The committed config enables `createUpdaterArtifacts: true`; release CI uses Tauri's `v1Compatible` artifact mode to additionally produce the requested `.nsis.zip` format accepted by the v2 updater. Metadata contains the archive signature and a version-specific HTTPS asset URL. The updater authenticates the downloaded artifact, not a cryptographically signed JSON manifest. Malformed metadata fails checking; tampered payloads or invalid signatures fail installation.

Updater signatures are **not Windows Authenticode signing**; SmartScreen warnings can still occur. Non-tag push/manual builds disable updater artifact generation and never receive the signing secret. A manual run on a release tag follows the signed release path.

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
No API URL is needed: the desktop app is fully local and never issues HTTP API calls.

## Build on macOS

From the repository root:

```bash
pnpm build:desktop --config '{"bundle":{"createUpdaterArtifacts":false}}'
```

The default bundle target remains `app`, producing `apps/desktop/src-tauri/target/release/bundle/macos/Escuela Futbol.app` for the Mac's native architecture. Windows CI overrides only the bundle target to NSIS; build each platform on its native operating system. The local override disables updater signing for development without changing the committed config. macOS code signing/notarization and published macOS update artifacts are not configured.

These packaging steps do not change application behavior or offline SQLite functionality. Do not deploy `apps/web` as a standalone site; build it only as the frontend embedded into Tauri.
