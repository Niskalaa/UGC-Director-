
import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, Check } from 'lucide-react';
import { getStoredReplicateKey, setStoredReplicateKey } from '../services/externalService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [replicateKey, setReplicateKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReplicateKey(getStoredReplicateKey());
    }
  }, [isOpen]);

  const handleSave = () => {
    setStoredReplicateKey(replicateKey);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#0f0f0f] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
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
            <h2 className="text-xl font-bold text-white">Integration Settings</h2>
            <p className="text-xs text-slate-400">Manage third-party API connections</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Replicate Section */}
          <div className="space-y-3">
             <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-200">Replicate API Token</label>
                <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer" className="text-[10px] text-brand-400 hover:underline flex items-center gap-1">
                   Get Token <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-xs text-slate-500 leading-relaxed">
                Required for <strong>Flux</strong> (High-Quality Images) and <strong>Minimax</strong> (Video Generation). 
                Without this, the app uses standard Gemini capabilities.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={replicateKey}
                  onChange={(e) => setReplicateKey(e.target.value)}
                  placeholder="r8_..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
                />
             </div>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/10 p-3 rounded-lg">
             <p className="text-[10px] text-yellow-200/80">
                <strong>Note:</strong> Your keys are stored locally in your browser and used directly to fetch data from providers.
             </p>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
          >
             {saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4" />}
             {saved ? 'Saved!' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};
