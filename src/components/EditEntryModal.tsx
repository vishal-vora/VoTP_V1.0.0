import React, { useState, useEffect } from 'react';
import { X, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { AlgorithmType, CategoryType, OtpType, TotpEntry } from '../types/otp';
import { isValidBase32Secret, sounds } from '../utils/crypto';

interface EditEntryModalProps {
  entry: TotpEntry | null;
  onClose: () => void;
  onSave: (updated: TotpEntry) => void;
  soundEnabled?: boolean;
}

export const EditEntryModal: React.FC<EditEntryModalProps> = ({
  entry,
  onClose,
  onSave,
  soundEnabled = true,
}) => {
  const [issuer, setIssuer] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('SHA1');
  const [digits, setDigits] = useState<6 | 8>(6);
  const [period, setPeriod] = useState<number>(30);
  const [type, setType] = useState<OtpType>('TOTP');
  const [category, setCategory] = useState<CategoryType>('All');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (entry) {
      setIssuer(entry.issuer);
      setName(entry.name);
      setSecret(entry.secret);
      setAlgorithm(entry.algorithm);
      setDigits(entry.digits);
      setPeriod(entry.period);
      setType(entry.type);
      setCategory(entry.category);
      setNotes(entry.notes || '');
      setErrorMessage('');
    }
  }, [entry]);

  if (!entry) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanSecret = secret.replace(/[\s\-=]/g, '').toUpperCase();
    if (!cleanSecret) {
      setErrorMessage('Secret key cannot be empty.');
      return;
    }

    if (!isValidBase32Secret(cleanSecret)) {
      setErrorMessage('Invalid Base32 secret key format.');
      return;
    }

    const updated: TotpEntry = {
      ...entry,
      issuer: issuer.trim() || 'General',
      name: name.trim() || 'Account',
      secret: cleanSecret,
      algorithm,
      digits,
      period,
      type,
      category,
      notes: notes.trim(),
      updatedAt: Date.now(),
    };

    if (soundEnabled) sounds.playCopySuccess();
    onSave(updated);
    onClose();
  };

  return (
    <div
      id="modal-edit-entry"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-fadeIn"
    >
      <div className="w-full max-w-md bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-[#141418]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
              <Edit2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-100">Edit 2FA Account</h2>
              <p className="text-[10px] text-zinc-400">Update configuration for {entry.issuer}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit dialog"
            className="w-7 h-7 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 flex items-start gap-2 text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Issuer / Service</label>
              <input
                type="text"
                required
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Account / Email</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Base32 Secret Key</label>
            <input
              type="text"
              required
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-100 uppercase focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-0.5">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Algorithm
              </label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                <option value="SHA1">SHA-1</option>
                <option value="SHA256">SHA-256</option>
                <option value="SHA512">SHA-512</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Digits</label>
              <select
                value={digits}
                onChange={(e) => setDigits(parseInt(e.target.value) as 6 | 8)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                <option value={6}>6 Digits</option>
                <option value={8}>8 Digits</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(parseInt(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-0.5">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                <option value="All">General</option>
                <option value="Work">Work</option>
                <option value="Personal">Personal</option>
                <option value="Cloud">Cloud & Infra</option>
                <option value="Finance">Finance</option>
                <option value="Social">Social</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional description"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
