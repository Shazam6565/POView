# POView - Gemini Live Agent Challenge Planning Notes

## Overview
These are the group review notes for the upcoming hackathon upgrade for the **POView** project. The goal is to integrate Gemini multimodal capabilities, agentic workflows, and cloud-native optimizations to fulfill the Gemini Live Agent Challenge requirements.

*Note: No project code has been modified during the creation of this document.*

## 1. Core Feature Upgrades
- **Gemini Grounding Search View:** Implement search capabilities utilizing Gemini's grounding.
- **Drone Zoom-In View:** Enhance the globe visual experience with an agent-directed zoom and observation feature.

## 2. Agent Architecture (Agent ADK)
*Planned patterns: Sequential, Loop, or Workflow via Agent ADK.*
- **Multimodal Live-Streaming Agent:** Build an agent capable of real-time multi-modal streaming.
- **Interactive Globe Control:** Grant the agent control over the movement of the globe, allowing it to navigate the 3D space by controlling code execution.
- **Neighborhood Analysis Scripting Agent:** Automate and adapt the currently built neighborhood analysis system to be driven by a robust scripting agent.
- **Resource/Tool Integration:** Equip the agent with external information retrieval capabilities using integrated tools (e.g., Tavily API, Zillow).

## 3. Infrastructure & Deployment Optimizations
- **Containerization:** Enhance Docker container optimizations for smoother deployment.
- **UI Rendering Improvements:** Address rendering clarity issues by implementing "resampling multiple integral images" to ensure a crisp UI and Map experience. (NEEDS CONSIDERATION)

## 4. Hackathon Submission Requirements Checklist

**Deadline:** Mar 16, 2026, @ 8:00 pm EDT

### A. Project Deliverables
- [ ] **Text Description:** Summary of features, functions, technologies, data sources, and learnings.
- [ ] **Public Code Repository URL:** Repo containing the code and a README with spin-up instructions.
- [ ] **Proof of Google Cloud Deployment:** Screen recording (backend running on GCP/console logs) OR code link showing Google Cloud service usage (e.g., Vertex AI API).
- [ ] **Architecture Diagram:** Visual outlining Gemini to backend, DB, and frontend connectivity.
- [ ] **Demonstration Video (Under 4 mins):** Must show real-time multimodal/agentic features (no mockups) and include a pitch explaining the problem solved and value provided.

### B. Technical Requirements
- [ ] **Gemini Model Integration:** Core logic leverages a Gemini model.
- [ ] **SDK/ADK Usage:** Build agents using the Google GenAI SDK or Agent Development Kit (ADK).
- [ ] **Google Cloud Services:** Incorporate at least one Google Cloud service.
- [ ] **Category Alignment:** Ensure fit within one of the following:
  - *Live Agents:* Real-time interaction via Gemini Live API.
  - *Creative Storyteller:* Interleaved/mixed output (text + images/video).
  - *UI Navigator:* Interprets and acts on screenshots/recordings. (Our live-streaming and globe control capabilities align closely here).

### C. Optional Bonus Items
- [ ] **Content Publication:** Publish a blog, podcast, or video using `#GeminiLiveAgentChallenge`.
- [ ] **Automated Deployment:** Provide Infrastructure-as-Code (IaC) or automated scripts in the repo.
- [ ] **GDG Profile:** Provide a public profile link for a Google Developer Group.
