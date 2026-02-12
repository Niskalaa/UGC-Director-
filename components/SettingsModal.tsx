
import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, Check, Zap, Cpu, Network, LayoutGrid, Mic } from 'lucide-react';
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
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [activeProvider, setActiveProvider] = useState<string>('gemini'); // 'gemini' | 'openrouter'
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOpenRouterKey(getStoredOpenRouterKey());
      setSelectedModel(getStoredOpenRouterModel());
      setGeminiKey(localStorage.getItem('GEMINI_API_KEY') || '');
      setElevenLabsKey(localStorage.getItem('ELEVENLABS_API_KEY') || '');
      setActiveProvider(localStorage.getItem('PREFERRED_PROVIDER') || 'gemini');
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

    if (elevenLabsKey.trim()) {
        localStorage.setItem('ELEVENLABS_API_KEY', elevenLabsKey.trim());
    } else {
        localStorage.removeItem('ELEVENLABS_API_KEY');
    }

    localStorage.setItem('PREFERRED_PROVIDER', activeProvider);

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
      window.location.reload(); 
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-brand-50 rounded-lg border border-brand-200">
            <Key className="w-5 h-5 text-brand-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">System Settings</h2>
            <p className="text-xs text-slate-500">API Keys & Model Configuration</p>
          </div>
        </div>

        <div className="space-y-6">
          
          {/* Provider Selection */}
          <div className="space-y-3 pb-6 border-b border-slate-100">
             <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-blue-500" /> Active AI Engine
             </label>
             <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => setActiveProvider('gemini')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${activeProvider === 'gemini' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}
                >
                    <Zap className={`w-5 h-5 ${activeProvider === 'gemini' ? 'text-emerald-500' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold">Google Gemini</span>
                </button>
                <button 
                    onClick={() => setActiveProvider('openrouter')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${activeProvider === 'openrouter' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}
                >
                    <Network className={`w-5 h-5 ${activeProvider === 'openrouter' ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold">OpenRouter</span>
                </button>
             </div>
          </div>
            
          {/* Gemini Section */}
          <div className={`space-y-3 pb-6 border-b border-slate-100 ${activeProvider !== 'gemini' ? 'opacity-50 grayscale' : ''}`}>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    <label className="text-sm font-bold text-slate-700">Gemini API Key</label>
                </div>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                   Get Key <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Required for Video (Veo), TTS, and Image Analysis. Uses fallback if empty.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  disabled={activeProvider !== 'gemini'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors placeholder-slate-400 disabled:cursor-not-allowed"
                />
             </div>
          </div>

          {/* OpenRouter Section */}
          <div className={`space-y-3 pb-6 border-b border-slate-100 ${activeProvider !== 'openrouter' ? 'opacity-50 grayscale' : ''}`}>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-indigo-500" />
                    <label className="text-sm font-bold text-slate-700">OpenRouter API</label>
                </div>
                <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                   Get Key <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <div className="relative">
                <input 
                  type="password" 
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  placeholder="sk-or-..."
                  disabled={activeProvider !== 'openrouter'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors placeholder-slate-400 disabled:cursor-not-allowed"
                />
             </div>
             
             {/* Model Selector */}
             <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Cpu className="w-4 h-4 text-slate-400" /> Preferred Model
                </div>
                <select 
                    value={selectedModel} 
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={activeProvider !== 'openrouter'}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500 max-w-[180px] disabled:opacity-50"
                >
                    {OPENROUTER_MODELS.map(m => (
                        <option key={m.id} value={m.id} className="bg-white text-slate-700">{m.name}</option>
                    ))}
                </select>
             </div>
          </div>

          {/* ElevenLabs Section */}
          <div className="space-y-3 pb-2">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-orange-500" />
                    <label className="text-sm font-bold text-slate-700">ElevenLabs API</label>
                </div>
                <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                   Get Key <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Optional. If provided, enables high-quality AI voices for script reading.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={elevenLabsKey}
                  onChange={(e) => setElevenLabsKey(e.target.value)}
                  placeholder="xi-..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-colors placeholder-slate-400"
                />
             </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-4 shadow-lg"
          >
             {saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4" />}
             {saved ? 'Settings Saved' : 'Save & Reload'}
          </button>
        </div>
      </div>
    </div>
  );
};
