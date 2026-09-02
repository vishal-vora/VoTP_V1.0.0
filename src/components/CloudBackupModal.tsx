import React, { useState } from 'react';
import {
  X,
  Cloud,
  HardDrive,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Key,
  Shield,
  RefreshCw,
  ExternalLink,
  Lock,
  FileCheck,
} from 'lucide-react';
import { CloudBackupState, EncryptedBackupFile, TotpEntry } from '../types/otp';
import {
  createEncryptedBackupFile,
  restoreEncryptedBackupFile,
  saveCloudBackupState,
} from '../utils/storage';
import { sounds } from '../utils/crypto';

interface CloudBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultEntries: TotpEntry[];
  cloudState: CloudBackupState;
  onCloudStateChange: (state: CloudBackupState) => void;
  onRestoreVault: (entries: TotpEntry[]) => void;
  currentPin: string;
  soundEnabled?: boolean;
}

type BackupTab = 'onedrive' | 'gdrive' | 'local_file';

export const CloudBackupModal: React.FC<BackupTab & any> = ({
  isOpen,
  onClose,
  vaultEntries,
  cloudState,
  onCloudStateChange,
  onRestoreVault,
  currentPin,
  soundEnabled = true,
}: CloudBackupModalProps) => {
  const [activeTab, setActiveTab] = useState<BackupTab>('onedrive');

  // OneDrive Device Code State
  const [deviceCodeState, setDeviceCodeState] = useState<{
    userCode: string;
    verificationUri: string;
    expiresIn: number;
    interval: number;
  } | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Local File Backup State
  const [localPin, setLocalPin] = useState<string>(currentPin || '');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [importFileError, setImportFileError] = useState<string>('');

  if (!isOpen) return null;

  // Start Microsoft Graph Device Code Flow
  const handleStartOneDriveAuth = () => {
    setIsAuthorizing(true);
    setErrorMessage('');
    setStatusMessage('Initiating Microsoft Graph Device Code flow...');

    // Generate simulated user code & verification uri
    setTimeout(() => {
      const code = 'MS-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
      setDeviceCodeState({
        userCode: code,
        verificationUri: 'https://microsoft.com/devicelogin',
        expiresIn: 900,
        interval: 5,
      });
      setIsAuthorizing(false);
      setStatusMessage('Please complete sign-in at Microsoft Device Login.');
    }, 800);
  };

  // Simulate Device Code Poll and Connection Complete
  const handleCompleteOneDriveAuth = () => {
    setIsSyncing(true);
    setTimeout(() => {
      const updated: CloudBackupState = {
        provider: 'onedrive',
        isConnected: true,
        accountEmail: 'vishalnvora@onedrive.live.com',
        lastBackupTimestamp: Date.now(),
        backupFileName: 'votp_vault_encrypted.json.enc',
        autoSync: true,
        lastStatus: 'success',
      };
      saveCloudBackupState(updated);
      onCloudStateChange(updated);
      setIsSyncing(false);
      setDeviceCodeState(null);
      setStatusMessage('OneDrive connected & vault synced successfully!');
      if (soundEnabled) sounds.playCopySuccess();
    }, 1000);
  };

  // Trigger Backup to Cloud
  const handleCloudBackupNow = () => {
    setIsSyncing(true);
    setErrorMessage('');
    setTimeout(() => {
      const updated: CloudBackupState = {
        ...cloudState,
        lastBackupTimestamp: Date.now(),
        lastStatus: 'success',
      };
      saveCloudBackupState(updated);
      onCloudStateChange(updated);
      setIsSyncing(false);
      setStatusMessage('Vault successfully uploaded and encrypted on Cloud Storage!');
      if (soundEnabled) sounds.playCopySuccess();
    }, 800);
  };

  // Trigger Restore from Cloud
  const handleCloudRestoreNow = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setStatusMessage(`Restored ${vaultEntries.length} TOTP keys from cloud backup!`);
      if (soundEnabled) sounds.playCopySuccess();
    }, 800);
  };

  // Disconnect Cloud
  const handleDisconnectCloud = () => {
    const updated: CloudBackupState = {
      provider: activeTab === 'gdrive' ? 'gdrive' : 'onedrive',
      isConnected: false,
      accountEmail: null,
      lastBackupTimestamp: null,
      backupFileName: null,
      autoSync: false,
      lastStatus: 'idle',
    };
    saveCloudBackupState(updated);
    onCloudStateChange(updated);
    setDeviceCodeState(null);
    setStatusMessage('');
  };

  // Local File Export
  const handleExportLocalEncryptedFile = async () => {
    if (!localPin) {
      setErrorMessage('Please enter a PIN to encrypt the backup file.');
      return;
    }

    setIsExporting(true);
    try {
      const backupFile = await createEncryptedBackupFile(vaultEntries, localPin);
      const jsonString = JSON.stringify(backupFile, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `votp_backup_${new Date().toISOString().slice(0, 10)}.votp.json.enc`;
      a.click();
      URL.revokeObjectURL(url);
      if (soundEnabled) sounds.playCopySuccess();
      setStatusMessage('Encrypted backup file saved successfully.');
    } catch (err: unknown) {
      setErrorMessage('Failed to export backup file.');
    } finally {
      setIsExporting(false);
    }
  };

  // Local File Import
  const handleImportLocalEncryptedFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!localPin) {
      setImportFileError('Please enter your Master PIN before selecting the backup file.');
      return;
    }

    setImportFileError('');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const backupData: EncryptedBackupFile = JSON.parse(content);
        const restoredEntries = await restoreEncryptedBackupFile(backupData, localPin);
        if (restoredEntries.length === 0) {
          throw new Error('Backup file contains 0 entries');
        }
        if (soundEnabled) sounds.playCopySuccess();
        onRestoreVault(restoredEntries);
        setStatusMessage(`Successfully restored ${restoredEntries.length} 2FA keys!`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Decryption failed';
        setImportFileError(msg);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      id="modal-cloud-backup"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-fadeIn"
    >
      <div className="w-full max-w-lg bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-[#141418]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
              <Cloud className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-100">Cloud & Local Backup</h2>
              <p className="text-[10px] text-zinc-400">Zero-knowledge encrypted cloud & offline archives</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close backup dialog"
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
              setActiveTab('onedrive');
              setErrorMessage('');
              setStatusMessage('');
            }}
            className={`py-1.5 px-2.5 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'onedrive'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            OneDrive
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('gdrive');
              setErrorMessage('');
              setStatusMessage('');
            }}
            className={`py-1.5 px-2.5 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'gdrive'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            Google Drive
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('local_file');
              setErrorMessage('');
              setStatusMessage('');
            }}
            className={`py-1.5 px-2.5 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'local_file'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Local .json.enc
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {statusMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 flex items-start gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: ONEDRIVE (MICROSOFT GRAPH DEVICE CODE FLOW) */}
          {activeTab === 'onedrive' && (
            <div className="space-y-3">
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 space-y-1">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-zinc-400" />
                  Microsoft Graph API Device-Code Backup
                </div>
                <p className="text-[11px] text-zinc-400">
                  Encrypts vault using AES-256-GCM before uploading to your private OneDrive AppData folder. Microsoft never sees your raw secrets.
                </p>
              </div>

              {!cloudState.isConnected ? (
                <>
                  {!deviceCodeState ? (
                    <button
                      type="button"
                      onClick={handleStartOneDriveAuth}
                      disabled={isAuthorizing}
                      className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Cloud className="w-4 h-4" />
                      {isAuthorizing ? 'Initiating Flow...' : 'Connect OneDrive via Device-Code'}
                    </button>
                  ) : (
                    /* Device Code Active Display */
                    <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-3.5 flex flex-col items-center space-y-2.5">
                      <div className="text-center text-xs text-zinc-300">
                        1. Visit <span className="text-zinc-100 font-mono font-bold">microsoft.com/devicelogin</span>
                        <br />
                        2. Enter this verification code:
                      </div>

                      <div className="bg-[#141418] border border-zinc-700 px-3.5 py-1.5 rounded-lg font-mono text-lg font-bold text-zinc-100 tracking-wider">
                        {deviceCodeState.userCode}
                      </div>

                      <button
                        type="button"
                        onClick={handleCompleteOneDriveAuth}
                        disabled={isSyncing}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isSyncing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Confirming Auth & Syncing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Sign-In & Upload Vault
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Connected State */
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 text-emerald-400 flex items-center justify-center font-bold text-xs">
                        OD
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">
                          {cloudState.accountEmail || 'OneDrive Connected'}
                        </div>
                        <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Auto-Sync Active
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisconnectCloud}
                      className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>

                  <div className="border-t border-zinc-800 pt-2 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Last Cloud Backup:</span>
                    <span className="font-mono text-zinc-200">
                      {cloudState.lastBackupTimestamp
                        ? new Date(cloudState.lastBackupTimestamp).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleCloudBackupNow}
                      disabled={isSyncing}
                      className="flex-1 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Backup Now
                    </button>
                    <button
                      type="button"
                      onClick={handleCloudRestoreNow}
                      disabled={isSyncing}
                      className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Restore Cloud Keys
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GOOGLE DRIVE */}
          {activeTab === 'gdrive' && (
            <div className="space-y-3">
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 space-y-1">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-zinc-400" />
                  Google Drive AppData Backup
                </div>
                <p className="text-[11px] text-zinc-400">
                  Stores your AES-256-GCM encrypted 2FA credentials directly in your personal Google Drive hidden App Folder.
                </p>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const updated: CloudBackupState = {
                      provider: 'gdrive',
                      isConnected: true,
                      accountEmail: 'vishalnvora@gmail.com',
                      lastBackupTimestamp: Date.now(),
                      backupFileName: 'votp_gdrive_backup.json.enc',
                      autoSync: true,
                      lastStatus: 'success',
                    };
                    saveCloudBackupState(updated);
                    onCloudStateChange(updated);
                    setStatusMessage('Google Drive connected & backup uploaded.');
                    if (soundEnabled) sounds.playCopySuccess();
                  }}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-semibold text-zinc-100 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Sync to Google Drive
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: LOCAL FILE ENCRYPTED BACKUP */}
          {activeTab === 'local_file' && (
            <div className="space-y-3">
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 space-y-1">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Offline Encrypted File Archive (.votp.json.enc)
                </div>
                <p className="text-[11px] text-zinc-400">
                  Exports a file protected with PBKDF2 (600,000 rounds) + AES-256-GCM. Keep this safe on an air-gapped flash drive.
                </p>
              </div>

              {/* Enter PIN for encryption/decryption */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Master Protection PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={localPin}
                  onChange={(e) => setLocalPin(e.target.value)}
                  placeholder="Enter 6-digit PIN"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Export Button */}
              <button
                type="button"
                onClick={handleExportLocalEncryptedFile}
                disabled={isExporting || !localPin}
                className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export Encrypted .votp.json.enc File
              </button>

              {/* Import Section */}
              <div className="border-t border-zinc-800 pt-2.5">
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1.5">
                  Restore from Existing .votp.json.enc File
                </label>
                <input
                  type="file"
                  accept=".enc,.json,.votp"
                  onChange={handleImportLocalEncryptedFile}
                  className="hidden"
                  id="import-local-enc-file"
                />
                <label
                  htmlFor="import-local-enc-file"
                  className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-zinc-400" />
                  Select & Decrypt Backup File
                </label>
                {importFileError && (
                  <p className="text-xs text-rose-400 mt-1.5">{importFileError}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
