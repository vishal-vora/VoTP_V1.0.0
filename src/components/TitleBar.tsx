import React from 'react';
import {
  Shield,
  Smartphone,
  Tablet,
  Monitor,
  Lock,
  Minus,
  Square,
  X,
  Clock,
  KeyRound,
  Layers,
} from 'lucide-react';
import { AppSettings, UserAuth } from '../types/otp';

interface TitleBarProps {
  user: UserAuth | null;
  settings: AppSettings;
  isUnlocked: boolean;
  onLock: () => void;
  onMinimizeToTray: () => void;
  onChangeViewMode: (mode: AppSettings['viewMode']) => void;
  inactivityRemainingSeconds: number | null;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  user,
  settings,
  isUnlocked,
  onLock,
  onMinimizeToTray,
  onChangeViewMode,
  inactivityRemainingSeconds,
  onOpenSettings,
  onOpenAbout,
}) => {
  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <header
      id="votp-window-titlebar"
      className="w-full bg-[#121215] border-b border-zinc-800 px-3 py-1.5 flex items-center justify-between select-none shrink-0"
    >
      {/* App Branding & Status */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-5 h-5 rounded bg-zinc-100 flex items-center justify-center text-zinc-950 font-bold shrink-0">
          <Shield className="w-3 h-3 text-zinc-950 stroke-[2.5]" />
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-xs tracking-tight text-zinc-100 flex items-center gap-1 truncate">
            VoTP
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded">
              v1.2
            </span>
          </span>
          <span className="hidden sm:inline-block text-[10px] text-zinc-500 font-medium truncate">
            — Autoenginiea
          </span>
        </div>
      </div>

      {/* Center Utilities: Auto-Lock Countdown & Screen Sizer */}
      <div className="flex items-center gap-1.5">
        {/* Form Factor Switcher */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-0.5 flex items-center gap-0.5">
          <button
            type="button"
            id="btn-view-tablet7"
            onClick={() => onChangeViewMode('tablet7')}
            title="7-Inch Tablet Sizer (600x960)"
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 font-medium transition-colors ${
              settings.viewMode === 'tablet7'
                ? 'bg-zinc-100 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Tablet className="w-3 h-3" />
            <span className="hidden md:inline">7" Tab</span>
          </button>
          <button
            type="button"
            id="btn-view-mobile"
            onClick={() => onChangeViewMode('mobile')}
            title="Compact Mobile Sizer (390x844)"
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 font-medium transition-colors ${
              settings.viewMode === 'mobile'
                ? 'bg-zinc-100 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-3 h-3" />
            <span className="hidden md:inline">Mobile</span>
          </button>
          <button
            type="button"
            id="btn-view-desktop"
            onClick={() => onChangeViewMode('desktop')}
            title="Full Desktop Window Mode"
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 font-medium transition-colors ${
              settings.viewMode === 'desktop'
                ? 'bg-zinc-100 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Monitor className="w-3 h-3" />
            <span className="hidden md:inline">Desktop</span>
          </button>
        </div>

        {/* Auto-Lock Indicator */}
        {isUnlocked && settings.autoLockMinutes > 0 && inactivityRemainingSeconds !== null && (
          <div
            id="auto-lock-countdown-badge"
            title={`Vault auto-locks in ${formatCountdown(inactivityRemainingSeconds)} of inactivity`}
            className={`hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
              inactivityRemainingSeconds < 30
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 animate-pulse'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800'
            }`}
          >
            <Clock className="w-2.5 h-2.5 text-zinc-400" />
            <span>{formatCountdown(inactivityRemainingSeconds)}</span>
          </div>
        )}

        {/* Instant Lock Button */}
        {isUnlocked && (
          <button
            type="button"
            id="btn-instant-lock"
            onClick={onLock}
            title="Lock Vault Now (AES-256-GCM Session Clear)"
            className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] flex items-center gap-1 font-medium transition-colors"
          >
            <Lock className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Lock</span>
          </button>
        )}
      </div>

      {/* Windows Standard Window Controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          id="btn-window-minimize"
          onClick={onMinimizeToTray}
          title="Minimize to System Tray"
          aria-label="Minimize to System Tray"
          className="w-6 h-6 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          type="button"
          id="btn-window-maximize"
          onClick={() => onChangeViewMode(settings.viewMode === 'desktop' ? 'tablet7' : 'desktop')}
          title="Toggle Maximize Window"
          aria-label="Toggle Maximize Window"
          className="w-6 h-6 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors"
        >
          <Square className="w-2.5 h-2.5" />
        </button>
        <button
          type="button"
          id="btn-window-close"
          onClick={onMinimizeToTray}
          title="Close to Background Tray"
          aria-label="Close to Background Tray"
          className="w-6 h-6 rounded hover:bg-rose-500/20 hover:text-rose-300 text-zinc-400 flex items-center justify-center transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </header>
  );
};
