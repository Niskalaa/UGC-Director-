import React, { useState } from 'react';
import { FormData, Brand, Product, Scrape, Constraints } from '../types';
import { Sparkles, AlertCircle, Link, FileText, CheckCircle2, Circle } from 'lucide-react';

interface InputFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
}

const initialData: FormData = {
  brand: {
    name: '',
    tone_hint_optional: '',
    country_market_optional: 'ID',
  },
  product: {
    type: '',
    material: '',
    variant_optional: '',
    price_tier_optional: 'mid',
    platform: ['tiktok'],
    objective: 'conversion',
    main_angle_optional: 'problem-solution',
  },
  scrape: {
    source_url_optional: '',
    raw_text_optional: '',
  },
  constraints: {
    do_not_say_optional: [],
    must_include_optional: [],
    language: 'id',
    vo_duration_seconds: 15,
  },
};

export const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading }) => {
  const [data, setData] = useState<FormData>(initialData);
  const [doNotSayInput, setDoNotSayInput] = useState('');
  const [mustIncludeInput, setMustIncludeInput] = useState('');

  const handleChange = (section: keyof FormData, field: string, value: any) => {
    setData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const togglePlatform = (platform: 'tiktok' | 'reels' | 'shorts') => {
    setData((prev) => {
      const current = prev.product.platform;
      const updated = current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform];
      
      return {
        ...prev,
        product: {
          ...prev.product,
          platform: updated,
        },
      };
    });
  };

  const handleArrayAdd = (field: 'do_not_say_optional' | 'must_include_optional', value: string, setter: (val: string) => void) => {
    if (!value.trim()) return;
    setData(prev => ({
      ...prev,
      constraints: {
        ...prev.constraints,
        [field]: [...prev.constraints[field], value.trim()]
      }
    }));
    setter('');
  };

  const handleArrayRemove = (field: 'do_not_say_optional' | 'must_include_optional', index: number) => {
    setData(prev => ({
      ...prev,
      constraints: {
        ...prev.constraints,
        [field]: prev.constraints[field].filter((_, i) => i !== index)
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (data.product.platform.length === 0) {
        alert("Please select at least one platform.");
        return;
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-sm">
      
      {/* Brand Section */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-lg backdrop-blur-md">
        <h3 className="text-brand-500 font-semibold mb-5 text-lg flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold ring-1 ring-brand-500/40">1</span>
          Brand Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-slate-300 mb-2 font-medium">Brand Name *</label>
            <input 
              required
              type="text" 
              className="w-full glass-input text-white rounded-xl px-4 py-3 md:py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 placeholder-slate-500 transition-all min-h-[48px]"
              value={data.brand.name}
              onChange={(e) => handleChange('brand', 'name', e.target.value)}
              placeholder="e.g. Somethinc"
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2 font-medium">Tone Hint</label>
            <input 
              type="text" 
              className="w-full glass-input text-white rounded-xl px-4 py-3 md:py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 placeholder-slate-500 transition-all min-h-[48px]"
              value={data.brand.tone_hint_optional}
              onChange={(e) => handleChange('brand', 'tone_hint_optional', e.target.value)}
              placeholder="e.g. Fun, Energetic, Scientific"
            />
          </div>
        </div>
      </div>

      {/* Product Section */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-lg backdrop-blur-md">
        <h3 className="text-brand-500 font-semibold mb-5 text-lg flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold ring-1 ring-brand-500/40">2</span>
          Product Specs
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-slate-300 mb-2 font-medium">Product Type *</label>
            <input 
              required
              type="text" 
              className="w-full glass-input text-white rounded-xl px-4 py-3 md:py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 placeholder-slate-500 transition-all min-h-[48px]"
              value={data.product.type}
              onChange={(e) => handleChange('product', 'type', e.target.value)}
              placeholder="e.g. Serum"
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2 font-medium">Material/Key Ingredient *</label>
            <input 
              required
              type="text" 
              className="w-full glass-input text-white rounded-xl px-4 py-3 md:py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 placeholder-slate-500 transition-all min-h-[48px]"
              value={data.product.material}
              onChange={(e) => handleChange('product', 'material', e.target.value)}
              placeholder="e.g. Niacinamide"
            />
          </div>
          <div>
             <label className="block text-slate-300 mb-2 font-medium">Objective</label>
             <div className="relative">
               <select 
                 className="w-full glass-input text-white rounded-xl px-4 py-3 md:py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer min-h-[48px]"
                 value={data.product.objective}
                 onChange={(e) => handleChange('product', 'objective', e.target.value)}
               >
                 <option value="awareness" className="bg-dark-card">Awareness</option>
                 <option value="consideration" className="bg-dark-card">Consideration</option>
                 <option value="conversion" className="bg-dark-card">Conversion</option>
               </select>
               <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                 ▼
               </div>
             </div>
          </div>
          <div>
             <label className="block text-slate-300 mb-2 font-medium">Main Angle</label>
             <div className="relative">
               <select 
                 className="w-full glass-input text-white rounded-xl px-4 py-3 md:py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer min-h-[48px]"
                 value={data.product.main_angle_optional}
                 onChange={(e) => handleChange('product', 'main_angle_optional', e.target.value)}
               >
                 <option value="problem-solution" className="bg-dark-card">Problem-Solution</option>
                 <option value="routine" className="bg-dark-card">Routine / GRWM</option>
                 <option value="review" className="bg-dark-card">Honest Review</option>
                 <option value="aesthetic" className="bg-dark-card">Aesthetic / ASMR</option>
                 <option value="comparison" className="bg-dark-card">Comparison</option>
               </select>
               <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                 ▼
               </div>
             </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-slate-300 mb-3 font-medium">Target Platforms *</label>
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'tiktok', label: 'TikTok' },
                { id: 'reels', label: 'Instagram Reels' },
                { id: 'shorts', label: 'YouTube Shorts' },
              ].map((p) => {
                 const isSelected = data.product.platform.includes(p.id as any);
                 return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id as any)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all duration-200 min-h-[48px] ${
                      isSelected 
                        ? 'bg-brand-500/20 border-brand-500 text-brand-100 shadow-[0_0_15px_rgba(249,115,22,0.3)]' 
                        : 'glass-input text-slate-400 border-white/10 hover:border-white/30 hover:bg-white/5'
                    }`}
                  >
                    {isSelected ? <CheckCircle2 className="w-5 h-5 text-brand-500" /> : <Circle className="w-5 h-5" />}
                    {p.label}
                  </button>
                 );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Source Material Section */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-lg backdrop-blur-md">
        <h3 className="text-brand-500 font-semibold mb-5 text-lg flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold ring-1 ring-brand-500/40">3</span>
          Source Material <span className="text-slate-500 font-normal text-xs ml-auto border border-white/10 px-2 py-1 rounded-full">Optional</span>
        </h3>
        <div className="space-y-5">
           <div>
              <label className="block text-slate-300 mb-2 font-medium flex items-center gap-2">
                <Link className="w-4 h-4 text-brand-400" /> Source URL (Reference Only)
              </label>
              <input 
                type="url" 
                className="w-full glass-input text-white rounded-xl px-4 py-3 md:py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 placeholder-slate-500 transition-all min-h-[48px]"
                value={data.scrape.source_url_optional}
                onChange={(e) => handleChange('scrape', 'source_url_optional', e.target.value)}
                placeholder="https://..."
              />
           </div>
           <div>
              <label className="block text-slate-300 mb-2 font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-400" /> Raw Product Info / Scraped Text
              </label>
              <textarea 
                className="w-full glass-input text-white rounded-xl px-4 py-3 md:py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 placeholder-slate-500 transition-all min-h-[120px]"
                value={data.scrape.raw_text_optional}
                onChange={(e) => handleChange('scrape', 'raw_text_optional', e.target.value)}
                placeholder="Paste product description, reviews, or raw text here. The AI will sanitize it automatically."
              />
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5 opacity-80">
                <CheckCircle2 className="w-3 h-3 text-brand-500" />
                Auto-sanitization enabled: Removes UI noise & blocks prompt injection attempts.
              </p>
           </div>
        </div>
      </div>

      {/* Constraints Section */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-lg backdrop-blur-md">
        <h3 className="text-brand-500 font-semibold mb-5 text-lg flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold ring-1 ring-brand-500/40">4</span>
          Rules & Constraints
        </h3>
        
        <div className="mb-6">
          <label className="block text-slate-300 mb-2 font-medium">Must Include</label>
          <div className="flex gap-2 mb-3">
            <input 
              type="text"
              className="flex-1 glass-input text-white rounded-xl px-4 py-3 md:py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 placeholder-slate-500 min-h-[48px]"
              value={mustIncludeInput}
              onChange={(e) => setMustIncludeInput(e.target.value)}
              placeholder="Add key phrase..."
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayAdd('must_include_optional', mustIncludeInput, setMustIncludeInput))}
            />
            <button type="button" onClick={() => handleArrayAdd('must_include_optional', mustIncludeInput, setMustIncludeInput)} className="bg-brand-600/20 border border-brand-500/50 text-brand-400 px-5 rounded-xl hover:bg-brand-500 hover:text-white transition-all text-xl font-light min-h-[48px]">+</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.constraints.must_include_optional.map((item, i) => (
              <span key={i} className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2">
                {item}
                <button type="button" onClick={() => handleArrayRemove('must_include_optional', i)} className="hover:text-white bg-emerald-500/20 rounded-full w-4 h-4 flex items-center justify-center">×</button>
              </span>
            ))}
          </div>
        </div>

        <div className="mb-2">
          <label className="block text-slate-300 mb-2 font-medium">Do Not Say</label>
          <div className="flex gap-2 mb-3">
            <input 
              type="text"
              className="flex-1 glass-input text-white rounded-xl px-4 py-3 md:py-3.5 focus:outline-none focus:ring-2 focus:ring-red-500/50 placeholder-slate-500 min-h-[48px]"
              value={doNotSayInput}
              onChange={(e) => setDoNotSayInput(e.target.value)}
              placeholder="Add banned word..."
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayAdd('do_not_say_optional', doNotSayInput, setDoNotSayInput))}
            />
            <button type="button" onClick={() => handleArrayAdd('do_not_say_optional', doNotSayInput, setDoNotSayInput)} className="bg-red-600/20 border border-red-500/50 text-red-400 px-5 rounded-xl hover:bg-red-500 hover:text-white transition-all text-xl font-light min-h-[48px]">+</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.constraints.do_not_say_optional.map((item, i) => (
              <span key={i} className="bg-red-500/10 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2">
                {item}
                <button type="button" onClick={() => handleArrayRemove('do_not_say_optional', i)} className="hover:text-white bg-red-500/20 rounded-full w-4 h-4 flex items-center justify-center">×</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-brand-600 via-orange-500 to-yellow-500 hover:from-brand-500 hover:to-yellow-400 text-white font-bold py-5 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] border border-white/20 min-h-[56px]"
      >
        {isLoading ? (
          <>
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
            Sanitizing & Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 fill-white/20" />
            <span className="text-lg">Generate UGC Plan</span>
          </>
        )}
      </button>

      <div className="flex items-start gap-3 text-xs text-slate-400 bg-white/5 border border-white/5 p-4 rounded-xl backdrop-blur-sm">
        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-brand-500" />
        <p>AI will strictly follow compliance rules. No medical claims or guarantees will be generated.</p>
      </div>
    </form>
  );
};