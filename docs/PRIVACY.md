# Data and responsible use

Cueglass is for practice and assistance permitted by the meeting/interview organizer. Obtain required participant consent before recording/transcribing. Do not use it to circumvent assessment rules, proctoring, security controls or another person's expectation of privacy. It does not hide processes or tamper with Teams, Meet or Zoom.

## Local processing

Microphone/playback capture and Whisper transcription run on the computer when you explicitly Start. Local transcription does not need a provider account or internet. Temporary WAV/text files used by transcription are cleaned up after processing; interruption/crashes can leave temporary artifacts in the Windows temp directory. Do not assume secure erasure. The running session's transcript/answers stay in memory unless exported; exported session files are your responsibility. Images are not included in session exports.

Account tokens and provider keys are stored using Electron safeStorage/Windows DPAPI in the app's user-data directory. Safe UI settings and downloaded models are local. Encryption does not protect against every process running as the same compromised Windows account. Do not share the user-data directory, logs containing secrets or exported private sessions. Upgrades/uninstall preserve user data; sign-out/revocation is separate from uninstall.

## Remote processing

Online answering requires explicit session text sharing. The selected question/transcript context and any candidate context you supply are sent to each selected provider. A manually captured screenshot requires preview and explicit image sharing to a compatible selected model. Multiple answer slots send separate requests, potentially to different organizations. Each provider's terms, retention and usage charges/plan limits apply. ChatGPT requests set store false and stream true as required by the supported flow; that setting is not a blanket claim about every provider's retention. Do not enter sensitive materials you are not authorized to share.

Model-list refresh/sign-in communicates with the selected provider. Optional curated model downloads communicate with Hugging Face/upstream hosting; the installer already includes the three default presets. The release is unsigned and has no automatic updater. No cloud transcription service, paid inference fallback, background screen capture or recording starts automatically.

## Window capture exclusion

The overlay requests documented Windows window-capture exclusion where supported. Teams, Meet and Zoom can use different recipient-share/capture paths; these paths have not been comprehensively recipient-verified. Unsupported capture paths may include the overlay or show a black region. Cameras, external capture hardware and screenshots can still see visible content. **No universal invisibility or undetectability is promised.** Test the exact share mode with a consenting partner before a permitted meeting. Hide via the tray/hotkey when appropriate.

The public website uses no added analytics or tracking scripts. GitHub serves repositories/releases/Pages and may log visitor information under its own privacy policy. Do not post real meeting screenshots, transcripts, resumes, personal account identifiers or tokens in public issue reports.
