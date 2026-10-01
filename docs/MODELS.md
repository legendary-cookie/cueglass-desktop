# Three offline Whisper presets

All presets run locally through the included official **whisper.cpp 1.9.2 CPU runtime**. These are OpenAI Whisper weights converted/quantized by whisper.cpp's upstream model repository, not different commercial transcription services. **Q5_1** is the quantization format; it reduces disk/memory compared with full-precision weights and may affect recognition quality.

| Preset | Exact compatible weights | Parameters (upstream family) | Exact file bytes | Practical expectation |
| --- | --- | --- | ---: | --- |
| Fast | `tiny-q5_1` / `ggml-tiny-q5_1.bin` | 39 million | 32,152,673 | Lowest compute/memory of these presets. Good starting point for weak CPUs; more recognition mistakes can occur on difficult speech. |
| Balanced (default) | `base-q5_1` / `ggml-base-q5_1.bin` | 74 million | 59,707,625 | Middle resource cost. Start here, then judge your own language/microphone. |
| Higher accuracy | `small-q5_1` / `ggml-small-q5_1.bin` | 244 million | 190,085,487 | Larger model and higher CPU/latency cost; may improve difficult speech, without guaranteeing a more accurate result on every utterance. |

All three are **multilingual**, not `.en` variants. Total weights: **281,945,785 bytes** (about 269 MiB). They are included in the installer, available immediately offline and hash-checked on selection. A clean profile starts on Balanced. Your explicit saved choices are retained during upgrades.

## What results to expect

Whisper produces approximate text, not verified facts, speaker identity or guaranteed punctuation. Compare the transcript against what was said. Clean, single-speaker speech with a suitable language selection is an easier case than overlapping voices, background music, accents, unfamiliar names, very short clips or language switching. Test a short consented example in your own language before depending on it. Larger is not universally better and automatic language detection is not guaranteed. Manual correction is part of the workflow.

OpenAI documents a size/speed trade-off and language-dependent performance. Its published relative-speed figures come from a different PyTorch/GPU setup; they are **not Cueglass CPU benchmarks**. whisper.cpp's upstream reference memory figures (~273 MB Tiny, ~388 MB Base, ~852 MB Small) refer to its reference models and **are not measured memory requirements for these Q5_1 files**, nor total app RAM. The app, OS and meeting software need additional memory. See [measured release validation](REQUIREMENTS.md) for the specific synthetic test; no general WER, accent benchmark or real-meeting accuracy score is claimed.

If replies are delayed, first distinguish transcription time from provider/network response time. Fast can reduce local compute; a faster online model helps only the latter. If meaning is wrong, try an explicit speech language, reduce noise, correct text, or compare Balanced and Higher accuracy. Do not infer correctness from fluent generated answers.

## Provenance, hashes and licenses

Weights are pinned to `ggerganov/whisper.cpp` revision `5359861c739e955e79d9a303bcbc70fb988958b1` on Hugging Face. Sizes and SHA-256 values were checked against that revision's upstream LFS metadata and downloaded bytes. The installer contains the MIT copyright/license texts for OpenAI Whisper and whisper.cpp. No additional model license acceptance or gated download is required.

| Model | SHA-256 |
| --- | --- |
| Tiny Q5_1 | `818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7` |
| Base Q5_1 | `422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898` |
| Small Q5_1 | `ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb` |

[Pinned upstream catalog](https://huggingface.co/ggerganov/whisper.cpp/tree/5359861c739e955e79d9a303bcbc70fb988958b1) · [Whisper model/language trade-offs and MIT weights license](https://github.com/openai/whisper#available-models-and-languages) · [whisper.cpp quantization and memory reference](https://github.com/ggml-org/whisper.cpp) · [Runtime release](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.2)
