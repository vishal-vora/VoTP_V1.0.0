import React, { useState } from 'react';
import {
  X,
  Settings,
  Clock,
  Shuffle,
  Volume2,
  VolumeX,
  Palette,
  Shield,
  Key,
  CheckCircle2,
  Lock,
  HardDrive,
  Eye,
} from 'lucide-react';
import { AppSettings, UserAuth } from '../types/otp';
import { NumericKeypad } from './NumericKeypad';
import { deriveKeyAndHash, sounds } from '../utils/crypto';
import { saveAppSettings, saveUserAuth } from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  user: UserAuth | null;
  currentPin: string;
  onUpdatePin: (newPin: string, newKey: CryptoKey) => void;
  onOpenSqliteInspector: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  user,
  currentPin,
  onUpdatePin,
  onOpenSqliteInspector,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'change_pin'>('general');

  // Change PIN State
  const [oldPin, setOldPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmNewPin, setConfirmNewPin] = useState<string>('');
  const [pinStep, setPinStep] = useState<'old' | 'new' | 'confirm'>('old');
  const [pinError, setPinError] = useState<string>('');
  const [pinSuccess, setPinSuccess] = useState<string>('');

  if (!isOpen) return null;

  const handleToggleRandomize = () => {
    const updated: AppSettings = {
      ...settings,
      antiKeyloggerRandomized: !settings.antiKeyloggerRandomized,
    };
    onUpdateSettings(updated);
    saveAppSettings(updated);
  };

  const handleToggleSound = () => {
    const updated: AppSettings = {
      ...settings,
      soundEffects: !settings.soundEffects,
    };
    onUpdateSettings(updated);
    saveAppSettings(updated);
  };

  const handleChangeAutoLock = (minutes: number) => {
    const updated: AppSettings = {
      ...settings,
      autoLockMinutes: minutes,
    };
    onUpdateSettings(updated);
    saveAppSettings(updated);
  };

  const handleChangeCopyTimeout = (seconds: number) => {
    const updated: AppSettings = {
      ...settings,
      copyTimeoutSeconds: seconds,
    };
    onUpdateSettings(updated);
    saveAppSettings(updated);
  };

  const handleChangeTheme = (theme: AppSettings['theme']) => {
    const updated: AppSettings = {
      ...settings,
      theme,
    };
    onUpdateSettings(updated);
    saveAppSettings(updated);
  };

  // Change PIN handler
  const handleVerifyOldPin = () => {
    if (oldPin !== currentPin) {
      setPinError('Incorrect current Master PIN.');
      setOldPin('');
      return;
    }
    setPinError('');
    setPinStep('new');
  };

  const handleConfirmNewPin = async () => {
    if (newPin !== confirmNewPin) {
      setPinError('New PIN confirmation does not match.');
      setConfirmNewPin('');
      return;
    }

    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltHex = Array.from(salt)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const { key, pinHash } = await deriveKeyAndHash(newPin, salt);

      if (user) {
        const updatedUser: UserAuth = {
          ...user,
          pinHash,
          saltHex,
        };
        saveUserAuth(updatedUser);
      }

      onUpdatePin(newPin, key);
      if (settings.soundEffects) sounds.playCopySuccess();
      setPinSuccess('Master PIN updated successfully!');
      setTimeout(() => {
        setActiveSubTab('general');
        setPinStep('old');
        setOldPin('');
        setNewPin('');
        setConfirmNewPin('');
        setPinSuccess('');
      }, 1200);
    } catch {
      setPinError('Failed to update Master PIN.');
    }
  };

  return (
    <div
      id="modal-settings"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-fadeIn"
    >
      <div className="w-full max-w-md bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-[#141418]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
              <Settings className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-100">Vault & Security Settings</h2>
              <p className="text-[10px] text-zinc-400">Configure auto-lock, numpad, & themes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings dialog"
            className="w-7 h-7 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SubTab Bar */}
        <div className="grid grid-cols-2 gap-1 p-1.5 bg-[#09090b] border-b border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('general')}
            className={`py-1.5 px-2.5 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeSubTab === 'general'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            General & Security
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('change_pin')}
            className={`py-1.5 px-2.5 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeSubTab === 'change_pin'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Change Master PIN
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
          {activeSubTab === 'general' ? (
            <>
              {/* 1. Auto-Lock Timer Duration */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200 text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    Inactivity Auto-Lock Timer
                  </span>
                  <span className="font-mono text-zinc-100 font-bold text-xs">
                    {settings.autoLockMinutes === 0 ? 'Disabled' : `${settings.autoLockMinutes} min`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 pt-0.5">
                  {[1, 2, 5, 10, 15, 30, 0].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleChangeAutoLock(mins)}
                      className={`py-1 text-xs rounded-md font-medium border transition-colors ${
                        settings.autoLockMinutes === mins
                          ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {mins === 0 ? 'Never' : `${mins}m`}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400">
                  Vault will automatically clear cryptographic session keys when inactive.
                </p>
              </div>

              {/* 2. Anti-Keylogger Scramble Toggle */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-semibold text-zinc-200 text-xs flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                    Scrambled Numpad Default
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Randomizes on-screen digit positions to defeat mouse tracking
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.antiKeyloggerRandomized}
                  onChange={handleToggleRandomize}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-zinc-400 cursor-pointer accent-zinc-100"
                />
              </div>

              {/* 3. Sound Effects Toggle */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-semibold text-zinc-200 text-xs flex items-center gap-1.5">
                    {settings.soundEffects ? (
                      <Volume2 className="w-3.5 h-3.5 text-zinc-300" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                    Tactile Audio Feedback
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Plays subtle click chimes on keypad and copy events
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.soundEffects}
                  onChange={handleToggleSound}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-zinc-400 cursor-pointer accent-zinc-100"
                />
              </div>

              {/* 4. Clipboard Auto-Purge */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200 text-xs">
                    Clipboard Security Auto-Purge
                  </span>
                  <span className="font-mono text-zinc-100 font-bold text-xs">
                    {settings.copyTimeoutSeconds}s
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[15, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handleChangeCopyTimeout(sec)}
                      className={`py-1 text-xs rounded-md font-medium border transition-colors ${
                        settings.copyTimeoutSeconds === sec
                          ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {sec} Seconds
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. SQLite Storage Inspector Trigger */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-semibold text-zinc-200 text-xs flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                    SQLite Database Viewer (~/.votp/)
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Inspect raw encrypted database tables & BLOBs
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenSqliteInspector}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold rounded-md border border-zinc-800 transition-colors cursor-pointer"
                >
                  View Tables
                </button>
              </div>
            </>
          ) : (
            /* CHANGE MASTER PIN TAB */
            <div className="space-y-3">
              {pinSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{pinSuccess}</span>
                </div>
              )}

              {pinStep === 'old' && (
                <NumericKeypad
                  pin={oldPin}
                  onChange={setOldPin}
                  maxLength={6}
                  onEnter={handleVerifyOldPin}
                  randomized={settings.antiKeyloggerRandomized}
                  soundEnabled={settings.soundEffects}
                  label="Enter Current Master PIN"
                  errorMessage={pinError}
                />
              )}

              {pinStep === 'new' && (
                <NumericKeypad
                  pin={newPin}
                  onChange={setNewPin}
                  maxLength={6}
                  onEnter={() => setPinStep('confirm')}
                  randomized={settings.antiKeyloggerRandomized}
                  soundEnabled={settings.soundEffects}
                  label="Enter New 6-Digit PIN"
                  errorMessage={pinError}
                />
              )}

              {pinStep === 'confirm' && (
                <NumericKeypad
                  pin={confirmNewPin}
                  onChange={setConfirmNewPin}
                  maxLength={6}
                  onEnter={handleConfirmNewPin}
                  randomized={settings.antiKeyloggerRandomized}
                  soundEnabled={settings.soundEffects}
                  label="Confirm New 6-Digit PIN"
                  errorMessage={pinError}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
