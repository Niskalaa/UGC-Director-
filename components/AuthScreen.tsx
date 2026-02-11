import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';
import { Zap, Mail, Lock, User, Loader2, LogIn, UserPlus, AlertCircle } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Support for "admin" username requested by user
    let finalEmail = email;
    if (email.toLowerCase() === 'admin') {
      finalEmail = 'admin@ugcgenius.ai';
    } else if (!email.includes('@')) {
      setError('Please enter a valid email or "admin"');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: finalEmail,
          password: password,
        });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email: finalEmail,
          password: password,
        });
        if (signUpError) throw signUpError;
        alert('Registration successful! You can now log in.');
        setIsLogin(true);
      }
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-black">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-brand-500/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-brand-800/20 rounded-full blur-[100px] animate-pulse-slow"></div>

      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="glass-panel p-8 rounded-[32px] border border-white/10 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-br from-brand-500 to-yellow-500 p-4 rounded-2xl shadow-lg shadow-brand-500/20 mb-4">
              <Zap className="w-8 h-8 text-white fill-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              UGC<span className="text-brand-500">Genius</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-medium">Production Terminal</p>
          </div>

          <div className="flex p-1 bg-white/5 rounded-xl mb-8 border border-white/5">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-brand-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-brand-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Email / Username</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text"
                  required
                  placeholder={isLogin ? "admin or email@example.com" : "email@example.com"}
                  className="w-full glass-input pl-11 pr-4 py-3 rounded-xl text-white focus:outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full glass-input pl-11 pr-4 py-3 rounded-xl text-white focus:outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-start gap-2 text-red-400 text-xs animate-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 text-white font-bold py-4 rounded-xl shadow-xl shadow-brand-500/10 transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              {isLogin ? 'Enter Workspace' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-600 uppercase tracking-tighter">
              Authorized Content Personnel Only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};