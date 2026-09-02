import React from 'react';
import {
  X,
  Shield,
  ExternalLink,
  Code2,
  Heart,
  Award,
  Layers,
  Lock,
  Cpu,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMigrationSuite?: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  onOpenMigrationSuite,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="modal-about-votp"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-fadeIn"
    >
      <div className="w-full max-w-lg bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-[#141418]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-100">About VoTP Authenticator</h2>
              <p className="text-[10px] text-zinc-400">Windows & Server Thick Client 2FA Engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close about dialog"
            className="w-7 h-7 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3 text-xs">
          {/* Main Hero Card */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 mb-2">
              <Shield className="w-5 h-5 text-zinc-200" />
            </div>
            <h3 className="font-bold text-base text-zinc-100">VoTP — Virtual OTP</h3>
            <p className="text-zinc-400 font-medium text-xs mt-0.5">
              Powered by Autoenginiea Private Limited
            </p>
            <p className="text-zinc-400 text-[11px] mt-1.5 max-w-sm">
              An enterprise-grade, offline-first TOTP 2FA authenticator designed for Windows 10/11 and Windows Server environments with zero cloud telemetry requirements.
            </p>
          </div>

          {/* Key Specifications Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
              <span className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider">
                Contributor / Author
              </span>
              <div className="font-bold text-zinc-200 text-xs mt-0.5 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                Vishal Vora
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
              <span className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider">
                License
              </span>
              <div className="font-bold text-emerald-400 text-xs mt-0.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                AGPLv3 OpenSource
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
              <span className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider">
                Encryption Engine
              </span>
              <div className="font-mono text-zinc-200 font-bold text-[11px] mt-0.5 flex items-center gap-1">
                <Lock className="w-3 h-3 text-zinc-400" />
                AES-256-GCM / PBKDF2 600K
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
              <span className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider">
                Target Platform
              </span>
              <div className="font-bold text-zinc-200 text-xs mt-0.5 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-zinc-400" />
                Windows 10/11 & Servers
              </div>
            </div>
          </div>

          {/* GitHub Repository Link */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="font-bold text-zinc-200 text-xs flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-zinc-400" />
                Official GitHub Repository
              </div>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                https://github.com/vishal-vora/VoTP/
              </div>
            </div>
            <a
              href="https://github.com/vishal-vora/VoTP/"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-xs rounded-md flex items-center gap-1 transition-colors"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Feature Architecture Checklist */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-1.5">
            <span className="font-bold text-zinc-200 text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Verified Core Implementations
            </span>
            <ul className="space-y-1 text-[11px] text-zinc-400">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                Anti-Keylogger scrambled on-screen numpad for secure PIN entry
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                Official Google Authenticator <code className="text-zinc-300">otpauth-migration://</code> Protobuf import & export
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                Microsoft Graph API device-code OneDrive & Google Drive backup
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                Inactivity auto-lock timer with 7" Tablet and Mobile sizer
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
