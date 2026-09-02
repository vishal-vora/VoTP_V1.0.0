import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Star,
  MoreVertical,
  QrCode,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  RotateCw,
  Clock,
  Shield,
  Tag,
} from 'lucide-react';
import { TotpEntry } from '../types/otp';
import { formatOtpDisplay, generateTotpCode, sounds } from '../utils/crypto';

interface TotpCardProps {
  entry: TotpEntry;
  onCopy: (entry: TotpEntry, code: string) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (entry: TotpEntry) => void;
  onDelete: (id: string) => void;
  onViewQr: (entry: TotpEntry) => void;
  onHotpIncrement?: (id: string) => void;
  soundEnabled?: boolean;
}

export const TotpCard: React.FC<TotpCardProps> = ({
  entry,
  onCopy,
  onToggleFavorite,
  onEdit,
  onDelete,
  onViewQr,
  onHotpIncrement,
  soundEnabled = true,
}) => {
  const [currentCode, setCurrentCode] = useState<string>('------');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [showSecret, setShowSecret] = useState<boolean>(false);

  // Update OTP code and countdown every second
  useEffect(() => {
    let isMounted = true;

    const updateCode = async () => {
      try {
        if (entry.type === 'TOTP') {
          const result = await generateTotpCode(entry.secret, {
            period: entry.period,
            digits: entry.digits,
            algorithm: entry.algorithm,
          });
          if (isMounted) {
            setCurrentCode(result.code);
            setRemainingSeconds(result.secondsRemaining);
            setProgressPercent(result.progress);
          }
        } else {
          // HOTP logic
          const result = await generateTotpCode(entry.secret, {
            time: (entry.counter || 0) * (entry.period || 30) * 1000,
            digits: entry.digits,
            algorithm: entry.algorithm,
          });
          if (isMounted) {
            setCurrentCode(result.code);
            setRemainingSeconds(30);
            setProgressPercent(100);
          }
        }
      } catch (err) {
        if (isMounted) {
          setCurrentCode('ERROR');
        }
      }
    };

    updateCode();
    const interval = setInterval(updateCode, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [entry.secret, entry.period, entry.digits, entry.algorithm, entry.type, entry.counter]);

  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (soundEnabled) sounds.playCopySuccess();
    navigator.clipboard.writeText(currentCode);
    setIsCopied(true);
    onCopy(entry, currentCode);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Issuer styling helper
  const getIssuerBadgeColor = (issuer: string) => {
    const low = (issuer || '').toLowerCase();
    if (low.includes('google')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (low.includes('cloudflare')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    if (low.includes('github')) return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
    if (low.includes('aws')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (low.includes('microsoft')) return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    if (low.includes('discord')) return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
    return 'bg-zinc-900 text-zinc-300 border-zinc-800';
  };

  // SVG Circular progress radius & circumference
  const radius = 13;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const isUrgent = remainingSeconds <= 5;
  const isWarning = remainingSeconds <= 10 && remainingSeconds > 5;

  return (
    <div
      id={`totp-card-${entry.id}`}
      className="group relative bg-[#141418] hover:bg-[#18181f] border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-3 transition-all duration-150 shadow-sm flex flex-col justify-between"
    >
      {/* Top Row: Issuer, Name, Category, Favorite, Menu */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-start gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs shrink-0 border ${getIssuerBadgeColor(
              entry.issuer
            )}`}
          >
            {entry.issuer ? entry.issuer.slice(0, 2).toUpperCase() : '2F'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-zinc-200 text-xs truncate max-w-[140px] sm:max-w-[190px]">
                {entry.issuer || 'General'}
              </span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-medium border ${getIssuerBadgeColor(
                  entry.issuer
                )}`}
              >
                {entry.category}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate max-w-[150px] sm:max-w-[210px] font-mono">
              {entry.name}
            </p>
          </div>
        </div>

        {/* Favorite & Options */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onToggleFavorite(entry.id)}
            title={entry.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
            className={`p-1 rounded transition-colors ${
              entry.isFavorite
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${entry.isFavorite ? 'fill-current' : ''}`} />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-30 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onViewQr(entry);
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                  >
                    <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                    Show QR Code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowSecret(!showSecret);
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                  >
                    {showSecret ? (
                      <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    {showSecret ? 'Hide Secret' : 'Reveal Secret'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(entry);
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    Edit Account
                  </button>
                  <div className="border-t border-zinc-800 my-0.5" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      if (confirm(`Delete 2FA key for "${entry.issuer}: ${entry.name}"?`)) {
                        onDelete(entry.id);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Key
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Middle Row: Secret Reveal (if toggled) */}
      {showSecret && (
        <div className="bg-zinc-950 border border-amber-500/30 rounded-md p-1.5 mb-2 text-[10px] font-mono text-amber-300 flex items-center justify-between">
          <span className="truncate mr-2">{entry.secret}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(entry.secret);
              if (soundEnabled) sounds.playCopySuccess();
            }}
            className="text-amber-400 hover:underline shrink-0"
          >
            Copy
          </button>
        </div>
      )}

      {/* Main Code Row with 1-Click Copy & Circular Countdown Progress */}
      <div
        onClick={handleCopyClick}
        title="Click to copy code to clipboard"
        className="w-full bg-zinc-950 hover:bg-zinc-950/90 border border-zinc-800/90 hover:border-zinc-700 rounded-lg p-2.5 flex items-center justify-between cursor-pointer transition-all duration-150 group/code"
      >
        <div className="flex items-center gap-2.5">
          <div className="font-mono font-bold text-xl sm:text-2xl tracking-widest text-zinc-100 group-hover/code:text-cyan-400 transition-colors">
            {formatOtpDisplay(currentCode)}
          </div>
          {isCopied ? (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded-md flex items-center gap-1 animate-fadeIn">
              <Check className="w-2.5 h-2.5" /> Copied
            </span>
          ) : (
            <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover/code:text-zinc-300 transition-colors" />
          )}
        </div>

        {/* Circular Countdown Progress */}
        {entry.type === 'TOTP' ? (
          <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r={radius}
                className="stroke-zinc-800 fill-none"
                strokeWidth="3.5"
              />
              <circle
                cx="18"
                cy="18"
                r={radius}
                className={`fill-none transition-all duration-1000 ease-linear ${
                  isUrgent
                    ? 'stroke-rose-500'
                    : isWarning
                    ? 'stroke-amber-400'
                    : 'stroke-zinc-300'
                }`}
                strokeWidth="3.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <span
              className={`absolute text-[10px] font-bold font-mono ${
                isUrgent
                  ? 'text-rose-400 animate-pulse'
                  : isWarning
                  ? 'text-amber-300'
                  : 'text-zinc-400'
              }`}
            >
              {remainingSeconds}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onHotpIncrement) onHotpIncrement(entry.id);
            }}
            title="Generate Next HOTP Code"
            className="px-2 py-1 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold rounded-md flex items-center gap-1"
          >
            <RotateCw className="w-3 h-3" /> Next
          </button>
        )}
      </div>

      {/* Footer Info: Algorithm & Period */}
      <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-2 px-0.5">
        <span className="font-mono">
          {entry.algorithm} • {entry.digits} Digits • {entry.period}s
        </span>
        {entry.notes && (
          <span className="truncate max-w-[120px] text-zinc-400" title={entry.notes}>
            {entry.notes}
          </span>
        )}
      </div>
    </div>
  );
};
