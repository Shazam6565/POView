# GroundLevel (God's Eye)
**Autonomous Urban Intelligence & Spatial Telemetry**

GroundLevel is a next-generation analytical platform that merges a highly immersive 3D geospatial engine with deterministic, context-aware AI. By aggregating telemetry from across the Google Maps Platform and dynamically simulating current weather conditions, GroundLevel allows users to effortlessly discover "vibe-matched" physical locations based on contextual intent.

## Key Features
* **Hyper-Local Contextual Intent Search:** Users describe what they want to do (e.g., "drinking dark roast coffee while reading a book") and the AI translates the intent to locate the most relevant physical spaces nearby.
* **Forecast-Aware AI Profiling:** Real-time Google WeatherForecast integration directly feeds the Gemini AI engine, ensuring all location recommendations (Atmosphere, Best For, Not Ideal For) forcefully reflect the current reality (e.g., clear skies vs. heavy rain).
* **Cinematic 3D Globe:** Built on CesiumJS and Google 3D Photorealistic Tiles, the UI features dynamic camera positioning, automatic flyovers, and interactive neighborhood anchors.
* **Reactive Weather Environments:** The 3D globe's atmosphere automatically adjusts lighting, desaturation, and fog thickness to mirror real-time weather conditions.
* **Interactive UI/UX:** A sleek, glassmorphism-styled dashboard containing a live Weather Pane, automatic routing paths to target locations, and floating insight overlays.

## System Architecture

- **Frontend:** Next.js (React), TailwindCSS, Resium (CesiumJS), Axios.
- **Backend:** Python FastAPI, Pydantic, Uvicorn.
- **Data & Orhcestration:** Redis Cache.

### Third-Party APIs used
*   **Google Places API (New):** For searching coordinates, text queries, reviews, and extensive place metadata.
*   **Google Routes API v2:** Computes the pedestrian walking paths between an anchor point and recommendations.
*   **Google Maps 3D Tiles API:** Renders the photorealistic global geometry.
*   **Google Gemini 3.1 Pro via GenAI SDK:** Handles intent parsing and constructs the complex JSON `NeighborhoodProfile`.
*   **Open-Meteo API:** Used as a real-time proxy for the predictive capabilities of Google WeatherForecast 2.

### Flow of Data
1.  **Proximity Masking:** The UI requests a search (`/api/proximity_search`). The Backend uses Gemini to map the human intent ("reading") into API keywords ("cafe, library") and searches Google Places nearby.
2.  **Routing Visualization:** For each match, the backend requests the walking path from Google Routes API v2, returning encoded `routingPath` polylines.
3.  **Spatial Profiling & Weather Context:** The UI simultaneously requests (`/api/profile/{place_id}`). The API checks Redis. On a miss, it fetches location metadata, deeply inspects surrounding infrastructure, and pulls live weather data.
4.  **Deterministic AI Generation:** The backend injects the live weather (e.g., "Steady rain at 48°F") and all spatial data into a strict prompt. Gemini generates the `NeighborhoodProfile` returning it to the UI in strict JSON.
5.  **Reactive Rendering:** The React UI parses the response. The Cesium `Map3D` component manipulates `scene.skyAtmosphere` and `scene.fog` based on the weather state, dropping interactive anchors on the matched locations.

## Quick Start

### Prerequisites
- Node.js (v18+)
- Python 3.9+
- Redis Server ( running on `localhost:6379`)
- API Keys defined in `backend/.env` (`GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_CESIUM_ION_TOKEN` in frontend).

### Run the Backend
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Run the Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to begin.
# POView
