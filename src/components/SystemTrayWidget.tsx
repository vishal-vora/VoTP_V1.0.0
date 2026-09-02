import React, { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  Copy,
  Check,
  Maximize2,
  Lock,
  X,
  ExternalLink,
} from 'lucide-react';
import { TotpEntry } from '../types/otp';
import { generateTotpCode, formatOtpDisplay, sounds } from '../utils/crypto';

interface SystemTrayWidgetProps {
  isOpen: boolean;
  entries: TotpEntry[];
  onRestoreWindow: () => void;
  onLock: () => void;
  soundEnabled?: boolean;
}

export const SystemTrayWidget: React.FC<SystemTrayWidgetProps> = ({
  isOpen,
  entries,
  onRestoreWindow,
  onLock,
  soundEnabled = true,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [liveCodes, setLiveCodes] = useState<Record<string, { code: string; secs: number }>>({});

  useEffect(() => {
    if (!isOpen) return;

    const updateCodes = async () => {
      const results: Record<string, { code: string; secs: number }> = {};
      for (const entry of entries) {
        try {
          const res = await generateTotpCode(entry.secret, {
            period: entry.period,
            digits: entry.digits,
            algorithm: entry.algorithm,
          });
          results[entry.id] = { code: res.code, secs: res.secondsRemaining };
        } catch {
          results[entry.id] = { code: 'ERR', secs: 0 };
        }
      }
      setLiveCodes(results);
    };

    updateCodes();
    const interval = setInterval(updateCodes, 1000);
    return () => clearInterval(interval);
  }, [isOpen, entries]);

  if (!isOpen) return null;

  const filtered = entries.filter((e) => {
    const q = searchQuery.toLowerCase();
    return e.issuer.toLowerCase().includes(q) || e.name.toLowerCase().includes(q);
  });

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    if (soundEnabled) sounds.playCopySuccess();
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      id="system-tray-widget-overlay"
      className="fixed bottom-3 right-3 z-50 flex flex-col items-end animate-fadeIn"
    >
      {/* Floating Mini Window */}
      <div className="w-72 bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md mb-2 flex flex-col max-h-96">
        {/* Tray Header */}
        <div className="px-3 py-2 bg-[#141418] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100">
              <Shield className="w-3 h-3 text-zinc-300" />
            </div>
            <span className="font-bold text-xs text-zinc-100">VoTP Quick Tray</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onLock}
              title="Lock Vault"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
            >
              <Lock className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onRestoreWindow}
              title="Restore VoTP Window"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Quick Search */}
        <div className="p-2 border-b border-zinc-800 bg-zinc-950">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search 2FA keys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-7 pr-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        {/* Mini Accounts List */}
        <div className="p-1.5 overflow-y-auto space-y-1 flex-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-400">No matching accounts</div>
          ) : (
            filtered.map((item) => {
              const live = liveCodes[item.id] || { code: '------', secs: 30 };
              const isCopied = copiedId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleCopy(item.id, live.code)}
                  className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="min-w-0 pr-1.5">
                    <div className="font-bold text-xs text-zinc-200 truncate">{item.issuer}</div>
                    <div className="text-[9px] text-zinc-400 font-mono truncate">{item.name}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono font-bold text-xs text-zinc-100">
                      {formatOtpDisplay(live.code)}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1 rounded ${
                        live.secs <= 5
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                      }`}
                    >
                      {live.secs}s
                    </span>
                    {isCopied ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-zinc-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Tray Footer */}
        <div className="p-1.5 bg-[#141418] border-t border-zinc-800 text-center">
          <button
            type="button"
            onClick={onRestoreWindow}
            className="w-full py-1 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
            Restore VoTP Main Window
          </button>
        </div>
      </div>
    </div>
  );
};
