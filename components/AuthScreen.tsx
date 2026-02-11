import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  useEffect(() => {
    // Automatically enter the app since auth is removed
    const timer = setTimeout(() => {
      onAuthSuccess();
    }, 800);
    return () => clearTimeout(timer);
  }, [onAuthSuccess]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black">
       <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
         <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
         <p className="text-brand-500 font-mono text-sm uppercase tracking-widest">Initializing Workspace...</p>
       </div>
    </div>
  );
};