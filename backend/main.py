import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import polyline
from services.places_service import get_places_details, get_nearby_places, format_context_payload, get_autocomplete_predictions, contextual_places_search, get_directions
from services.gemini_client import generate_neighborhood_profile, parse_contextual_intent
from services.redis_cache import get_cached_profile, set_cached_profile
from services.weather_service import fetch_weather_forecast

app = FastAPI(title="GroundLevel AI Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/autocomplete")
async def autocomplete_proxy(input: str):
    """Secure proxy for Places Autocomplete."""
    if not input:
        return {"suggestions": []}
    suggestions = await get_autocomplete_predictions(input)
    return {"suggestions": suggestions}

class ProximityRequest(BaseModel):
    place_id: str
    intent: str
    radius: float = 0.4

@app.post("/api/proximity_search")
async def proximity_search(req: ProximityRequest):
    """Handles Contextual AI Proximity Search"""
    
    # 1. Resolve place_id to lat/lng
    location_details = await get_places_details(req.place_id)
    if not location_details or not location_details.get("geometry"):
        raise HTTPException(status_code=404, detail="Location not found")
        
    lat = location_details["geometry"].get("location", {}).get("lat")
    lng = location_details["geometry"].get("location", {}).get("lng")
    
    if not lat or not lng:
        raise HTTPException(status_code=400, detail="Location geometry invalid")
        
    # 2. Parse intent with Gemini to get Places keywords
    try:
        intent_parsed = await parse_contextual_intent(req.intent)
        keywords = intent_parsed.get("keywords", [])
        if not keywords:
            keywords = [req.intent] # Fallback
    except Exception as e:
        print(f"Gemini Intent Parsing Error: {e}")
        keywords = [req.intent] # Fallback
        
    # 3. Search Google Places within bounds (returns a list of dicts)
    recommendations = await contextual_places_search(lat, lng, req.radius, keywords)
    if not recommendations:
        raise HTTPException(status_code=404, detail="No contextual matches found nearby.")
        
    # 4. Concurrently Get Actual Route directions for all recommendations
    async def fetch_route(rec):
        try:
            directions = await get_directions(lat, lng, rec["lat"], rec["lng"])
            path = polyline.decode(directions) if directions else [
                [lat, lng],
                [rec["lat"], rec["lng"]]
            ]
            return path
        except Exception as e:
            print(f"Directions API fallback to straight line for {rec['name']}: {e}")
            return [
                [lat, lng],
                [rec["lat"], rec["lng"]]
            ]

    routes = await asyncio.gather(*[fetch_route(r) for r in recommendations])

    # Combine recommendations with their respective routing paths
    results = []
    for i, rec in enumerate(recommendations):
        results.append({
            "coordinates": [rec["lat"], rec["lng"]],
            "metadata": {
                "name": rec["name"],
                "rating": rec["rating"],
                "description": rec["description"]
            },
            "routing_path": routes[i]
        })

    # 5. Return structured array of recommendations
    return {
        "results": results
    }

@app.get("/api/profile/{place_id}")
async def fetch_neighborhood_profile(place_id: str, intent: str = None):
    """Main Orchestration endpoint for the Foundation Neighborhood Profile"""
            
    # 1. Check strict Redis Cache (Zero Token Expenditure)
    cache_key = f"{place_id}_{intent}" if intent else place_id
    cached_payload = await get_cached_profile(cache_key)
    if cached_payload:
        if "viewport" in cached_payload and "profile_data" in cached_payload and "weather" in cached_payload:
            return {
                "source": "cache", 
                "data": cached_payload["profile_data"],
                "viewport": cached_payload["viewport"],
                "location": cached_payload["location"],
                "weather": cached_payload["weather"]
            }
        # If it's old cache without viewport, we fall through and regenerate to get the bounds
        
    # 2. Asynchronously aggregate Google Places Data
    location_details = await get_places_details(place_id)
    if not location_details:
        raise HTTPException(status_code=404, detail="Location not found")
        
    lat = location_details.get("geometry", {}).get("location", {}).get("lat")
    lng = location_details.get("geometry", {}).get("location", {}).get("lng")
    
    if not lat or not lng:
        raise HTTPException(status_code=400, detail="Location geometry invalid")
        
    nearby_places = await get_nearby_places(lat, lng)
    weather = await fetch_weather_forecast(lat, lng)
    
    # 3. Format context explicitly matching the architectural constraints
    prompt_payload = format_context_payload(location_details, nearby_places)
    
    # System Instruction injection specific to Module 1 with Google WeatherForecast 2 Integration
    intent_instruction = f"The user's specific search intent is: '{intent}'. Tailor the 'vibe_description' to specifically explain WHY this neighborhood is (or isn't) highly relevant to their intent in exactly 2 punchy, actionable sentences. " if intent else ""
    
    system_instruction = (
        "You are an expert urban analyst. Your tone must be direct, highly specific, and culturally intuitive. "
        "Do NOT use diplomatic platitudes. Provide unvarnished assessments. You must reply strictly in the exact JSON format requested. "
        f"CRITICAL GOOGLE WEATHERFORECAST 2 CONTEXT: {weather['ai_summary']} "
        "You MUST adapt the 'vibe_description', 'best_for', and 'not_ideal_for' arrays to heavily reflect this current weather reality. "
        f"{intent_instruction}"
    )
    
    full_prompt = f"SYSTEM INSTRUCTION: {system_instruction}\n\nDATA PAYLOAD:\n{prompt_payload}"
    
    # 4. Generate AI Insight via Gemini 3.1 Pro
    try:
        profile_data = await generate_neighborhood_profile(full_prompt)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Gemini API Error: {e}")
        raise HTTPException(status_code=500, detail="AI insights temporarily unavailable")
        
    # 5. Set Redis Cache with 72-hour TTL
    cache_wrapper = {
        "profile_data": profile_data,
        "viewport": location_details.get("geometry", {}).get("viewport"),
        "location": location_details.get("geometry", {}).get("location"),
        "weather": weather
    }
    await set_cached_profile(cache_key, cache_wrapper)
    
    return {
        "source": "gemini", 
        "data": profile_data,
        "viewport": cache_wrapper["viewport"],
        "location": cache_wrapper["location"],
        "weather": weather
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
