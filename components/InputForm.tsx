
import React, { useState, useEffect, useRef } from 'react';
import { FormData } from '../types';
import { Sparkles, Type, Tag, Target, Smartphone, Link, FileText, Plus, X, CheckCircle2, Globe, Clock, Layers, Settings2, Image as ImageIcon, Loader2, Cpu, Zap } from 'lucide-react';
import { analyzeImageForBrief } from '../services/geminiService';

interface InputFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
  initialValues?: FormData | null;
}

const defaultData: FormData = {
  brand: { name: '', tone_hint_optional: '', country_market_optional: 'ID' },
  product: { type: '', material: '', price_tier_optional: 'mid', platform: ['tiktok'], objective: 'conversion', main_angle_optional: 'problem-solution' },
  scrape: { source_url_optional: '', raw_text_optional: '' },
  constraints: { do_not_say_optional: [], must_include_optional: [], language: 'id', vo_duration_seconds: 30, scene_count: 5, ai_model: 'gemini-3-pro-preview' },
};

export const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, initialValues }) => {
  const [data, setData] = useState<FormData>(defaultData);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialValues) {
      // Ensure ai_model is set if loading from legacy history
      const safeData = {
          ...initialValues,
          constraints: {
              ...initialValues.constraints,
              ai_model: initialValues.constraints.ai_model || 'gemini-3-pro-preview'
          }
      };
      setData(safeData);
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

  // Auto-adjust duration recommendation based on scene count
  const handleSceneCountChange = (count: number) => {
      handleChange('constraints', 'scene_count', count);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingImage(true);
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = (reader.result as string).split(',')[1];
            const mimeType = file.type;
            
            try {
                const analysis = await analyzeImageForBrief(base64String, mimeType);
                
                // Merge analysis into form data
                setData(prev => ({
                    ...prev,
                    brand: {
                        ...prev.brand,
                        name: analysis.brand_name || prev.brand.name,
                        tone_hint_optional: analysis.brand_tone || prev.brand.tone_hint_optional
                    },
                    product: {
                        ...prev.product,
                        type: analysis.product_type || prev.product.type,
                        material: analysis.product_material || prev.product.material,
                        price_tier_optional: analysis.price_tier || prev.product.price_tier_optional,
                        main_angle_optional: analysis.marketing_angle || prev.product.main_angle_optional
                    },
                    scrape: {
                        ...prev.scrape,
                        raw_text_optional: (prev.scrape.raw_text_optional ? prev.scrape.raw_text_optional + "\n\n" : "") + (analysis.raw_context ? `[Image Analysis]: ${analysis.raw_context}` : "")
                    }
                }));
                
                alert("Form auto-filled from image analysis!");
            } catch (err) {
                console.error(err);
                alert("Could not analyze image. Please try again.");
            } finally {
                setIsAnalyzingImage(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsDataURL(file);
    } catch (err) {
        setIsAnalyzingImage(false);
        console.error("File reading failed", err);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (data.product.platform.length === 0) return alert("Select platform"); onSubmit(data); }} className="space-y-6 text-sm">
      
      {/* Brand */}
      <div className="glass-panel p-5 rounded-2xl border-l-4 border-brand-500 relative">
        <div className="flex justify-between items-center mb-4">
             <h3 className="text-white font-bold flex items-center gap-2"><Type className="w-4 h-4 text-brand-500"/> Brand Identity</h3>
             
             {/* Image Upload Trigger */}
             <div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    className="hidden" 
                />
                <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzingImage || isLoading}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-900/30 border border-brand-500/30 text-brand-300 text-xs hover:bg-brand-900/50 hover:text-white transition-all"
                >
                    {isAnalyzingImage ? <Loader2 className="w-3 h-3 animate-spin"/> : <ImageIcon className="w-3 h-3" />}
                    {isAnalyzingImage ? "Analyzing..." : "Auto-fill from Image"}
                </button>
             </div>
        </div>

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
            {/* AI Model Selector */}
            <div>
                 <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400 flex items-center gap-2"><Cpu className="w-4 h-4 text-blue-400"/> AI Model</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        type="button"
                        onClick={() => handleChange('constraints', 'ai_model', 'gemini-3-pro-preview')}
                        className={`py-3 px-4 rounded-xl border text-left transition-all relative ${
                            data.constraints.ai_model === 'gemini-3-pro-preview' 
                            ? 'bg-blue-500/20 border-blue-500 text-white' 
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                    >
                        <div className="font-bold text-xs flex items-center gap-2">
                            Gemini 3 Pro
                            {data.constraints.ai_model === 'gemini-3-pro-preview' && <CheckCircle2 className="w-3 h-3 text-blue-400"/>}
                        </div>
                        <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
                             <Zap className="w-3 h-3" /> Max Thinking (Slow)
                        </div>
                    </button>

                    <button 
                        type="button"
                        onClick={() => handleChange('constraints', 'ai_model', 'gemini-3-flash-preview')}
                        className={`py-3 px-4 rounded-xl border text-left transition-all relative ${
                            data.constraints.ai_model === 'gemini-3-flash-preview' 
                            ? 'bg-emerald-500/20 border-emerald-500 text-white' 
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                    >
                        <div className="font-bold text-xs flex items-center gap-2">
                            Gemini 3 Flash
                             {data.constraints.ai_model === 'gemini-3-flash-preview' && <CheckCircle2 className="w-3 h-3 text-emerald-400"/>}
                        </div>
                         <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
                             <Cpu className="w-3 h-3" /> Balanced (Fast)
                        </div>
                    </button>
                </div>
            </div>

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
