import React, { useState } from 'react';
import { GeneratedAsset } from '../types';
import { generateSpeech, playAudio, getWavBlob } from '../services/geminiService';
import { Copy, Check, Video, MessageSquare, AlertTriangle, Layers, ShieldCheck, ShieldAlert, FileSearch, Fingerprint, Lock, Clapperboard, Anchor, Camera, Hand, ScanFace, Lamp, Mic, Volume2, Film, Focus, Ban, Globe, ClipboardCheck, Wrench, RefreshCw, XCircle, Code, Play, Loader2, Download, FileJson } from 'lucide-react';

interface OutputDisplayProps {
  data: GeneratedAsset | null;
}

interface JsonViewerProps {
  data: any;
  label: string;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data, label }) => {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 border-t border-white/10 pt-4 animate-in fade-in slide-in-from-top-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-slate-500 font-mono uppercase font-bold flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>
          {label} JSON
        </span>
        <button 
          onClick={handleCopy} 
          className="text-[10px] bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 px-2 py-1 rounded border border-brand-500/20 flex items-center gap-1 transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          Copy JSON
        </button>
      </div>
      <pre className="bg-black/80 p-3 rounded-xl text-[10px] text-slate-400 font-mono overflow-x-auto max-h-60 border border-white/10 shadow-inner custom-scrollbar">
        {jsonString}
      </pre>
    </div>
  );
};

export const OutputDisplay: React.FC<OutputDisplayProps> = ({ data }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);
  const [copiedUGCPrompt, setCopiedUGCPrompt] = useState<number | null>(null);
  const [copiedAltHook, setCopiedAltHook] = useState<number | null>(null);
  const [copiedNegVideo, setCopiedNegVideo] = useState(false);
  const [copiedFullJson, setCopiedFullJson] = useState(false);
  
  // State for toggling JSON views
  const [showJson, setShowJson] = useState<Record<string, boolean>>({});
  
  // State for audio
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [audioCache, setAudioCache] = useState<Record<number, string>>({});

  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 min-h-[400px] border-2 border-dashed border-white/10 rounded-3xl bg-white/5 backdrop-blur-sm">
        <div className="bg-white/5 p-4 rounded-full mb-4">
           <Layers className="w-8 h-8 text-brand-500 opacity-50" />
        </div>
        <p className="font-medium text-slate-400">Fill out the brief to generate your plan.</p>
        <p className="text-xs text-slate-600 mt-2">Ready to create viral content?</p>
      </div>
    );
  }

  const toggleJson = (section: string) => {
    setShowJson(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCopyFullJson = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedFullJson(true);
    setTimeout(() => setCopiedFullJson(false), 2000);
  }

  const handleCopyScript = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyPrompt = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(index);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const handleCopyUGCPrompt = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedUGCPrompt(index);
    setTimeout(() => setCopiedUGCPrompt(null), 2000);
  };

  const handleCopyAltHook = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedAltHook(index);
    setTimeout(() => setCopiedAltHook(null), 2000);
  };

  const handleCopyNegVideo = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNegVideo(true);
    setTimeout(() => setCopiedNegVideo(false), 2000);
  };
  
  const handlePlayAudio = async (text: string, index: number) => {
    if (playingIndex !== null) return; // Prevent multiple plays
    
    setPlayingIndex(index);
    try {
      let audioData = audioCache[index];
      if (!audioData) {
        audioData = await generateSpeech(text);
        setAudioCache(prev => ({ ...prev, [index]: audioData }));
      }
      await playAudio(audioData);
    } catch (err) {
      console.error("Audio playback failed", err);
      alert("Failed to generate audio. Please check API key/quota.");
    } finally {
      setPlayingIndex(null);
    }
  };

  const handleDownloadAudio = (index: number) => {
    const audioData = audioCache[index];
    if (!audioData) return;

    const wavBlob = getWavBlob(audioData);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vo_segment_${index}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasInjections = data.sanitization_report && data.sanitization_report.detected_injection_patterns.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* Global Actions */}
      <div className="flex justify-end">
        <button 
          onClick={handleCopyFullJson}
          className="flex items-center gap-2 text-xs font-medium text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 px-3 py-2 rounded-lg transition-all"
        >
          {copiedFullJson ? <Check className="w-3.5 h-3.5" /> : <FileJson className="w-3.5 h-3.5" />}
          Copy Full Project Data
        </button>
      </div>

      {/* Header Info */}
      <div className="glass-panel border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-2xl group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/20 rounded-full blur-[80px] -mr-10 -mt-10 pointer-events-none group-hover:bg-brand-500/30 transition-all duration-700"></div>
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 mb-2">
             <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{data.concept_title}</h2>
          </div>
          <p className="text-slate-400 text-sm mb-5 leading-relaxed max-w-2xl">{data.hook_rationale}</p>
          
          <div className="flex flex-wrap gap-2 text-xs">
             <div className="bg-white/10 text-slate-200 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm shadow-sm">
                CTA: <span className="font-semibold text-brand-300">{data.cta_button}</span>
             </div>
             <div className="bg-emerald-950/40 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                <Check className="w-3 h-3" /> Compliance Checked
             </div>
          </div>
        </div>
      </div>

      {/* Sanitization Alert */}
      {data.sanitization_report && (
        <div className={`glass-panel border rounded-2xl p-4 flex items-start gap-4 ${hasInjections ? 'border-red-500/30 bg-red-950/20' : 'border-emerald-500/20 bg-emerald-950/20'}`}>
           <div className={`p-2 rounded-full ${hasInjections ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
             {hasInjections ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
           </div>
           <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                  <div>
                    <h4 className={`text-sm font-bold ${hasInjections ? 'text-red-400' : 'text-emerald-400'}`}>
                        Sanitizer Report (Step 0A)
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                        Content cleaned. {data.sanitization_report.removed_sections_summary.length} noisy sections removed.
                    </p>
                  </div>
                  <button onClick={() => toggleJson('sanitize')} className="text-slate-500 hover:text-white transition-colors p-1">
                      <Code className="w-4 h-4" />
                  </button>
              </div>
              
              {hasInjections && (
                 <div className="mt-2">
                    <span className="text-xs font-bold text-red-400 block mb-1">Blocked Injections:</span>
                    <ul className="list-disc list-inside text-xs text-red-300/80">
                       {data.sanitization_report.detected_injection_patterns.map((p, i) => (
                         <li key={i}>{p}</li>
                       ))}
                    </ul>
                 </div>
              )}
              
              {showJson['sanitize'] && <JsonViewer data={data.sanitization_report} label="Sanitizer" />}
           </div>
        </div>
      )}

      {/* Brand DNA & Facts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Brand DNA Report */}
        {data.brand_dna && (
            <div className="glass-panel border border-purple-500/20 bg-purple-950/20 rounded-2xl p-4 md:p-5 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-purple-500/20 text-purple-400">
                            <Fingerprint className="w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-purple-400">Brand DNA</h4>
                            <p className="text-[10px] text-slate-400">Tone & Style</p>
                        </div>
                    </div>
                    <button onClick={() => toggleJson('brand')} className="text-purple-400/50 hover:text-purple-300 transition-colors p-1">
                        <Code className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-4 flex-1">
                    <div>
                        <span className="text-[10px] font-bold text-slate-300 block mb-1.5 uppercase tracking-wider">Voice Traits</span>
                        <div className="flex flex-wrap gap-1.5">
                            {data.brand_dna.voice_traits.map((trait, i) => (
                            <span key={i} className="text-xs bg-purple-900/40 text-purple-200 px-2 py-1 rounded border border-purple-500/20">{trait}</span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-300 block mb-1.5 uppercase tracking-wider">Taboo Words</span>
                        <p className="text-xs text-slate-500 italic">{data.brand_dna.taboo_words.join(', ')}</p>
                    </div>
                </div>
                
                {showJson['brand'] && <JsonViewer data={data.brand_dna} label="Brand DNA" />}
            </div>
        )}

        {/* Fact Extraction Report */}
        {data.fact_extraction_report && (
            <div className="glass-panel border border-blue-500/20 bg-blue-950/20 rounded-2xl p-4 md:p-5 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-500/20 text-blue-400">
                            <FileSearch className="w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-blue-400">Product Facts</h4>
                            <p className="text-[10px] text-slate-400">Extracted Data</p>
                        </div>
                    </div>
                    <button onClick={() => toggleJson('facts')} className="text-blue-400/50 hover:text-blue-300 transition-colors p-1">
                        <Code className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="space-y-3 flex-1 overflow-y-auto max-h-40 custom-scrollbar pr-2">
                    <div>
                        <ul className="list-disc list-inside text-xs text-slate-400 space-y-1.5">
                            {data.fact_extraction_report.facts.slice(0, 5).map((f, i) => (
                                <li key={i}>{f}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                {showJson['facts'] && <JsonViewer data={data.fact_extraction_report} label="Facts" />}
            </div>
        )}
      </div>

      {/* Product Truth Sheet (Step 2) */}
      {data.product_truth_sheet && (
         <div className="glass-panel border border-rose-500/20 bg-rose-950/20 rounded-2xl p-5">
            <div className="flex justify-between items-start mb-4">
               <div className="flex items-center gap-3">
                   <div className="p-2 rounded-full bg-rose-500/20 text-rose-400">
                       <Lock className="w-4 h-4" />
                   </div>
                   <div>
                       <h4 className="text-sm font-bold text-rose-400">Product Truth Sheet</h4>
                       <p className="text-[10px] text-slate-400">Compliance & Safety</p>
                   </div>
               </div>
               <button onClick={() => toggleJson('pts')} className="text-rose-400/50 hover:text-rose-300 transition-colors p-1">
                   <Code className="w-4 h-4" />
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
               <div className="space-y-4">
                   <div>
                     <span className="font-bold text-slate-200 block mb-2">Safe Benefit Phrases</span>
                     <ul className="list-disc list-inside text-emerald-400/80 space-y-1 bg-black/20 p-3 rounded-xl border border-white/5">
                       {data.product_truth_sheet.safe_benefit_phrases.slice(0, 5).map((p, i) => <li key={i}>{p}</li>)}
                     </ul>
                   </div>
                   <div>
                     <span className="font-bold text-slate-200 block mb-2">Required Disclaimer</span>
                     <div className="bg-black/40 border border-white/10 p-3 rounded-xl text-slate-400 italic">
                       "{data.product_truth_sheet.required_disclaimer}"
                     </div>
                   </div>
               </div>
               <div>
                   <span className="font-bold text-red-400 block mb-2">Forbidden Claims (NEVER Use)</span>
                   <ul className="list-disc list-inside text-red-400/70 space-y-1 bg-red-950/10 p-3 rounded-xl border border-red-500/10">
                     {data.product_truth_sheet.forbidden_claims.slice(0, 8).map((p, i) => <li key={i}>{p}</li>)}
                   </ul>
               </div>
            </div>

            {showJson['pts'] && <JsonViewer data={data.product_truth_sheet} label="PTS" />}
         </div>
      )}

      {/* Storyboard Planner (Step 3) */}
      {data.storyboard && (
         <div className="glass-panel border border-orange-500/20 bg-orange-950/20 rounded-2xl p-5">
             <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-orange-500/20 text-orange-400">
                        <Clapperboard className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-orange-400">Storyboard Planner</h4>
                        <p className="text-[10px] text-slate-400">Preset: <span className="text-orange-300 font-bold uppercase">{data.storyboard.preset_used_optional || "Custom"}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-[10px] bg-orange-900/30 border border-orange-500/30 px-2 py-1 rounded text-orange-300 font-mono">
                       {data.storyboard.total_seconds}s
                    </div>
                    <button onClick={() => toggleJson('storyboard')} className="text-orange-400/50 hover:text-orange-300 transition-colors p-1">
                       <Code className="w-4 h-4" />
                    </button>
                </div>
             </div>

             <div className="space-y-2">
                {data.storyboard.scenes.map((scene, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-3 text-xs border border-white/5 flex items-center gap-3">
                        <div className="text-orange-400 font-mono font-bold w-8 text-center shrink-0">{scene.seconds}</div>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="bg-white/10 text-slate-300 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">{scene.scene_id}</span>
                                <span className="text-slate-200 font-bold truncate">{scene.goal}</span>
                            </div>
                            <div className="flex flex-wrap gap-x-2 text-[10px] text-slate-500">
                               <span className="flex items-center gap-1 truncate"><Anchor className="w-3 h-3" /> {scene.hook_mechanic}</span>
                               <span className="text-slate-700 hidden sm:inline">|</span>
                               <span className="truncate">{scene.location}</span>
                            </div>
                        </div>
                    </div>
                ))}
             </div>

             {showJson['storyboard'] && <JsonViewer data={data.storyboard} label="Storyboard" />}
         </div>
      )}

      {/* UGC Shot List (Step 4) */}
      {data.ugc_prompts && (
         <div className="glass-panel border border-teal-500/20 bg-teal-950/20 rounded-2xl p-5">
             <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-teal-500/20 text-teal-400">
                        <Camera className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-teal-400">UGC Shot List</h4>
                        <p className="text-[10px] text-slate-400">Production Prompts</p>
                    </div>
                </div>
                <button onClick={() => toggleJson('ugc')} className="text-teal-400/50 hover:text-teal-300 transition-colors p-1">
                    <Code className="w-4 h-4" />
                </button>
             </div>
             
             <div className="grid gap-4">
                {data.ugc_prompts.map((prompt, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-4 text-xs border border-white/5 hover:border-teal-500/30 transition-colors">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                            <span className="text-teal-400 font-bold uppercase tracking-wider">{prompt.scene_id}</span>
                            <span className="text-slate-500 font-mono">{data.storyboard?.scenes[i]?.seconds || `Scene ${i+1}`}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Action & Pose</span>
                                <div className="flex items-start gap-2 text-slate-300">
                                    <ScanFace className="w-3 h-3 mt-0.5 text-teal-500/70 shrink-0" />
                                    <p className="leading-relaxed">{prompt.pose} — {prompt.action}</p>
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Framing & Handling</span>
                                <div className="flex items-start gap-2 text-slate-300">
                                    <Hand className="w-3 h-3 mt-0.5 text-teal-500/70 shrink-0" />
                                    <p className="leading-relaxed">{prompt.shot_framing} — {prompt.hands_and_product_handling}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="bg-black/30 p-3 rounded-xl border border-white/10 relative group">
                                <span className="text-[9px] text-slate-500 uppercase font-bold absolute top-2 right-2">Midjourney</span>
                                <p className="text-slate-400 pr-12 line-clamp-2 group-hover:line-clamp-none transition-all leading-relaxed">{prompt.ugc_prompt}</p>
                                <button 
                                    onClick={() => handleCopyUGCPrompt(prompt.ugc_prompt, i)}
                                    className="text-teal-500 hover:text-teal-400 absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                                >
                                    {copiedUGCPrompt === i ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
             </div>
             
             {showJson['ugc'] && <JsonViewer data={data.ugc_prompts} label="UGC Prompts" />}
         </div>
      )}

      {/* Scene Setups (Step 5) */}
      {data.scene_setups && (
        <div className="glass-panel border border-indigo-500/20 bg-indigo-950/20 rounded-2xl p-5">
             <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                   <div className="p-2 rounded-full bg-indigo-500/20 text-indigo-400">
                      <Lamp className="w-4 h-4" />
                   </div>
                   <div>
                      <h4 className="text-sm font-bold text-indigo-400">Production Setup</h4>
                      <p className="text-[10px] text-slate-400">Lighting & Props</p>
                   </div>
                </div>
                <button onClick={() => toggleJson('scenes')} className="text-indigo-400/50 hover:text-indigo-300 transition-colors p-1">
                    <Code className="w-4 h-4" />
                </button>
             </div>
             
             <div className="grid gap-3">
                {data.scene_setups.map((setup, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 text-xs border border-white/5">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/5">
                        <span className="text-indigo-400 font-bold uppercase tracking-wider">{setup.scene_id}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] bg-indigo-900/40 text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-500/30 truncate max-w-[100px]">{setup.lighting}</span>
                           <span className="text-[10px] text-slate-500 hidden sm:inline">{setup.time_of_day}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Set Dressing</span>
                        <ul className="list-disc list-inside text-slate-300/80 space-y-0.5">
                          {setup.set_dressing.map((item, idx) => <li key={idx} className="truncate">{item}</li>)}
                        </ul>
                      </div>
                      <div className="space-y-2">
                           <div className="bg-white/5 p-2 rounded border border-white/10">
                              <span className="text-[9px] text-slate-500 font-bold block">Continuity</span>
                              <p className="text-slate-400 leading-tight">{setup.continuity_notes.join('. ')}</p>
                           </div>
                           <div className="bg-red-900/10 p-2 rounded border border-red-900/20">
                              <span className="text-[9px] text-red-400/60 font-bold block">Safety</span>
                              <p className="text-red-300/60 leading-tight">{setup.safety_and_compliance_notes.join('. ')}</p>
                           </div>
                      </div>
                    </div>
                  </div>
                ))}
             </div>

             {showJson['scenes'] && <JsonViewer data={data.scene_setups} label="Scene Setups" />}
        </div>
      )}

      {/* VO Script & Audio (Step 6) */}
      {data.vo_script && (
         <div className="glass-panel border border-pink-500/20 bg-pink-950/20 rounded-2xl p-5">
             <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                   <div className="p-2 rounded-full bg-pink-500/20 text-pink-400">
                      <Mic className="w-4 h-4" />
                   </div>
                   <div>
                      <h4 className="text-sm font-bold text-pink-400">VO Script</h4>
                      <p className="text-[10px] text-slate-400">Gen Z Indonesian ({data.vo_script.duration_seconds}s)</p>
                   </div>
                </div>
                <button onClick={() => toggleJson('vo')} className="text-pink-400/50 hover:text-pink-300 transition-colors p-1">
                   <Code className="w-4 h-4" />
                </button>
             </div>

             {/* Master Script Table */}
             <div className="bg-black/40 rounded-xl overflow-x-auto border border-white/5 mb-4 shadow-inner custom-scrollbar">
               <table className="w-full text-xs text-left min-w-[500px]">
                 <thead className="bg-white/5 text-slate-400 font-medium">
                   <tr>
                     <th className="px-4 py-3 w-16">Time</th>
                     <th className="px-4 py-3">Line (Bahasa Indonesia)</th>
                     <th className="px-4 py-3 w-32 text-right">Audio</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                   {data.vo_script.timecodes.map((tc, i) => (
                     <tr key={i} className="hover:bg-white/5 transition-colors group">
                       <td className="px-4 py-3 font-mono text-pink-400/80 align-middle">{tc.seconds}</td>
                       <td className="px-4 py-3 text-slate-200 relative pr-8 align-middle">
                         {tc.line}
                         <button 
                             onClick={() => handleCopyScript(tc.line, i + 100)} 
                             className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity p-1"
                             title="Copy Text"
                         >
                             {copiedIndex === i + 100 ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                         </button>
                       </td>
                       <td className="px-4 py-3 text-right align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                             <button 
                               onClick={() => handlePlayAudio(tc.line, i)}
                               disabled={playingIndex !== null}
                               className={`p-2 rounded-lg transition-all ${
                                 playingIndex === i 
                                   ? 'bg-pink-500 text-white' 
                                   : 'bg-white/10 text-pink-400 hover:bg-pink-500/20'
                               } disabled:opacity-50`}
                               title="Generate & Play Audio"
                             >
                               {playingIndex === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                             </button>
                             {audioCache[i] && (
                                 <button 
                                   onClick={() => handleDownloadAudio(i)}
                                   className="p-2 rounded-lg bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white transition-all"
                                   title="Download WAV"
                                 >
                                   <Download className="w-3.5 h-3.5" />
                                 </button>
                             )}
                          </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
               <div className="bg-pink-900/20 px-4 py-3 border-t border-pink-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center min-w-[500px] gap-2">
                  <span className="text-pink-300 font-bold uppercase text-[10px] tracking-wider">Call To Action</span>
                  <span className="text-white font-medium text-xs">{data.vo_script.cta}</span>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Alt Hooks */}
                <div>
                   <span className="text-[10px] text-slate-500 uppercase font-bold block mb-2">Alternative Hooks (A/B Test)</span>
                   <div className="space-y-2">
                     {data.vo_script.alt_hooks.slice(0, 5).map((hook, i) => (
                       <div key={i} className="flex items-center justify-between text-xs bg-white/5 px-3 py-2.5 rounded-lg border border-white/5 group hover:border-pink-500/30 transition-colors">
                          <span className="text-slate-300 truncate mr-2">{hook}</span>
                          <button 
                             onClick={() => handleCopyAltHook(hook, i)}
                             className="text-slate-600 hover:text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          >
                             {copiedAltHook === i ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                       </div>
                     ))}
                   </div>
                </div>
                
                {/* On Screen Text */}
                <div>
                   <span className="text-[10px] text-slate-500 uppercase font-bold block mb-2">On-Screen Text Ideas</span>
                   <div className="flex flex-wrap gap-2">
                     {data.vo_script.on_screen_text_suggestions.map((txt, i) => (
                       <span key={i} className="text-xs bg-black/40 text-yellow-400/80 px-3 py-1.5 rounded-lg border border-white/10">
                         {txt}
                       </span>
                     ))}
                   </div>
                   {data.vo_script.required_disclaimer_included && (
                     <div className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-900/20 px-3 py-2 rounded-lg border border-emerald-900/30">
                        <Check className="w-3 h-3" />
                        Disclaimer Included Automatically
                     </div>
                   )}
                </div>
             </div>

             {showJson['vo'] && <JsonViewer data={data.vo_script} label="VO Script" />}
         </div>
      )}

      {/* Video Prompt Package (Step 7) */}
      {data.video_prompt && (
        <div className="glass-panel border border-cyan-500/20 bg-cyan-950/20 rounded-2xl p-5">
          <div className="flex justify-between items-start mb-4">
             <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-cyan-500/20 text-cyan-400">
                   <Film className="w-4 h-4" />
                </div>
                <div>
                   <h4 className="text-sm font-bold text-cyan-400">Video AI Prompts</h4>
                   <p className="text-[10px] text-slate-400">Runway / Luma / Kling</p>
                </div>
             </div>
             <button onClick={() => toggleJson('video')} className="text-cyan-400/50 hover:text-cyan-300 transition-colors p-1">
                 <Code className="w-4 h-4" />
             </button>
          </div>

          <div className="space-y-4">
             {/* Shotlist Table */}
             <div className="bg-black/40 rounded-xl overflow-hidden border border-white/5">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white/5 text-slate-400 font-medium">
                    <tr>
                      <th className="px-4 py-2 w-16">Scene</th>
                      <th className="px-4 py-2">Camera Move</th>
                      <th className="px-4 py-2">Focus & Constraints</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.video_prompt.shotlist.map((shot, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                         <td className="px-4 py-2 font-mono text-cyan-400/80 uppercase">{shot.scene_id}</td>
                         <td className="px-4 py-2 text-slate-200">{shot.camera_move}</td>
                         <td className="px-4 py-2">
                            <div className="space-y-1">
                               <div className="flex items-center gap-1.5 text-slate-300">
                                  <Focus className="w-3 h-3 text-cyan-500/70" /> {shot.focus_rule}
                               </div>
                               <div className="flex items-center gap-1.5 text-slate-400">
                                  <ShieldCheck className="w-3 h-3 text-emerald-500/70" /> {shot.product_readability_rule}
                               </div>
                            </div>
                         </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Global Constraints */}
                <div>
                   <span className="text-[10px] text-slate-500 uppercase font-bold block mb-2 flex items-center gap-1">
                     <Globe className="w-3 h-3" /> Global Constraints
                   </span>
                   <div className="flex flex-wrap gap-1.5">
                      {data.video_prompt.global_constraints.map((constaint, i) => (
                        <span key={i} className="text-xs bg-white/5 text-slate-300 px-2 py-1 rounded border border-white/10">
                          {constaint}
                        </span>
                      ))}
                   </div>
                </div>

                {/* Negative Prompt */}
                <div>
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                       <Ban className="w-3 h-3" /> Negative Video Prompt
                     </span>
                     <button 
                        onClick={() => handleCopyNegVideo(data.video_prompt!.negative_prompt_video.join(', '))}
                        className="text-cyan-500 hover:text-cyan-400 text-[10px] flex items-center gap-1 transition-colors p-1"
                     >
                        {copiedNegVideo ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        Copy All
                     </button>
                   </div>
                   <div className="bg-red-950/20 p-3 rounded-xl border border-red-900/30 max-h-32 overflow-y-auto custom-scrollbar">
                      <p className="text-xs text-red-300/70 leading-relaxed font-mono">
                        {data.video_prompt.negative_prompt_video.join(', ')}
                      </p>
                   </div>
                </div>
             </div>

             {showJson['video'] && <JsonViewer data={data.video_prompt} label="Video Prompt" />}
          </div>
        </div>
      )}

      {/* Evaluation Report (Step 8) */}
      {data.evaluation && (
        <div className={`glass-panel border rounded-2xl p-5 flex items-start gap-4 ${data.evaluation.passed ? 'border-green-500/30 bg-green-950/20' : 'border-yellow-500/30 bg-yellow-950/20'}`}>
           <div className={`p-2 rounded-full ${data.evaluation.passed ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
             {data.evaluation.passed ? <ClipboardCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
           </div>
           <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                  <div>
                    <h4 className={`text-sm font-bold ${data.evaluation.passed ? 'text-green-400' : 'text-yellow-400'}`}>
                        Validation Report
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 mb-3">
                        AI Agent Quality Control
                    </p>
                  </div>
                  <button onClick={() => toggleJson('eval')} className="text-slate-500 hover:text-white transition-colors p-1">
                      <Code className="w-4 h-4" />
                  </button>
              </div>

              {data.evaluation.issues.length > 0 && (
                <div className="mb-3">
                   <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block mb-1">Issues Found</span>
                   <ul className="space-y-1">
                      {data.evaluation.issues.map((issue, i) => (
                        <li key={i} className="text-xs text-red-300/80 flex items-start gap-1.5">
                           <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                           {issue}
                        </li>
                      ))}
                   </ul>
                </div>
              )}

              {data.evaluation.fixes_applied.length > 0 && (
                <div className="mb-3">
                   <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Auto-Fixes Applied</span>
                   <ul className="space-y-1">
                      {data.evaluation.fixes_applied.map((fix, i) => (
                        <li key={i} className="text-xs text-blue-300/80 flex items-start gap-1.5">
                           <Wrench className="w-3 h-3 mt-0.5 shrink-0" />
                           {fix}
                        </li>
                      ))}
                   </ul>
                </div>
              )}

              {data.evaluation.regenerate_steps.length > 0 && (
                 <div className="mt-2 bg-yellow-950/30 p-2 rounded border border-yellow-900/30">
                    <div className="flex items-center gap-2 text-yellow-500/80 text-xs font-bold mb-1">
                       <RefreshCw className="w-3 h-3" />
                       Recommended Regeneration
                    </div>
                    <p className="text-xs text-yellow-600/70">
                       Ideally, the system should restart: {data.evaluation.regenerate_steps.join(', ')}
                    </p>
                 </div>
              )}

              {showJson['eval'] && <JsonViewer data={data.evaluation} label="Evaluation" />}
           </div>
        </div>
      )}

      {/* Header Info (Repeat for Footer Context) */}
      <div className="glass-panel border border-white/5 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
          <Video className="w-6 h-6 text-brand-500" />
          Master Production Board
        </h3>
        
        {data.scenes.map((scene, idx) => (
          <div key={idx} className="bg-white/5 rounded-2xl overflow-hidden group hover:border-brand-500/40 transition-all duration-300 mt-4 border border-white/5">
            {/* Time Header */}
            <div className="bg-black/20 px-5 py-3 flex justify-between items-center border-b border-white/5">
              <span className="font-mono text-brand-400 text-sm font-bold bg-brand-900/20 px-2 py-0.5 rounded border border-brand-500/20">{scene.seconds}</span>
              <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Scene {idx + 1}</span>
            </div>
            
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Visuals */}
              <div className="space-y-4">
                <div>
                  <span className="text-slate-500 uppercase text-[10px] font-bold tracking-wider block mb-1.5">Visual Direction</span>
                  <p className="text-slate-200 leading-relaxed text-sm">{scene.visual_description}</p>
                </div>
                <div>
                   <span className="text-slate-500 uppercase text-[10px] font-bold tracking-wider block mb-1.5">Overlay Text</span>
                   <span className="bg-black/40 text-yellow-400 px-3 py-1.5 rounded-lg font-medium text-sm border border-white/10 inline-block shadow-lg">
                     "{scene.on_screen_text}"
                   </span>
                </div>
                
                {/* Image Prompt for AI Gen */}
                <div className="mt-4 pt-4 border-t border-white/5">
                   <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-600 uppercase text-[10px] font-bold tracking-wider">Midjourney / SD Prompt</span>
                      <button 
                        onClick={() => handleCopyPrompt(scene.image_prompt, idx)}
                        className="text-brand-500 hover:text-brand-400 text-[10px] flex items-center gap-1 p-1"
                      >
                         {copiedPrompt === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                         Copy
                      </button>
                   </div>
                   <p className="text-xs text-slate-500 bg-black/40 p-3 rounded-xl border border-white/5 font-mono break-all line-clamp-2 hover:line-clamp-none transition-all cursor-help hover:text-slate-400" title={scene.image_prompt}>
                     {scene.image_prompt}
                   </p>
                </div>
              </div>

              {/* Audio */}
              <div className="glass-panel bg-white/5 rounded-xl p-4 border border-white/5 relative flex flex-col justify-center">
                 <span className="text-slate-500 uppercase text-[10px] font-bold tracking-wider block mb-3 flex items-center gap-1.5"><Volume2 className="w-3 h-3" /> Voiceover (ID)</span>
                 <p className="text-lg text-white font-medium leading-relaxed font-sans pr-10">"{scene.audio_script}"</p>
                 <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                   <button 
                     onClick={() => handlePlayAudio(scene.audio_script, idx + 200)}
                     disabled={playingIndex !== null}
                     className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${playingIndex === idx + 200 ? 'text-pink-500' : 'text-slate-400 hover:text-white'}`}
                     title="Play Audio"
                   >
                     {playingIndex === idx + 200 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                   </button>
                    {audioCache[idx + 200] && (
                        <button 
                          onClick={() => handleDownloadAudio(idx + 200)}
                          className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                          title="Download WAV"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                    )}
                   <button 
                     onClick={() => handleCopyScript(scene.audio_script, idx)}
                     className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                     title="Copy Script"
                   >
                     {copiedIndex === idx ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                   </button>
                 </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Meta Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="glass-panel border border-white/5 rounded-2xl p-6">
            <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-500" />
              Suggested Caption
            </h4>
            <p className="text-sm text-slate-400 whitespace-pre-line leading-relaxed">{data.caption}</p>
         </div>

         <div className="glass-panel border border-white/5 rounded-2xl p-6">
            <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Compliance Notes
            </h4>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">{data.compliance_check}</p>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-2">Negative Prompt (Video)</span>
              <code className="text-[10px] text-slate-500 bg-black/40 p-3 rounded-lg block font-mono break-all">{data.negative_prompt_video}</code>
            </div>
         </div>
      </div>

    </div>
  );
};