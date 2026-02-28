import React from "react";
import { Star, MapPin } from "lucide-react";

interface RecommendationsPanelProps {
    recommendations: any[];
    onSelectRecommendation?: (rec: any) => void;
    profileData?: any;
}

export default function RecommendationsPanel({ recommendations, onSelectRecommendation, profileData }: RecommendationsPanelProps) {
    if (!recommendations || recommendations.length === 0) return null;

    return (
        <div className="max-h-full flex flex-col bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-3xl pb-2 overflow-hidden pointer-events-auto">
            {/* Header / Insights */}
            <div className="shrink-0 p-6 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
                {profileData && (
                    <div className="mb-4 pb-4 border-b border-white/10">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-white/50 text-xs font-bold uppercase tracking-widest">Reference Area</h3>
                            {profileData.weather && (
                                <span className="bg-white/5 border border-white/10 px-2 py-1 rounded-full text-[10px] font-mono font-medium text-cyan-300 flex items-center space-x-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" title={profileData.weather.ai_summary}>
                                    <span>{profileData.weather.temperature}°F</span>
                                    <span className="opacity-50">|</span>
                                    <span className="truncate">{profileData.weather.condition}</span>
                                </span>
                            )}
                        </div>
                        <h4 className="text-cyan-300 font-semibold tracking-wide mb-2">{profileData.neighborhood_name}</h4>
                        <p className="text-white/80 text-sm leading-relaxed line-clamp-3">{profileData.vibe_description}</p>
                    </div>
                )}
                <h2 className="text-2xl font-bold text-white tracking-wide">AI Targeting</h2>
                <p className="text-cyan-400 text-sm font-medium tracking-wide mt-1">
                    {recommendations.length} {recommendations.length === 1 ? 'Match' : 'Matches'} Found
                </p>
            </div>

            {/* Scrollable List */}
            <div className="overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent p-4 space-y-4">
                {recommendations.map((rec, index) => (
                    <div
                        key={index}
                        onClick={() => onSelectRecommendation && onSelectRecommendation(rec)}
                        className="group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 rounded-2xl p-4 transition-all duration-300 cursor-pointer"
                    >
                        {/* Rank Badge */}
                        <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400 border-dashed animate-[spin_10s_linear_infinite] group-hover:bg-cyan-500/40 group-hover:border-solid transition-colors duration-300 flex items-center justify-center"></div>
                        <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-cyan-50 text-xs tracking-tighter">
                            0{index + 1}
                        </div>

                        <div className="pl-4">
                            <div className="flex justify-between items-start mb-2 gap-4">
                                <h3 className="text-white font-semibold text-lg leading-tight group-hover:text-cyan-300 transition-colors duration-200">
                                    {rec.name}
                                </h3>
                                <div className="flex items-center space-x-1 shrink-0 bg-black/50 px-2 py-1 rounded-md border border-white/5">
                                    <Star className="w-3 h-3 text-cyan-400 fill-cyan-400/20" />
                                    <span className="text-white font-mono text-xs font-bold">{rec.rating.toFixed(1)}</span>
                                </div>
                            </div>

                            <p className="text-white/60 text-sm leading-relaxed mb-3 line-clamp-3 group-hover:line-clamp-none transition-all duration-300">
                                {rec.description}
                            </p>

                            <div className="flex items-center space-x-2 text-white/40 group-hover:text-cyan-400/70 transition-colors duration-200">
                                <MapPin className="w-3 h-3" />
                                <span className="text-[10px] uppercase font-mono tracking-widest">
                                    Target Acquisition Fixed
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
