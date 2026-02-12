import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, Check, Zap, Sparkles, Image as ImageIcon, Video, Clock, Gauge } from 'lucide-react';
import { getStoredReplicateKey, setStoredReplicateKey } from '../services/externalService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [replicateKey, setReplicateKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [defaultImageModel, setDefaultImageModel] = useState('flux');
  const [defaultVideoDuration, setDefaultVideoDuration] = useState('5s');
  const [defaultVideoFps, setDefaultVideoFps] = useState('30');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReplicateKey(getStoredReplicateKey());
      setGeminiKey(localStorage.getItem('GEMINI_API_KEY') || '');
      setDefaultImageModel(localStorage.getItem('PREF_IMAGE_MODEL') || 'flux');
      setDefaultVideoDuration(localStorage.getItem('PREF_VIDEO_DURATION') || '5s');
      setDefaultVideoFps(localStorage.getItem('PREF_VIDEO_FPS') || '30');
    }
  }, [isOpen]);

  const handleSave = () => {
    setStoredReplicateKey(replicateKey);
    
    if (geminiKey.trim()) {
        localStorage.setItem('GEMINI_API_KEY', geminiKey.trim());
    } else {
        localStorage.removeItem('GEMINI_API_KEY');
    }

    localStorage.setItem('PREF_IMAGE_MODEL', defaultImageModel);
    localStorage.setItem('PREF_VIDEO_DURATION', defaultVideoDuration);
    localStorage.setItem('PREF_VIDEO_FPS', defaultVideoFps);

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
      // Reload page to apply changes if necessary, or just close. 
      // Components read from localStorage on mount usually.
      // Ideally we should use a Context for this, but simple localStorage read in components works for now.
      window.location.reload(); 
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#0f0f0f] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-brand-900/20 rounded-lg border border-brand-500/20">
            <Key className="w-5 h-5 text-brand-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">System Settings</h2>
            <p className="text-xs text-slate-400">API Keys & Generation Defaults</p>
          </div>
        </div>

        <div className="space-y-6">
            
          {/* Gemini Section */}
          <div className="space-y-3 pb-6 border-b border-white/5">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <label className="text-sm font-bold text-slate-200">Gemini API Key</label>
                </div>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-brand-400 hover:underline flex items-center gap-1">
                   Get Key <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Optional. Use your own key if the default quota is exhausted.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder-slate-700"
                />
             </div>
          </div>

          {/* Replicate Section */}
          <div className="space-y-3 pb-6 border-b border-white/5">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <label className="text-sm font-bold text-slate-200">Replicate API Token</label>
                </div>
                <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer" className="text-[10px] text-brand-400 hover:underline flex items-center gap-1">
                   Get Token <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Required for <strong>Flux</strong> images and <strong>Minimax</strong> video.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={replicateKey}
                  onChange={(e) => setReplicateKey(e.target.value)}
                  placeholder="r8_..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-700"
                />
             </div>
          </div>

          {/* Defaults Section */}
          <div className="space-y-4">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generation Defaults</h3>
             
             {/* Image Model Pref */}
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <ImageIcon className="w-4 h-4 text-slate-500" /> Image Model
                </div>
                <select 
                    value={defaultImageModel} 
                    onChange={(e) => setDefaultImageModel(e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                >
                    <option value="flux">Flux Schnell (Replicate)</option>
                    <option value="gemini">Gemini Imagen</option>
                </select>
             </div>

             {/* Video Duration */}
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Clock className="w-4 h-4 text-slate-500" /> Video Duration
                </div>
                <select 
                    value={defaultVideoDuration} 
                    onChange={(e) => setDefaultVideoDuration(e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                >
                    <option value="5s">5 Seconds</option>
                    <option value="10s">10 Seconds</option>
                </select>
             </div>

             {/* Video FPS */}
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Gauge className="w-4 h-4 text-slate-500" /> Video FPS
                </div>
                <select 
                    value={defaultVideoFps} 
                    onChange={(e) => setDefaultVideoFps(e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                >
                    <option value="24">24 FPS</option>
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                </select>
             </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 mt-4"
          >
             {saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4" />}
             {saved ? 'Settings Saved' : 'Save & Reload'}
          </button>
        </div>
      </div>
    </div>
  );
};