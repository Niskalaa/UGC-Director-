import React, { useState, useEffect } from 'react';
import { InputForm } from './components/InputForm';
import { OutputDisplay } from './components/OutputDisplay';
import { AuthScreen } from './components/AuthScreen';
import { FormData, GeneratedAsset } from './types';
import { generateUGCConfig } from './services/geminiService';
import { saveGeneration, fetchHistory, SavedGeneration, supabase } from './services/supabaseService';
import { Zap, Github, Terminal, Sparkles, Loader2, Clock, Cloud, History, FolderOpen, ChevronRight, LayoutDashboard, LogOut, User } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [result, setResult] = useState<GeneratedAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedGeneration[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Loading state tracking
  const [loadingStep, setLoadingStep] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Auth Session Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load history when session changes
  useEffect(() => {
    if (session) {
      const loadHistory = async () => {
        const data = await fetchHistory();
        setHistory(data);
      };
      loadHistory();
    } else {
      setHistory([]);
      setResult(null);
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingStep(1);
    setElapsedTime(0);

    const timeInterval = setInterval(() => {
      setElapsedTime(prev => +(prev + 0.1).toFixed(1));
    }, 100);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < 8) return prev + 1;
        return prev;
      });
    }, 2500);

    try {
      const data = await generateUGCConfig(formData);
      setResult(data);
      
      setIsSyncing(true);
      try {
        const saved = await saveGeneration(formData, data);
        setHistory(prev => [saved, ...prev.slice(0, 9)]);
      } catch (syncErr) {
        console.warn('Sync to cloud failed, but local result is ready', syncErr);
      } finally {
        setIsSyncing(false);
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      clearInterval(timeInterval);
      clearInterval(stepInterval);
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const loadFromHistory = (item: SavedGeneration) => {
    setResult(item.output_plan);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!session) {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-black text-slate-200 font-sans selection:bg-brand-500/30 selection:text-brand-200 pb-10">
      
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[100px] mix-blend-screen opacity-40"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-800/10 rounded-full blur-[100px] mix-blend-screen opacity-30"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:32px_32px] opacity-20"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-12">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8 md:mb-12 glass-panel p-4 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="bg-gradient-to-br from-brand-500 to-yellow-500 p-2 md:p-2.5 rounded-xl shadow-lg shadow-brand-500/20">
              <Zap className="w-5 h-5 md:w-6 md:h-6 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-tight">
                UGC<span className="text-brand-500">Genius</span>
              </h1>
              <p className="text-[10px] md:text-xs text-slate-500 font-medium tracking-wide uppercase flex items-center gap-1.5">
                AI Creative Director
                {isSyncing && <Cloud className="w-3 h-3 text-brand-400 animate-pulse" />}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] text-slate-300">
               <User className="w-3 h-3 text-brand-500" />
               <span className="max-w-[120px] truncate">{session.user.email}</span>
             </div>
             
             <div className="flex items-center gap-2">
               <button 
                 onClick={handleLogout}
                 className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all group"
                 title="Logout"
               >
                 <LogOut className="w-4 h-4" />
               </button>
               <a href="https://github.com/google/genai" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition-colors p-2.5 bg-white/5 rounded-xl border border-white/10">
                 <Github className="w-4 h-4" />
               </a>
             </div>
          </div>
        </header>

        {/* Main Content Grid */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-1 backdrop-blur-xl shadow-2xl">
               <div className="bg-black/40 rounded-[22px] p-4 md:p-6 border border-white/5">
                 <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                    <div className="bg-brand-500/10 p-2 rounded-lg">
                      <Terminal className="w-4 h-4 text-brand-500" />
                    </div>
                    <h2 className="text-base md:text-lg font-semibold text-white">Project Brief</h2>
                 </div>
                 <InputForm onSubmit={handleSubmit} isLoading={loading} />
               </div>
            </div>
            
            <div className="hidden lg:block glass-panel rounded-3xl p-6 border border-white/5">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <History className="w-4 h-4 text-brand-500" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">Cloud Storage</h3>
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono">{history.length}/10</span>
               </div>
               
               <div className="space-y-2">
                  {history.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-xs italic">
                      No cloud history found yet.
                    </div>
                  ) : (
                    history.map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => loadFromHistory(item)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand-500/30 transition-all group text-left"
                      >
                         <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-200 truncate group-hover:text-brand-400">{item.brand_name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{item.product_type} • {new Date(item.created_at).toLocaleDateString()}</p>
                         </div>
                         <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-brand-500 group-hover:translate-x-1 transition-all shrink-0" />
                      </button>
                    ))
                  )}
               </div>
            </div>

            {loading && (
              <div className="bg-brand-950/20 border border-brand-500/30 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-500/5 to-transparent animate-pulse"></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2 text-brand-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="font-bold text-sm">Generating...</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-brand-300/70 bg-brand-900/30 px-2 py-1 rounded">
                      <Clock className="w-3 h-3" />
                      {elapsedTime}s
                    </div>
                  </div>
                  
                  <div className="w-full bg-brand-900/50 rounded-full h-1.5 mb-3 overflow-hidden">
                     <div 
                       className="bg-gradient-to-r from-brand-600 to-brand-400 h-1.5 rounded-full transition-all duration-500 ease-out" 
                       style={{ width: `${Math.min((loadingStep / 9) * 100, 95)}%` }}
                     ></div>
                  </div>
                  
                  <div className="flex justify-between text-[10px] text-brand-300/50 font-mono uppercase tracking-wider">
                    <span>Processing</span>
                    <span>Step {loadingStep}/9</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="glass-panel border-red-500/30 bg-red-950/20 rounded-2xl p-5 flex items-start gap-3">
                 <div className="p-2 bg-red-500/10 rounded-full text-red-500 shrink-0">
                    <Terminal className="w-5 h-5" />
                 </div>
                 <div>
                    <h3 className="text-red-400 font-bold text-sm mb-1">Generation Failed</h3>
                    <p className="text-xs text-red-200/60 leading-relaxed">{error}</p>
                 </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-8 space-y-6">
             {history.length > 0 && (
                <div className="lg:hidden flex gap-3 overflow-x-auto pb-4 scrollbar-none snap-x">
                   {history.map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => loadFromHistory(item)}
                        className="snap-start flex-none w-48 p-3 rounded-2xl glass-panel border-white/10 active:scale-95 transition-transform"
                      >
                         <div className="flex items-center gap-2 mb-2">
                           <FolderOpen className="w-3 h-3 text-brand-400" />
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Recent Sync</span>
                         </div>
                         <p className="text-xs font-bold text-white truncate">{item.brand_name}</p>
                         <p className="text-[10px] text-slate-500 truncate">{item.product_type}</p>
                      </button>
                   ))}
                </div>
             )}

             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-500/10 p-2 rounded-lg">
                    <Sparkles className="w-4 h-4 text-brand-500" />
                  </div>
                  <h2 className="text-base md:text-lg font-semibold text-white">Generated Strategy</h2>
                </div>
                {result && (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                    <LayoutDashboard className="w-3 h-3" /> PRODUCTION READY
                  </div>
                )}
             </div>
             
             <OutputDisplay data={result} />
          </div>

        </main>
      </div>
    </div>
  );
};

export default App;