
import React, { useState, useEffect } from 'react';
import { InputForm } from './components/InputForm';
import { OutputDisplay } from './components/OutputDisplay';
import { FormData, GeneratedAsset } from './types';
import { sanitizeInput, generateStrategy, generateScenes } from './services/geminiService';
import { saveGeneration, fetchHistory, SavedGeneration } from './services/supabaseService';
import { Zap, Rocket, Check, Terminal, Info, Database, History as HistoryIcon, X, ChevronRight, Clock, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [result, setResult] = useState<GeneratedAsset | null>(null);
  const [formDataState, setFormDataState] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'idle' | 'analyzing' | 'drafting' | 'finalizing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [savedToDb, setSavedToDb] = useState(false);
  
  // History State
  const [history, setHistory] = useState<SavedGeneration[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setLoadingStage('analyzing');
    setError(null);
    setResult(null);
    setSavedToDb(false);
    setFormDataState(formData); // Persist for re-runs

    try {
      // Step 1: Sanitize (Parallel with simple UI update)
      let contextText = formData.scrape.raw_text_optional || "";
      let sanReport = undefined;
      
      if (contextText) {
          const sanitized = await sanitizeInput(contextText);
          if (sanitized) {
              contextText = sanitized.clean_text;
              sanReport = sanitized;
          }
      }

      // Step 2: Generate Strategy (First Draft)
      setLoadingStage('drafting');
      const strategyData = await generateStrategy(formData, contextText);
      
      // Update UI with Draft immediately
      const draftResult: GeneratedAsset = {
          ...strategyData as any, // Cast for partial match
          sanitization_report: sanReport,
      };
      setResult(draftResult);

      // Step 3: Generate Scenes (Finalize)
      setLoadingStage('finalizing');
      const scenesData = await generateScenes(formData, draftResult);
      
      const finalResult: GeneratedAsset = {
          ...draftResult,
          ...scenesData as any,
      };
      setResult(finalResult);

      // Auto scroll to results on mobile
      if (window.innerWidth < 1024) {
        setTimeout(() => {
          document.getElementById('output-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      }

      // Save to Supabase Backend
      saveGeneration(formData, finalResult).then((saved) => {
        if (saved) {
          console.log("Successfully saved to Supabase", saved.id);
          setSavedToDb(true);
        }
      }).catch(err => {
        console.warn("Background save failed", err);
      });

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setLoadingStage('idle');
    }
  };

  const handleToggleHistory = async () => {
    if (!showHistory) {
        setLoadingHistory(true);
        const data = await fetchHistory();
        setHistory(data || []);
        setLoadingHistory(false);
    }
    setShowHistory(!showHistory);
  };

  const loadHistoryItem = (item: SavedGeneration) => {
    setResult(item.output_plan);
    setFormDataState(item.input_brief);
    setShowHistory(false);
    // Optional: scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen pb-20 animate-in overflow-x-hidden relative">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8 md:mb-12 relative z-20">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-brand-500 to-brand-600 p-2.5 rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.3)]">
              <Zap className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight leading-none">
                UGC<span className="text-brand-500">Director</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-white/10 text-slate-400 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Beta v2.2</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
                onClick={handleToggleHistory}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${showHistory ? 'bg-brand-600 border-brand-500 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
            >
                <HistoryIcon className="w-4 h-4" />
                <span className="hidden md:inline font-bold text-xs uppercase tracking-wider">History</span>
            </button>
            <div className="hidden md:block text-right">
                <p className="text-xs text-slate-500 font-mono">AI-POWERED CREATIVE SUITE</p>
                <div className="flex items-center justify-end gap-2 text-xs text-brand-500 font-mono">
                <span>READY FOR INPUT</span>
                {savedToDb && (
                    <span className="flex items-center gap-1 text-emerald-500 animate-in fade-in">
                    <Database className="w-3 h-3"/> SAVED
                    </span>
                )}
                </div>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Input Section */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-600 to-purple-600 rounded-[2rem] opacity-30 group-hover:opacity-50 blur transition duration-500"></div>
              <div className="relative bg-[#0a0a0a] rounded-[1.75rem] p-1 border border-white/10">
                 <div className="bg-[#0f0f0f] rounded-[1.5rem] p-4 md:p-5 overflow-hidden">
                    <InputForm onSubmit={handleSubmit} isLoading={loading} initialValues={formDataState} />
                 </div>
              </div>
            </div>

            {/* Granular Loading Status Panel */}
            {loading && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center lg:relative lg:inset-auto lg:bg-transparent lg:backdrop-blur-none lg:z-auto">
                 <div className="w-full max-w-sm lg:max-w-none glass-panel p-6 rounded-2xl border border-brand-500/30 shadow-2xl relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 text-brand-400">
                       <RefreshCw className="w-5 h-5 animate-spin" />
                       <span className="font-bold text-sm tracking-widest uppercase">Generating Assets</span>
                    </div>
                    <div className="space-y-4">
                        <div className={`flex items-center gap-3 text-xs transition-all ${loadingStage !== 'analyzing' ? 'text-emerald-500 opacity-50' : 'text-white font-bold'}`}>
                             <div className={`w-2 h-2 rounded-full ${loadingStage === 'analyzing' ? 'bg-white animate-pulse' : 'bg-current'}`}></div>
                             Analyzing Brand DNA & Safety
                             {loadingStage !== 'analyzing' && <Check className="w-3 h-3 ml-auto" />}
                        </div>
                        <div className={`flex items-center gap-3 text-xs transition-all ${loadingStage === 'drafting' ? 'text-white font-bold' : (result ? 'text-emerald-500 opacity-50' : 'text-slate-700')}`}>
                             <div className={`w-2 h-2 rounded-full ${loadingStage === 'drafting' ? 'bg-white animate-pulse' : 'bg-current'}`}></div>
                             Drafting Strategy & Hooks
                             {result && loadingStage !== 'drafting' && <Check className="w-3 h-3 ml-auto" />}
                        </div>
                        <div className={`flex items-center gap-3 text-xs transition-all ${loadingStage === 'finalizing' ? 'text-white font-bold' : 'text-slate-700'}`}>
                             <div className={`w-2 h-2 rounded-full ${loadingStage === 'finalizing' ? 'bg-white animate-pulse' : 'bg-current'}`}></div>
                             Finalizing Scenes & Scripts
                        </div>
                    </div>
                 </div>
              </div>
            )}

            {error && (
               <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                  <Info className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                     <h3 className="text-red-400 font-bold text-sm">Generation Failed</h3>
                     <p className="text-xs text-red-200/70 mt-1">{error}</p>
                  </div>
               </div>
            )}
          </div>

          {/* Output Section */}
          <div className="lg:col-span-8 xl:col-span-9 min-h-[500px]" id="output-section">
             <OutputDisplay data={result} />
          </div>

        </main>
      </div>

      {/* History Sidebar */}
      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-[400px] bg-[#0c0c0c] border-l border-white/10 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${showHistory ? 'translate-x-0' : 'translate-x-full'}`}
      >
         <div className="flex flex-col h-full">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#0a0a0a]">
               <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <HistoryIcon className="w-5 h-5 text-brand-500" />
                  Saved Prompts
               </h2>
               <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
               {loadingHistory ? (
                   <div className="flex items-center justify-center h-40 text-slate-500 gap-2">
                      <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
                      <span className="text-xs">Loading history...</span>
                   </div>
               ) : history.length === 0 ? (
                   <div className="text-center p-8 text-slate-600">
                      <HistoryIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No saved generations found.</p>
                   </div>
               ) : (
                   history.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => loadHistoryItem(item)}
                        className="group bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand-500/30 p-4 rounded-xl cursor-pointer transition-all"
                      >
                         <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-brand-400 bg-brand-900/20 px-2 py-0.5 rounded">{item.brand_name}</span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                               <Clock className="w-3 h-3" />
                               {new Date(item.created_at).toLocaleDateString()}
                            </span>
                         </div>
                         <h3 className="text-sm font-bold text-slate-200 mb-1 line-clamp-2">{item.output_plan.concept_title}</h3>
                         <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                             <span>{item.product_type}</span>
                             <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-brand-400 transition-opacity">
                                Open <ChevronRight className="w-3 h-3" />
                             </div>
                         </div>
                      </div>
                   ))
               )}
            </div>
         </div>
      </div>
      
      {/* Backdrop for history */}
      {showHistory && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setShowHistory(false)}></div>
      )}

    </div>
  );
};

export default App;
