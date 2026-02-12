
import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, Check, Zap, Cpu, Image as ImageIcon, Video, Clock, Gauge, Network } from 'lucide-react';
import { getStoredOpenRouterKey, setStoredOpenRouterKey, getStoredOpenRouterModel, setStoredOpenRouterModel } from '../services/externalService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OPENROUTER_MODELS = [
    { id: "deepseek/deepseek-chat", name: "DeepSeek V3" },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1 (Reasoning)" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
    { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
    { id: "openai/gpt-4o", name: "GPT-4o" },
    { id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B" }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [defaultVideoDuration, setDefaultVideoDuration] = useState('5s');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOpenRouterKey(getStoredOpenRouterKey());
      setSelectedModel(getStoredOpenRouterModel());
      setGeminiKey(localStorage.getItem('GEMINI_API_KEY') || '');
      setDefaultVideoDuration(localStorage.getItem('PREF_VIDEO_DURATION') || '5s');
    }
  }, [isOpen]);

  const handleSave = () => {
    setStoredOpenRouterKey(openRouterKey);
    setStoredOpenRouterModel(selectedModel);
    
    if (geminiKey.trim()) {
        localStorage.setItem('GEMINI_API_KEY', geminiKey.trim());
    } else {
        localStorage.removeItem('GEMINI_API_KEY');
    }

    localStorage.setItem('PREF_VIDEO_DURATION', defaultVideoDuration);

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
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
            <p className="text-xs text-slate-400">API Keys & Model Configuration</p>
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
                Default engine for Strategy & Scenes. Use your own key to bypass default quotas.
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

          {/* OpenRouter Section */}
          <div className="space-y-3 pb-6 border-b border-white/5">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-indigo-400" />
                    <label className="text-sm font-bold text-slate-200">OpenRouter API</label>
                </div>
                <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-[10px] text-brand-400 hover:underline flex items-center gap-1">
                   Get Key <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Optional. Overrides Gemini for Strategy & Script generation using models like Claude or DeepSeek.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  placeholder="sk-or-..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-700"
                />
             </div>
             
             {/* Model Selector */}
             <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Cpu className="w-4 h-4 text-slate-500" /> Preferred Model
                </div>
                <select 
                    value={selectedModel} 
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500 max-w-[180px]"
                >
                    {OPENROUTER_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
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
