## Voice Assistant Troubleshooting Notes

### 1. Gemini Live API `response_modalities` Pydantic Bug
- **Issue**: Assigning `[types.Modality.AUDIO]` instead of `["AUDIO"]` to `RunConfig(response_modalities=...)` triggers a Pydantic serialization warning in `google.adk`.
- **Impact**: The underlying ADK/GenAI SDK silently drops the ENTIRE `LiveConnectConfig` due to the validation warning. This breaks user voice transcription (`input_audio_transcription`) and forces Gemini to fall back to a text-only response. The UI appears fully broken/unresponsive.
- **Fix**: Always use the string literal `["AUDIO"]` for this configuration to avoid breaking the JSON payload string-matching schema.

### 2. Gemini Live API "Thinking" Block Parsing
- **Issue**: The `gemini-2.5-flash-native-audio` model frequently outputs text that begins with internal reasoning blocks like `**Thinking...**`. 
- **Impact**: The backend was using a strict `if not text.startswith("**"):` check to filter these out. This caused the entire message to be dropped. Because the frontend UI transcript panel (`panelVisible`) only activates if there is a valid `transcript` message, the panel stayed invisible and the assistant appeared unresponsive.
- **Fix**: Replaced the strict drop with `text.split("\n\n", 1)` to strip off the thinking block but preserve the spoken text, ensuring the frontend UI renders correctly.
