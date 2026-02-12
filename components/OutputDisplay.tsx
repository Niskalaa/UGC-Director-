
import React, { useState, useRef, useEffect } from 'react';
import { GeneratedAsset, Scene } from '../types';
import { generateSpeech, getWavBlob, analyzeVoiceStyle, generateImagePreview, generateVideo } from '../services/geminiService';
import { generateImageOpenRouter, generateImageHuggingFace, generateVideoHuggingFace } from '../services/externalService';
import { fetchElevenLabsVoices, generateElevenLabsSpeech, ElevenLabsVoice, ELEVENLABS_MODELS, ElevenLabsSettings } from '../services/elevenLabsService';
import { Copy, Check, Clapperboard, Play, Loader2, Mic, Download, Pause, Image, Settings2, Sparkles, Monitor, Tablet, Smartphone, Maximize2, X, Film, Wand2, Video as VideoIcon, Volume2, SlidersHorizontal, Info, FileText, FileJson, Printer, Headphones, Palette, Aperture, Layers, Split, Smile } from 'lucide-react';
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
  
  // Audio/Image cache
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [previewImages, setPreviewImages] = useState<Record<string, string>>({});
  const [previewVideos, setPreviewVideos] = useState<Record<string, string>>({});
  
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  // Variation State
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);

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
  const [loadingImageIdx, setLoadingImageIdx] = useState<number | null>(null);
  const [loadingVideoIdx, setLoadingVideoIdx] = useState<number | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  
  // Studio Settings (Models)
  const [activeImageModel, setActiveImageModel] = useState<string>('gemini-2.5-flash-image');
  const [activeVideoModel, setActiveVideoModel] = useState<string>('veo-3.1-fast-generate-preview');

  // View Modal State
  const [viewModalContent, setViewModalContent] = useState<{type: 'image' | 'video', url: string} | null>(null);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);

  // Custom Voice State (Gemini only)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [customVoiceTone, setCustomVoiceTone] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate state
  useEffect(() => {
    if (data) {
        const initialAudioUrls: Record<string, string> = {};
        const initialImages: Record<string, string> = {};
        
        const populateCache = (scenes: Scene[], varIndex: number) => {
             scenes.forEach((scene, idx) => {
                const key = `${varIndex}-${idx}`;
                if (scene.generated_audio) initialAudioUrls[key] = scene.generated_audio;
                if (scene.generated_image) initialImages[key] = scene.generated_image;
             });
        };

        if (data.variations && data.variations.length > 0) {
             data.variations.forEach((v, i) => populateCache(v.scenes, i));
        } else if (data.scenes) {
             populateCache(data.scenes, 0);
        }
        
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
                 const defaultVoice = voices.find(v => v.name === "Rachel" || v.name === "Adam") || voices[0];
                 setActiveVoice(defaultVoice.voice_id);
            }
        });
    }

    if (imageModelUsed) setActiveImageModel(imageModelUsed);

    if (data) {
        const dna = data.brand_dna;
        const traits = dna?.voice_traits?.map(t => t.toLowerCase()) || [];
        const audience = dna?.audience_guess?.toLowerCase() || '';

        let recommendedGemini = 'Kore';
        if (audience.includes('male') || audience.includes('men') || traits.some(t => ['deep', 'authoritative', 'bold', 'assertive'].includes(t))) {
            recommendedGemini = 'Fenrir';
        }
        
        if (activeVoice === 'Kore' && ttsProvider === 'gemini') {
            setActiveVoice(recommendedGemini);
        }
    }
  }, [data]);

  const getActiveScenes = (): Scene[] => {
      if (!data) return [];
      if (data.variations && data.variations.length > 0) {
          return data.variations[activeVariationIndex]?.scenes || [];
      }
      return data.scenes || [];
  };

  const getActiveVariationName = (): string => {
      if (!data?.variations?.length) return "Original Script";
      return data.variations[activeVariationIndex].name;
  }

  const handleProviderChange = (provider: TTSProvider) => {
      setTtsProvider(provider);
      
      if (provider === 'gemini') {
          setActiveVoice('Kore');
      } else if (provider === 'elevenlabs' && elevenLabsVoices.length > 0) {
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

    const cacheKey = `${activeVariationIndex}-${idx}`;

    try {
      let url = audioUrls[cacheKey];
      
      if (!url) {
        if (ttsProvider === 'gemini') {
             const tone = customVoiceTone || (speechStyle !== 'Natural' ? `Speak in a ${speechStyle} tone` : undefined);
             const b64 = await generateSpeech(text, activeVoice, tone);
             const blob = getWavBlob(b64);
             const reader = new FileReader();
             reader.readAsDataURL(blob);
             await new Promise(resolve => reader.onloadend = resolve);
             url = reader.result as string;
        } else {
             const blobUrl = await generateElevenLabsSpeech(text, activeVoice, elSettings);
             const blob = await fetch(blobUrl).then(r => r.blob());
             const reader = new FileReader();
             reader.readAsDataURL(blob);
             await new Promise(resolve => reader.onloadend = resolve);
             url = reader.result as string;
        }
        
        setAudioUrls(prev => ({ ...prev, [cacheKey]: url }));
        
        if (data && onUpdate) {
            const updatedData = JSON.parse(JSON.stringify(data)) as GeneratedAsset;
            if (updatedData.variations && updatedData.variations[activeVariationIndex]) {
                 updatedData.variations[activeVariationIndex].scenes[idx].generated_audio = url;
            } else if (updatedData.scenes) {
                 updatedData.scenes[idx].generated_audio = url;
            }
            onUpdate(updatedData);
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

  const handleGeneratePreview = async (scene: Scene, idx: number) => {
      if (loadingImageIdx !== null) return;
      setLoadingImageIdx(idx);
      const cacheKey = `${activeVariationIndex}-${idx}`;
      
      // Prefer new structured image prompt, fallback to legacy
      const promptToUse = scene.media_prompts?.image_prompt || scene.image_prompt || scene.visual_description;

      try {
          let imageUrl = "";
          
          if (activeImageModel === 'openrouter-flux') {
              imageUrl = await generateImageOpenRouter(promptToUse, aspectRatio);
          } else if (activeImageModel.startsWith('hf-')) {
              const hfModel = activeImageModel === 'hf-sdxl' ? "stabilityai/stable-diffusion-xl-base-1.0" : "black-forest-labs/FLUX.1-dev";
              imageUrl = await generateImageHuggingFace(promptToUse, hfModel);
          } else {
              imageUrl = await generateImagePreview(promptToUse, aspectRatio, activeImageModel);
          }

          if (imageUrl) {
              setPreviewImages(prev => ({ ...prev, [cacheKey]: imageUrl }));
              if (data && onUpdate) {
                const updatedData = JSON.parse(JSON.stringify(data)) as GeneratedAsset;
                if (updatedData.variations && updatedData.variations[activeVariationIndex]) {
                     updatedData.variations[activeVariationIndex].scenes[idx].generated_image = imageUrl;
                } else if (updatedData.scenes) {
                     updatedData.scenes[idx].generated_image = imageUrl;
                }
                onUpdate(updatedData);
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

  const handleGenerateVideo = async (scene: Scene, idx: number) => {
     if (loadingVideoIdx !== null) return;
     setLoadingVideoIdx(idx);
     const cacheKey = `${activeVariationIndex}-${idx}`;
     
     // Prefer new structured video prompt, fallback to legacy or visual description
     const promptToUse = scene.media_prompts?.video_prompt || scene.video_prompt || scene.visual_description;

     try {
         let videoUrl = "";
         if (activeVideoModel === 'hf-cogvideo') {
             // Fallback to HF video logic if model selected
             videoUrl = await generateVideoHuggingFace(promptToUse); 
         } else {
             // Default Veo (Gemini)
             videoUrl = await generateVideo(promptToUse);
         }

         if (videoUrl) {
             setPreviewVideos(prev => ({ ...prev, [cacheKey]: videoUrl }));
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
    
    // Export Active Variation
    txt += `--- SCRIPT (${getActiveVariationName()}) ---\n\n`;
    const scenes = getActiveScenes();
    scenes.forEach((scene, i) => {
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
    
    const scenes = getActiveScenes();

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
            <p><strong>Variation:</strong> ${getActiveVariationName()}</p>
            <p><strong>Hook:</strong> ${data.hook_rationale}</p>
            <p><strong>Winning Angle:</strong> ${data.analysis_report?.winning_angle_logic}</p>
            <p><strong>Duration:</strong> ${scenes.reduce((acc, s) => acc + (parseInt(s.seconds) || 0), 0) || 0}s est.</p>
          </div>
          
          ${scenes.map((scene, i) => `
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

  const scenes = getActiveScenes();
  const isPartial = !scenes || scenes.length === 0;

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
                    {/* ... (Keep existing Tuning UI) ... */}
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
            
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
                <button onClick={handleExportTXT} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all"><FileText className="w-3.5 h-3.5" /> TXT</button>
                <div className="w-px h-4 bg-slate-200"></div>
                <button onClick={handleExportJSON} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all"><FileJson className="w-3.5 h-3.5" /> JSON</button>
                <div className="w-px h-4 bg-slate-200"></div>
                <button onClick={handlePrint} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all"><Printer className="w-3.5 h-3.5" /> PDF</button>
            </div>
          </div>

          <div className="mt-4 -mx-5 px-5 md:mx-0 md:px-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-3 min-w-max pb-1">
                
                {/* Voice Control Group */}
                <div className="flex items-center gap-3 text-xs text-brand-700 bg-brand-50 px-4 py-2 rounded-full border border-brand-200 whitespace-nowrap">
                <Mic className="w-3.5 h-3.5" />
                <div className="flex items-center gap-1 bg-white rounded p-0.5 border border-slate-200 shadow-sm">
                    <button onClick={() => handleProviderChange('gemini')} className={`px-2 py-0.5 rounded transition-all font-medium ${ttsProvider === 'gemini' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Gemini</button>
                    <button onClick={() => handleProviderChange('elevenlabs')} className={`px-2 py-0.5 rounded transition-all font-medium ${ttsProvider === 'elevenlabs' ? 'bg-orange-500/80 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>ElevenLabs</button>
                </div>
                <span className="text-brand-300">|</span>
                <div className="flex items-center gap-2">
                    <span className="text-brand-800/70 uppercase font-bold tracking-wider">Voice:</span>
                    <select value={activeVoice} onChange={(e) => handleVoiceChange(e.target.value)} className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-brand-600 transition-colors max-w-[100px] truncate">
                    {ttsProvider === 'gemini' ? GEMINI_VOICES.map(v => <option key={v} value={v} className="bg-white text-slate-800">{v}</option>) 
                    : elevenLabsVoices.length > 0 ? elevenLabsVoices.map(v => <option key={v.voice_id} value={v.voice_id} className="bg-white text-slate-800">{v.name}</option>)
                    : <option className="bg-white text-slate-400">Loading/No Key...</option>}
                    </select>
                </div>
                </div>

                {/* Studio Settings (Media Models) */}
                <div className="flex items-center gap-3 text-xs text-purple-700 bg-purple-50 px-4 py-2 rounded-full border border-purple-200 whitespace-nowrap">
                   <Aperture className="w-3.5 h-3.5" />
                   {/* Image Model Selector */}
                   <div className="flex items-center gap-2">
                       <span className="text-purple-800/70 uppercase font-bold tracking-wider">Image:</span>
                       <select 
                          value={activeImageModel}
                          onChange={(e) => setActiveImageModel(e.target.value)}
                          className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-purple-600 transition-colors max-w-[120px] truncate"
                       >
                          <option value="gemini-3-pro-image-preview">Gemini 3 Pro</option>
                          <option value="gemini-2.5-flash-image">Gemini 2.5</option>
                          <option value="imagen-3.0-generate-001">Imagen 3</option>
                          <option value="openrouter-flux">OpenRouter Flux</option>
                          <option value="hf-flux-dev">HuggingFace FLUX</option>
                          <option value="hf-sdxl">HuggingFace SDXL</option>
                       </select>
                   </div>
                   <span className="text-purple-300">|</span>
                   {/* Video Model Selector */}
                   <div className="flex items-center gap-2">
                       <span className="text-purple-800/70 uppercase font-bold tracking-wider">Video:</span>
                       <select 
                          value={activeVideoModel}
                          onChange={(e) => setActiveVideoModel(e.target.value)}
                          className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-purple-600 transition-colors max-w-[120px] truncate"
                       >
                          <option value="veo-3.1-fast-generate-preview">Veo Fast</option>
                          <option value="hf-cogvideo">HF CogVideo</option>
                       </select>
                   </div>
                </div>

                {/* Visual Settings Group */}
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full border border-slate-200">
                    <div className="flex items-center gap-1 pr-1">
                        {[{ val: "9:16", icon: Smartphone }, { val: "16:9", icon: Monitor }, { val: "1:1", icon: Tablet }].map(r => (
                            <button key={r.val} onClick={() => setAspectRatio(r.val as AspectRatio)} className={`p-1.5 rounded-full transition-all ${aspectRatio === r.val ? 'bg-white text-brand-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><r.icon className="w-3.5 h-3.5" /></button>
                        ))}
                    </div>
                </div>

            </div>
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
            {scenes.map((scene: Scene, idx: number) => {
                const cacheKey = `${activeVariationIndex}-${idx}`;
                const structuredPrompts = scene.media_prompts;
                
                return (
                <div key={idx} className="glass-panel p-4 md:p-6 rounded-2xl border border-slate-200 bg-white hover:border-brand-500/30 transition-all shadow-sm hover:shadow-md group/card animate-in fade-in slide-in-from-bottom-4 duration-500" style={{animationDelay: `${idx * 100}ms`}}>
                    
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
                                {!previewImages[cacheKey] && (
                                    <button 
                                        onClick={() => handleGeneratePreview(scene, idx)}
                                        disabled={loadingImageIdx === idx}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] transition-colors bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-medium active:scale-95"
                                        title={`Generate using ${activeImageModel}`}
                                    >
                                        {loadingImageIdx === idx ? <Loader2 className="w-3 h-3 animate-spin"/> : <Image className="w-3 h-3"/>}
                                        {activeImageModel.includes('flux') ? 'Flux' : activeImageModel.includes('hf') ? 'HF' : activeImageModel.includes('imagen') ? 'Imagen' : 'Gemini'}
                                    </button>
                                )}
                                
                                {/* Video Gen Button */}
                                {(structuredPrompts?.video_prompt || scene.video_prompt) && !previewVideos[cacheKey] && (
                                    <button 
                                        onClick={() => handleGenerateVideo(scene, idx)}
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
                        {previewVideos[cacheKey] ? (
                            <div className={`mb-4 relative rounded-lg overflow-hidden border border-slate-200 shadow-sm group/media bg-black ${aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "16:9" ? "aspect-video" : "aspect-square"}`}>
                                <video src={previewVideos[cacheKey]} controls className="w-full h-full object-cover" />
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/media:opacity-100 transition-opacity">
                                    <button onClick={() => handleDownload(previewVideos[cacheKey] as string, `scene-${idx+1}-video.mp4`)} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Download className="w-3 h-3" /></button>
                                    <button onClick={() => setViewModalContent({type: 'video', url: previewVideos[cacheKey] as string})} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Maximize2 className="w-3 h-3" /></button>
                                </div>
                            </div>
                        ) : previewImages[cacheKey] ? (
                            <div className={`mb-4 relative rounded-lg overflow-hidden border border-slate-200 shadow-sm group/media bg-black ${aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "16:9" ? "aspect-video" : "aspect-square"}`}>
                                <img src={previewImages[cacheKey]} alt="Scene Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-2 opacity-0 group-hover/media:opacity-100 transition-opacity">
                                    <span className="text-[10px] text-white/80 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-indigo-400"/> {activeImageModel.includes('flux') ? 'Flux' : 'Gemini'} Image
                                    </span>
                                </div>
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/media:opacity-100 transition-opacity">
                                    <button onClick={() => handleDownload(previewImages[cacheKey] as string, `scene-${idx+1}-image.jpg`)} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Download className="w-3 h-3" /></button>
                                    <button onClick={() => setViewModalContent({type: 'image', url: previewImages[cacheKey] as string})} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Maximize2 className="w-3 h-3" /></button>
                                </div>
                            </div>
                        ) : (loadingImageIdx === idx || loadingVideoIdx === idx) ? (
                            <div className={`mb-4 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-4 group ${aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "16:9" ? "aspect-video" : "aspect-square"}`}>
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                            <div className="relative z-10 flex flex-col items-center">
                                <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-2" />
                                <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">
                                    {loadingVideoIdx === idx ? 'Generating Video' : 'Rendering Image'}
                                </span>
                            </div>
                            </div>
                        ) : null}

                        <p className="text-slate-700 text-sm leading-relaxed mb-4 font-medium">{scene.visual_description}</p>
                        
                        {/* Structured Prompts Display */}
                        {structuredPrompts && (
                            <div className="space-y-2">
                                <div className="bg-slate-50 p-3 rounded border border-slate-200 relative group/prompt">
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-2">
                                        <Image className="w-3 h-3"/> AI Image Prompt
                                        </div>
                                        <button onClick={() => copyToClipboard(`prompt-text-${idx}`, structuredPrompts.image_prompt)} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-800 transition-colors">
                                            {copiedSection === `prompt-text-${idx}` ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                                        </button>
                                    </div>
                                    <code className="text-xs text-brand-600 font-mono block leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">{structuredPrompts.image_prompt}</code>
                                    <div className="mt-1 text-[10px] text-red-400 font-mono truncate">Negative: {structuredPrompts.image_negative}</div>
                                </div>

                                <div className="bg-indigo-50/50 p-3 rounded border border-indigo-100 relative group/prompt">
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-indigo-100">
                                        <div className="text-[10px] text-indigo-500 uppercase font-bold flex items-center gap-2">
                                        <VideoIcon className="w-3 h-3"/> Video Prompt
                                        </div>
                                        <button onClick={() => copyToClipboard(`video-prompt-${idx}`, structuredPrompts.video_prompt)} className="p-1 hover:bg-indigo-100 rounded text-indigo-400 hover:text-indigo-800 transition-colors">
                                            {copiedSection === `video-prompt-${idx}` ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                                        </button>
                                    </div>
                                    <code className="text-xs text-indigo-600 font-mono block leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">{structuredPrompts.video_prompt}</code>
                                    <div className="mt-2 flex gap-2">
                                        {structuredPrompts.video_params?.duration && <span className="text-[9px] bg-white border border-indigo-200 px-1.5 py-0.5 rounded text-indigo-500 font-bold">{structuredPrompts.video_params.duration}</span>}
                                        {structuredPrompts.video_params?.fps && <span className="text-[9px] bg-white border border-indigo-200 px-1.5 py-0.5 rounded text-indigo-500 font-bold">{structuredPrompts.video_params.fps} FPS</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Fallback for Legacy Scenes without structured prompts */}
                        {!structuredPrompts && (
                            <div className="space-y-2">
                                <div className="bg-slate-50 p-3 rounded border border-slate-200 relative group/prompt">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-2 mb-1"><Image className="w-3 h-3"/> Legacy Prompt</div>
                                    <code className="text-xs text-brand-600 font-mono block leading-relaxed line-clamp-2">{scene.image_prompt}</code>
                                </div>
                            </div>
                        )}
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
                            onClick={() => handleTogglePlay(scene.audio_script as string, idx)} 
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
                                {audioUrls[cacheKey] ? 'Play VO' : `Generate (${ttsProvider === 'elevenlabs' ? '11Labs' : 'Gemini'})`}
                                </>
                            )}
                            </button>

                            {audioUrls[cacheKey] && (
                            <button 
                                onClick={() => handleDownload(audioUrls[cacheKey] as string, `scene-${idx+1}-audio.mp3`)}
                                className="p-3 md:p-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 active:scale-95"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                            )}
                        </div>
                    </div>
                    </div>
                </div>
                );
            })}
        </div>
      )}
    </div>
  );
};
