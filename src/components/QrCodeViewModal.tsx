import React, { useEffect, useState } from 'react';
import { X, QrCode, Copy, Check, Download, Shield } from 'lucide-react';
import QRCode from 'qrcode';
import { TotpEntry } from '../types/otp';
import { createOtpauthUri } from '../utils/protobufMigration';
import { sounds } from '../utils/crypto';

interface QrCodeViewModalProps {
  entry: TotpEntry | null;
  onClose: () => void;
  soundEnabled?: boolean;
}

export const QrCodeViewModal: React.FC<QrCodeViewModalProps> = ({
  entry,
  onClose,
  soundEnabled = true,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [otpUri, setOtpUri] = useState<string>('');
  const [isCopiedUri, setIsCopiedUri] = useState<boolean>(false);
  const [isCopiedSecret, setIsCopiedSecret] = useState<boolean>(false);

  useEffect(() => {
    if (entry) {
      const uri = createOtpauthUri(entry);
      setOtpUri(uri);
      QRCode.toDataURL(uri, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#f8fafc',
        },
      }).then((dataUrl) => {
        setQrDataUrl(dataUrl);
      });
    } else {
      setQrDataUrl('');
      setOtpUri('');
    }
  }, [entry]);

  if (!entry) return null;

  const handleCopyUri = () => {
    navigator.clipboard.writeText(otpUri);
    setIsCopiedUri(true);
    if (soundEnabled) sounds.playCopySuccess();
    setTimeout(() => setIsCopiedUri(false), 2000);
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(entry.secret);
    setIsCopiedSecret(true);
    if (soundEnabled) sounds.playCopySuccess();
    setTimeout(() => setIsCopiedSecret(false), 2000);
  };

  return (
    <div
      id="modal-qr-view"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-fadeIn"
    >
      <div className="w-full max-w-sm bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-[#141418]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
              <QrCode className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-100 truncate max-w-[190px]">
                {entry.issuer} 2FA QR
              </h2>
              <p className="text-[10px] text-zinc-400 truncate max-w-[190px]">{entry.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR view dialog"
            className="w-7 h-7 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col items-center space-y-3">
          {/* QR Code Canvas */}
          {qrDataUrl && (
            <div className="p-2.5 bg-white rounded-xl shadow-md border border-zinc-700 flex flex-col items-center">
              <img src={qrDataUrl} alt="2FA QR Code" className="w-48 h-48 object-contain" />
              <div className="text-[10px] text-zinc-700 font-mono font-medium mt-1">
                Scan with any Authenticator app
              </div>
            </div>
          )}

          {/* Secret Key Display */}
          <div className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 flex items-center justify-between text-xs">
            <div className="min-w-0 pr-2">
              <div className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Base32 Secret</div>
              <div className="font-mono text-zinc-100 font-bold text-xs truncate">{entry.secret}</div>
            </div>
            <button
              type="button"
              onClick={handleCopySecret}
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 rounded-md text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              {isCopiedSecret ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {isCopiedSecret ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Actions */}
          <div className="w-full flex gap-2">
            <button
              type="button"
              onClick={handleCopyUri}
              className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isCopiedUri ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {isCopiedUri ? 'Copied URI' : 'Copy URI'}
            </button>

            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`${entry.issuer}_2fa_qr.png`}
                className="flex-1 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Save PNG
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
