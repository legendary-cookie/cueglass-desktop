# Build the source snapshot

The original installer is Cueglass 0.6.0. This clean source snapshot was published later with the user's authorization and MIT metadata; private git history is excluded. Application source matches the tested 0.6.0 implementation. License/docs metadata updates do not rebuild or replace the existing unsigned installer.

Use Windows x64, Node 22.12 or later, npm, and the Windows .NET Framework 4.x C# compiler. Clone this public repository and use your ordinary account. Never copy another app's credentials or commit your own secrets.

```powershell
npm.cmd ci
npm.cmd run setup
npm.cmd run check
```

`setup` installs the official pinned Electron runtime. The native helper is compiled by the build. `check` runs lint, TypeScript, unit tests and the production build. No test authorizes real model inference, OAuth grants or recording.

To build the offline speech bundle, review `scripts/bundle-whisper.ps1`, then run it under your existing PowerShell script policy:

```powershell
& ([scriptblock]::Create((Get-Content -Raw scripts/bundle-whisper.ps1)))
npm.cmd run package
```

This downloads the official whisper.cpp x64 CPU runtime and the three pinned multilingual models, checks sizes/SHA-256, and retains their licenses. Total model data is 281,945,785 bytes. It does not execute arbitrary model files. Packaging produces `release/0.6.0/win-unpacked`; keep every file together. Signing is not configured.

For the per-user installer, `scripts/build-installer.mjs` also requires the verified NSIS 3.0.4.1 compiler cache from electron-builder under `%LOCALAPPDATA%/electron-builder/Cache/nsis-3.0.4.1`. It stops clearly if that compiler is absent. Obtain the official electron-builder NSIS toolchain through its supported download/build setup; do not substitute an untrusted executable. Portable packaging does not require this NSIS cache.

```powershell
npm.cmd run installer
```

The installer includes setup guides and original vendor notices. It starts no app, login, service or recording. The `--old-validation` installer option requires the historical 0.5.4 payload and is only a developer upgrade fixture. Native smoke suites need their documented isolated profiles/fixtures and packaged release targets; historical suites may target older versions. Do not run them against your real session or credential store. `scripts/bundled-models-smoke.mjs` needs a locally created synthetic WAV fixture; test outputs and models are excluded from git.

Use `npm.cmd run dev` for one build and a manual app launch, without a watcher. Startup is offline and recording is stopped. Accounts are connected only through the UI; supported credentials are stored outside the repository in Windows-protected local storage. See USER-GUIDE.md, PRIVACY.md and VALIDATION.md for capabilities, consent controls and live-unverified paths.
