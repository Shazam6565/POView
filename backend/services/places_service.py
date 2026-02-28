import os
import httpx
from typing import List, Dict, Any

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "YOUR_API_KEY_HERE")

async def get_autocomplete_predictions(input_text: str) -> List[Dict[str, Any]]:
    """Secure backend proxy for Google Places Autocomplete API to hide the API key."""
    url = "https://places.googleapis.com/v1/places:autocomplete"
    headers = {
        "X-Goog-Api-Key": API_KEY,
        "Content-Type": "application/json"
    }
    payload = {"input": input_text}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("suggestions", [])
        except Exception as e:
            print(f"Error fetching autocomplete: {e}")
            return []

async def get_places_details(place_id: str) -> Dict[str, Any]:
    """Retrieve details for a specific Google Place ID using Places API (New)."""
    # Clean the ID to remove any 'places/' prefixes that the autocomplete might return
    clean_id = place_id.replace("places/", "")
    url = f"https://places.googleapis.com/v1/places/{clean_id}"
    headers = {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "displayName,location,viewport,formattedAddress,types"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            return {
                "name": data.get("displayName", {}).get("text", ""),
                "geometry": {
                    "location": {
                        "lat": data.get("location", {}).get("latitude"),
                        "lng": data.get("location", {}).get("longitude")
                    },
                    "viewport": data.get("viewport")
                },
                "formatted_address": data.get("formattedAddress", ""),
                "type": data.get("types", [""])[0] if data.get("types") else ""
            }
        except Exception as e:
            print(f"Error fetching place details: {e}")
            return {}

async def get_nearby_places(lat: float, lng: float, radius: float = 1000.0) -> List[Dict[str, Any]]:
    """Retrieve an array of points of interest around the coordinates using Places API (New)."""
    url = "https://places.googleapis.com/v1/places:searchNearby"
    headers = {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.location,places.rating,places.priceLevel,places.primaryType",
        "Content-Type": "application/json"
    }
    
    payload = {
        "locationRestriction": {
            "circle": {
                "center": {
                    "latitude": lat,
                    "longitude": lng
                },
                "radius": radius
            }
        }
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            places_result = response.json()
        except Exception as e:
            print(f"Error fetching nearby places: {e}")
            return []
    
    results = places_result.get("places", [])
    
    # Deterministic Data Stripping
    stripped_data = []
    for place in results:
        p_type = place.get("primaryType", "")
        if p_type in ["locality", "political", "neighborhood", "administrative_area_level_1", "administrative_area_level_2"]:
            continue
            
        stripped_data.append({
            "name": place.get("displayName", {}).get("text", ""),
            "lat": place.get("location", {}).get("latitude"),
            "lng": place.get("location", {}).get("longitude"),
            "rating": place.get("rating", 0.0),
            "price_level": place.get("priceLevel", "PRICE_LEVEL_UNSPECIFIED"),
            "primary_type": p_type
        })
        
    return stripped_data

def format_context_payload(location_details: Dict, nearby_places: List[Dict]) -> str:
    """Formats the dense token representation for Gemini."""
    
    # Assess if we have data scarcity
    entity_count = len(nearby_places)
    scarcity_override = ""
    
    if entity_count < 5:
        # Dynamic threshold instruction override as mandated
        scarcity_override = (
            "CRITICAL CONTEXT: The provided location demonstrates extreme commercial scarcity "
            "(fewer than 5 notable entities). Do not interpret this strictly as a failure. "
            "Shift your paradigm to focus on evaluating its potential for privacy, access to natural "
            "surroundings, architectural spacing, and the lifestyle appeal of low-density environments. "
        )
        
    payload = f"{scarcity_override}\n"
    payload += f"Location: {location_details.get('name')} | Address: {location_details.get('formatted_address')} | Type: {location_details.get('type')}\n"
    payload += f"Geometry: lat: {location_details.get('geometry', {}).get('location', {}).get('lat')}, lng: {location_details.get('geometry', {}).get('location', {}).get('lng')}\n"
    payload += "--- SURROUNDING POINTS OF INTEREST ---\n"
    
    for place in nearby_places:
        payload += f"- {place['name']} (Type: {place['primary_type']}, Rating: {place['rating']}/5.0, Price Level: {place['price_level']}) | lat: {place['lat']}, lng: {place['lng']}\n"
        
    return payload

async def contextual_places_search(lat: float, lng: float, radius_miles: float, keywords: List[str]) -> Dict[str, Any]:
    """Search Google Places using keywords extracted by Gemini, restricted by radius."""
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.location,places.rating,places.editorialSummary,places.primaryType",
        "Content-Type": "application/json"
    }

    radius_meters = radius_miles * 1609.34
    text_query = " ".join(keywords)
    
    # Text Search locationRestriction requires a rectangle. Let's calculate a rough bounding box.
    # 1 degree of latitude is ~111km. So roughly 1 meter is 1/111000 degrees.
    lat_offset = radius_meters / 111000.0
    # Longitude offset depends on latitude.
    import math
    lng_offset = radius_meters / (111000.0 * math.cos(math.radians(lat)))
    
    south = lat - lat_offset
    north = lat + lat_offset
    west = lng - lng_offset
    east = lng + lng_offset
    
    payload = {
        "textQuery": text_query,
        "locationRestriction": {
            "rectangle": {
                "low": {
                    "latitude": south,
                    "longitude": west
                },
                "high": {
                    "latitude": north,
                    "longitude": east
                }
            }
        },
        "maxResultCount": 5
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            places_result = response.json()
        except Exception as e:
            print(f"Error fetching contextual places: {e}"); print(getattr(e, "response", type("obj", (object,), {"text": ""})).text)
            return {}
            
    results = places_result.get("places", [])
    if not results:
        return []
        
    structured_results = []
    
    for place in results:
        description = place.get("editorialSummary", {}).get("text", "A place matching your criteria.")
        description = description.encode('ascii', 'ignore').decode('ascii').strip()
        name = place.get("displayName", {}).get("text", "").encode('ascii', 'ignore').decode('ascii').strip()
        
        structured_results.append({
            "name": name,
            "lat": place.get("location", {}).get("latitude"),
            "lng": place.get("location", {}).get("longitude"),
            "rating": place.get("rating", 0.0),
            "description": description,
        })
        
    return structured_results

async def get_directions(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> str:
    """Fetch routing directions using Google Maps Routes API v2."""
    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline"
    }

    payload = {
        "origin": {
            "location": {
                "latLng": {
                    "latitude": origin_lat,
                    "longitude": origin_lng
                }
            }
        },
        "destination": {
            "location": {
                "latLng": {
                    "latitude": dest_lat,
                    "longitude": dest_lng
                }
            }
        },
        "travelMode": "WALK"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            if "routes" in data and len(data["routes"]) > 0:
                return data["routes"][0].get("polyline", {}).get("encodedPolyline", "")
            else:
                print(f"Routes API returned no routes or error: {data}")
                return ""
        except Exception as e:
            print(f"Error fetching directions via Routes API: {e}")
            if hasattr(e, 'response') and e.response:
                print(f"Response Body: {e.response.text}")
            return ""
