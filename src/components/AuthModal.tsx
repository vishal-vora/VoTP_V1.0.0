import React, { useState } from 'react';
import {
  Shield,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Info,
  Key,
} from 'lucide-react';
import { NumericKeypad } from './NumericKeypad';
import { AppSettings, UserAuth } from '../types/otp';
import { deriveKeyAndHash, sounds } from '../utils/crypto';
import { saveUserAuth } from '../utils/storage';

interface AuthModalProps {
  existingUser: UserAuth | null;
  settings: AppSettings;
  onAuthenticated: (user: UserAuth, sessionKey: CryptoKey, pin: string) => void;
}

type AuthMode = 'unlock' | 'setup' | 'social' | 'email_otp';

export const AuthModal: React.FC<AuthModalProps> = ({
  existingUser,
  settings,
  onAuthenticated,
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>(existingUser ? 'unlock' : 'setup');

  // Input states
  const [email, setEmail] = useState<string>(existingUser ? existingUser.email : 'vishalnvora@gmail.com');
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [setupStep, setSetupStep] = useState<'enter_pin' | 'confirm_pin'>('enter_pin');

  // Email OTP state
  const [smtpProvider, setSmtpProvider] = useState<'Gmail' | 'Outlook' | 'LinkedIn' | 'Facebook'>('Gmail');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpSentTime, setOtpSentTime] = useState<number | null>(null);
  const [otpInput, setOtpInput] = useState<string>('');

  // UI status
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  // Handle Unlock with existing user's PIN
  const handleUnlock = async (enteredPin: string) => {
    if (!existingUser) return;
    setIsLoading(true);
    setErrorMsg('');

    try {
      const saltBytes = new Uint8Array(
        existingUser.saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );
      const { key, pinHash } = await deriveKeyAndHash(enteredPin, saltBytes);

      if (pinHash === existingUser.pinHash) {
        if (settings.soundEffects) sounds.playCopySuccess();
        const updatedUser: UserAuth = {
          ...existingUser,
          lastLoginAt: Date.now(),
        };
        saveUserAuth(updatedUser);
        onAuthenticated(updatedUser, key, enteredPin);
      } else {
        if (settings.soundEffects) sounds.playLock();
        setErrorMsg('Invalid Master PIN. Please try again.');
        setPin('');
      }
    } catch (err: unknown) {
      setErrorMsg('Authentication error. Please retry.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle First-Time Setup
  const handleSetup = async () => {
    if (!email || !email.includes('@')) {
      setErrorMsg('Please provide a valid email address.');
      return;
    }

    if (setupStep === 'enter_pin') {
      if (pin.length !== 6) {
        setErrorMsg('Please enter a 6-digit Master PIN.');
        return;
      }
      setErrorMsg('');
      setSetupStep('confirm_pin');
      return;
    }

    if (setupStep === 'confirm_pin') {
      if (confirmPin !== pin) {
        setErrorMsg('PIN confirmation does not match. Please re-enter.');
        setConfirmPin('');
        return;
      }

      setIsLoading(true);
      try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltHex = Array.from(salt)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        const { key, pinHash } = await deriveKeyAndHash(pin, salt);

        const newUser: UserAuth = {
          isSetup: true,
          email: email.trim(),
          pinHash,
          saltHex,
          provider: 'email',
          displayName: email.split('@')[0],
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
        };

        saveUserAuth(newUser);
        if (settings.soundEffects) sounds.playCopySuccess();
        onAuthenticated(newUser, key, pin);
      } catch {
        setErrorMsg('Setup failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle Social Login Simulator (Google / LinkedIn / Facebook OAuth2)
  const handleSocialLogin = (provider: 'google' | 'linkedin' | 'facebook') => {
    setSocialLoading(provider);
    setErrorMsg('');

    // Simulate OAuth2 popup / redirect
    setTimeout(async () => {
      try {
        const providerEmails = {
          google: 'vishalnvora@gmail.com',
          linkedin: 'vishal.vora@linkedin.com',
          facebook: 'vishal.vora@facebook.com',
        };
        const providerNames = {
          google: 'Vishal Vora (Google SSO)',
          linkedin: 'Vishal Vora (LinkedIn Pro)',
          facebook: 'Vishal Vora (Meta)',
        };

        const targetEmail = providerEmails[provider];
        const defaultPin = '123456'; // Default social session master PIN
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltHex = Array.from(salt)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        const { key, pinHash } = await deriveKeyAndHash(defaultPin, salt);

        const authUser: UserAuth = {
          isSetup: true,
          email: targetEmail,
          pinHash,
          saltHex,
          provider,
          displayName: providerNames[provider],
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
        };

        saveUserAuth(authUser);
        if (settings.soundEffects) sounds.playCopySuccess();
        onAuthenticated(authUser, key, defaultPin);
      } catch {
        setErrorMsg('OAuth authorization failed');
      } finally {
        setSocialLoading(null);
      }
    }, 900);
  };

  // Send Email PIN OTP
  const handleSendEmailOtp = () => {
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(randomOtp);
    setOtpSentTime(Date.now());
    setErrorMsg('');
    if (settings.soundEffects) sounds.playCopySuccess();
  };

  // Verify Email PIN OTP
  const handleVerifyEmailOtp = async (code: string) => {
    if (code !== generatedOtp) {
      if (settings.soundEffects) sounds.playLock();
      setErrorMsg('Invalid verification code. Please check your simulated inbox.');
      setOtpInput('');
      return;
    }

    setIsLoading(true);
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltHex = Array.from(salt)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const { key, pinHash } = await deriveKeyAndHash(code, salt);

      const authUser: UserAuth = {
        isSetup: true,
        email: email.trim(),
        pinHash,
        saltHex,
        provider: 'email',
        displayName: email.split('@')[0],
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      };

      saveUserAuth(authUser);
      if (settings.soundEffects) sounds.playCopySuccess();
      onAuthenticated(authUser, key, code);
    } catch {
      setErrorMsg('OTP login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="votp-auth-screen"
      className="w-full h-full flex flex-col items-center justify-center p-3 bg-[#09090b] overflow-y-auto"
    >
      <div className="w-full max-w-md bg-[#121215] border border-zinc-800 rounded-xl p-5 sm:p-6 shadow-2xl flex flex-col items-center my-auto">
        {/* App Logo */}
        <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-950 font-bold mb-3 shadow-sm">
          <Shield className="w-6 h-6 text-zinc-950 stroke-[2.5]" />
        </div>

        <h1 className="text-xl font-bold text-zinc-100 tracking-tight text-center flex items-center gap-1.5">
          VoTP Authenticator
        </h1>
        <p className="text-[11px] text-zinc-400 text-center mt-0.5 mb-4">
          Virtual OTP Engine — Powered by <span className="text-zinc-200 font-medium">Autoenginiea</span>
        </p>

        {/* Mode Selector (Unlock vs Email OTP vs Social) */}
        <div className="w-full grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 mb-4 text-xs">
          <button
            type="button"
            onClick={() => {
              setAuthMode(existingUser ? 'unlock' : 'setup');
              setErrorMsg('');
              setPin('');
            }}
            className={`py-1 px-2 rounded-md font-medium text-xs transition-all ${
              authMode === 'unlock' || authMode === 'setup'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {existingUser ? 'Master PIN' : 'Setup PIN'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('email_otp');
              setErrorMsg('');
            }}
            className={`py-1 px-2 rounded-md font-medium text-xs transition-all ${
              authMode === 'email_otp'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Email OTP
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('social');
              setErrorMsg('');
            }}
            className={`py-1 px-2 rounded-md font-medium text-xs transition-all ${
              authMode === 'social'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Social OAuth
          </button>
        </div>

        {/* 1. UNLOCK EXISTING VAULT */}
        {authMode === 'unlock' && existingUser && (
          <div className="w-full flex flex-col items-center animate-fadeIn">
            <div className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 mb-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-xs">
                  {existingUser.displayName ? existingUser.displayName[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="font-semibold text-zinc-200 text-xs truncate max-w-[170px]">
                    {existingUser.displayName || existingUser.email}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate max-w-[170px]">
                    {existingUser.email}
                  </div>
                </div>
              </div>
              <span className="text-[9px] uppercase font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                Encrypted
              </span>
            </div>

            <NumericKeypad
              pin={pin}
              onChange={setPin}
              maxLength={6}
              onEnter={() => handleUnlock(pin)}
              randomized={settings.antiKeyloggerRandomized}
              soundEnabled={settings.soundEffects}
              disabled={isLoading}
              label="Enter 6-Digit Master PIN"
              errorMessage={errorMsg}
            />

            <div className="mt-3 flex items-center justify-between w-full text-[11px] text-zinc-400">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('email_otp');
                  setErrorMsg('');
                }}
                className="hover:text-zinc-200 transition-colors"
              >
                Lost PIN? Login with Email
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Reset Master Vault? You will need to re-import your TOTP keys.')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="text-rose-400/80 hover:text-rose-300 transition-colors text-[10px]"
              >
                Reset Vault
              </button>
            </div>
          </div>
        )}

        {/* 2. SETUP NEW VAULT */}
        {authMode === 'setup' && (
          <div className="w-full flex flex-col items-center animate-fadeIn">
            {setupStep === 'enter_pin' ? (
              <>
                <div className="w-full mb-3">
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Account Email (For Encrypted Identity)
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      id="input-setup-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                </div>

                <NumericKeypad
                  pin={pin}
                  onChange={setPin}
                  maxLength={6}
                  onEnter={() => handleSetup()}
                  randomized={settings.antiKeyloggerRandomized}
                  soundEnabled={settings.soundEffects}
                  disabled={isLoading}
                  label="Create 6-Digit Master PIN"
                  errorMessage={errorMsg}
                />

                <button
                  type="button"
                  id="btn-continue-confirm-pin"
                  disabled={pin.length !== 6 || !email}
                  onClick={handleSetup}
                  className="w-full mt-3 py-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40 transition-all cursor-pointer"
                >
                  Continue to Confirm PIN
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <div className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 mb-3 text-[11px] text-zinc-300">
                  Re-enter the exact same 6-digit PIN on the anti-keylogger keypad to verify and create your AES-256 vault.
                </div>

                <NumericKeypad
                  pin={confirmPin}
                  onChange={setConfirmPin}
                  maxLength={6}
                  onEnter={() => handleSetup()}
                  randomized={settings.antiKeyloggerRandomized}
                  soundEnabled={settings.soundEffects}
                  disabled={isLoading}
                  label="Confirm 6-Digit PIN"
                  errorMessage={errorMsg}
                />

                <div className="w-full flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSetupStep('enter_pin');
                      setConfirmPin('');
                      setErrorMsg('');
                    }}
                    className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg font-medium text-xs transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    id="btn-finalize-setup"
                    disabled={confirmPin.length !== 6 || isLoading}
                    onClick={handleSetup}
                    className="flex-1 py-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Initialize Vault
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. EMAIL PIN LOGIN (SMTP OTP GENERATION) */}
        {authMode === 'email_otp' && (
          <div className="w-full flex flex-col items-center animate-fadeIn">
            <div className="w-full mb-2.5">
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Target Email ID
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  id="input-otp-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@autoenginiea.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* SMTP Gateway Preset Selector */}
            <div className="w-full mb-3">
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                SMTP Relay Gateway Preset:
              </label>
              <div className="grid grid-cols-4 gap-1">
                {(['Gmail', 'Outlook', 'LinkedIn', 'Facebook'] as const).map((prov) => (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => setSmtpProvider(prov)}
                    className={`py-1 text-[11px] rounded-md font-medium border transition-colors ${
                      smtpProvider === prov
                        ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {prov}
                  </button>
                ))}
              </div>
            </div>

            {!generatedOtp ? (
              <button
                type="button"
                id="btn-send-email-otp"
                onClick={handleSendEmailOtp}
                className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                Send 6-Digit Email PIN Code
              </button>
            ) : (
              <>
                {/* Simulated Email Gateway Notification Card */}
                <div className="w-full bg-zinc-950 border border-emerald-500/30 rounded-lg p-2.5 mb-3 flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between text-emerald-400 font-semibold text-[11px]">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {smtpProvider} SMTP Relay Sent!
                    </span>
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Resend
                    </button>
                  </div>
                  <p className="text-zinc-400 text-[10px]">
                    Simulated verification email delivered to <span className="font-mono text-zinc-200">{email}</span>.
                  </p>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-md p-1.5 mt-0.5 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">Your Secure OTP:</span>
                    <span className="font-mono font-bold text-sm text-emerald-400 tracking-wider">
                      {generatedOtp}
                    </span>
                  </div>
                </div>

                <NumericKeypad
                  pin={otpInput}
                  onChange={setOtpInput}
                  maxLength={6}
                  onEnter={() => handleVerifyEmailOtp(otpInput)}
                  randomized={settings.antiKeyloggerRandomized}
                  soundEnabled={settings.soundEffects}
                  disabled={isLoading}
                  label="Enter 6-Digit Email OTP"
                  errorMessage={errorMsg}
                />
              </>
            )}
          </div>
        )}

        {/* 4. SOCIAL LOGIN OAUTH2 (Google, LinkedIn, Facebook) */}
        {authMode === 'social' && (
          <div className="w-full flex flex-col gap-2 animate-fadeIn">
            <p className="text-[11px] text-zinc-400 text-center mb-0.5">
              Authenticate securely via browser OAuth2 redirect to localhost.
            </p>

            {/* Google */}
            <button
              type="button"
              id="btn-social-google"
              disabled={!!socialLoading}
              onClick={() => handleSocialLogin('google')}
              className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-100 flex items-center justify-center gap-2.5 transition-all hover:border-zinc-700 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {socialLoading === 'google' ? 'Redirecting to Google...' : 'Continue with Google'}
            </button>

            {/* LinkedIn */}
            <button
              type="button"
              id="btn-social-linkedin"
              disabled={!!socialLoading}
              onClick={() => handleSocialLogin('linkedin')}
              className="w-full py-2 px-3 bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 border border-[#0A66C2]/30 rounded-lg text-xs font-semibold text-blue-200 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current text-[#0A66C2]" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
              {socialLoading === 'linkedin' ? 'Authenticating LinkedIn...' : 'Continue with LinkedIn'}
            </button>

            {/* Facebook */}
            <button
              type="button"
              id="btn-social-facebook"
              disabled={!!socialLoading}
              onClick={() => handleSocialLogin('facebook')}
              className="w-full py-2 px-3 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/30 rounded-lg text-xs font-semibold text-blue-200 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current text-[#1877F2]" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              {socialLoading === 'facebook' ? 'Connecting to Facebook...' : 'Continue with Facebook'}
            </button>
          </div>
        )}

        {/* Security Footer Note */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 w-full flex items-center justify-center gap-1.5 text-[10px] text-zinc-400">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>PBKDF2 600K Iterations • AES-256-GCM Vault</span>
        </div>
      </div>
    </div>
  );
};
