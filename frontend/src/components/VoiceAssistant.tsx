"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, X } from "lucide-react";

interface VoiceAssistantProps {
  onSearchResult?: (data: {
    profileData: any;
    viewport: any;
    location: any;
    weather: any;
    droneWaypoints: any[];
    recommendations: any[];
  }) => void;
  onDroneTourStart?: () => void;
  onTranscript?: (text: string, role: "user" | "agent") => void;
}

type ConnectionState = "idle" | "connecting" | "connected" | "error";
type AgentState = "idle" | "listening" | "processing" | "speaking";

export default function VoiceAssistant({
  onSearchResult,
  onDroneTourStart,
  onTranscript,
}: VoiceAssistantProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [isExpanded, setIsExpanded] = useState(false);
  const [transcripts, setTranscripts] = useState<
    { role: "user" | "agent"; text: string; _final?: boolean }[]
  >([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const scheduledEndCbRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string>(
    `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );

  const playAudioChunk = useCallback((pcmData: Float32Array) => {
    const ctx = playbackContextRef.current;
    if (!ctx) return;

    setAgentState("speaking");

    const buffer = ctx.createBuffer(1, pcmData.length, 24000);
    buffer.getChannelData(0).set(pcmData);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    // Schedule gaplessly: each buffer starts exactly where the last one ends
    const now = ctx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;

    // Set a timeout to flip state back to listening after the last scheduled buffer ends
    if (scheduledEndCbRef.current) clearTimeout(scheduledEndCbRef.current);
    const msUntilEnd = (nextStartTimeRef.current - now) * 1000 + 100;
    scheduledEndCbRef.current = setTimeout(() => {
      setAgentState((s) => (s === "speaking" ? "listening" : s));
      scheduledEndCbRef.current = null;
    }, msUntilEnd);
  }, []);

  const handleWebSocketMessage = useCallback(
    (event: MessageEvent) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case "transcript": {
              const isFinished = msg.finished === true;
              setTranscripts((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === msg.role && !last._final) {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: msg.role,
                    text: last.text + msg.text,
                    _final: isFinished,
                  };
                  return updated.slice(-20);
                }
                return [...prev, { role: msg.role, text: msg.text, _final: isFinished }].slice(-20);
              });
              if (msg.text) onTranscript?.(msg.text, msg.role);
              if (msg.role === "agent") setAgentState("speaking");
              break;
            }

            case "tool_result":
              if (msg.tool === "search_neighborhood" && msg.data && !msg.data.error) {
                onSearchResult?.({
                  profileData: {
                    ...msg.data.profile,
                    weather: msg.data.weather,
                  },
                  viewport: msg.data.viewport,
                  location: msg.data.location,
                  weather: msg.data.weather,
                  droneWaypoints:
                    msg.data.visualization_plan?.waypoints || [],
                  recommendations: [],
                });
              } else if (msg.tool === "get_recommendations" && msg.data && !msg.data.error) {
                onSearchResult?.({
                  profileData: null,
                  viewport: null,
                  location: msg.data.location,
                  weather: null,
                  droneWaypoints: [],
                  recommendations: msg.data.recommendations || [],
                });
              } else if (msg.tool === "start_drone_tour") {
                onDroneTourStart?.();
              }
              break;

            case "state":
              if (msg.state === "processing") {
                setAgentState("processing");
              } else if (msg.state === "listening") {
                setAgentState("listening");
              }
              break;

            case "error":
              console.error("Live agent error:", msg.message);
              break;
          }
        } catch {
          // non-JSON text, ignore
        }
      } else if (event.data instanceof Blob) {
        // Binary audio data from agent
        event.data.arrayBuffer().then((buf) => {
          const int16 = new Int16Array(buf);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768;
          }
          playAudioChunk(float32);
        });
      }
    },
    [onTranscript, onSearchResult, onDroneTourStart, playAudioChunk]
  );

  const startSession = useCallback(async () => {
    if (connectionState === "connected") return;
    setConnectionState("connecting");

    try {
      // Create BOTH AudioContexts synchronously — must be within user gesture
      // to satisfy Chrome's autoplay policy
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;
      await ctx.resume();

      const playbackCtx = new AudioContext({ sampleRate: 24000 });
      playbackContextRef.current = playbackCtx;
      await playbackCtx.resume();

      // Load audio worklet for mic capture
      await ctx.audioWorklet.addModule("/audio-processor.js");

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Connect WebSocket
      const wsUrl = `ws://localhost:8000/ws/live/${sessionIdRef.current}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setConnectionState("connected");
        setAgentState("listening");

        // Connect mic AudioWorklet immediately — ADK buffers safely
        const source = ctx.createMediaStreamSource(stream);
        sourceNodeRef.current = source;

        const worklet = new AudioWorkletNode(ctx, "pcm-processor");
        workletNodeRef.current = worklet;

        worklet.port.onmessage = (e: MessageEvent) => {
          if (ws.readyState === WebSocket.OPEN && e.data instanceof ArrayBuffer) {
            ws.send(e.data);
          }
        };

        source.connect(worklet);
        worklet.connect(ctx.destination);
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onerror = () => {
        setConnectionState("error");
        setAgentState("idle");
      };

      ws.onclose = () => {
        setConnectionState("idle");
        setAgentState("idle");
      };
    } catch (err) {
      console.error("Failed to start voice session:", err);
      setConnectionState("error");
    }
  }, [connectionState, handleWebSocketMessage]);

  const stopSession = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop audio
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    // Clear playback scheduling
    nextStartTimeRef.current = 0;
    if (scheduledEndCbRef.current) {
      clearTimeout(scheduledEndCbRef.current);
      scheduledEndCbRef.current = null;
    }

    setConnectionState("idle");
    setAgentState("idle");
    setIsExpanded(false);

    // Generate new session ID for next connection
    sessionIdRef.current = `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  const toggleSession = () => {
    if (connectionState === "connected") {
      stopSession();
    } else {
      setIsExpanded(true);
      startSession();
    }
  };

  const orbColorClass =
    connectionState === "connected"
      ? agentState === "speaking"
        ? "bg-purple-500/80 shadow-[0_0_30px_rgba(168,85,247,0.6)]"
        : agentState === "processing"
          ? "bg-amber-500/80 shadow-[0_0_30px_rgba(245,158,11,0.6)]"
          : "bg-cyan-500/80 shadow-[0_0_30px_rgba(6,182,212,0.6)]"
      : connectionState === "connecting"
        ? "bg-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
        : connectionState === "error"
          ? "bg-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
          : "bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]";

  const pulseClass =
    connectionState === "connected" && agentState === "listening"
      ? "animate-pulse"
      : "";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3">
      {/* Transcript overlay */}
      {isExpanded && transcripts.length > 0 && (
        <div className="w-[360px] max-h-[200px] overflow-y-auto bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 space-y-2 scrollbar-thin">
          {transcripts.map((t, i) => (
            <div
              key={i}
              className={`text-xs leading-relaxed ${
                t.role === "user"
                  ? "text-cyan-300/90"
                  : "text-purple-300/90"
              }`}
            >
              <span className="font-semibold uppercase tracking-wider text-[10px] text-white/40 mr-1.5">
                {t.role === "user" ? "You" : "POView"}
              </span>
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* Voice orb + controls */}
      <div className="flex items-center gap-3">
        {/* Close button when active */}
        {connectionState === "connected" && (
          <button
            onClick={stopSession}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-center text-white/40 hover:text-red-400 hover:border-red-400/30 transition-all duration-300"
          >
            <X size={16} />
          </button>
        )}

        {/* Main orb button */}
        <button
          onClick={toggleSession}
          disabled={connectionState === "connecting"}
          className={`relative w-16 h-16 rounded-full border border-white/20 backdrop-blur-xl flex items-center justify-center transition-all duration-500 ${orbColorClass} ${pulseClass} hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-wait`}
        >
          {/* Ripple rings when listening */}
          {connectionState === "connected" && agentState === "listening" && (
            <>
              <span className="absolute inset-0 rounded-full border-2 border-cyan-400/30 animate-ping" />
              <span className="absolute -inset-2 rounded-full border border-cyan-400/10 animate-pulse" />
            </>
          )}

          {/* Speaking wave rings */}
          {connectionState === "connected" && agentState === "speaking" && (
            <>
              <span className="absolute -inset-1 rounded-full border-2 border-purple-400/40 animate-ping" style={{ animationDuration: "1.5s" }} />
            </>
          )}

          {connectionState === "connected" ? (
            <Mic size={24} className="text-white drop-shadow-lg" />
          ) : connectionState === "connecting" ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-cyan-400 rounded-full animate-spin" />
          ) : (
            <MicOff size={24} className="text-white/60" />
          )}
        </button>

        {/* Status label */}
        {connectionState === "connected" && (
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              {agentState === "listening"
                ? "Listening..."
                : agentState === "processing"
                  ? "Thinking..."
                  : agentState === "speaking"
                    ? "Speaking..."
                    : "Ready"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
