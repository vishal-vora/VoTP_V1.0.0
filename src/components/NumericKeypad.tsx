import React, { useState } from 'react';
import { Delete, Shuffle, Volume2, VolumeX, ShieldCheck } from 'lucide-react';
import { sounds } from '../utils/crypto';

interface NumericKeypadProps {
  pin: string;
  onChange: (pin: string) => void;
  maxLength?: number;
  onEnter?: () => void;
  randomized?: boolean;
  soundEnabled?: boolean;
  disabled?: boolean;
  label?: string;
  errorMessage?: string;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  pin,
  onChange,
  maxLength = 6,
  onEnter,
  randomized = true,
  soundEnabled = true,
  disabled = false,
  label = 'Enter 6-Digit PIN',
  errorMessage,
}) => {
  const [isScrambled, setIsScrambled] = useState<boolean>(randomized);
  const [keyLayout, setKeyLayout] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);

  // Shuffle digits for anti-keylogger protection
  const shuffleKeys = () => {
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    setKeyLayout(digits);
    if (soundEnabled) sounds.playKeypadClick();
  };

  const handleDigitPress = (digit: number) => {
    if (disabled || pin.length >= maxLength) return;
    if (soundEnabled) sounds.playKeypadClick();
    const newPin = pin + digit.toString();
    onChange(newPin);

    // If scrambled mode is active, optionally reshuffle after every click for ultra-high security
    if (isScrambled) {
      shuffleKeys();
    }

    if (newPin.length === maxLength && onEnter) {
      setTimeout(() => onEnter(), 100);
    }
  };

  const handleBackspace = () => {
    if (disabled || pin.length === 0) return;
    if (soundEnabled) sounds.playKeypadClick();
    onChange(pin.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled) return;
    if (soundEnabled) sounds.playKeypadClick();
    onChange('');
  };

  const toggleScramble = () => {
    if (!isScrambled) {
      shuffleKeys();
      setIsScrambled(true);
    } else {
      setKeyLayout([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
      setIsScrambled(false);
    }
  };

  return (
    <div id="numeric-keypad-container" className="w-full max-w-sm mx-auto flex flex-col items-center">
      {/* Label and Security Badge */}
      <div className="w-full flex items-center justify-between mb-2 px-0.5">
        <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          {label}
        </span>
        <button
          type="button"
          id="btn-scramble-toggle"
          onClick={toggleScramble}
          title={isScrambled ? 'Anti-Keylogger Scramble Active' : 'Enable Anti-Keylogger Scramble'}
          className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 border transition-colors ${
            isScrambled
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
          }`}
        >
          <Shuffle className="w-2.5 h-2.5" />
          {isScrambled ? 'Scrambled' : 'Standard'}
        </button>
      </div>

      {/* PIN Dots Display */}
      <div className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 flex flex-col items-center justify-center mb-3">
        <div className="flex items-center justify-center gap-2.5 h-6">
          {Array.from({ length: maxLength }).map((_, index) => {
            const isFilled = index < pin.length;
            const isCurrent = index === pin.length;
            return (
              <div
                key={index}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                  isFilled
                    ? 'bg-zinc-100 scale-110 shadow-sm'
                    : isCurrent
                    ? 'border-2 border-cyan-400 scale-100 animate-pulse'
                    : 'bg-zinc-900 border border-zinc-800'
                }`}
              />
            );
          })}
        </div>
        {errorMessage && (
          <p className="text-[11px] text-rose-400 mt-1.5 font-medium animate-shake text-center">
            {errorMessage}
          </p>
        )}
      </div>

      {/* 3x4 On-Screen Keypad Grid */}
      <div className="grid grid-cols-3 gap-1.5 w-full">
        {keyLayout.slice(0, 9).map((digit) => (
          <button
            key={digit}
            type="button"
            id={`keypad-btn-${digit}`}
            disabled={disabled}
            onClick={() => handleDigitPress(digit)}
            className="h-11 sm:h-12 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 border border-zinc-800/80 hover:border-zinc-700 text-lg font-bold font-mono text-zinc-100 transition-all flex items-center justify-center shadow-xs disabled:opacity-50 select-none cursor-pointer"
          >
            {digit}
          </button>
        ))}

        {/* Clear Button */}
        <button
          type="button"
          id="keypad-btn-clear"
          disabled={disabled || pin.length === 0}
          onClick={handleClear}
          className="h-11 sm:h-12 rounded-lg bg-zinc-950 hover:bg-zinc-900 active:scale-95 border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer"
        >
          CLEAR
        </button>

        {/* 0 Button */}
        <button
          type="button"
          id={`keypad-btn-${keyLayout[9]}`}
          disabled={disabled}
          onClick={() => handleDigitPress(keyLayout[9])}
          className="h-11 sm:h-12 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 border border-zinc-800/80 hover:border-zinc-700 text-lg font-bold font-mono text-zinc-100 transition-all flex items-center justify-center shadow-xs disabled:opacity-50 select-none cursor-pointer"
        >
          {keyLayout[9]}
        </button>

        {/* Backspace Button */}
        <button
          type="button"
          id="keypad-btn-backspace"
          disabled={disabled || pin.length === 0}
          onClick={handleBackspace}
          className="h-11 sm:h-12 rounded-lg bg-zinc-950 hover:bg-zinc-900 active:scale-95 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer"
        >
          <Delete className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[10px] text-zinc-400 mt-2 text-center">
        Hardware anti-keylogger active. Click on-screen buttons only.
      </p>
    </div>
  );
};
