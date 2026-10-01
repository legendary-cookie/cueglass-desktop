# Troubleshooting

| Symptom | Check |
| --- | --- |
| Installer blocked/warning | Release is unsigned. Compare SHA-256 and use trusted release links. Follow your organization's approval process; do not disable security. If you are not comfortable or policy blocks it, stop. |
| Setup/uninstall says app is running | Save/export, Stop audio and tray Quit the target installed copy. Setup never forces it closed. Another process may be unverifiable; retry after safely closing your own copies. |
| Old interface/version still appears | Another copy may own the single-instance session. Check the version shown in Cueglass, Quit the old copy after saving, then open **Cueglass (installed)**. Portable **Cueglass** shortcuts may still point to older folders. |
| Can't see the overlay | Check tray/overflow, Show/Settings or the actual recovery shortcut. Click-through expires after 30 seconds. Reset appearance/bounds if needed. No visibility action resumes audio. |
| No taskbar entry | Intentional tray-first behavior. Windows, not Cueglass, decides overflow placement. |
| Shortcut not working | Another app may own it. Controls displays collision/status; record another combination. Recovery has reserved fallback choices. |
| No audio/meter | Ensure Start was explicitly pressed, Windows permission is allowed, the correct active source/device/process is selected and volume is nonzero. A changed or closed source can stop capture. Try a permitted microphone/system source if per-app loopback is unsupported. |
| Hearing/reading unrelated audio | System playback is broad; choose a supported app source if isolation is needed. Browser processes may be shared. Stop capture before changing routing. |
| Local transcript missing/delayed | Confirm a bundled preset is selected, source meter moves, and the CPU is not overloaded. Try Fast. More accurate labels do not guarantee speed. Notice of dropped chunks means local processing fell behind. |
| Wrong language/words | Prefer explicit speech language, check the multilingual model, reduce noise, correct transcript and retry. Mixed-language/short-clip accuracy is unproven. |
| Models absent | For ChatGPT, select the correct account/provider and Refresh catalog. Account-specific availability can differ from Codex. Refresh errors retain the last good list and show a note; that list can be stale. No credentials or model access are included in setup. |
| OAuth rejected/incomplete | Provider-side consent alone does not prove a completed local session. Review Accounts/error feedback and official OpenAI eligibility/registration requirements. Do not borrow cookies/Codex credentials or create a paid API key merely to bypass this. Live end-to-end authentication is not guaranteed by release tests. |
| Provider HTTP 401/429/model failure | Check the selected provider account/key, exact model access and plan/quota. Do not expose credentials in reports. No paid fallback is automatically used. |
| Automatic reply triggers incorrectly/misses a question | It uses VAD/pause + text heuristics, not a semantic completion model. Adjust pause/cooldown, correct the transcript or use Answer now. |
| Overlay appears in a share | Capture exclusion is path-dependent. Hide it and test the actual recipient share mode with consent. There is no universal invisibility guarantee. |

Before reporting an issue, include app version, Windows build, source type, preset/provider name, and a short artificial reproduction. Remove identifiers/secrets/private content. Prefer typed synthetic examples over meeting screenshots. Do not attach the credential store or full user-data directory.
