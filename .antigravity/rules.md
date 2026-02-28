# GroundLevel IDE Rules

1. **Strict Tone**: AI coding agent must output formal structure. Do not use conversational introductions or summarize conclusions outside of expected outputs.
2. **Deterministic Output**: Always generate JSON outputs from Gemini in standard structured shapes (Pydantic). 
3. **No Emojis**: The system must rely entirely on explicit string identifiers and robust prose. Do not use graphic emojis in code or output. Use alphanumeric text values mapped to local SVG files in React.
4. **Resilience**: Assume data could be sparse. Assume APIs could return 429. Wrap integrations in try-catch with graceful degradation.
