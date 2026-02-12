
import React, { useState, useEffect, useRef } from 'react';
import { FormData } from '../types';
import { Sparkles, Type, Tag, Smartphone, FileText, Loader2, Image as ImageIcon, Globe, Settings2, Cpu, Zap, Layers, CheckCircle2, Clock, Network, Palette } from 'lucide-react';
import { analyzeImageForBrief } from '../services/geminiService';

interface InputFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
  initialValues?: FormData | null;
  activeProvider?: string;
  openRouterModel?: string;
}

const defaultData: FormData = {
  brand: { name: '', tone_hint_optional: '', country_market_optional: 'ID' },
  product: { type: '', material: '', price_tier_optional: 'mid', platform: ['tiktok'], objective: 'conversion', main_angle_optional: 'problem-solution' },
  scrape: { source_url_optional: '', raw_text_optional: '' },
  constraints: { do_not_say_optional: [], must_include_optional: [], language: 'id', vo_duration_seconds: 30, scene_count: 5, ai_model: 'gemini-3-pro-preview', image_generator_model: 'gemini-3-pro-image-preview' },
};

export const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, initialValues, activeProvider = 'gemini', openRouterModel }) => {
  const [data, setData] = useState<FormData>(defaultData);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialValues) {
      const safeData = {
          ...initialValues,
          constraints: {
              ...initialValues.constraints,
              ai_model: initialValues.constraints.ai_model || 'gemini-3-pro-preview',
              image_generator_model: initialValues.constraints.image_generator_model || 'gemini-3-pro-image-preview'
          }
      };
      setData(safeData);
    }
  }, [initialValues]);

  // Sync OpenRouter model to constraints if provider changes
  useEffect(() => {
    if (activeProvider === 'openrouter' && openRouterModel) {
        handleChange('constraints', 'ai_model', openRouterModel);
    } else if (activeProvider === 'gemini' && !data.constraints.ai_model.startsWith('gemini')) {
        handleChange('constraints', 'ai_model', 'gemini-3-pro-preview');
    }
  }, [activeProvider, openRouterModel]);

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
    <form onSubmit={(e) => { e.preventDefault(); if (data.product.platform.length === 0) return alert("Select platform"); onSubmit(data); }} className="space-y-5 text-sm">
      
      {/* Brand */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border-l-4 border-brand-500 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
             <h3 className="text-slate-800 font-bold flex items-center gap-2 text-base"><Type className="w-5 h-5 text-brand-500"/> Brand Identity</h3>
             
             {/* Image Upload Trigger */}
             <div className="w-full sm:w-auto">
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
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-brand-50 border border-brand-200 text-brand-600 text-xs hover:bg-brand-100 transition-all font-semibold active:scale-95"
                >
                    {isAnalyzingImage ? <Loader2 className="w-3 h-3 animate-spin"/> : <ImageIcon className="w-3 h-3" />}
                    {isAnalyzingImage ? "Analyzing..." : "Auto-fill from Image"}
                </button>
             </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
             <label className="text-xs font-semibold text-slate-500 ml-1">Brand Name</label>
             <input required type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base" value={data.brand.name} onChange={(e) => handleChange('brand', 'name', e.target.value)} placeholder="e.g. GlowUp Co." />
          </div>
          <div className="space-y-1">
             <label className="text-xs font-semibold text-slate-500 ml-1">Brand Tone</label>
             <input type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base" value={data.brand.tone_hint_optional} onChange={(e) => handleChange('brand', 'tone_hint_optional', e.target.value)} placeholder="e.g. Fun, Scientific, Bold" />
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
             <Globe className="w-4 h-4 text-slate-500 ml-2 shrink-0" />
             <select 
                className="bg-transparent w-full p-2 text-slate-700 outline-none font-medium text-base"
                value={data.constraints.language} 
                onChange={(e) => handleChange('constraints', 'language', e.target.value)}
             >
                <option className="bg-white" value="id">Output Language: Indonesian</option>
                <option className="bg-white" value="en">Output Language: English</option>
             </select>
        </div>
      </div>

      {/* Product */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border-l-4 border-purple-500">
        <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-base"><Tag className="w-5 h-5 text-purple-500"/> Product Specs</h3>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <input required type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base" value={data.product.type} onChange={(e) => handleChange('product', 'type', e.target.value)} placeholder="Type (e.g. Serum) *" />
          <input required type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base" value={data.product.material} onChange={(e) => handleChange('product', 'material', e.target.value)} placeholder="Key Feature (e.g. Retinol) *" />
          <select className="glass-input w-full p-3.5 rounded-xl text-base bg-white" value={data.product.objective} onChange={(e) => handleChange('product', 'objective', e.target.value)}>
             <option className="bg-white" value="conversion">Goal: Conversion</option>
             <option className="bg-white" value="awareness">Goal: Awareness</option>
          </select>
          <select className="glass-input w-full p-3.5 rounded-xl text-base bg-white" value={data.product.main_angle_optional} onChange={(e) => handleChange('product', 'main_angle_optional', e.target.value)}>
             <option className="bg-white" value="problem-solution">Angle: Problem-Solution</option>
             <option className="bg-white" value="routine">Angle: Routine</option>
             <option className="bg-white" value="review">Angle: Review</option>
          </select>
        </div>
        <div className="flex gap-2">
          {['tiktok', 'reels', 'shorts'].map(p => (
            <button key={p} type="button" onClick={() => togglePlatform(p)} className={`flex-1 py-3 rounded-lg border flex items-center justify-center gap-2 transition-all font-medium text-sm active:scale-95 ${data.product.platform.includes(p as any) ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm' : 'glass-input border-transparent text-slate-500 hover:bg-slate-50'}`}>
              <Smartphone className="w-4 h-4"/> <span className="capitalize">{p}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Format Settings (Scenes & Duration) */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border-l-4 border-blue-500">
        <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-base"><Settings2 className="w-5 h-5 text-blue-500"/> Format Control</h3>
        
        <div className="space-y-6">
            
            {/* Model & Image Model Config */}
            <div className="grid md:grid-cols-2 gap-6">
                
                {/* Text Model */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-500 flex items-center gap-2 font-medium"><Cpu className="w-4 h-4 text-blue-400"/> AI Script Model</span>
                    </div>
                    {activeProvider === 'openrouter' ? (
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between h-[72px]">
                            <div className="flex items-center gap-3">
                                <Network className="w-5 h-5 text-indigo-600" />
                                <div>
                                    <div className="text-xs font-bold text-indigo-800 uppercase tracking-wide">OpenRouter</div>
                                    <div className="text-sm font-semibold text-indigo-700 truncate max-w-[120px]">{openRouterModel?.split('/').pop()}</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <select 
                            value={data.constraints.ai_model}
                            onChange={(e) => handleChange('constraints', 'ai_model', e.target.value)}
                            className="w-full h-[72px] bg-white/50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none"
                        >
                            <option value="gemini-3-pro-preview">Gemini 3 Pro (High Quality)</option>
                            <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                        </select>
                    )}
                </div>

                {/* Image Generator Model */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                         <span className="text-slate-500 flex items-center gap-2 font-medium"><Palette className="w-4 h-4 text-purple-400"/> Image Generator</span>
                    </div>
                    <select 
                        value={data.constraints.image_generator_model}
                        onChange={(e) => handleChange('constraints', 'image_generator_model', e.target.value)}
                        className="w-full h-[72px] bg-white/50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 focus:border-purple-500 focus:bg-white transition-all outline-none"
                    >
                        <option value="gemini-3-pro-image-preview">Gemini 3 Image (Best Quality)</option>
                        <option value="gemini-2.5-flash-image">Gemini 2.5 Image (Faster)</option>
                        <option value="imagen-3.0-generate-001">Imagen 3 (Photorealistic)</option>
                        {activeProvider === 'openrouter' && (
                             <option value="openrouter-flux">OpenRouter (Flux)</option>
                        )}
                    </select>
                </div>
            </div>

            {/* Sliders Grid */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Scene Count Slider */}
                <div>
                    <div className="flex justify-between text-sm mb-3">
                        <span className="text-slate-500 flex items-center gap-2 font-medium"><Layers className="w-4 h-4 text-blue-400"/> Scene Count</span>
                        <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-200">{data.constraints.scene_count || 5} Scenes</span>
                    </div>
                    <input 
                        type="range" 
                        min="3" 
                        max="10" 
                        step="1" 
                        value={data.constraints.scene_count || 5} 
                        onChange={(e) => handleSceneCountChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* Duration Slider */}
                <div>
                    <div className="flex justify-between text-sm mb-3">
                        <span className="text-slate-500 flex items-center gap-2 font-medium"><Clock className="w-4 h-4 text-blue-400"/> Duration</span>
                        <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-200">{data.constraints.vo_duration_seconds}s</span>
                    </div>
                    <input 
                        type="range" 
                        min="15" 
                        max="90" 
                        step="5" 
                        value={data.constraints.vo_duration_seconds} 
                        onChange={(e) => handleChange('constraints', 'vo_duration_seconds', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
            </div>
        </div>
      </div>

      {/* Context */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border-l-4 border-emerald-500">
        <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-base"><FileText className="w-5 h-5 text-emerald-500"/> Context (Optional)</h3>
        <textarea className="glass-input w-full p-3.5 rounded-xl h-24 placeholder-slate-400 text-base" value={data.scrape.raw_text_optional} onChange={(e) => handleChange('scrape', 'raw_text_optional', e.target.value)} placeholder="Paste raw product details, facts, or existing copy here..." />
      </div>

      <button disabled={isLoading} className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none active:scale-[0.98]">
        {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Sparkles className="w-5 h-5"/>}
        {isLoading ? 'GENERATING...' : 'GENERATE BRIEF'}
      </button>
    </form>
  );
};
