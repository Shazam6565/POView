# Gemini Grounding: Findings & Architecture Integration Plan

This document records the findings from our initial experiments with Gemini Grounding via the Google Search and Google Maps tools, and outlines the required architectural plan for integrating this into the project in the future.

## Key Findings & Constraints

1. **Model Support**: 
   - `gemini-3.1-pro-preview` **does not** support Google Maps grounding.
   - For Maps grounding, we must use `gemini-2.5-pro` or `gemini-2.5-flash`.
2. **SDK Version Requirements**:
   - The `google-genai` pip package **must be upgraded to `>= 1.65.0`**. (Version `0.2.2` does not contain `types.GoogleMaps`).
3. **Incompatibility with Structured Output**:
   - Google Maps grounding requires tools to be injected into the config.
   - Using `types.Tool(google_maps=types.GoogleMaps())` in `GenerateContentConfig` **conflicts** with `response_mime_type="application/json"`. The API will reject the request with a 400 error.
   - *Conclusion*: We cannot natively enforce Pydantic/JSON schema while simultaneously using Maps grounding on these models.

## Future Architecture Integration Plan

When we are ready to implement Maps/Search grounding in the core platform (e.g., inside `backend/services/gemini_client.py`), we must implement the following changes:

### 1. Upgrade Environment
- Update `requirements.txt` to include `google-genai>=1.65.0`.

### 2. Dual-Model Strategy
- Currently, `generate_neighborhood_profile` uses `gemini-3.1-pro-preview` for deep reasoning.
- To use Maps grounding, we will need to either:
  a. Downgrade the profile generation to `gemini-2.5-pro`.
  b. Execute a two-pass architecture: First pass uses `gemini-2.5-pro` with Maps Grounding to gather contextual facts/chunks. Second pass feeds those grounded chunks as plain text into `gemini-3.1-pro-preview` to generate the final structured profile.

### 3. Workaround for JSON Parsing
Since `response_mime_type` cannot be used alongside Maps grounding, we will need to prompt the model strictly to output raw JSON and parse it manually.

```python
# Example Future Implementation
config = types.GenerateContentConfig(
    temperature=0.4,
    # response_mime_type="application/json", # MUST BE REMOVED
    # response_schema=schema,                # MUST BE REMOVED
    tools=[
        types.Tool(google_maps=types.GoogleMaps()),
        types.Tool(google_search=types.GoogleSearch())
    ],
    tool_config=types.ToolConfig(
        retrieval_config=types.RetrievalConfig(
            lat_lng=types.LatLng(latitude=lat, longitude=lng)
        )
    )
)

# Appended to the prompt:
prompt_payload += "\n\nCRITICAL: You must return the response exclusively as a valid JSON object matching the required schema. Do not wrap it in markdown blockquotes."
```

### 4. Code Modification Targets
- **`backend/services/gemini_client.py`**: Update `generate_neighborhood_profile` (or other target methods) to accept `lat` and `lng`, apply the config changes, and manually parse the `json.loads(response.text)` while stripping markdown fences if they exist.
- **`backend/main.py`**: Retrieve the latitude and longitude from the existing `location_details` payload and pass it to the Gemini generation function.
