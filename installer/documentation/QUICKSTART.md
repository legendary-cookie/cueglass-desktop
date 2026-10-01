# Install and start

1. Download `Cueglass-Setup-0.6.0-x64.exe` and `SHA256SUMS.txt` from the [release](https://github.com/legendary-cookie/cueglass-desktop/releases/tag/v0.6.0).
2. In PowerShell, run `Get-FileHash .\Cueglass-Setup-0.6.0-x64.exe -Algorithm SHA256` and compare with the published checksum. A checksum confirms identical bytes, not a trusted publisher identity.
3. Run the installer under your ordinary Windows account. It installs into `%LOCALAPPDATA%\Programs\Cueglass`, adds a current-user Start-menu entry and **Cueglass (installed)** desktop shortcut, and appears in Windows Installed apps. No admin elevation is requested. Existing unrelated nonempty installation folders are refused.
4. Open the installed shortcut. Installation does not automatically launch the app. If another Cueglass copy is running, save/export that session and Quit it through its tray before opening the installed copy; the existing process can receive the second launch.
5. In Controls, choose **Balanced** or another bundled speech preset. All three are available offline immediately. Start with an explicit speech language when known; use Auto when needed.
6. To try the interface without network credentials, select **Offline practice**. It produces a clearly labeled local template, not an AI-generated answer. For online answers, use Accounts to connect a supported ChatGPT session or your separately billed provider key, then choose the provider/model and Refresh catalog.
7. Choose the permitted audio source and explicitly press Start. Watch the meter and transcript. Pause/Stop ends capture; changing source pauses it. No source is recorded merely because you select it.
8. For automatic replies, deliberately enable speech-pause mode and session text sharing. Start listening. Stable question-like transcripts may trigger an answer after a pause. Manual **Answer now** uses the latest interviewer transcript or your optional typed prompt.

Use a practice session before a real permitted meeting. Verify the selected source, language, model, sharing permission and recording state. Do not rely on tiny meters or automated detection for consent.

## Upgrade or reinstall

Export a session you want to keep, Pause/Stop listening, and Quit the installed app through the tray. Run the newer installer under the same Windows account. It replaces installed program files in the managed folder and updates its version entry. If the target copy is running or its process state cannot be verified, setup stops; it never kills it. Credentials, preferences and separately downloaded models are kept in `%APPDATA%\cueglass`, outside program files. Balanced remains the clean-profile default; your explicit saved choices are preserved.

Older portable folders or side-by-side versions are not removed. The existing **Cueglass** shortcut from a portable build is not replaced by the new **Cueglass (installed)** shortcut. Use the installed shortcut to avoid launching an older copy. The installer skips conflicting pre-existing shortcuts rather than replacing unrelated links.

## Tray, close and exit

The main overlay requests no taskbar entry. Windows chooses whether its tray icon appears directly or in the overflow arrow. Close/minimize hides to tray and pauses audio. Show never resumes audio. Tray Quit exits. Do not expect Top to cover secure desktop or exclusive fullscreen applications.

## Uninstall

Use Windows Settings → Apps → Installed apps → Cueglass → Uninstall, or `Uninstall Cueglass.exe` in the installed folder. Quit the installed copy first. Uninstall refuses a running/unverifiable target. It removes known installed files and shortcuts that still point to this installation; unrelated additional files and the user's data directory are preserved. It never removes exported sessions stored elsewhere.

For a complete data reset, first export needed sessions and sign out/revoke access as appropriate, then manually remove `%APPDATA%\cueglass` after all Cueglass copies exit. This deletes local credentials/preferences/downloaded models; do it only intentionally. Uninstall alone does not revoke provider access grants. Avoid copying encrypted credentials between Windows accounts.
