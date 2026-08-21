import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, User, Lock, Landmark, ChevronRight, Eye, EyeOff, Mail, X, PiggyBank, Banknote, ShieldAlert } from 'lucide-react';
import { AuthController } from '../../controllers/AuthController';
import { useAuth } from '../../hooks/useAuth';
import { loginByMemberCodeQuery } from '../../queries/groups';

export default function LoginScreen() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Try to load remembered user from localStorage
  const [rememberedUser, setRememberedUser] = useState<{ email: string; name: string } | null>(() => {
    try {
      const data = localStorage.getItem('ipon_remembered_user');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  });

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailVerificationSent, setIsEmailVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);



  // If a user is remembered, prefill their email
  useEffect(() => {
    if (rememberedUser) {
      setEmail(rememberedUser.email);
    }
  }, [rememberedUser]);

  const authController = new AuthController();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        const result = await authController.signUp({ email, password, name: username });
        if (result) {
          if (result.sessionCreated) {
            // Save to remembered user
            localStorage.setItem('ipon_remembered_user', JSON.stringify({ email: result.user.email, name: result.user.name }));
            login(result.user);
            navigate('/group-selection', { replace: true });
          } else {
            // Email confirmation is required
            setVerificationEmail(result.user.email);
            setIsEmailVerificationSent(true);
          }
        } else {
          setError('Registration failed. Please make sure the email is valid and not already in use.');
        }
      } else {
        const loginEmail = rememberedUser ? rememberedUser.email : email;
        const user = await authController.login({ email: loginEmail, password });
        if (user) {
          // Save to remembered user
          localStorage.setItem('ipon_remembered_user', JSON.stringify({ email: user.email, name: user.name }));
          login(user);
          navigate('/group-selection', { replace: true });
        } else {
          setError('Invalid password or credentials');
        }
      }
    } catch (err: any) {
      setError(err?.message || `An error occurred during ${isSignUp ? 'sign up' : 'login'}. Please try again.`);
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAccess = () => {
    localStorage.removeItem('ipon_remembered_user');
    setRememberedUser(null);
    setEmail('');
    setPassword('');
    setError('');
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-tr from-primary via-slate-900 to-tertiary pt-10 pb-6 px-6">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white/20 border-2 border-white/40 rounded-full flex items-center justify-center shadow-inner">
              <Lock className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-white text-3xl font-bold tracking-tight mb-2 drop-shadow-sm">
            {forgotSuccess ? "Email Sent!" : "Forgot Password"}
          </h1>
          <p className="text-white/80 text-sm font-medium mb-8 max-w-xs mx-auto leading-relaxed">
            {forgotSuccess 
              ? `We have sent a password recovery link to ${forgotEmail}. Please check your inbox to continue.`
              : "Enter your registered email address below, and we'll send you a secure link to reset your password."}
          </p>

          {forgotSuccess ? (
            <button
              onClick={() => {
                setIsForgotPassword(false);
                setForgotSuccess(false);
                setForgotEmail('');
                setError('');
              }}
              className="w-full max-w-sm mx-auto bg-white text-primary py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:bg-white/95 transition-all duration-200 active:scale-[0.98] text-sm cursor-pointer"
            >
              Back to Sign In
            </button>
          ) : (
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                setIsLoading(true);
                try {
                  const success = await authController.sendPasswordResetEmail(forgotEmail);
                  if (success) {
                    setForgotSuccess(true);
                  } else {
                    setError('Failed to send reset link.');
                  }
                } catch (err: any) {
                  setError(err?.message || 'An error occurred. Please verify your email.');
                } finally {
                  setIsLoading(false);
                }
              }}
              className="space-y-4 max-w-sm w-full mx-auto"
            >
              <div className="relative bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center px-4 py-3.5 focus-within:ring-2 focus-within:ring-tertiary/50">
                <Mail className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
                <input
                  id="forgotEmail"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
                  required
                />
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
                {isLoading ? "Sending Link..." : "Send Reset Link"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setError('');
                }}
                className="w-full bg-transparent text-white border border-white/30 py-3.5 rounded-2xl font-bold hover:bg-white/5 transition-all duration-200 active:scale-[0.98] text-sm cursor-pointer"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (isEmailVerificationSent) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-tr from-primary via-slate-900 to-tertiary pt-10 pb-6 px-6">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center text-center">
          <div className="w-20 h-20 bg-white/20 border-2 border-white/40 rounded-full flex items-center justify-center shadow-inner mx-auto mb-6">
            <Mail className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-white text-3xl font-bold tracking-tight mb-2 drop-shadow-sm">
            Verify Your Email
          </h1>
          <p className="text-white/80 text-sm font-medium mb-8 max-w-xs mx-auto leading-relaxed">
            We've sent a verification link to <strong className="text-white">{verificationEmail}</strong>. Please check your inbox and verify your account to proceed.
          </p>

          <button
            onClick={() => {
              setIsEmailVerificationSent(false);
              setIsSignUp(false);
              setEmail(verificationEmail);
              setPassword('');
              setError('');
            }}
            className="w-full max-w-sm mx-auto bg-white text-primary py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:bg-white/95 transition-all duration-200 active:scale-[0.98] text-sm"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-tr from-primary via-slate-900 to-tertiary pt-10 pb-6 px-6">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">

        {/* Top Header Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {rememberedUser ? (
              <div className="w-20 h-20 bg-white/20 border-2 border-white/40 rounded-full flex items-center justify-center shadow-inner">
                <User className="w-10 h-10 text-white" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-white/20 border-2 border-white/40 rounded-2xl flex items-center justify-center shadow-md">
                {isSignUp ? <UserPlus className="w-8 h-8 text-white" /> : <LogIn className="w-8 h-8 text-white" />}
              </div>
            )}
          </div>

          <h1 className="text-white text-3xl font-bold tracking-tight mb-1 drop-shadow-sm">
            {rememberedUser
              ? `Hello, ${rememberedUser.name.split(' ')[0].toUpperCase()}!`
              : (isSignUp ? 'Create Account' : 'Ipon-Ipon')}
          </h1>
          <p className="text-white/85 text-sm font-medium">
            {rememberedUser
              ? 'Unlock'
              : (isSignUp ? 'Join us to start managing your savings' : 'Manage your savings & track loan interest')}
          </p>
        </div>

        {/* Input & Form Container */}
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm w-full mx-auto">

          {/* Normal Username / Email / Password Inputs */}
          {!rememberedUser && (
            <>
              {isSignUp && (
                <div className="relative bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center px-4 py-3.5 focus-within:ring-2 focus-within:ring-tertiary/50">
                  <User className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username / Name"
                    className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
                    required={isSignUp}
                  />
                </div>
              )}

              <div className="relative bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center px-4 py-3.5 focus-within:ring-2 focus-within:ring-tertiary/50">
                <User className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
                  required
                />
              </div>
            </>
          )}

          {/* Password Input */}
          <div className="relative bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center px-4 py-3.5 focus-within:ring-2 focus-within:ring-tertiary/50">
            <Lock className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-400 hover:text-slate-600 p-1 focus:outline-none flex-shrink-0 cursor-pointer ml-1"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {!isSignUp && (
            <div className="flex justify-end pr-1 -mt-1 pb-1">
              <button
                type="button"
                className="text-xs text-white/95 hover:text-white font-semibold hover:underline cursor-pointer bg-transparent border-none p-0 inline"
                onClick={() => {
                  setIsForgotPassword(true);
                  setError('');
                }}
              >
                Forgot Password?
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50/90 backdrop-blur-sm border border-red-100 text-red-650 px-4 py-3 rounded-2xl text-xs font-semibold text-center shadow-md animate-pulse">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white text-primary py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:bg-white/95 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 text-sm cursor-pointer"
          >
            {isLoading
              ? (rememberedUser ? 'Unlocking...' : (isSignUp ? 'Signing Up...' : 'Signing In...'))
              : (rememberedUser ? 'Log in' : (isSignUp ? 'Sign Up' : 'Sign In'))
            }
          </button>

          {!rememberedUser && (
            <>
              {/* Toggle Normal Sign In/Sign Up */}
              <p className="text-center text-xs text-white/90 font-medium pt-2">
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                  }}
                  className="text-white font-bold underline hover:text-white/80 cursor-pointer bg-transparent border-none p-0 inline align-baseline"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>

              {/* Demo Accounts Tap-to-Fill list */}
              {/* {!isSignUp && !isPasscodeLogin && (
                <div className="pt-4 border-t border-white/10 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider mb-2.5">Demo Accounts (Tap to autofill):</p>
                  <div className="flex justify-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('junie@gmail.com');
                        setPassword('123123');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-[10px] text-white font-medium active:scale-95 transition cursor-pointer"
                    >
                      Junie
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('junessa@gmail.com');
                        setPassword('123123');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-[10px] text-white font-medium active:scale-95 transition cursor-pointer"
                    >
                      Junessa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('jenelyn@gmail.com');
                        setPassword('123123');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-[10px] text-white font-medium active:scale-95 transition cursor-pointer"
                    >
                      Jenelyn
                    </button>
                  </div>
                </div>
              )} */}
            </>
          )}
        </form>

        {/* Switch Account link for Lock Screen */}
        {rememberedUser && (
          <div className="text-center mt-6">
            <button
              type="button"
              onClick={handleClearAccess}
              className="text-white/85 hover:text-white text-xs font-semibold underline"
            >
              Sign in with another account
            </button>
          </div>
        )}
      </div>

      {/* Bottom sliding card sheet placeholder */}
      <div className="w-full max-w-md mx-auto mt-6">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-white/20 shadow-2xl relative">
          {/* Chevron Handle Indicator */}
          <div className="flex justify-center mb-3 text-primary">
            <div className="text-lg font-bold select-none">^</div>
          </div>

          {/* Quick Balance UI Card */}
          <button
            type="button"
            onClick={() => navigate('/quick-balance')}
            className="w-full bg-white border-2 border-secondary hover:border-tertiary rounded-2xl p-4 flex items-center justify-between text-left transition active:scale-[0.99] shadow-sm hover:shadow-md cursor-pointer"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-tertiary rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/10">
                <Landmark className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-primary text-sm font-bold">Quick Balance Inquiry</h3>
                <p className="text-slate-400 text-xs font-light">View the current savings balance of your accounts</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </button>
        </div>
      </div>
    </div>
  );
}
