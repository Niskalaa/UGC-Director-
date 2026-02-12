
import React, { useState } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../services/supabaseService';
import { Zap, Mail, Lock, Loader2, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // The redirect happens automatically, onAuthSuccess might not trigger immediately 
      // but the App component will catch the session change.
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google");
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        await signInWithEmail(email, password);
        onAuthSuccess(); // Manual trigger if session updates aren't instant
      } else {
        await signUpWithEmail(email, password);
        setMessage("Account created! Please check your email to verify.");
        setIsLogin(true); // Switch back to login
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#f8fafc]">
       {/* Background Effects */}
       <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none"></div>
       <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>

       <div className="w-full max-w-md relative z-10 animate-in zoom-in-95 duration-500">
         
         {/* Header */}
         <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/30 mb-4">
                <Zap className="w-8 h-8 text-white fill-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                UGC<span className="text-brand-500">Director</span>
            </h1>
            <p className="text-slate-500 mt-2 text-sm">Sign in to access AI Director tools</p>
         </div>

         {/* Auth Card */}
         <div className="glass-panel p-8 rounded-3xl border border-white/50 shadow-2xl backdrop-blur-xl bg-white/70">
            
            {/* Google Button */}
            <button 
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white text-slate-700 border border-slate-200 font-bold py-3.5 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 mb-6 relative group overflow-hidden shadow-sm"
            >
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                ) : (
                    <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" style={{color: '#4285F4'}} />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" style={{color: '#34A853'}} />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" style={{color: '#FBBC05'}} />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" style={{color: '#EA4335'}} />
                    </svg>
                    <span>Continue with Google</span>
                    </>
                )}
            </button>

            <div className="relative flex py-2 items-center mb-6">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-xs text-slate-400 uppercase tracking-widest font-semibold">Or with Email</span>
                <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 ml-1">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="creator@example.com"
                            className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-all placeholder-slate-400 shadow-sm"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 ml-1">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-all placeholder-slate-400 shadow-sm"
                        />
                    </div>
                </div>

                {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 p-3 rounded-lg text-xs text-red-600">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        {error}
                    </div>
                )}
                
                {message && (
                    <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs text-emerald-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        {message}
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 mt-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : (isLogin ? "Sign In" : "Create Account")}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
            </form>

            <div className="mt-6 text-center">
                <button 
                    type="button"
                    onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
                    className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
                >
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span className="text-brand-600 font-bold hover:underline">{isLogin ? "Sign up" : "Log in"}</span>
                </button>
            </div>
         </div>
         
         <div className="mt-6 text-center">
            <p className="text-[10px] text-slate-500">
                By continuing, you agree to our Terms of Service. <br/>
                Gemini API Key integrated automatically for authenticated users.
            </p>
         </div>
       </div>
    </div>
  );
};
