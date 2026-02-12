
import React, { useState, useEffect } from 'react';
import { InputForm } from './components/InputForm';
import { OutputDisplay } from './components/OutputDisplay';
import { AuthScreen } from './components/AuthScreen';
import { FormData, GeneratedAsset } from './types';
import { sanitizeInput, generateStrategy as generateStrategyGemini, generateScenes as generateScenesGemini } from './services/geminiService';
import { generateStrategyOpenRouter, generateScenesOpenRouter, getStoredOpenRouterKey, getStoredOpenRouterModel } from './services/externalService';
import { saveGeneration, updateGeneration, fetchHistory, deleteGeneration, SavedGeneration, supabase, signOut } from './services/supabaseService';
import { Zap, Check, Info, History as HistoryIcon, X, ChevronRight, Clock, RefreshCw, Settings2, LogOut, User, Network, Trash2, CheckCircle2, Cpu } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { Session } from '@supabase/supabase-js';
import { SpeedInsights } from '@vercel/speed-insights/react';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [result, setResult] = useState<GeneratedAsset | null>(null);
  const [formDataState, setFormDataState] = useState<FormData | null>(null);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'idle' | 'analyzing' | 'drafting' | 'finalizing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [savedToDb, setSavedToDb] = useState(false);
  
  // History State
  const [history, setHistory] = useState<SavedGeneration[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Notification State
  const [notification, setNotification] = useState<string | null>(null);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>('gemini'); // Default to gemini

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
    });

    // Check configuration preferences
    const storedProvider = localStorage.getItem('PREFERRED_PROVIDER');
    const openRouterKey = getStoredOpenRouterKey();
    
    // Logic: Use stored provider, but fallback to gemini if openrouter is selected but no key exists
    if (storedProvider === 'openrouter' && openRouterKey) {
        setActiveProvider('openrouter');
    } else {
        setActiveProvider('gemini');
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, [showSettings]); // Re-check when settings close

  const showNotificationMsg = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogout = async () => {
    await signOut();
    setSession(null);
    setResult(null);
    setHistory([]);
    setCurrentGenerationId(null);
  };

  const handleUpdateGeneration = async (updatedAsset: GeneratedAsset) => {
      setResult(updatedAsset);
      if (currentGenerationId) {
          await updateGeneration(currentGenerationId, updatedAsset);
      }
  };

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setLoadingStage('analyzing');
    setError(null);
    setResult(null);
    setSavedToDb(false);
    setFormDataState(formData);
    setCurrentGenerationId(null);

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
           setCurrentGenerationId(saved.id);
           setSavedToDb(true);
        }
      });

      // --- PROCESSING ---
      const rawText = formData.scrape.raw_text_optional || "";
      
      // Sanitization always uses Gemini (Fast/Cheap)
      const sanitizePromise = rawText ? sanitizeInput(rawText) : Promise.resolve(null);
      
      // Step 1: Generate Strategy
      // Choose Engine based on Active Provider
      const strategyPromise = activeProvider === 'openrouter'
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
      
      const scenesPromise = activeProvider === 'openrouter'
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
        const saved = await saveGeneration(formData, finalResult);
        if (saved) setCurrentGenerationId(saved.id);
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
    setCurrentGenerationId(item.id);
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotificationMsg("Brief & Strategy Loaded Successfully");
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent loading the item when clicking delete
    if (window.confirm("Are you sure you want to delete this saved generation?")) {
        try {
            await deleteGeneration(id);
            // Optimistic update
            setHistory(prev => prev.filter(item => item.id !== id));
            showNotificationMsg("Item deleted");
        } catch (err) {
            console.error("Delete Error:", err);
            alert("Failed to delete item. You may not have permission.");
        }
    }
  };

  if (authChecking) {
     return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
     );
  }

  if (!session) {
      return <AuthScreen onAuthSuccess={() => { /* Handled by onAuthStateChange */ }} />;
  }

  return (
    <div className="min-h-screen pb-20 animate-in overflow-x-hidden relative text-slate-900 bg-[#f8fafc]">
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 w-[90%] max-w-sm">
             <div className="bg-white/90 backdrop-blur-md border border-emerald-500/20 text-emerald-600 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 justify-center">
                 <CheckCircle2 className="w-5 h-5 shrink-0" />
                 <span className="text-sm font-bold truncate">{notification}</span>
             </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-6 md:mb-10 relative z-20">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="bg-gradient-to-br from-brand-500 to-brand-600 p-2 md:p-2.5 rounded-xl shadow-lg shadow-brand-500/30">
              <Zap className="w-5 h-5 md:w-6 md:h-6 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">
                UGC<span className="text-brand-500">Director</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] md:text-[10px] bg-slate-100 text-slate-500 px-1.5 md:px-2 py-0.5 rounded uppercase tracking-wider font-bold border border-slate-200">Beta v2.4</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                
                {activeProvider === 'openrouter' ? (
                     <span className="hidden sm:flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase tracking-wider font-bold border border-indigo-200">
                        <Network className="w-3 h-3" /> OpenRouter
                     </span>
                ) : (
                    <span className="hidden sm:flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded uppercase tracking-wider font-bold border border-emerald-200">
                        <Zap className="w-3 h-3" /> Gemini Pro
                    </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
             <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mr-2">
                <User className="w-3 h-3 text-slate-400" />
                <span className="text-xs text-slate-600 truncate max-w-[150px]">{session.user.email}</span>
             </div>

            <button 
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 p-2.5 md:p-2 rounded-xl md:rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all hover:text-brand-600 shadow-sm active:scale-95"
                title="API Settings"
            >
                <Settings2 className="w-5 h-5" />
                <span className="hidden md:inline font-bold text-xs uppercase tracking-wider">Settings</span>
            </button>
            <button 
                onClick={handleToggleHistory}
                className={`flex items-center gap-2 p-2.5 md:px-4 md:py-2 rounded-xl md:rounded-lg border transition-all shadow-sm active:scale-95 ${showHistory ? 'bg-brand-600 border-brand-500 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-600'}`}
                title="History"
            >
                <HistoryIcon className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden md:inline font-bold text-xs uppercase tracking-wider">History</span>
            </button>
            <button 
                onClick={handleLogout}
                className="p-2.5 md:p-2 rounded-xl md:rounded-lg bg-white border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm active:scale-95"
                title="Sign Out"
            >
                <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          
          {/* Input Section */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-200 to-purple-200 rounded-[2rem] opacity-50 blur-lg transition duration-500"></div>
              <div className="relative bg-white/50 rounded-[1.75rem] p-1 border border-white/50">
                 <div className="bg-white/40 rounded-[1.5rem] p-3 md:p-5 overflow-hidden">
                    <InputForm 
                      onSubmit={handleSubmit} 
                      isLoading={loading} 
                      initialValues={formDataState}
                      activeProvider={activeProvider}
                      openRouterModel={getStoredOpenRouterModel()}
                    />
                 </div>
              </div>
            </div>

            {/* Granular Loading Status Panel */}
            {loading && (
              <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[60] flex items-center justify-center lg:relative lg:inset-auto lg:bg-transparent lg:backdrop-blur-none lg:z-auto p-4">
                 <div className="w-full max-w-sm lg:max-w-none glass-panel p-6 rounded-3xl border border-brand-500/30 shadow-2xl relative overflow-hidden bg-white">
                    <div className="flex items-center gap-3 mb-6 text-brand-600">
                       <RefreshCw className="w-6 h-6 animate-spin" />
                       <span className="font-bold text-base tracking-widest uppercase">
                          {activeProvider === 'openrouter' ? 'Connecting OpenRouter' : 'Generating Assets'}
                       </span>
                    </div>
                    <div className="space-y-5">
                        <div className={`flex items-center gap-3 text-sm transition-all ${loadingStage !== 'analyzing' ? 'text-emerald-500 opacity-50' : 'text-slate-900 font-bold scale-105 origin-left'}`}>
                             <div className={`w-2.5 h-2.5 rounded-full ${loadingStage === 'analyzing' ? 'bg-brand-500 animate-pulse' : 'bg-current'}`}></div>
                             Analyzing Brand DNA
                             {loadingStage !== 'analyzing' && <Check className="w-4 h-4 ml-auto" />}
                        </div>
                        <div className={`flex items-center gap-3 text-sm transition-all ${loadingStage === 'drafting' ? 'text-slate-900 font-bold scale-105 origin-left' : (result ? 'text-emerald-500 opacity-50' : 'text-slate-400')}`}>
                             <div className={`w-2.5 h-2.5 rounded-full ${loadingStage === 'drafting' ? 'bg-brand-500 animate-pulse' : 'bg-current'}`}></div>
                             Drafting Strategy
                             {result && loadingStage !== 'drafting' && <Check className="w-4 h-4 ml-auto" />}
                        </div>
                        <div className={`flex items-center gap-3 text-sm transition-all ${loadingStage === 'finalizing' ? 'text-slate-900 font-bold scale-105 origin-left' : 'text-slate-400'}`}>
                             <div className={`w-2.5 h-2.5 rounded-full ${loadingStage === 'finalizing' ? 'bg-brand-500 animate-pulse' : 'bg-current'}`}></div>
                             Finalizing Scenes
                        </div>
                    </div>
                    
                    {/* Model Indicator Footer */}
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Intelligence Engine</span>
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono border ${activeProvider === 'openrouter' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-brand-50 text-brand-600 border-brand-200'}`}>
                                {activeProvider === 'openrouter' ? <Network className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                                {activeProvider === 'openrouter' 
                                    ? getStoredOpenRouterModel().split('/').pop() 
                                    : (formDataState?.constraints.ai_model || 'gemini-3-pro-preview')}
                            </div>
                        </div>
                    </div>
                 </div>
              </div>
            )}

            {error && (
               <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 shadow-sm">
                  <Info className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                     <h3 className="text-red-700 font-bold text-sm">Generation Failed</h3>
                     <p className="text-xs text-red-600 mt-1">{error}</p>
                  </div>
               </div>
            )}
          </div>

          {/* Output Section */}
          <div className="lg:col-span-8 xl:col-span-9 min-h-[500px]" id="output-section">
             <OutputDisplay 
                data={result} 
                modelUsed={formDataState?.constraints.ai_model}
                imageModelUsed={formDataState?.constraints.image_generator_model}
                onUpdate={handleUpdateGeneration}
             />
          </div>

        </main>
      </div>

      {/* History Sidebar */}
      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-[400px] bg-white border-l border-slate-200 shadow-2xl transform transition-transform duration-300 ease-in-out z-[80] ${showHistory ? 'translate-x-0' : 'translate-x-full'}`}
      >
         <div className="flex flex-col h-full safe-area-bottom">
            <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur safe-area-top">
               <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <HistoryIcon className="w-5 h-5 text-brand-500" />
                  Saved Prompts
               </h2>
               <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
               {loadingHistory ? (
                   <div className="flex items-center justify-center h-40 text-slate-500 gap-2">
                      <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
                      <span className="text-xs">Loading history...</span>
                   </div>
               ) : history.length === 0 ? (
                   <div className="text-center p-8 text-slate-400">
                      <HistoryIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No saved generations found.</p>
                   </div>
               ) : (
                   history.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => loadHistoryItem(item)}
                        className="group bg-white hover:bg-white border border-slate-200 hover:border-brand-500/50 p-4 rounded-xl cursor-pointer transition-all relative shadow-sm hover:shadow-md active:scale-[0.99]"
                      >
                         <div className="flex justify-between items-start mb-2 pr-6">
                            <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">{item.brand_name}</span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                               <Clock className="w-3 h-3" />
                               {new Date(item.created_at).toLocaleDateString()}
                            </span>
                         </div>
                         <h3 className="text-sm font-bold text-slate-800 mb-1 line-clamp-2">{item.output_plan.concept_title}</h3>
                         <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                             <span>{item.product_type}</span>
                             <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-brand-500 transition-opacity">
                                Open <ChevronRight className="w-3 h-3" />
                             </div>
                         </div>
                         
                         {/* Delete Button */}
                         <button 
                            onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                            className="absolute top-2 right-2 p-2 md:p-1.5 z-10 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100"
                            title="Delete"
                         >
                            <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                   ))
               )}
            </div>
         </div>
      </div>
      
      {/* Backdrop for history */}
      {showHistory && (
         <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[70] md:hidden" onClick={() => setShowHistory(false)}></div>
      )}

      <SpeedInsights />
    </div>
  );
};

export default App;
