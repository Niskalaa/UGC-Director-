
import React, { useState, useRef, useEffect } from 'react';
import { GeneratedAsset } from '../types';
import { generateSpeech, getWavBlob, analyzeVoiceStyle, generateImagePreview } from '../services/geminiService';
import { getStoredReplicateKey, generateFluxImage, generateMinimaxVideo } from '../services/externalService';
import { Copy, Check, Clapperboard, Play, Loader2, Mic, Download, Pause, Volume2, FileJson, FileText, Image, Database, Settings2, Share2, MoreHorizontal, Upload, Wand2, Eye, Brain, Video, Sparkles, Monitor, Tablet, Smartphone, Maximize2, X, AlertCircle, Camera, Film, Clock, Gauge } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
const SPEECH_STYLES = [
  'Natural',
  'Excited',
  'Serious',
  'Whispering',
  'Shouting',
  'Fast-paced',
  'Slow & Deliberate',
  'Friendly'
];

type AspectRatio = "9:16" | "16:9" | "1:1";
type VideoStyle = "vlog" | "cinematic" | "commercial";

const VIDEO_STYLES: Record<VideoStyle, { label: string, promptPrefix: string }> = {
    vlog: { label: "Vlog (Handheld)", promptPrefix: "Handheld smartphone footage, vlog style, authentic shake, UGC aesthetic" },
    cinematic: { label: "Cinematic (Smooth)", promptPrefix: "Cinematic shot, smooth gimbal movement, high production value, 4k" },
    commercial: { label: "Commercial (Crisp)", promptPrefix: "Professional commercial footage, steady cam, bright lighting, high clarity" }
};

export const OutputDisplay: React.FC<{ data: GeneratedAsset | null }> = ({ data }) => {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [overrideVoice, setOverrideVoice] = useState<string | null>(null);
  const [speechStyle, setSpeechStyle] = useState<string>('Natural');
  
  // Media Generation State
  const [previewImages, setPreviewImages] = useState<Record<number, string>>({});
  const [previewVideos, setPreviewVideos] = useState<Record<number, string>>({});
  const [loadingImageIdx, setLoadingImageIdx] = useState<number | null>(null);
  const [loadingVideoIdx, setLoadingVideoIdx] = useState<number | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  
  // Video Settings
  const [videoStyle, setVideoStyle] = useState<VideoStyle>("vlog");
  const [videoFps, setVideoFps] = useState<"24" | "30" | "60">("30");
  const [videoDuration, setVideoDuration] = useState<"5s" | "10s">("5s"); // Note: Minimax often defaults to 6s, this is for prompt steering
  
  // View Modal State
  const [viewModalContent, setViewModalContent] = useState<{type: 'image' | 'video', url: string} | null>(null);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [hasReplicateKey, setHasReplicateKey] = useState(false);

  // Custom Voice State
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [customVoiceTone, setCustomVoiceTone] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasReplicateKey(!!getStoredReplicateKey());
  }, [showSettings]);

  if (!data) return (
    <div className="h-full flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
      <Clapperboard className="w-12 h-12 mb-4 opacity-50" />
      <p>Waiting for director's input...</p>
    </div>
  );

  // Helper to determine the best voice and tone
  const getVoiceConfig = () => {
    const dna = data.brand_dna;
    const traits = dna?.voice_traits?.map(t => t.toLowerCase()) || [];
    const audience = dna?.audience_guess?.toLowerCase() || '';

    let voice = 'Kore'; 
    if (audience.includes('male') || audience.includes('men') || traits.some(t => ['deep', 'authoritative', 'bold', 'assertive'].includes(t))) {
      voice = 'Fenrir'; 
    } else if (traits.some(t => ['calm', 'soft', 'gentle'].includes(t))) {
       voice = 'Kore'; 
    }

    const tone = customVoiceTone || (speechStyle !== 'Natural' ? `Speak in a ${speechStyle} tone` : null) || (traits.slice(0, 3).join(', '));
    return { voice, tone };
  };

  const { voice: recommendedVoice, tone: activeTone } = getVoiceConfig();
  const activeVoice = overrideVoice || recommendedVoice;

  const handleVoiceChange = (newVoice: string) => {
    setOverrideVoice(newVoice);
    setAudioUrls({});
    if (activeAudio) {
      activeAudio.pause();
      setActiveAudio(null);
    }
    setPlayingIdx(null);
  };

  const handleStyleChange = (style: string) => {
    setSpeechStyle(style);
    setAudioUrls({}); 
    if (activeAudio) {
        activeAudio.pause();
        setActiveAudio(null);
    }
    setPlayingIdx(null);
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingVoice(true);
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            const analyzedTone = await analyzeVoiceStyle(base64Audio);
            setCustomVoiceTone(analyzedTone);
            setAudioUrls({});
            alert(`Voice Clone Active: Style adapted to "${analyzedTone}"`);
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error("Voice analysis failed", err);
        alert("Could not analyze voice sample.");
    } finally {
        setIsProcessingVoice(false);
    }
  };

  const handleTogglePlay = async (text: string, idx: number) => {
    if (playingIdx === idx && activeAudio) {
      activeAudio.pause();
      setPlayingIdx(null);
      return;
    }
    if (activeAudio) {
      activeAudio.pause();
      setPlayingIdx(null);
    }
    setLoadingIdx(idx);

    try {
      let url = audioUrls[idx];
      if (!url) {
        const b64 = await generateSpeech(text, activeVoice, activeTone || undefined);
        const blob = getWavBlob(b64);
        url = URL.createObjectURL(blob);
        setAudioUrls(prev => ({ ...prev, [idx]: url }));
      }
      
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingIdx(null);
        setActiveAudio(null);
      };
      
      try {
        await audio.play();
        setActiveAudio(audio);
        setPlayingIdx(idx);
      } catch (playErr) {
        console.warn("Auto-play blocked after generation.", playErr);
      }
      
    } catch (e) {
      console.error(e);
      alert("Error generating audio. Please check quota or try again.");
    } finally {
      setLoadingIdx(null);
    }
  };

  const handleGeneratePreview = async (prompt: string, idx: number) => {
      if (loadingImageIdx !== null) return;
      setLoadingImageIdx(idx);
      try {
          let imageUrl = "";
          // Determine Provider
          if (hasReplicateKey) {
             imageUrl = await generateFluxImage(prompt, aspectRatio);
          } else {
             imageUrl = await generateImagePreview(prompt, aspectRatio);
          }

          if (imageUrl) {
              setPreviewImages(prev => ({ ...prev, [idx]: imageUrl }));
          } else {
              alert("Failed to generate preview image.");
          }
      } catch (e) {
          console.error(e);
          alert(e instanceof Error ? e.message : "Image generation failed");
      } finally {
          setLoadingImageIdx(null);
      }
  };

  const handleGenerateVideo = async (prompt: string, idx: number) => {
      if (loadingVideoIdx !== null) return;
      if (!hasReplicateKey) {
          setShowSettings(true);
          return;
      }

      setLoadingVideoIdx(idx);
      try {
          // Construct enhanced prompt with video settings
          const stylePrefix = VIDEO_STYLES[videoStyle].promptPrefix;
          const enhancedPrompt = `${stylePrefix}. ${prompt}. Frame rate: ${videoFps}fps.`;
          
          const videoUrl = await generateMinimaxVideo(enhancedPrompt);
          if (videoUrl) {
              setPreviewVideos(prev => ({ ...prev, [idx]: videoUrl }));
          }
      } catch (e) {
          console.error(e);
          alert(e instanceof Error ? e.message : "Video generation failed");
      } finally {
          setLoadingVideoIdx(null);
      }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyToClipboard = (label: string, content: any) => {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(label);
      setTimeout(() => setCopiedSection(null), 2000);
    }).catch(err => {
      console.error("Clipboard access denied:", err);
      alert("Cannot copy to clipboard. Please allow clipboard permissions or copy manually.");
    });
  };

  const isPartial = !data.scenes || data.scenes.length === 0;

  return (
    <div className="space-y-6 animate-in pb-12">
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Media Viewer Modal */}
      {viewModalContent && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
           <button 
              onClick={() => setViewModalContent(null)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
           >
              <X className="w-6 h-6" />
           </button>
           <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col items-center">
              {viewModalContent.type === 'video' ? (
                <video src={viewModalContent.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
              ) : (
                <img src={viewModalContent.url} alt="Full view" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain" />
              )}
              <div className="mt-6 flex gap-4">
                 <button 
                    onClick={() => handleDownload(viewModalContent.url, `ugc-generated-${Date.now()}.${viewModalContent.type === 'video' ? 'mp4' : 'jpg'}`)}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all"
                 >
                    <Download className="w-5 h-5" /> Download {viewModalContent.type === 'video' ? 'Video' : 'Image'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Title & Controls */}
      <div className="glass-panel p-8 rounded-3xl border-l-4 border-brand-500 bg-gradient-to-r from-brand-900/10 to-transparent relative overflow-hidden">
        {/* Settings Trigger */}
        <button 
          onClick={() => setShowSettings(true)}
          className={`absolute top-6 right-6 p-2 rounded-lg transition-colors border ${hasReplicateKey ? 'bg-brand-900/20 text-brand-400 border-brand-500/30' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}
          title="Configure External AI Keys"
        >
          <Settings2 className="w-5 h-5" />
        </button>

        <div className="relative z-10">
          <div className="flex justify-between items-start gap-4 pr-12">
            <div>
               <h2 className="text-3xl font-black text-white mb-2">{data.concept_title}</h2>
               <p className="text-slate-300 italic mb-4">"{data.hook_rationale}"</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            
            {/* Voice Control Group */}
            <div className="flex items-center gap-3 text-xs text-brand-400 bg-brand-900/20 px-4 py-2 rounded-full border border-brand-500/20">
              <Mic className="w-3.5 h-3.5" />
              <div className="flex items-center gap-2">
                <span className="text-brand-500/70 uppercase font-bold tracking-wider">Voice:</span>
                <select 
                  value={activeVoice}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="bg-transparent text-white font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-brand-300 transition-colors"
                >
                  {VOICES.map(v => (
                    <option key={v} value={v} className="bg-zinc-900 text-slate-200">{v}</option>
                  ))}
                </select>
              </div>
              <span className="text-brand-500/20">|</span>
              <div className="flex items-center gap-2">
                <span className="text-brand-500/70 uppercase font-bold tracking-wider">Style:</span>
                <select 
                  value={speechStyle}
                  onChange={(e) => handleStyleChange(e.target.value)}
                  className="bg-transparent text-white font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-brand-300 transition-colors"
                >
                  {SPEECH_STYLES.map(s => (
                    <option key={s} value={s} className="bg-zinc-900 text-slate-200">{s}</option>
                  ))}
                </select>
              </div>
              <span className="text-brand-500/20">|</span>
              
              <div className="flex items-center gap-2 pl-2 border-l border-brand-500/20">
                 <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden" 
                 />
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingVoice}
                    className={`flex items-center gap-1.5 hover:text-white transition-colors ${customVoiceTone ? 'text-emerald-400' : 'text-brand-300'}`}
                    title={customVoiceTone ? `Active Clone Style: ${customVoiceTone}` : "Upload sample to clone style"}
                 >
                    {isProcessingVoice ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3"/>}
                    {customVoiceTone ? 'Custom Active' : 'Clone Voice'}
                 </button>
              </div>
            </div>

            {/* Visual Settings Group */}
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/5">
                {/* Aspect Ratio */}
                <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
                    {[
                        { val: "9:16", icon: Smartphone, label: "Story (9:16)" },
                        { val: "16:9", icon: Monitor, label: "Cinema (16:9)" },
                        { val: "1:1", icon: Tablet, label: "Square (1:1)" }
                    ].map(r => (
                        <button
                            key={r.val}
                            onClick={() => setAspectRatio(r.val as AspectRatio)}
                            className={`p-1.5 rounded-full transition-all ${aspectRatio === r.val ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            title={r.label}
                        >
                            <r.icon className="w-3.5 h-3.5" />
                        </button>
                    ))}
                </div>

                {/* Video Style */}
                <div className="flex items-center gap-2 text-xs pr-2">
                    <Film className="w-3.5 h-3.5 text-indigo-400" />
                    <select 
                        value={videoStyle}
                        onChange={(e) => setVideoStyle(e.target.value as VideoStyle)}
                        className="bg-transparent text-slate-300 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-white transition-colors w-[60px]"
                        title="Video Generation Style"
                    >
                        <option className="bg-zinc-900" value="vlog">Vlog</option>
                        <option className="bg-zinc-900" value="cinematic">Cinema</option>
                        <option className="bg-zinc-900" value="commercial">Ad</option>
                    </select>
                </div>

                {/* Video FPS/Duration (Visual Toggles) */}
                {hasReplicateKey && (
                    <div className="hidden md:flex items-center gap-2 pl-2 border-l border-white/10 text-[10px]">
                        <button onClick={() => setVideoFps(videoFps === "30" ? "60" : "30")} className="flex items-center gap-1 text-slate-400 hover:text-indigo-400 transition-colors">
                            <Gauge className="w-3 h-3" /> {videoFps}fps
                        </button>
                        <button onClick={() => setVideoDuration(videoDuration === "5s" ? "10s" : "5s")} className="flex items-center gap-1 text-slate-400 hover:text-indigo-400 transition-colors">
                            <Clock className="w-3 h-3" /> {videoDuration}
                        </button>
                    </div>
                )}
            </div>
            
            {hasReplicateKey && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300">
                <Sparkles className="w-3 h-3" />
                Flux & Minimax Active
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Strategy Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2">
         <div className="glass-panel p-4 rounded-xl border border-white/5">
             <div className="flex items-center gap-2 mb-2">
                 <Brain className="w-4 h-4 text-purple-500" />
                 <h4 className="text-xs font-bold text-slate-400 uppercase">Brand DNA</h4>
             </div>
             <div className="flex flex-wrap gap-1.5">
                 {data.brand_dna?.voice_traits?.map((trait, i) => (
                     <span key={i} className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] border border-purple-500/20">{trait}</span>
                 )) || <div className="h-4 w-20 bg-white/5 rounded animate-pulse"></div>}
             </div>
         </div>
         <div className="glass-panel p-4 rounded-xl border border-white/5">
             <div className="flex items-center gap-2 mb-2">
                 <Eye className="w-4 h-4 text-emerald-500" />
                 <h4 className="text-xs font-bold text-slate-400 uppercase">Audience</h4>
             </div>
             <p className="text-xs text-slate-200">
                 {data.brand_dna?.audience_guess || <div className="h-4 w-full bg-white/5 rounded animate-pulse"></div>}
             </p>
         </div>
         <div className="glass-panel p-4 rounded-xl border border-white/5 lg:col-span-2">
             <div className="flex items-center gap-2 mb-2">
                 <Check className="w-4 h-4 text-brand-500" />
                 <h4 className="text-xs font-bold text-slate-400 uppercase">Core Product Truths</h4>
             </div>
              <div className="flex flex-wrap gap-2">
                 {data.product_truth_sheet?.core_facts?.slice(0,3).map((fact, i) => (
                     <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-300 bg-white/5 px-2 py-1 rounded">
                         <div className="w-1 h-1 bg-brand-500 rounded-full"></div>
                         {fact}
                     </div>
                 )) || <div className="h-4 w-40 bg-white/5 rounded animate-pulse"></div>}
              </div>
         </div>
      </div>

      {/* Scenes */}
      {isPartial ? (
         <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
                <h3 className="text-slate-300 font-bold mb-1">Director is drafting scenes...</h3>
                <p className="text-xs text-slate-500">Writing scripts based on brand DNA: <span className="text-brand-400">{data.brand_dna?.voice_traits?.join(', ')}</span></p>
            </div>
         </div>
      ) : (
        <div className="space-y-4">
            {data.scenes!.map((scene, idx) => (
            <div key={idx} className="glass-panel p-6 rounded-2xl border border-white/5 hover:border-brand-500/30 transition-colors group/card">
                
                {/* Scene Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                    <div className="bg-brand-500 text-white font-bold px-3 py-1 rounded text-xs">{scene.seconds}s</div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scene {idx + 1}</div>
                    </div>
                    <button 
                        onClick={() => copyToClipboard(`scene-${idx}`, scene)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-slate-400 hover:text-white transition-colors border border-white/5"
                    >
                        {copiedSection === `scene-${idx}` ? <Check className="w-3 h-3 text-emerald-500"/> : <FileJson className="w-3 h-3"/>}
                        JSON
                    </button>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                {/* Visual Column */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-slate-500 uppercase font-bold">Visual</div>
                        <div className="flex gap-2">
                             {/* Image Gen Button */}
                             {!previewImages[idx] && !previewVideos[idx] && (
                                <button 
                                    onClick={() => handleGeneratePreview(scene.image_prompt, idx)}
                                    disabled={loadingImageIdx === idx}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors ${hasReplicateKey ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 hover:bg-white/10 text-slate-300'}`}
                                >
                                    {loadingImageIdx === idx ? <Loader2 className="w-3 h-3 animate-spin"/> : <Image className="w-3 h-3"/>}
                                    {hasReplicateKey ? 'Generate Flux' : 'Visualize'}
                                </button>
                             )}
                             {/* Video Gen Button */}
                             {!previewVideos[idx] && (
                                 <button 
                                     onClick={() => handleGenerateVideo(scene.image_prompt, idx)}
                                     disabled={loadingVideoIdx === idx}
                                     className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] transition-colors border border-white/5"
                                     title={hasReplicateKey ? "Generate Video (Minimax)" : "Configure Replicate Key first"}
                                 >
                                     {loadingVideoIdx === idx ? <Loader2 className="w-3 h-3 animate-spin"/> : <Video className="w-3 h-3"/>}
                                     Video
                                 </button>
                             )}
                        </div>
                    </div>
                    
                    {/* Visual Media Display */}
                    {previewVideos[idx] ? (
                        <div className={`mb-4 relative rounded-lg overflow-hidden border border-white/10 bg-black group/media ${aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "16:9" ? "aspect-video" : "aspect-square"}`}>
                            <video 
                                src={previewVideos[idx]} 
                                controls 
                                autoPlay 
                                loop 
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-white flex items-center gap-1 z-10">
                                <Sparkles className="w-3 h-3 text-indigo-400" /> AI Video ({videoStyle})
                            </div>
                             <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/media:opacity-100 transition-opacity z-10">
                                <button onClick={() => handleDownload(previewVideos[idx], `scene-${idx+1}-video.mp4`)} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Download className="w-3 h-3" /></button>
                                <button onClick={() => setViewModalContent({type: 'video', url: previewVideos[idx]})} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Maximize2 className="w-3 h-3" /></button>
                            </div>
                        </div>
                    ) : previewImages[idx] ? (
                         <div className={`mb-4 relative rounded-lg overflow-hidden border border-white/10 group/media bg-black ${aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "16:9" ? "aspect-video" : "aspect-square"}`}>
                            <img src={previewImages[idx]} alt="Scene Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-2 opacity-0 group-hover/media:opacity-100 transition-opacity">
                                <span className="text-[10px] text-white/80 flex items-center gap-1">
                                    {hasReplicateKey ? <Sparkles className="w-3 h-3 text-indigo-400"/> : <Image className="w-3 h-3"/>}
                                    {hasReplicateKey ? 'Flux Schnell' : 'Gemini Flash Image'}
                                </span>
                            </div>
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/media:opacity-100 transition-opacity">
                                <button onClick={() => handleDownload(previewImages[idx], `scene-${idx+1}-image.jpg`)} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Download className="w-3 h-3" /></button>
                                <button onClick={() => setViewModalContent({type: 'image', url: previewImages[idx]})} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Maximize2 className="w-3 h-3" /></button>
                            </div>
                         </div>
                    ) : (loadingImageIdx === idx || loadingVideoIdx === idx) ? (
                        <div className={`mb-4 relative rounded-xl overflow-hidden border border-white/10 bg-[#050505] flex flex-col items-center justify-center gap-4 group ${aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "16:9" ? "aspect-video" : "aspect-square"}`}>
                           
                           {/* Tech Grid Background */}
                           <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                           
                           {/* Radial Glow */}
                           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.15)_0%,transparent_70%)]"></div>

                           {/* Vertical Scanning Line */}
                           <div className="absolute inset-0 w-full h-[50%] bg-gradient-to-b from-transparent via-brand-500/10 to-transparent animate-scan blur-sm"></div>
                           <div className="absolute inset-0 w-full h-px bg-brand-500/30 animate-scan shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>

                           {/* Central HUD */}
                           <div className="relative z-10 flex flex-col items-center">
                              <div className="w-16 h-16 relative mb-4">
                                 {/* Rotating Rings */}
                                 <div className="absolute inset-0 border-2 border-slate-800 rounded-full"></div>
                                 <div className="absolute inset-0 border-2 border-brand-500/50 rounded-full border-t-transparent animate-spin"></div>
                                 <div className="absolute inset-2 border border-white/10 rounded-full border-b-brand-400 animate-[spin_2s_linear_infinite_reverse]"></div>
                                 
                                 {/* Center Icon */}
                                 <div className="absolute inset-0 flex items-center justify-center">
                                    {loadingVideoIdx === idx ? (
                                       <Video className="w-6 h-6 text-white animate-pulse" />
                                    ) : (
                                       <Image className="w-6 h-6 text-white animate-pulse" />
                                    )}
                                 </div>
                              </div>

                              {/* Text Info */}
                              <div className="space-y-1.5 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                     <span className="relative flex h-2 w-2">
                                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                                       <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                                     </span>
                                     <span className="text-xs font-bold text-white tracking-[0.2em] uppercase">
                                        {loadingVideoIdx === idx ? 'GENERATING' : 'RENDERING'}
                                     </span>
                                  </div>
                                  <p className="text-[10px] text-brand-500/60 font-mono">
                                     {hasReplicateKey 
                                        ? (loadingVideoIdx === idx ? 'MODEL: MINIMAX-01' : 'MODEL: FLUX-SCHNELL') 
                                        : 'MODEL: GEMINI-2.5'}
                                  </p>
                              </div>
                           </div>
                           
                           {/* Corner Accents */}
                           <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-white/20 rounded-tl-lg m-2"></div>
                           <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-white/20 rounded-tr-lg m-2"></div>
                           <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-white/20 rounded-bl-lg m-2"></div>
                           <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-white/20 rounded-br-lg m-2"></div>

                        </div>
                    ) : null}

                    <p className="text-slate-200 text-sm leading-relaxed mb-4">{scene.visual_description}</p>
                    
                    <div className="bg-black/30 p-3 rounded border border-white/5 relative group/prompt">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/5">
                            <div className="text-[10px] text-slate-600 uppercase font-bold flex items-center gap-2">
                            <Image className="w-3 h-3"/> AI Image Prompt
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => copyToClipboard(`prompt-text-${idx}`, scene.image_prompt)}
                                    className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-white transition-colors"
                                    title="Copy Positive Prompt"
                                >
                                    {copiedSection === `prompt-text-${idx}` ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                                </button>
                            </div>
                        </div>
                        <code className="text-xs text-brand-400 font-mono block leading-relaxed">{scene.image_prompt}</code>
                        {scene.image_negative_prompt && (
                            <div className="mt-2 pt-2 border-t border-white/5">
                                <span className="text-[10px] text-red-400/70 font-bold uppercase block mb-1">Negative Prompt</span>
                                <code className="text-[10px] text-slate-500 font-mono block">{scene.image_negative_prompt}</code>
                            </div>
                        )}
                    </div>
                </div>

                {/* Audio Column */}
                <div className="bg-white/5 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                        <div className="text-xs text-slate-500 uppercase font-bold flex items-center gap-2"><Mic className="w-3 h-3"/> Audio Script</div>
                        <button 
                                onClick={() => copyToClipboard(`script-text-${idx}`, scene.audio_script)}
                                className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-white transition-colors"
                            >
                                {copiedSection === `script-text-${idx}` ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                            </button>
                        </div>
                        <p className="text-white font-medium text-lg leading-relaxed">"{scene.audio_script}"</p>
                        
                        <div className="mt-4 flex items-start justify-between gap-2 p-2 bg-yellow-500/5 border border-yellow-500/10 rounded-lg">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-yellow-500/80 uppercase font-bold mb-0.5">Overlay Text</span>
                            <span className="text-xs text-yellow-100">{scene.on_screen_text}</span>
                        </div>
                        <button 
                                onClick={() => copyToClipboard(`overlay-${idx}`, scene.on_screen_text)}
                                className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-yellow-400 transition-colors"
                            >
                                {copiedSection === `overlay-${idx}` ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-3">
                        <button 
                        onClick={() => handleTogglePlay(scene.audio_script, idx)} 
                        disabled={loadingIdx === idx}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                            playingIdx === idx 
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                            : 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                        }`}
                        >
                        {loadingIdx === idx ? (
                            <>
                            <Loader2 className="w-4 h-4 animate-spin"/> Generating...
                            </>
                        ) : playingIdx === idx ? (
                            <>
                            <Pause className="w-4 h-4 fill-current"/> Pause VO
                            </>
                        ) : (
                            <>
                            <Play className="w-4 h-4 fill-current"/> {audioUrls[idx] ? 'Play VO' : 'Generate VO'}
                            </>
                        )}
                        </button>

                        {audioUrls[idx] && (
                        <button 
                            onClick={() => handleDownload(audioUrls[idx], `scene-${idx+1}-audio.wav`)}
                            className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                        )}
                    </div>
                </div>
                </div>
            </div>
            ))}
        </div>
      )}
    </div>
  );
};
