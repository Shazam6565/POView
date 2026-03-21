# POView 1.0.2 Hackathon Execution Checklist

## Hackathon Context Reminders
* **Core Objective**: Leverage Vercel's agent stack and Gemini's multimodal capabilities (vision, audio) to build intelligent agents.
* **Problem Statement Target**: AI Applications - focus on craft, user experience, and shipping something polished. Avoid unpolished UX.
* **Demo Environment**: Frontend on Vercel, Backend running locally (manual turn on required).

---

## Execution Checklist

### 1. Voice Assistant Latency
- [ ] Investigate audio capture/transmission bottleneck in the frontend (ensure PCM 16kHz chunks are optimal).
- [ ] Review `backend/main.py` WebSocket loop (`/ws/live/{session_id}`). 
- [ ] **Things to be aware of**: The backend is already throttling screen captures to 1 every 2 seconds (`now - _last_screen_capture_time >= 2.0`). If latency is still high, consider checking network packet size, Voice Activity Detection (VAD) configuration on the frontend, or testing with a lighter model if applicable. Latency is critical for the "craft/user experience" judging criteria.

### 2. UI & Narration Agent Synchronization
- [ ] Debug the synchronization between the `tour_progress` WebSocket events and the 3D globe visualization (Cesium camera tracking).
- [ ] Check how `NarrationTimeline` segments are tied to the frontend visual updates.
- [ ] **Things to be aware of**: The backend receives `tour_progress` events (with `segment_id`, `narration_text`, etc.) and injects them as `NARRATION_CUE`. If the AI speaks too early/late, review the `pause_after` and `duration` timings in the `visualization_plan` (e.g. in `/api/drone_stream/{place_id}`). State updates might be causing React re-renders that delay the globe; ensure Zustand transient state is used.

### 3. Left Panel UI Inconsistency (Shimmer Effect)
- [ ] Fix the shimmer effect/loading state inconsistency on the left panel.
- [ ] **Things to be aware of**: Check React keys, suspense boundaries, or conditional rendering logic in the left panel components. Unnecessary re-renders or missing loading skeletons are detrimental to the "polished" requirement for Statement Three.

### 4. Neighborhood Analysis Propagation (Voice Mode)
- [ ] Investigate why the neighborhood analysis fails to run, or fails to propagate results to the left UI panel when initiated via the voice assistant.
- [ ] **Things to be aware of**: When the LLM decides to run an analysis tool via voice, it triggers a `function_call` which `main.py` sends to the frontend as `{"type": "state", "tool": tool_name}` and then `{"type": "tool_result", "data": tool_data}`. Ensure the frontend's WebSocket listener correctly captures this `tool_result` event and dispatches the payload to the left panel's state store (Zustand context). 

### 5. Deployment / Network Routing
- [ ] Expose the local backend (running FastAPI) to the public internet using a tunnel (e.g., `ngrok`, `localtunnel`, or Cloudflare Tunnels).
- [ ] Update the Vercel frontend project settings/codebase to point its backend endpoint URL to the new tunneled URL instead of localhost or the old production URL.
- [ ] Push the updated code to Vercel (or trigger a redeploy with the new environment variables).
- [ ] **Things to be aware of**: Ensure CORS (`ALLOWED_ORIGINS` in `main.py`) allows the Vercel domain. Don't forget to manually turn on the local backend and tunnel before the demo! 

### 6. Hackathon Submission Logistics
- [ ] Edit the Git link on the submission portal/docs to point to the newer, correct Git repository used for this hackathon.
- [ ] Verify the repository is public or accessible to judges if required.
