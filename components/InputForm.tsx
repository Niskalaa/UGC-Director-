import React, { useState, useEffect } from 'react';
import { FormData } from '../types';
import { Sparkles, Type, Tag, Target, Smartphone, Link, FileText, Plus, X, CheckCircle2, Globe, Clock, Layers, Settings2 } from 'lucide-react';

interface InputFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
  initialValues?: FormData | null;
}

const defaultData: FormData = {
  brand: { name: '', tone_hint_optional: '', country_market_optional: 'ID' },
  product: { type: '', material: '', price_tier_optional: 'mid', platform: ['tiktok'], objective: 'conversion', main_angle_optional: 'problem-solution' },
  scrape: { source_url_optional: '', raw_text_optional: '' },
  constraints: { do_not_say_optional: [], must_include_optional: [], language: 'id', vo_duration_seconds: 30, scene_count: 5 },
};

export const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, initialValues }) => {
  const [data, setData] = useState<FormData>(defaultData);

  useEffect(() => {
    if (initialValues) {
      setData(initialValues);
    }
  }, [initialValues]);

  const handleChange = (section: keyof FormData, field: string, value: any) => {
    setData((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const togglePlatform = (platform: any) => {
    setData((prev) => {
      const current = prev.product.platform;
      const updated = current.includes(platform) ? current.filter((p) => p !== platform) : [...current, platform];
      return { ...prev, product: { ...prev.product, platform: updated } };
    });
  };

  const handleArrayAdd = (field: 'do_not_say_optional' | 'must_include_optional', value: string, setter: any) => {
    if (!value.trim()) return;
    setData(prev => ({ ...prev, constraints: { ...prev.constraints, [field]: [...prev.constraints[field], value.trim()] } }));
    setter('');
  };

  // Auto-adjust duration recommendation based on scene count if user hasn't heavily customized it
  // This is a simple heuristic: ~6s per scene
  const handleSceneCountChange = (count: number) => {
      handleChange('constraints', 'scene_count', count);
      // Optional: Auto-suggest duration? 
      // Let's keep it manual for now but maybe just update the default if it was the initial value.
      // For now, simple manual control is safer.
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (data.product.platform.length === 0) return alert("Select platform"); onSubmit(data); }} className="space-y-6 text-sm">
      
      {/* Brand */}
      <div className="glass-panel p-5 rounded-2xl border-l-4 border-brand-500">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Type className="w-4 h-4 text-brand-500"/> Brand Identity</h3>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <input required type="text" className="glass-input w-full p-3 rounded-xl placeholder-slate-500" value={data.brand.name} onChange={(e) => handleChange('brand', 'name', e.target.value)} placeholder="Brand Name *" />
          <input type="text" className="glass-input w-full p-3 rounded-xl placeholder-slate-500" value={data.brand.tone_hint_optional} onChange={(e) => handleChange('brand', 'tone_hint_optional', e.target.value)} placeholder="Tone (e.g. Fun, Scientific)" />
        </div>
        <div className="flex items-center gap-2 bg-zinc-900/50 p-2 rounded-xl border border-white/5">
             <Globe className="w-4 h-4 text-slate-400 ml-2" />
             <select 
                className="bg-transparent w-full p-2 text-slate-200 outline-none"
                value={data.constraints.language} 
                onChange={(e) => handleChange('constraints', 'language', e.target.value)}
             >
                <option className="bg-zinc-900" value="id">Output Language: Indonesian</option>
                <option className="bg-zinc-900" value="en">Output Language: English</option>
             </select>
        </div>
      </div>

      {/* Product */}
      <div className="glass-panel p-5 rounded-2xl border-l-4 border-purple-500">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-purple-500"/> Product Specs</h3>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <input required type="text" className="glass-input w-full p-3 rounded-xl placeholder-slate-500" value={data.product.type} onChange={(e) => handleChange('product', 'type', e.target.value)} placeholder="Type (e.g. Serum) *" />
          <input required type="text" className="glass-input w-full p-3 rounded-xl placeholder-slate-500" value={data.product.material} onChange={(e) => handleChange('product', 'material', e.target.value)} placeholder="Key Feature (e.g. Retinol) *" />
          <select className="glass-input w-full p-3 rounded-xl" value={data.product.objective} onChange={(e) => handleChange('product', 'objective', e.target.value)}>
             <option className="bg-zinc-900" value="conversion">Conversion</option>
             <option className="bg-zinc-900" value="awareness">Awareness</option>
          </select>
          <select className="glass-input w-full p-3 rounded-xl" value={data.product.main_angle_optional} onChange={(e) => handleChange('product', 'main_angle_optional', e.target.value)}>
             <option className="bg-zinc-900" value="problem-solution">Problem-Solution</option>
             <option className="bg-zinc-900" value="routine">Routine</option>
             <option className="bg-zinc-900" value="review">Review</option>
          </select>
        </div>
        <div className="flex gap-2">
          {['tiktok', 'reels', 'shorts'].map(p => (
            <button key={p} type="button" onClick={() => togglePlatform(p)} className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-2 transition-all ${data.product.platform.includes(p as any) ? 'bg-purple-900/50 border-purple-500 text-white' : 'glass-input border-transparent text-slate-500'}`}>
              <Smartphone className="w-4 h-4"/> {p}
            </button>
          ))}
        </div>
      </div>

      {/* Format Settings (Scenes & Duration) */}
      <div className="glass-panel p-5 rounded-2xl border-l-4 border-blue-500">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4 text-blue-500"/> Format Control</h3>
        
        <div className="space-y-6">
            {/* Scene Count Slider */}
            <div>
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400 flex items-center gap-2"><Layers className="w-4 h-4 text-blue-400"/> Scene Count</span>
                    <span className="text-white font-bold bg-blue-500/20 px-2 py-0.5 rounded text-xs border border-blue-500/20">{data.constraints.scene_count || 5} Scenes</span>
                </div>
                <input 
                    type="range" 
                    min="3" 
                    max="10" 
                    step="1" 
                    value={data.constraints.scene_count || 5} 
                    onChange={(e) => handleSceneCountChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>3 (Short)</span>
                    <span>10 (Long)</span>
                </div>
            </div>

            {/* Duration Slider */}
            <div>
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400"/> Target Duration</span>
                    <span className="text-white font-bold bg-blue-500/20 px-2 py-0.5 rounded text-xs border border-blue-500/20">{data.constraints.vo_duration_seconds} Seconds</span>
                </div>
                <input 
                    type="range" 
                    min="15" 
                    max="90" 
                    step="5" 
                    value={data.constraints.vo_duration_seconds} 
                    onChange={(e) => handleChange('constraints', 'vo_duration_seconds', parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>15s</span>
                    <span>90s</span>
                </div>
            </div>
        </div>
      </div>

      {/* Context */}
      <div className="glass-panel p-5 rounded-2xl border-l-4 border-emerald-500">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-500"/> Context (Optional)</h3>
        <textarea className="glass-input w-full p-3 rounded-xl h-24 placeholder-slate-500" value={data.scrape.raw_text_optional} onChange={(e) => handleChange('scrape', 'raw_text_optional', e.target.value)} placeholder="Paste raw product details, facts, or existing copy here..." />
      </div>

      <button disabled={isLoading} className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
        {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Sparkles className="w-5 h-5"/>}
        {isLoading ? 'GENERATING...' : 'GENERATE BRIEF'}
      </button>
    </form>
  );
};