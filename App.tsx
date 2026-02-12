
import React, { useState, useEffect } from 'react';
import { InputForm } from './components/InputForm';
import { OutputDisplay } from './components/OutputDisplay';
import { AuthScreen } from './components/AuthScreen';
import { FormData, GeneratedAsset } from './types';
import { sanitizeInput, generateStrategy as generateStrategyGemini, generateScenes as generateScenesGemini } from './services/geminiService';
import { generateStrategyOpenRouter, generateScenesOpenRouter, getStoredOpenRouterKey, getStoredOpenRouterModel } from './services/externalService';
import { saveGeneration, updateGeneration, fetchHistory, SavedGeneration, supabase, signOut } from './services/supabaseService';
import { Zap, Check, Info, History as HistoryIcon, X, ChevronRight, Clock, RefreshCw, Settings2, LogOut, User, Network } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

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

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [useOpenRouter, setUseOpenRouter] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
    });

    // Check configuration
    setUseOpenRouter(!!getStoredOpenRouterKey());

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, [showSettings]); // Re-check when settings close

  const handleLogout = async () => {
    await signOut();
    setSession(null);
    setResult(null);
    setHistory([]);
  };

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setLoadingStage('analyzing');
    setError(null);
    setResult(null);
    setSavedToDb(false);
    setFormDataState(formData);

    let draftId: string | null = null;

    try {
      // --- IMMEDIATE SAVE: Create a draft record so history is updated instantly ---
      const placeholderResult: GeneratedAsset = {
        concept_title: "Generating Strategy...",
        hook_rationale: "AI Director is analyzing your brief.",
        brand_dna: { voice_traits: [], cta_style: "Loading...", audience_guess: "Loading..." },
        product_truth_sheet: { core_facts: [], safe_benefit_phrases: [], forbidden_claims: [], required_disclaimer: "" },
        scenes: [] 
      };

      // Fire and forget
      saveGeneration(formData, placeholderResult).then(saved => {
        if (saved) {
           draftId = saved.id;
           setSavedToDb(true);
        }
      });

      // --- PROCESSING ---
      const rawText = formData.scrape.raw_text_optional || "";
      
      // Sanitization always uses Gemini (Fast/Cheap)
      const sanitizePromise = rawText ? sanitizeInput(rawText) : Promise.resolve(null);
      
      // Step 1: Generate Strategy
      // Choose Engine
      const strategyPromise = useOpenRouter 
          ? generateStrategyOpenRouter(formData, rawText) 
          : generateStrategyGemini(formData, rawText);

      // Wait for Strategy (Critical Path)
      const strategyData = await strategyPromise;
      setLoadingStage('drafting');

      // Update UI with Strategy immediately
      let draftResult: GeneratedAsset = {
          ...strategyData as any,
      };
      setResult(draftResult);

      // Step 2: Generate Scenes (Finalize)
      setLoadingStage('finalizing');
      
      const scenesPromise = useOpenRouter
          ? generateScenesOpenRouter(formData, draftResult)
          : generateScenesGemini(formData, draftResult);
          
      const scenesData = await scenesPromise;
      
      // Get sanitization result (non-blocking)
      const sanReport = await sanitizePromise;

      const finalResult: GeneratedAsset = {
          ...draftResult,
          ...scenesData as any,
          sanitization_report: sanReport || undefined
      };
      
      setResult(finalResult);

      // --- UPDATE DB: Replace draft with final result ---
      if (draftId) {
        updateGeneration(draftId, finalResult).then(() => {
          console.log("Draft updated with final result");
        });
      } else {
        saveGeneration(formData, finalResult);
      }

      if (window.innerWidth < 1024) {
        setTimeout(() => {
          document.getElementById('output-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      }

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (authChecking) {
     return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
     );
  }

  if (!session) {
      return <AuthScreen onAuthSuccess={() => { /* Handled by onAuthStateChange */ }} />;
  }

  return (
    <div className="min-h-screen pb-20 animate-in overflow-x-hidden relative">
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

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
                <span className="text-[10px] bg-white/10 text-slate-400 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Beta v2.4</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {useOpenRouter && (
                     <span className="flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded uppercase tracking-wider font-bold border border-indigo-500/20">
                        <Network className="w-3 h-3" /> OpenRouter
                     </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mr-2">
                <User className="w-3 h-3 text-slate-400" />
                <span className="text-xs text-slate-300 truncate max-w-[150px]">{session.user.email}</span>
             </div>

            <button 
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all hover:text-white"
                title="API Settings"
            >
                <Settings2 className="w-5 h-5" />
                <span className="hidden md:inline font-bold text-xs uppercase tracking-wider">Settings</span>
            </button>
            <button 
                onClick={handleToggleHistory}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${showHistory ? 'bg-brand-600 border-brand-500 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
            >
                <HistoryIcon className="w-4 h-4" />
                <span className="hidden md:inline font-bold text-xs uppercase tracking-wider">History</span>
            </button>
            <button 
                onClick={handleLogout}
                className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                title="Sign Out"
            >
                <LogOut className="w-5 h-5" />
            </button>
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
                       <span className="font-bold text-sm tracking-widest uppercase">
                          {useOpenRouter ? 'Connecting OpenRouter' : 'Generating Assets'}
                       </span>
                    </div>
                    <div className="space-y-4">
                        <div className={`flex items-center gap-3 text-xs transition-all ${loadingStage !== 'analyzing' ? 'text-emerald-500 opacity-50' : 'text-white font-bold'}`}>
                             <div className={`w-2 h-2 rounded-full ${loadingStage === 'analyzing' ? 'bg-white animate-pulse' : 'bg-current'}`}></div>
                             Analyzing Brand DNA & Safety
                             {loadingStage !== 'analyzing' && <Check className="w-3 h-3 ml-auto" />}
                        </div>
                        <div className={`flex items-center gap-3 text-xs transition-all ${loadingStage === 'drafting' ? 'text-white font-bold' : (result ? 'text-emerald-500 opacity-50' : 'text-slate-700')}`}>
                             <div className={`w-2 h-2 rounded-full ${loadingStage === 'drafting' ? 'bg-white animate-pulse' : 'bg-current'}`}></div>
                             Drafting Strategy
                             {result && loadingStage !== 'drafting' && <Check className="w-3 h-3 ml-auto" />}
                        </div>
                        <div className={`flex items-center gap-3 text-xs transition-all ${loadingStage === 'finalizing' ? 'text-white font-bold' : 'text-slate-700'}`}>
                             <div className={`w-2 h-2 rounded-full ${loadingStage === 'finalizing' ? 'bg-white animate-pulse' : 'bg-current'}`}></div>
                             Finalizing Scenes & Scripts
                        </div>
                    </div>
                    {useOpenRouter && (
                         <div className="mt-4 pt-3 border-t border-white/10">
                             <p className="text-[10px] text-indigo-400 flex items-center gap-1">
                                 <Network className="w-3 h-3" /> Using {getStoredOpenRouterModel().split('/')[1]}
                             </p>
                         </div>
                    )}
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
