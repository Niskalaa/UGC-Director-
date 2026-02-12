
import React, { useState, useRef, useEffect } from 'react';
import { GeneratedAsset, Scene } from '../types';
import { generateSpeech, getWavBlob, analyzeVoiceStyle, generateImagePreview, generateVideo } from '../services/geminiService';
import { generateImageOpenRouter } from '../services/externalService';
import { fetchElevenLabsVoices, generateElevenLabsSpeech, ElevenLabsVoice, ELEVENLABS_MODELS, ElevenLabsSettings } from '../services/elevenLabsService';
import { Copy, Check, Clapperboard, Play, Loader2, Mic, Download, Pause, Image, Settings2, Sparkles, Monitor, Tablet, Smartphone, Maximize2, X, Film, Wand2, Video as VideoIcon, Volume2, SlidersHorizontal, Info, FileText, FileJson, Printer, Headphones } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

const GEMINI_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
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
type TTSProvider = 'gemini' | 'elevenlabs';

interface OutputDisplayProps {
    data: GeneratedAsset | null;
    modelUsed?: string;
    imageModelUsed?: string;
    onUpdate?: (updatedData: GeneratedAsset) => void;
}

export const OutputDisplay: React.FC<OutputDisplayProps> = ({ data, modelUsed, imageModelUsed, onUpdate }) => {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  // TTS State
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>('gemini');
  const [activeVoice, setActiveVoice] = useState<string>('Kore'); // Default Gemini Voice
  const [speechStyle, setSpeechStyle] = useState<string>('Natural');
  
  // ElevenLabs State
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [hasElevenLabsKey, setHasElevenLabsKey] = useState(false);
  const [showElTuning, setShowElTuning] = useState(false);
  const [elSettings, setElSettings] = useState<ElevenLabsSettings>({
      model_id: 'eleven_multilingual_v2',
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
  });
  
  // Media Generation State
  const [previewImages, setPreviewImages] = useState<Record<number, string>>({});
  const [previewVideos, setPreviewVideos] = useState<Record<number, string>>({});
  const [loadingImageIdx, setLoadingImageIdx] = useState<number | null>(null);
  const [loadingVideoIdx, setLoadingVideoIdx] = useState<number | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  
  // View Modal State
  const [viewModalContent, setViewModalContent] = useState<{type: 'image' | 'video', url: string} | null>(null);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);

  // Custom Voice State (Gemini only)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [customVoiceTone, setCustomVoiceTone] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize state from prop data if available (History hydration)
  useEffect(() => {
    if (data?.scenes) {
        const initialAudioUrls: Record<number, string> = {};
        const initialImages: Record<number, string> = {};
        
        data.scenes.forEach((scene, idx) => {
            if (scene.generated_audio) {
                initialAudioUrls[idx] = scene.generated_audio;
            }
            if (scene.generated_image) {
                initialImages[idx] = scene.generated_image;
            }
        });
        setAudioUrls(initialAudioUrls);
        setPreviewImages(initialImages);
    }
  }, [data]);

  // Initial Logic & ElevenLabs Fetch
  useEffect(() => {
    const key = localStorage.getItem('ELEVENLABS_API_KEY');
    if (key) {
        setHasElevenLabsKey(true);
        fetchElevenLabsVoices().then(voices => {
            setElevenLabsVoices(voices);
            if (voices.length > 0 && ttsProvider === 'elevenlabs') {
                 // Try to find a good default
                 const defaultVoice = voices.find(v => v.name === "Rachel" || v.name === "Adam") || voices[0];
                 setActiveVoice(defaultVoice.voice_id);
            }
        });
    }

    // Heuristic for default voice config if not set
    if (data) {
        const dna = data.brand_dna;
        const traits = dna?.voice_traits?.map(t => t.toLowerCase()) || [];
        const audience = dna?.audience_guess?.toLowerCase() || '';

        let recommendedGemini = 'Kore';
        if (audience.includes('male') || audience.includes('men') || traits.some(t => ['deep', 'authoritative', 'bold', 'assertive'].includes(t))) {
            recommendedGemini = 'Fenrir';
        }
        
        // Only set if user hasn't messed with it yet
        if (activeVoice === 'Kore' && ttsProvider === 'gemini') {
            setActiveVoice(recommendedGemini);
        }
    }
  }, [data]);

  const handleProviderChange = (provider: TTSProvider) => {
      setTtsProvider(provider);
      // We don't clear audioUrls cache here because we want to keep history
      
      if (provider === 'gemini') {
          setActiveVoice('Kore');
      } else if (provider === 'elevenlabs' && elevenLabsVoices.length > 0) {
           // Default to first available
           setActiveVoice(elevenLabsVoices[0].voice_id);
      } else if (provider === 'elevenlabs' && !hasElevenLabsKey) {
          alert("Please add your ElevenLabs API Key in settings first.");
          setShowSettings(true);
          setTtsProvider('gemini');
      }
  };

  const handleVoiceChange = (newVoice: string) => {
    setActiveVoice(newVoice);
    if (activeAudio) {
      activeAudio.pause();
      setActiveAudio(null);
    }
    setPlayingIdx(null);
  };

  const handleStyleChange = (style: string) => {
    setSpeechStyle(style);
    if (activeAudio) {
        activeAudio.pause();
        setActiveAudio(null);
    }
    setPlayingIdx(null);
  }

  const handleElSettingChange = (field: keyof ElevenLabsSettings, value: any) => {
      setElSettings(prev => ({...prev, [field]: value}));
  };

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
            if (ttsProvider !== 'gemini') {
                setTtsProvider('gemini'); // Force switch back to Gemini for tone cloning features
                alert("Switched to Gemini TTS to support voice tone cloning.");
            } else {
                alert(`Voice Clone Active: Style adapted to "${analyzedTone}"`);
            }
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
        if (ttsProvider === 'gemini') {
             const tone = customVoiceTone || (speechStyle !== 'Natural' ? `Speak in a ${speechStyle} tone` : undefined);
             const b64 = await generateSpeech(text, activeVoice, tone);
             const blob = getWavBlob(b64);
             // Convert blob to base64 data URI for persistence
             const reader = new FileReader();
             reader.readAsDataURL(blob);
             await new Promise(resolve => reader.onloadend = resolve);
             url = reader.result as string;
        } else {
             // ElevenLabs returns blob URL but we need persistent data URI if possible, or accept blob URL transiently
             // ElevenLabs service returns blob URL currently. Let's fetch it to convert to base64
             const blobUrl = await generateElevenLabsSpeech(text, activeVoice, elSettings);
             const blob = await fetch(blobUrl).then(r => r.blob());
             const reader = new FileReader();
             reader.readAsDataURL(blob);
             await new Promise(resolve => reader.onloadend = resolve);
             url = reader.result as string;
        }
        
        setAudioUrls(prev => ({ ...prev, [idx]: url }));
        
        // Update persistent state
        if (data && data.scenes && onUpdate) {
            const updatedScenes = [...data.scenes];
            updatedScenes[idx] = { ...updatedScenes[idx], generated_audio: url };
            onUpdate({ ...data, scenes: updatedScenes });
        }
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
      alert(e instanceof Error ? e.message : "Error generating audio.");
    } finally {
      setLoadingIdx(null);
    }
  };

  const handleGeneratePreview = async (prompt: string, idx: number) => {
      if (loadingImageIdx !== null) return;
      setLoadingImageIdx(idx);
      try {
          let imageUrl = "";
          
          if (imageModelUsed === 'openrouter-flux') {
              imageUrl = await generateImageOpenRouter(prompt, aspectRatio);
          } else {
              // Default to Gemini Service which handles Gemini/Imagen
              // We pass the specific model selected in input form
              imageUrl = await generateImagePreview(prompt, aspectRatio, imageModelUsed || 'gemini-3-pro-image-preview');
          }

          if (imageUrl) {
              setPreviewImages(prev => ({ ...prev, [idx]: imageUrl }));
              // Update persistent state
              if (data && data.scenes && onUpdate) {
                const updatedScenes = [...data.scenes];
                updatedScenes[idx] = { ...updatedScenes[idx], generated_image: imageUrl };
                onUpdate({ ...data, scenes: updatedScenes });
              }
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
     setLoadingVideoIdx(idx);
     try {
         const videoUrl = await generateVideo(prompt);
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

  const handleExportJSON = () => {
    if (!data) return;
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.concept_title.replace(/\s+/g, '_')}_script.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTXT = () => {
    if (!data) return;
    let txt = `TITLE: ${data.concept_title}\n`;
    txt += `HOOK: ${data.hook_rationale}\n`;
    txt += `ANGLE: ${data.analysis_report?.winning_angle_logic}\n\n`;
    txt += `--- SCRIPT ---\n\n`;
    
    data.scenes?.forEach((scene, i) => {
        txt += `SCENE ${i + 1} (${scene.seconds}s)\n`;
        txt += `VISUAL: ${scene.visual_description}\n`;
        txt += `AUDIO: ${scene.audio_script}\n`;
        txt += `TEXT OVERLAY: ${scene.on_screen_text}\n\n`;
    });
    
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.concept_title.replace(/\s+/g, '_')}_script.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handlePrint = () => {
    if (!data) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Please allow popups to print");
    
    const html = `
      <html>
        <head>
          <title>${data.concept_title}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1e293b; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            .meta { color: #64748b; font-size: 14px; margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; }
            .scene { margin-bottom: 30px; page-break-inside: avoid; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; }
            .scene-header { font-weight: bold; font-size: 14px; color: #f97316; margin-bottom: 10px; text-transform: uppercase; }
            .label { font-weight: bold; font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-top: 10px; display: block; }
            p { margin-top: 4px; line-height: 1.5; }
            @media print {
               body { padding: 0; }
               .scene { border: none; border-bottom: 1px solid #e2e8f0; border-radius: 0; }
            }
          </style>
        </head>
        <body>
          <h1>${data.concept_title}</h1>
          <div class="meta">
            <p><strong>Hook:</strong> ${data.hook_rationale}</p>
            <p><strong>Winning Angle:</strong> ${data.analysis_report?.winning_angle_logic}</p>
            <p><strong>Duration:</strong> ${data.scenes?.reduce((acc, s) => acc + (parseInt(s.seconds) || 0), 0) || 0}s est.</p>
          </div>
          
          ${data.scenes?.map((scene, i) => `
            <div class="scene">
              <div class="scene-header">Scene ${i+1} • ${scene.seconds}s</div>
              
              <span class="label">Visual</span>
              <p>${scene.visual_description}</p>
              
              <span class="label">Audio</span>
              <p>"${scene.audio_script}"</p>
              
              <span class="label">Overlay</span>
              <p>${scene.on_screen_text}</p>
            </div>
          `).join('')}
          
          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (!data) return (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white/40 p-8">
      <Clapperboard className="w-12 h-12 mb-4 opacity-30 text-slate-500" />
      <p className="font-medium text-center">Waiting for director's input...</p>
    </div>
  );

  const isPartial = !data.scenes || data.scenes.length === 0;

  return (
    <div className="space-y-6 animate-in pb-12">
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* ElevenLabs Tuning Modal */}
      {showElTuning && (
          <div className="fixed inset-0 z-[100] bg-white/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                         <SlidersHorizontal className="w-4 h-4 text-orange-500" />
                         <h3 className="font-bold text-slate-800">Voice Tuning</h3>
                    </div>
                    <button onClick={() => setShowElTuning(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-4 h-4"/></button>
                </div>
                <div className="p-6 space-y-6">
                    {/* Model Select */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Model</label>
                        <select 
                            value={elSettings.model_id}
                            onChange={(e) => handleElSettingChange('model_id', e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-orange-500"
                        >
                            {ELEVENLABS_MODELS.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Stability */}
                    <div className="space-y-2">
                         <div className="flex justify-between text-xs">
                             <span className="font-bold text-slate-600">Stability</span>
                             <span className="text-slate-400">{Math.round(elSettings.stability * 100)}%</span>
                         </div>
                         <input 
                            type="range" min="0" max="1" step="0.01"
                            value={elSettings.stability}
                            onChange={(e) => handleElSettingChange('stability', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                         />
                         <div className="flex justify-between text-[10px] text-slate-400">
                             <span>Variable</span>
                             <span>Stable</span>
                         </div>
                    </div>

                    {/* Similarity */}
                    <div className="space-y-2">
                         <div className="flex justify-between text-xs">
                             <span className="font-bold text-slate-600">Similarity</span>
                             <span className="text-slate-400">{Math.round(elSettings.similarity_boost * 100)}%</span>
                         </div>
                         <input 
                            type="range" min="0" max="1" step="0.01"
                            value={elSettings.similarity_boost}
                            onChange={(e) => handleElSettingChange('similarity_boost', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                         />
                         <div className="flex justify-between text-[10px] text-slate-400">
                             <span>Low</span>
                             <span>High</span>
                         </div>
                    </div>

                    {/* Style */}
                    <div className="space-y-2">
                         <div className="flex justify-between text-xs">
                             <span className="font-bold text-slate-600">Style Exaggeration</span>
                             <span className="text-slate-400">{Math.round(elSettings.style * 100)}%</span>
                         </div>
                         <input 
                            type="range" min="0" max="1" step="0.01"
                            value={elSettings.style}
                            onChange={(e) => handleElSettingChange('style', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                         />
                         <div className="flex justify-between text-[10px] text-slate-400">
                             <span>None</span>
                             <span>High</span>
                         </div>
                    </div>

                    {/* Speaker Boost */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-600">Speaker Boost</label>
                        <button 
                           onClick={() => handleElSettingChange('use_speaker_boost', !elSettings.use_speaker_boost)}
                           className={`w-10 h-5 rounded-full relative transition-colors ${elSettings.use_speaker_boost ? 'bg-orange-500' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${elSettings.use_speaker_boost ? 'left-6' : 'left-1'}`}></div>
                        </button>
                    </div>

                    <button 
                        onClick={() => setShowElTuning(false)}
                        className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-900/10 active:scale-95 transition-all"
                    >
                        Apply Settings
                    </button>
                </div>
             </div>
          </div>
      )}

      {/* Media Viewer Modal */}
      {viewModalContent && (
        <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
           <button 
              onClick={() => setViewModalContent(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shadow-sm"
           >
              <X className="w-6 h-6" />
           </button>
           <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col items-center">
              {viewModalContent.type === 'image' ? (
                  <img src={viewModalContent.url} alt="Full view" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-slate-200" />
              ) : (
                  <video src={viewModalContent.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-lg shadow-2xl border border-slate-200" />
              )}
              <div className="mt-6 flex gap-4">
                 <button 
                    onClick={() => handleDownload(viewModalContent.url, `ugc-generated-${Date.now()}.${viewModalContent.type === 'image' ? 'jpg' : 'mp4'}`)}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/30 active:scale-95"
                 >
                    <Download className="w-5 h-5" /> Download {viewModalContent.type === 'image' ? 'Image' : 'Video'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Title & Controls */}
      <div className="glass-panel p-5 md:p-8 rounded-3xl border-l-4 border-brand-500 bg-white relative overflow-hidden shadow-sm">
        {/* Settings Trigger */}
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-lg bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100 transition-colors"
          title="Configure AI Keys"
        >
          <Settings2 className="w-5 h-5" />
        </button>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pr-12">
            <div>
               <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">{data.concept_title}</h2>
               <p className="text-slate-500 italic mb-4 text-sm md:text-base">"{data.hook_rationale}"</p>
            </div>
            
            {/* Export Actions */}
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
                <button 
                    onClick={handleExportTXT} 
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all"
                    title="Export as Text"
                >
                    <FileText className="w-3.5 h-3.5" /> TXT
                </button>
                <div className="w-px h-4 bg-slate-200"></div>
                <button 
                    onClick={handleExportJSON} 
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all"
                    title="Export as JSON"
                >
                    <FileJson className="w-3.5 h-3.5" /> JSON
                </button>
                <div className="w-px h-4 bg-slate-200"></div>
                <button 
                    onClick={handlePrint} 
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all"
                    title="Print / PDF"
                >
                    <Printer className="w-3.5 h-3.5" /> PDF
                </button>
            </div>
          </div>

          {/* Horizontally Scrollable Controls for Mobile */}
          <div className="mt-4 -mx-5 px-5 md:mx-0 md:px-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-3 min-w-max pb-1">
                
                {/* Voice Control Group */}
                <div className="flex items-center gap-3 text-xs text-brand-700 bg-brand-50 px-4 py-2 rounded-full border border-brand-200 whitespace-nowrap">
                <Mic className="w-3.5 h-3.5" />
                
                {/* Provider Toggle */}
                <div className="flex items-center gap-1 bg-white rounded p-0.5 border border-slate-200 shadow-sm">
                    <button 
                        onClick={() => handleProviderChange('gemini')}
                        className={`px-2 py-0.5 rounded transition-all font-medium ${ttsProvider === 'gemini' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >Gemini</button>
                    <button 
                        onClick={() => handleProviderChange('elevenlabs')}
                        className={`px-2 py-0.5 rounded transition-all font-medium ${ttsProvider === 'elevenlabs' ? 'bg-orange-500/80 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >ElevenLabs</button>
                </div>

                <span className="text-brand-300">|</span>

                <div className="flex items-center gap-2">
                    <span className="text-brand-800/70 uppercase font-bold tracking-wider">Voice:</span>
                    <select 
                    value={activeVoice}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-brand-600 transition-colors max-w-[100px] truncate"
                    >
                    {ttsProvider === 'gemini' ? (
                        GEMINI_VOICES.map(v => (
                            <option key={v} value={v} className="bg-white text-slate-800">{v}</option>
                        ))
                    ) : (
                        elevenLabsVoices.length > 0 ? (
                            elevenLabsVoices.map(v => (
                                <option key={v.voice_id} value={v.voice_id} className="bg-white text-slate-800">{v.name} ({v.category})</option>
                            ))
                        ) : (
                            <option className="bg-white text-slate-400">Loading/No Key...</option>
                        )
                    )}
                    </select>
                </div>
                
                {/* Only show style controls for Gemini, ElevenLabs handles style inside the voice model usually */}
                {ttsProvider === 'gemini' && (
                    <>
                        <span className="text-brand-300">|</span>
                        <div className="flex items-center gap-2">
                            <span className="text-brand-800/70 uppercase font-bold tracking-wider">Style:</span>
                            <select 
                            value={speechStyle}
                            onChange={(e) => handleStyleChange(e.target.value)}
                            className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-brand-600 transition-colors"
                            >
                            {SPEECH_STYLES.map(s => (
                                <option key={s} value={s} className="bg-white text-slate-800">{s}</option>
                            ))}
                            </select>
                        </div>
                        <span className="text-brand-300">|</span>
                        <div className="flex items-center gap-2 pl-2 border-l border-brand-200">
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
                                className={`flex items-center gap-1.5 hover:text-brand-600 transition-colors font-bold ${customVoiceTone ? 'text-emerald-600' : 'text-brand-600'}`}
                                title={customVoiceTone ? `Active Clone Style: ${customVoiceTone}` : "Upload sample to clone style"}
                            >
                                {isProcessingVoice ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3"/>}
                                {customVoiceTone ? 'Custom Active' : 'Clone Voice'}
                            </button>
                        </div>
                    </>
                )}

                {/* ElevenLabs Tuning Button */}
                {ttsProvider === 'elevenlabs' && (
                    <>
                        <span className="text-brand-300">|</span>
                        <button 
                            onClick={() => setShowElTuning(true)}
                            className="flex items-center gap-1.5 hover:text-orange-600 transition-colors font-bold text-orange-500"
                            title="Fine-tune voice model"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5"/>
                            Tune
                        </button>
                    </>
                )}
                </div>

                {/* Visual Settings Group */}
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full border border-slate-200">
                    {/* Aspect Ratio */}
                    <div className="flex items-center gap-1 pr-1">
                        {[
                            { val: "9:16", icon: Smartphone, label: "9:16" },
                            { val: "16:9", icon: Monitor, label: "16:9" },
                            { val: "1:1", icon: Tablet, label: "1:1" }
                        ].map(r => (
                            <button
                                key={r.val}
                                onClick={() => setAspectRatio(r.val as AspectRatio)}
                                className={`p-1.5 rounded-full transition-all ${aspectRatio === r.val ? 'bg-white text-brand-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                title={r.label}
                            >
                                <r.icon className="w-3.5 h-3.5" />
                            </button>
                        ))}
                    </div>
                </div>

            </div>
          </div>
        </div>
      </div>

      {/* Strategy Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2">
         {/* ... (existing dashboard items) ... */}
         {/* Audio History Panel */}
         <div className="glass-panel p-4 rounded-xl border border-slate-200 bg-white shadow-sm col-span-1 md:col-span-2 lg:col-span-1">
             <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                     <Headphones className="w-4 h-4 text-brand-500" />
                     <h4 className="text-xs font-bold text-slate-500 uppercase">Audio History</h4>
                 </div>
                 <span className="text-[10px] text-slate-400">{Object.keys(audioUrls).length} clips</span>
             </div>
             <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {Object.keys(audioUrls).length > 0 ? Object.entries(audioUrls).map(([idx, url]) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 group">
                        <span className="text-[10px] font-bold text-slate-600">Scene {parseInt(idx)+1}</span>
                        <div className="flex gap-1">
                             <button onClick={() => { new Audio(url).play(); }} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-brand-500"><Play className="w-3 h-3 fill-current"/></button>
                             <button onClick={() => handleDownload(url, `scene-${parseInt(idx)+1}.mp3`)} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700"><Download className="w-3 h-3"/></button>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-4 text-[10px] text-slate-400 italic">No audio generated yet</div>
                )}
             </div>
         </div>
      </div>

      {/* Scenes */}
      {isPartial ? (
         <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-white/50">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
                <h3 className="text-slate-800 font-bold mb-1">Director is drafting scenes...</h3>
                <p className="text-xs text-slate-500">Writing scripts based on brand DNA: <span className="text-brand-600 font-medium">{data.brand_dna?.voice_traits?.join(', ')}</span></p>
            </div>
         </div>
      ) : (
        <div className="space-y-4">
            {data.scenes!.map((scene: Scene, idx: number) => (
            <div key={idx} className="glass-panel p-4 md:p-6 rounded-2xl border border-slate-200 bg-white hover:border-brand-500/30 transition-all shadow-sm hover:shadow-md group/card">
                
                {/* Scene Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                    <div className="bg-brand-500 text-white font-bold px-3 py-1 rounded text-xs">{scene.seconds}s</div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scene {idx + 1}</div>
                    </div>
                    <button 
                        onClick={() => copyToClipboard(`scene-${idx}`, scene)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[10px] text-slate-500 hover:text-slate-800 transition-colors border border-slate-100"
                    >
                        {copiedSection === `scene-${idx}` ? <Check className="w-3 h-3 text-emerald-500"/> : <Film className="w-3 h-3"/>}
                        <span className="hidden sm:inline">JSON</span>
                    </button>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                {/* Visual Column */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-slate-500 uppercase font-bold">Visual</div>
                        <div className="flex gap-2">
                             {/* Image Gen Button */}
                             {!previewImages[idx] && (
                                <button 
                                    onClick={() => handleGeneratePreview(scene.image_prompt, idx)}
                                    disabled={loadingImageIdx === idx}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] transition-colors bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-medium active:scale-95"
                                >
                                    {loadingImageIdx === idx ? <Loader2 className="w-3 h-3 animate-spin"/> : <Image className="w-3 h-3"/>}
                                    {imageModelUsed && imageModelUsed.includes('flux') ? 'Flux' : 'Image'}
                                </button>
                             )}
                             
                             {/* Video Gen Button */}
                             {scene.video_prompt && !previewVideos[idx] && (
                                <button 
                                    onClick={() => handleGenerateVideo(scene.video_prompt || scene.visual_description, idx)}
                                    disabled={loadingVideoIdx === idx}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] transition-colors bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 font-medium active:scale-95"
                                >
                                    {loadingVideoIdx === idx ? <Loader2 className="w-3 h-3 animate-spin"/> : <VideoIcon className="w-3 h-3"/>}
                                    Video
                                </button>
                             )}
                        </div>
                    </div>
                    
                    {/* Visual Media Display (Video Priority) */}
                    {previewVideos[idx] ? (
                         <div className={`mb-4 relative rounded-lg overflow-hidden border border-slate-200 shadow-sm group/media bg-black ${aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "16:9" ? "aspect-video" : "aspect-square"}`}>
                            <video src={previewVideos[idx]} controls className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/media:opacity-100 transition-opacity">
                                <button onClick={() => handleDownload(previewVideos[idx], `scene-${idx+1}-video.mp4`)} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Download className="w-3 h-3" /></button>
                                <button onClick={() => setViewModalContent({type: 'video', url: previewVideos[idx]})} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Maximize2 className="w-3 h-3" /></button>
                            </div>
                         </div>
                    ) : previewImages[idx] ? (
                         <div className={`mb-4 relative rounded-lg overflow-hidden border border-slate-200 shadow-sm group/media bg-black ${aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "16:9" ? "aspect-video" : "aspect-square"}`}>
                            <img src={previewImages[idx]} alt="Scene Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-2 opacity-0 group-hover/media:opacity-100 transition-opacity">
                                <span className="text-[10px] text-white/80 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-indigo-400"/> {imageModelUsed?.includes('flux') ? 'Flux' : 'Gemini'} Image
                                </span>
                            </div>
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/media:opacity-100 transition-opacity">
                                <button onClick={() => handleDownload(previewImages[idx], `scene-${idx+1}-image.jpg`)} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Download className="w-3 h-3" /></button>
                                <button onClick={() => setViewModalContent({type: 'image', url: previewImages[idx]})} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Maximize2 className="w-3 h-3" /></button>
                            </div>
                         </div>
                    ) : (loadingImageIdx === idx || loadingVideoIdx === idx) ? (
                        <div className={`mb-4 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-4 group ${aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "16:9" ? "aspect-video" : "aspect-square"}`}>
                           <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                           <div className="relative z-10 flex flex-col items-center">
                              <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-2" />
                              <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">
                                 {loadingVideoIdx === idx ? 'Generating Video (Veo)' : 'Rendering Image'}
                              </span>
                           </div>
                        </div>
                    ) : null}

                    <p className="text-slate-700 text-sm leading-relaxed mb-4 font-medium">{scene.visual_description}</p>
                    
                    {/* Prompt Box */}
                    <div className="space-y-2">
                        <div className="bg-slate-50 p-3 rounded border border-slate-200 relative group/prompt">
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
                                <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-2">
                                <Image className="w-3 h-3"/> AI Image Prompt
                                </div>
                                <button 
                                    onClick={() => copyToClipboard(`prompt-text-${idx}`, scene.image_prompt || '')}
                                    className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-800 transition-colors"
                                >
                                    {copiedSection === `prompt-text-${idx}` ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                                </button>
                            </div>
                            <code className="text-xs text-brand-600 font-mono block leading-relaxed line-clamp-3 hover:line-clamp-none transition-all">{scene.image_prompt}</code>
                        </div>

                        {scene.video_prompt && (
                            <div className="bg-indigo-50/50 p-3 rounded border border-indigo-100 relative group/prompt">
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-indigo-100">
                                    <div className="text-[10px] text-indigo-500 uppercase font-bold flex items-center gap-2">
                                    <VideoIcon className="w-3 h-3"/> Veo Video Prompt
                                    </div>
                                    <button 
                                        onClick={() => copyToClipboard(`video-prompt-${idx}`, scene.video_prompt || '')}
                                        className="p-1 hover:bg-indigo-100 rounded text-indigo-400 hover:text-indigo-800 transition-colors"
                                    >
                                        {copiedSection === `video-prompt-${idx}` ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                                    </button>
                                </div>
                                <code className="text-xs text-indigo-600 font-mono block leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">{scene.video_prompt}</code>
                            </div>
                        )}
                    </div>
                </div>

                {/* Audio Column */}
                <div className="bg-slate-50 p-4 rounded-xl flex flex-col justify-between border border-slate-100">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                        <div className="text-xs text-slate-500 uppercase font-bold flex items-center gap-2"><Mic className="w-3 h-3"/> Audio Script</div>
                        <button 
                                onClick={() => copyToClipboard(`script-text-${idx}`, scene.audio_script)}
                                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-800 transition-colors"
                            >
                                {copiedSection === `script-text-${idx}` ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                            </button>
                        </div>
                        <p className="text-slate-800 font-medium text-lg leading-relaxed">"{scene.audio_script}"</p>
                        
                        <div className="mt-4 flex items-start justify-between gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-yellow-600 uppercase font-bold mb-0.5">Overlay Text</span>
                            <span className="text-xs text-yellow-800 font-bold">{scene.on_screen_text}</span>
                        </div>
                        <button 
                                onClick={() => copyToClipboard(`overlay-${idx}`, scene.on_screen_text)}
                                className="p-1 hover:bg-yellow-100 rounded text-yellow-600/50 hover:text-yellow-700 transition-colors"
                            >
                                {copiedSection === `overlay-${idx}` ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-3">
                        <button 
                        onClick={() => handleTogglePlay(scene.audio_script, idx)} 
                        disabled={loadingIdx === idx}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 md:py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                            playingIdx === idx 
                            ? 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-200' 
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
                            {ttsProvider === 'elevenlabs' ? <Volume2 className="w-4 h-4"/> : <Play className="w-4 h-4 fill-current"/>} 
                            {audioUrls[idx] ? 'Play VO' : `Generate (${ttsProvider === 'elevenlabs' ? '11Labs' : 'Gemini'})`}
                            </>
                        )}
                        </button>

                        {audioUrls[idx] && (
                        <button 
                            onClick={() => handleDownload(audioUrls[idx], `scene-${idx+1}-audio.mp3`)}
                            className="p-3 md:p-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 active:scale-95"
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
