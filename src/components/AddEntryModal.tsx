import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Key,
  QrCode,
  Link2,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
} from 'lucide-react';
import jsQR from 'jsqr';
import { AlgorithmType, CategoryType, OtpType, TotpEntry } from '../types/otp';
import { isValidBase32Secret, sounds } from '../utils/crypto';
import { parseOtpauthUri, parseMigrationUri, determineCategory } from '../utils/protobufMigration';

interface AddEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEntry: (entry: TotpEntry) => void;
  onAddBatchEntries: (entries: TotpEntry[]) => void;
  soundEnabled?: boolean;
}

type AddTab = 'manual' | 'qr_scan' | 'paste_uri';

export const AddEntryModal: React.FC<AddEntryModalProps> = ({
  isOpen,
  onClose,
  onAddEntry,
  onAddBatchEntries,
  soundEnabled = true,
}) => {
  const [activeTab, setActiveTab] = useState<AddTab>('manual');

  // Manual Form State
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

  // QR Camera State
  const [isScanningCamera, setIsScanningCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanAnimationId = useRef<number | null>(null);

  // Paste URI State
  const [uriInput, setUriInput] = useState<string>('');

  // Reset fields when opening modal
  useEffect(() => {
    if (isOpen) {
      setIssuer('');
      setName('');
      setSecret('');
      setAlgorithm('SHA1');
      setDigits(6);
      setPeriod(30);
      setType('TOTP');
      setCategory('All');
      setNotes('');
      setErrorMessage('');
      setUriInput('');
      setCameraError('');
      setIsScanningCamera(false);
    } else {
      stopCamera();
    }
  }, [isOpen]);

  const stopCamera = () => {
    if (scanAnimationId.current) {
      cancelAnimationFrame(scanAnimationId.current);
      scanAnimationId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanningCamera(false);
  };

  // Process decoded QR text string (either otpauth:// or otpauth-migration://)
  const processDecodedQr = (rawText: string) => {
    try {
      const trimmed = rawText.trim();
      if (trimmed.startsWith('otpauth-migration:')) {
        const batch = parseMigrationUri(trimmed);
        if (batch.length === 0) {
          throw new Error('No valid TOTP accounts found in migration payload');
        }
        if (soundEnabled) sounds.playCopySuccess();
        onAddBatchEntries(batch);
        onClose();
        return;
      }

      if (trimmed.startsWith('otpauth:')) {
        const parsed = parseOtpauthUri(trimmed);
        if (!parsed.secret) {
          throw new Error('QR code missing secret key');
        }
        const newEntry: TotpEntry = {
          id: 'totp_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          name: parsed.name || 'Account',
          issuer: parsed.issuer || 'General',
          secret: parsed.secret.replace(/\s+/g, '').toUpperCase(),
          algorithm: parsed.algorithm || 'SHA1',
          digits: parsed.digits || 6,
          period: parsed.period || 30,
          type: parsed.type || 'TOTP',
          category: parsed.category || 'Personal',
          isFavorite: false,
          notes: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        if (soundEnabled) sounds.playCopySuccess();
        onAddEntry(newEntry);
        onClose();
        return;
      }

      // If plain secret key string
      if (isValidBase32Secret(trimmed)) {
        setSecret(trimmed.toUpperCase());
        setActiveTab('manual');
        setErrorMessage('');
        return;
      }

      throw new Error('Unrecognized QR format. Must be otpauth:// or Google Authenticator export.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse QR code';
      setErrorMessage(msg);
    }
  };

  // Live Camera Scan Loop
  const startCamera = async () => {
    setCameraError('');
    setIsScanningCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        scanAnimationId.current = requestAnimationFrame(scanTick);
      }
    } catch (err: unknown) {
      setCameraError('Unable to access camera. Please allow camera permissions or upload an image file.');
      setIsScanningCamera(false);
    }
  };

  const scanTick = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code && code.data) {
          stopCamera();
          processDecodedQr(code.data);
          return;
        }
      }
    }
    scanAnimationId.current = requestAnimationFrame(scanTick);
  };

  // QR Image File Upload / Drag & Drop
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    decodeImageFile(file);
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    decodeImageFile(file);
  };

  const decodeImageFile = (file: File) => {
    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            processDecodedQr(code.data);
          } else {
            setErrorMessage('No valid QR code detected in the uploaded image. Please try another image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Manual Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanSecret = secret.replace(/[\s\-=]/g, '').toUpperCase();
    if (!cleanSecret) {
      setErrorMessage('Secret key is required.');
      return;
    }

    if (!isValidBase32Secret(cleanSecret)) {
      setErrorMessage('Invalid Base32 secret key format. Only A-Z and 2-7 are allowed.');
      return;
    }

    const finalIssuer = issuer.trim() || 'General';
    const finalCategory = category === 'All' ? determineCategory(finalIssuer) : category;

    const newEntry: TotpEntry = {
      id: 'totp_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      name: name.trim() || 'Account',
      issuer: finalIssuer,
      secret: cleanSecret,
      algorithm,
      digits,
      period,
      type,
      category: finalCategory,
      isFavorite: false,
      notes: notes.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (soundEnabled) sounds.playCopySuccess();
    onAddEntry(newEntry);
    onClose();
  };

  // Paste URI Submit
  const handleUriSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uriInput.trim()) {
      setErrorMessage('Please paste an otpauth:// or otpauth-migration:// URI.');
      return;
    }
    processDecodedQr(uriInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-add-entry"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-fadeIn"
    >
      <div className="w-full max-w-lg bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-[#141418]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
              <Key className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-100">Add 2FA Key</h2>
              <p className="text-[10px] text-zinc-400">Manual entry, QR scan, or URI import</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add entry dialog"
            className="w-7 h-7 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1.5 bg-[#09090b] border-b border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab('manual');
              setErrorMessage('');
            }}
            className={`py-1.5 px-2.5 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'manual'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Manual Entry
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('qr_scan');
              setErrorMessage('');
            }}
            className={`py-1.5 px-2.5 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'qr_scan'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Scan QR Code
          </button>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab('paste_uri');
              setErrorMessage('');
            }}
            className={`py-1.5 px-2.5 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'paste_uri'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Paste URI
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 mb-3 flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: MANUAL ENTRY */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Issuer / Service <span className="text-zinc-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Google, Cloudflare"
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Account Name / Email
                  </label>
                  <input
                    type="text"
                    placeholder="user@example.com"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Secret Key (Base32) <span className="text-zinc-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JBSWY3DPEHPK3PXP"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-500 uppercase tracking-wide focus:outline-none focus:border-zinc-500"
                />
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Spaces and dashes will be automatically stripped.
                </p>
              </div>

              {/* Advanced Settings Grid */}
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
                    <option value="SHA1">SHA-1 (Default)</option>
                    <option value="SHA256">SHA-256</option>
                    <option value="SHA512">SHA-512</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                    Digits
                  </label>
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
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                    Period
                  </label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(parseInt(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-500"
                  >
                    <option value={30}>30s (Default)</option>
                    <option value={60}>60s</option>
                  </select>
                </div>
              </div>

              {/* Category & Notes */}
              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                    Category Tag
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CategoryType)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="All">Auto-Detect</option>
                    <option value="Work">Work</option>
                    <option value="Personal">Personal</option>
                    <option value="Cloud">Cloud & Infra</option>
                    <option value="Finance">Finance / Crypto</option>
                    <option value="Social">Social</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                    Optional Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Master Backup Key"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
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
                  Save 2FA Key to Vault
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: QR SCANNER / FILE UPLOAD */}
          {activeTab === 'qr_scan' && (
            <div className="space-y-3">
              {/* Dropzone for QR Image File */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropFile}
                className="w-full border border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl p-5 flex flex-col items-center justify-center bg-zinc-950 transition-colors cursor-pointer group"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="qr-file-input"
                />
                <label
                  htmlFor="qr-file-input"
                  className="flex flex-col items-center justify-center cursor-pointer w-full h-full"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-200">
                    Click to browse or Drag & Drop QR Image
                  </span>
                  <span className="text-[10px] text-zinc-400 mt-0.5 text-center">
                    Supports PNG, JPG, WebP screenshots and Google Authenticator export QR images
                  </span>
                </label>
              </div>

              {/* Live WebCam Scanner Option */}
              <div className="border-t border-zinc-800 pt-3">
                {!isScanningCamera ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 border border-zinc-800 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-zinc-400" />
                    Open Live Camera Scanner
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="relative w-full max-w-xs aspect-square bg-black rounded-lg overflow-hidden border border-zinc-700 shadow-md">
                      <video ref={videoRef} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 border-2 border-cyan-400 m-6 rounded pointer-events-none animate-pulse" />
                    </div>
                    {cameraError && (
                      <p className="text-xs text-rose-400 text-center">{cameraError}</p>
                    )}
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-md transition-colors cursor-pointer"
                    >
                      Stop Camera
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PASTE URI */}
          {activeTab === 'paste_uri' && (
            <form onSubmit={handleUriSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Paste Migration or OTP URI
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. otpauth://totp/Google:user@gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=Google or otpauth-migration://offline?data=..."
                  value={uriInput}
                  onChange={(e) => setUriInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-[11px] text-zinc-400 flex items-start gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <span>
                  Paste either a single standard <code className="text-zinc-200">otpauth://</code> URI, or a Google Authenticator <code className="text-zinc-200">otpauth-migration://</code> batch URI to import all accounts in 1-click.
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Parse and Import URI
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
