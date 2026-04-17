import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PieChart, Lock, User, AlertCircle, Mail, ArrowLeft, TrendingUp, Shield, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const FEATURES = [
  { icon: TrendingUp, label: 'Real-time Portfolio Tracking', desc: 'Monitor loans and repayments live' },
  { icon: Shield,     label: 'Role-based Access Control',   desc: 'Granular permissions for every team' },
  { icon: Zap,        label: 'AI-powered Insights',         desc: 'Gemini-powered financial intelligence' },
];

export const Login: React.FC = () => {
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [deactivationNotice, setDeactivationNotice] = useState(false);

  const { profileFetchError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('account_deactivated') === 'true') {
      setDeactivationNotice(true);
      localStorage.removeItem('account_deactivated');
    }
  }, []);

  useEffect(() => {
    if (profileFetchError) setError(profileFetchError);
  }, [profileFetchError]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    let username = credential.toLowerCase().trim();
    if (username.includes('@')) username = username.split('@')[0];
    const email = `${username}@janalo.com`;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/');
    } catch {
      setError('Invalid credentials or password.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    let username = resetEmail.toLowerCase().trim();
    if (username.includes('@')) username = username.split('@')[0];
    const email = `${username}@janalo.com`;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e3a5f 100%)' }}>

      {/* Left panel – branding (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[480px] h-[480px] rounded-full bg-indigo-600/20 blur-[80px]" />
          <div className="absolute bottom-[-15%] right-[-10%] w-[400px] h-[400px] rounded-full bg-blue-500/15 blur-[80px]" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
            <PieChart className="h-5 w-5 text-indigo-300" />
          </div>
          <span className="text-xl font-bold text-white font-display tracking-wider">JANALO</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-extrabold text-white font-display leading-tight mb-4">
              Financial Management<br />
              <span className="animate-gradient-text">Made Intelligent</span>
            </h1>
            <p className="text-indigo-200/70 text-base leading-relaxed max-w-sm">
              A unified platform for loans, payroll, accounting, and business intelligence — built for modern microfinance operations.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map(({ icon: FIcon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="h-9 w-9 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                  <FIcon className="h-4 w-4 text-indigo-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{label}</div>
                  <div className="text-xs text-indigo-300/60 mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-indigo-300/40">
          © {new Date().getFullYear()} Janalo Enterprises. All rights reserved.
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[400px] animate-scale-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <PieChart className="h-5 w-5 text-indigo-300" />
            </div>
            <span className="text-xl font-bold text-white font-display tracking-wider">JANALO</span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Card header */}
            <div className="px-8 pt-8 pb-6 border-b border-gray-100">
              <h2 className="text-2xl font-extrabold text-gray-900 font-display tracking-tight">
                {showForgotPassword ? 'Reset Password' : 'Welcome back'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {showForgotPassword
                  ? 'Enter your username to receive a reset link'
                  : 'Sign in to your Janalo Enterprises account'}
              </p>
            </div>

            {/* Deactivation notice */}
            {deactivationNotice && (
              <div className="mx-6 mt-5 p-4 bg-red-50 border border-red-100 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Account Deactivated</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Contact your administrator to reactivate access.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={showForgotPassword ? handlePasswordReset : handleLogin} className="px-8 py-6 space-y-5">
              {/* Error */}
              {error && (
                <div className="bg-red-50 text-red-700 p-3.5 rounded-xl flex items-start text-sm gap-2.5 border border-red-100">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!showForgotPassword ? (
                <>
                  {/* Username */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        required
                        value={credential}
                        onChange={(e) => setCredential(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white transition-colors duration-150 placeholder-gray-400"
                        placeholder="e.g. Andrew"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white transition-colors duration-150 placeholder-gray-400"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-bold text-white shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: loading ? '#6366f1' : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
                  >
                    {loading ? (
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : null}
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setError(null); }}
                    className="w-full text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                  >
                    Forgot your password?
                  </button>
                </>
              ) : resetSent ? (
                <div className="text-center space-y-4 py-4">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mb-2">
                    <Mail className="h-7 w-7 text-green-600" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">Check your email</h3>
                  <p className="text-sm text-gray-500">
                    We've sent a password reset link to your registered email address.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetEmail(''); setError(null); }}
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(false); setError(null); }}
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                  </button>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white transition-colors placeholder-gray-400"
                        placeholder="Enter your username"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-bold text-white disabled:opacity-50 shadow-lg transition-all duration-200"
                    style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </>
              )}

              {!showForgotPassword && (
                <p className="text-center text-[11px] text-gray-400 pt-1">
                  For access issues, contact your IT Administrator.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};