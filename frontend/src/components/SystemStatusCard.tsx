import { useState, useEffect } from "react";
import { useSimulationStore } from "@/store/useSimulationStore";
import { ServerCog, ChevronDown, ChevronUp } from "lucide-react";

export function SystemStatusCard() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  
  const isAnalyzing = useSimulationStore(s => s.analysisState.isAnalyzing);
  const stage = useSimulationStore(s => s.analysisState.currentStage);
  
  useEffect(() => {
    if (!isAnalyzing) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  if (!isAnalyzing) return null;

  return (
    <div className="bg-black/80 backdrop-blur-2xl border border-blue-500/30 rounded-2xl w-[360px] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 pointer-events-auto">
      <div className="flex justify-between items-center p-3 border-b border-white/10">
        <div className="flex items-center gap-2 relative">
          <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20 scale-150" />
          <ServerCog className="w-4 h-4 text-blue-400 animate-pulse" />
          <span className="text-[10px] text-blue-300/70 font-mono tracking-widest uppercase ml-1">System Status</span>
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="text-white/50 hover:text-white transition-colors">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>
      
      <div className={`transition-all duration-300 ${isExpanded ? "max-h-40 opacity-100 p-4" : "max-h-0 opacity-0 overflow-hidden"}`}>
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="flex flex-col">
               <span className="text-sm text-blue-100 font-medium leading-snug">
                 {stage || "Initializing multi-agent protocol..."}
               </span>
             </div>
           </div>
           <div className="text-xs font-mono text-blue-400/80 bg-blue-500/10 px-2 py-1 rounded shrink-0 ml-4">
             {elapsed}s
           </div>
         </div>
      </div>
    </div>
  );
}
