# Accounts, audio and controls

## Providers and answers

ChatGPT plan access uses the supported Sign in with ChatGPT OAuth flow, subject to OpenAI's registration, plan, region, workspace and model availability. Browser consent is separate from successful local token exchange and inference. A consumer subscription is not a general OpenAI API key. Cueglass does not use browser cookies, another application's identity or cached Codex credentials. No account or key is included in the installer.

For ChatGPT, select the account and **Refresh catalog**. The choices are the server's account-specific `visibility: list` entries; labels come from `display_name`, while requests use the exact `slug`. A model available in Codex may be absent here. Empty choices or an error are reported; Cueglass does not invent access. See [OpenAI's model-list instructions](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).

Claude, DeepSeek, GLM, Kimi and Gemini use their official provider endpoints with your own separately configured keys/billing. Model discovery is used where supported; a documented fallback or a manually configured exact ID is labeled access-unverified. Unsupported accounts or models can fail. Development validation uses mocks; live inference and end-to-end OAuth have not been verified across these providers. Never assume successful sign-in means every listed model supports images or every generation option.

Choose **Auto** for a lower-usage/latency preference among available models, or an exact model. **Provider default**, **Fast (lower reasoning)** and **Reasoning (higher effort)** appear only for recognized capability mappings. Cueglass's Fast control reduces reasoning effort where supported; it is not a promise of a provider's paid priority/fast service tier. Latency depends on the model, network, server load and your request. Catalog failures preserve a prior good list with visible feedback; that prior list may be stale until refreshed successfully.

One answer slot means one request. Add up to three slots for independent streaming answers and optional comparison; each increases provider usage. One failure does not block the other cards. Review per-session request limits and token usage; Cueglass has no automatic paid fallback. Cancel ends local processing and aborts requests, but a provider may still count already processed work.

## Audio routing

**Microphone:** choose an available input device for your voice or permitted external audio. Windows microphone permission/device availability may be required. **System playback:** output-device loopback captures sound played through the selected speakers/headphones; headphones do not prevent playback capture. It may include unrelated notifications or apps, so choose sources carefully.

**Application:** process loopback is available only on supported Windows builds (20348+) and runtime conditions. It follows a selected process/process tree, not an abstract meeting name. Browser meeting audio may belong to a child process; selecting the wrong process can yield silence. Protected content, exclusive/device changes and application lifecycle can prevent capture. Windows 10's common desktop builds do not meet the per-app threshold; use a permitted microphone/system source there. Source lists and meters help check routing but are not a guarantee of isolation. No third-party meeting app is modified.

Explicit Start, Pause and Stop are visible. Selecting/changing a source does not start recording; source changes pause active capture. Close/minimize also pauses. If processing falls behind, chunks may be dropped with notice: switch to Fast, reduce competing CPU load, pause and correct the transcript. This build uses CPU Whisper with two worker threads and disables GPU inference; a gaming GPU does not automatically accelerate it.

## Speech, answers and languages

The bundled models are multilingual. Controls includes Auto plus 24 named speech/answer languages. Speech language affects recognition; answer language is independently included in the provider prompt. Mixed speech forces auto detection; code-switching and short clips can still be misidentified. Use a known speech language when practical. Correct transcript text before asking again if recognition changed the meaning. Proper names, numbers, accents, overlapping voices, noise and silence can cause mistakes or hallucinated text.

The user interface is currently English. The localization framework is extensible, but this release is not a fully translated multilingual UI. See [Whisper trade-offs](MODELS.md). English-only alternatives in the optional catalog are not bundled presets; choose those only for English speech. Optional model downloads require an explicit user action, verify trusted pinned size/hash, can be canceled, and never replace the selected working model on failure.

## Automatic assistance

Speech-pause replies are per-session opt-in and require text-sharing permission for online models. Energy VAD, a stable transcript, a question-like-text heuristic, debounce and cooldown are used. Default pause is 1 second, adjustable 0.6–3 seconds; cooldown defaults to 6 seconds, adjustable 3–30 seconds. New speech cancels stale automatic responses. Silence does not prove a complete question, and question detection can miss questions or trigger incorrectly. It is not Smart Turn, Jev or Laya integration. Manual Answer now and correction remain available.

## Vision

Screen capture is manual and separate from audio. Choose a permitted window/region, inspect the preview, and remove it if inappropriate before sending. Automatic screen capture is off. Send only to selected models with recognized image-input capability, with explicit sharing consent. Unsupported model/capture/size selections are rejected. Provider privacy and usage costs apply; real screen transmission was not used in development tests.

## Overlay, appearance and shortcuts

**Pin locks position**; controls still work. **Top** independently requests always-on-top. Drag the header when unpinned; resize at the corner. Compact mode keeps the answer and essential controls visible. Settings offers Light, Dark and High contrast, custom colors, text size and reset/contrast feedback. Native dropdowns use readable opaque colors even with translucent backgrounds.

See-through background can be toggled without forgetting its amount. **Transparency 0–90%** means 0% opaque and 90% mostly see-through; text remains solid. Above 45%, a readability warning appears. Color contrast also depends on the actual backdrop. Reset, the tray and recovery remain available. Click-through is temporary (maximum 30 seconds), requires recovery to be registered, and never persists across restart.

| Action | Initial shortcut |
| --- | --- |
| Answer now | Ctrl+Shift+Space |
| Show/hide | Ctrl+Shift+H |
| Pause audio | Ctrl+Shift+P |
| Cancel answers | Ctrl+Shift+X |
| Manual screen preview | Ctrl+Shift+S |

Record a replacement combo in Controls. Invalid/reserved keys and collisions are reported; a rejected change preserves the old working binding. Recovery tries Ctrl+Shift+O, then Ctrl+Alt+O, then Ctrl+Shift+F10; the actual registered combo is shown in the app. Other applications can own these shortcuts. If you cannot interact, wait 30 seconds for click-through to expire, use tray Show/Settings, or reopen the executable. Reset visibility never starts audio or inference.
