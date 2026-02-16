import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface LoginFormProps {
  onLogin: (success: boolean, remember: boolean) => void;
  companyName: string;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, companyName }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load remembered credentials on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Connect to Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (authError) throw authError;

      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
      } else {
        localStorage.removeItem('remembered_email');
      }

      onLogin(true, rememberMe);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Invalid credentials or network error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 font-inter transition-colors duration-500">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl p-10 border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-500">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl shadow-blue-500/20 rotate-3">
            <span className="text-3xl">💼</span>
          </div>
          <h1 className="text-3xl font-black font-orbitron text-slate-900 dark:text-white uppercase tracking-tighter">
            {companyName}
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Enterprise Resource Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl animate-in fade-in slide-in-from-top-1">
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight text-center">
                {error}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Credential Identity</label>
            <input 
              type="email" 
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-sm font-bold shadow-inner focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2 relative">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Secure Key</label>
            <input 
              type={showPassword ? "text" : "password"} 
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-sm font-bold shadow-inner focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-[46px] text-slate-400 hover:text-blue-600 transition-colors"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          <div className="flex flex-col space-y-3 px-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded-lg border-none bg-slate-100 dark:bg-slate-800 checked:bg-blue-600 transition-all cursor-pointer accent-blue-600"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-600 dark:group-hover:text-slate-300">Keep me signed in</span>
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-5 bg-slate-900 dark:bg-blue-600 text-white font-black rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.3em] text-[10px] font-orbitron disabled:opacity-50"
          >
            {isLoading ? 'Connecting to DB...' : 'Authorize Session'}
          </button>
        </form>

        <div className="mt-12 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
            Security Notice: Authentication via Supabase Auth <br/>
            <span className="text-slate-600 dark:text-slate-300">Protected by Row-Level Security Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;