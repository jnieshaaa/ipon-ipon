import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Wait for Supabase to detect the recovery token from the URL and establish a session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setIsSessionReady(true);
        setIsCheckingSession(false);
      }
    });

    // Also check if there's already an active session (e.g. page was refreshed after token was consumed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsSessionReady(true);
      }
      setIsCheckingSession(false);
    });

    // Timeout after 10 seconds if no session is detected
    const timeout = setTimeout(() => {
      setIsCheckingSession(false);
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      // Sign out after password reset so user can log in fresh
      await supabase.auth.signOut();
      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'An error occurred while updating your password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success screen
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col justify-center bg-gradient-to-tr from-primary via-slate-900 to-tertiary px-6">
        <div className="w-full max-w-md mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-400/40 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
          </div>

          <h1 className="text-white text-3xl font-bold tracking-tight mb-2 drop-shadow-sm">
            Password Updated!
          </h1>
          <p className="text-white/80 text-sm font-medium mb-8 max-w-xs mx-auto leading-relaxed">
            Your password has been successfully changed. You can now sign in with your new password.
          </p>

          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full max-w-sm mx-auto bg-white text-primary py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:bg-white/95 transition-all duration-200 active:scale-[0.98] text-sm cursor-pointer"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Loading / waiting for session screen
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex flex-col justify-center bg-gradient-to-tr from-primary via-slate-900 to-tertiary px-6">
        <div className="w-full max-w-md mx-auto text-center">
          <div className="flex justify-center mb-6">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight mb-2">
            Verifying Reset Link...
          </h1>
          <p className="text-white/70 text-sm">
            Please wait while we verify your password reset link.
          </p>
        </div>
      </div>
    );
  }

  // No valid session — show error
  if (!isSessionReady) {
    return (
      <div className="min-h-screen flex flex-col justify-center bg-gradient-to-tr from-primary via-slate-900 to-tertiary px-6">
        <div className="w-full max-w-md mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-500/20 border-2 border-red-400/40 rounded-full flex items-center justify-center shadow-inner">
              <Lock className="w-10 h-10 text-red-400" />
            </div>
          </div>

          <h1 className="text-white text-3xl font-bold tracking-tight mb-2 drop-shadow-sm">
            Invalid or Expired Link
          </h1>
          <p className="text-white/80 text-sm font-medium mb-8 max-w-xs mx-auto leading-relaxed">
            This password reset link is invalid or has expired. Please request a new one from the login screen.
          </p>

          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full max-w-sm mx-auto bg-white text-primary py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:bg-white/95 transition-all duration-200 active:scale-[0.98] text-sm cursor-pointer"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen flex flex-col justify-center bg-gradient-to-tr from-primary via-slate-900 to-tertiary px-6">
      <div className="w-full max-w-md mx-auto text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-white/20 border-2 border-white/40 rounded-full flex items-center justify-center shadow-inner">
            <Lock className="w-10 h-10 text-white" />
          </div>
        </div>

        <h1 className="text-white text-3xl font-bold tracking-tight mb-2 drop-shadow-sm">
          Set New Password
        </h1>
        <p className="text-white/80 text-sm font-medium mb-8 max-w-xs mx-auto leading-relaxed">
          Choose a strong new password for your account. Must be at least 6 characters long.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm w-full mx-auto">
          {/* New Password */}
          <div className="relative bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center px-4 py-3.5 focus-within:ring-2 focus-within:ring-tertiary/50">
            <Lock className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
            <input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
              className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="text-slate-400 hover:text-slate-600 p-1 focus:outline-none flex-shrink-0 cursor-pointer ml-1"
              title={showNewPassword ? "Hide password" : "Show password"}
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center px-4 py-3.5 focus-within:ring-2 focus-within:ring-tertiary/50">
            <Lock className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm New Password"
              className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="text-slate-400 hover:text-slate-600 p-1 focus:outline-none flex-shrink-0 cursor-pointer ml-1"
              title={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="bg-red-50/90 backdrop-blur-sm border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-xs font-semibold text-center shadow-md animate-pulse">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white text-primary py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:bg-white/95 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 text-sm cursor-pointer"
          >
            {isLoading ? "Updating Password..." : "Update Password"}
          </button>

          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="w-full bg-transparent text-white border border-white/30 py-3.5 rounded-2xl font-bold hover:bg-white/5 transition-all duration-200 active:scale-[0.98] text-sm cursor-pointer"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
