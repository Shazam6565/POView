"use client";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import InsightPanel from "@/components/InsightPanel";
import SearchBox from "@/components/SearchBox";
import RecommendationsPanel from "@/components/RecommendationsPanel";
import LandingPage from "@/components/LandingPage";
import axios from "axios";
import { Ion } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

// Set Cesium base URL to public folder copies
if (typeof window !== "undefined") {
  (window as any).CESIUM_BASE_URL = "/cesium";
  Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";
}

// Dynamically import CesiumJS map to avoid SSR issues
const Map3D = dynamic(() => import("@/components/Map3D"), { ssr: false });

export default function Home() {
  const [profileData, setProfileData] = useState<any>(null);
  const [viewport, setViewport] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [layersVisible, setLayersVisible] = useState(true);

  // Landing Page State
  const [hasStarted, setHasStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Weather state from backend
  const [weatherState, setWeatherState] = useState<string>("clear");

  const handleStart = () => {
    setIsTransitioning(true);
    // Wait for the slide-up animation (1000ms) before completely unmounting
    setTimeout(() => {
      setHasStarted(true);
    }, 1000);
  };

  const handleSearch = async (placeId: string, intent: string, radius: number) => {
    setLoading(true);
    setError("");
    setRecommendations([]);
    setSelectedRecommendation(null);

    try {
      // Execute both requests concurrently for better UX
      const [proximityRes, profileRes] = await Promise.all([
        axios.post(`http://localhost:8000/api/proximity_search`, {
          place_id: placeId,
          intent: intent,
          radius: radius
        }),
        axios.get(`http://localhost:8000/api/profile/${placeId}`)
      ]);

      if (proximityRes.data && proximityRes.data.results) {
        setRecommendations(proximityRes.data.results.map((res: any) => ({
          ...res.metadata,
          lat: res.coordinates[0],
          lng: res.coordinates[1],
          routingPath: res.routing_path
        })));
      } else {
        setError("Failed to retrieve matching locations from proximity search.");
      }

      if (profileRes.data) {
        setProfileData({
          ...profileRes.data.data,
          weather: profileRes.data.weather
        });
        if (profileRes.data.viewport) {
          setViewport(profileRes.data.viewport);
        }
        if (profileRes.data.location) {
          setLocation({ lat: profileRes.data.location.lat, lng: profileRes.data.location.lng });
        }
        if (profileRes.data.weather && profileRes.data.weather.render_state) {
          setWeatherState(profileRes.data.weather.render_state);
        } else {
          setWeatherState("clear");
        }
      } else {
        setError("Failed to retrieve primary neighborhood profile.");
      }

    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecenter = () => {
    setRecenterTrigger(prev => prev + 1);
  };

  const handleClear = () => {
    setRecommendations([]);
    setSelectedRecommendation(null);
    setLocation(null);
    setProfileData(null);
    setWeatherState("clear");
  };

  const handleToggleLayers = () => {
    setLayersVisible(prev => !prev);
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black text-slate-100 font-sans">

      {/* Landing Page Overlay */}
      {!hasStarted && (
        <div
          className={`absolute inset-0 z-50 transition-all duration-1000 ease-[cubic-bezier(0.76,0,0.24,1)] ${isTransitioning ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
            }`}
        >
          <LandingPage onStart={handleStart} />
        </div>
      )}

      {/* 3D Map Viewport Background */}
      <div className="absolute inset-0 z-0">
        <Map3D
          viewport={viewport}
          location={location}
          recommendations={recommendations}
          selectedRecommendation={selectedRecommendation}
          recenterTrigger={recenterTrigger}
          layersVisible={layersVisible}
          weatherState={weatherState}
        />
      </div>

      {/* Main UI Overlay (fades in after start) */}
      <div className={`transition-opacity duration-1000 ${isTransitioning || hasStarted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

        {/* Top-Center Weather Pane & Utilities */}
        {profileData && profileData.weather && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-4">
            <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-full px-5 py-2 flex items-center space-x-3 pointer-events-auto transition-transform hover:scale-105">
              <span className="text-xl">{profileData.weather.is_day ? '☀️' : '🌙'}</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white/50 tracking-widest uppercase">Live Weather</span>
                <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                  <span>{profileData.weather.temperature}°F</span>
                  <span className="text-cyan-400">|</span>
                  <span>{profileData.weather.condition}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleRecenter}
              className="bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/50 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-full px-4 py-3 flex items-center space-x-2 pointer-events-auto transition-all duration-300 group"
              title="Return to target location"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-300 group-hover:text-white transition-colors"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>
              <span className="text-xs font-bold text-cyan-300 group-hover:text-white transition-colors tracking-wider">RECENTER</span>
            </button>
          </div>
        )}

        {/* Floating UI Layer Left Side */}
        <div className="absolute inset-y-6 left-6 w-[400px] md:w-[480px] z-10 flex flex-col pointer-events-none space-y-6">

          {/* Title and Search Header */}
          <div className="pointer-events-auto shrink-0 flex flex-col space-y-5">
            <div className="px-2 pt-2">
              <h1 className="text-4xl font-extrabold text-white tracking-wider drop-shadow-xl mb-1">
                GroundLevel
              </h1>
              <p className="text-white/70 text-sm font-medium tracking-wide drop-shadow-md">Autonomous Urban Intelligence</p>
            </div>
            <SearchBox
              onSearch={handleSearch}
              onRecenter={handleRecenter}
              onClear={handleClear}
              onToggleLayers={handleToggleLayers}
              isAnalyzing={loading}
              layersVisible={layersVisible}
            />
            {error && <p className="text-red-400 text-sm px-2 drop-shadow-md font-medium">{error}</p>}
          </div>

          {/* Floating Insight Panel */}
          <div className="pointer-events-auto flex-1 overflow-hidden h-0 rounded-3xl">
            {loading ? (
              <div className="p-8 text-center text-white/50 h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-3xl">
                <div className="w-12 h-12 border-4 border-white/10 border-t-cyan-400 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
                <p className="tracking-widest uppercase text-xs font-semibold text-cyan-300/80">Aggregating Telemetry...</p>
              </div>
            ) : (
              profileData && (
                <div className="h-full">
                  <InsightPanel profileData={profileData} />
                </div>
              )
            )}
          </div>
        </div>

        {/* Right Floating Recommendations Panel */}
        {recommendations && recommendations.length > 0 && (
          <div className="absolute inset-y-6 right-6 w-[400px] z-10 hidden lg:flex flex-col">
            <RecommendationsPanel
              recommendations={recommendations}
              onSelectRecommendation={setSelectedRecommendation}
              profileData={profileData}
            />
          </div>
        )}
      </div>
    </main>
  );
}
