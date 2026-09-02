export type AlgorithmType = 'SHA1' | 'SHA256' | 'SHA512';
export type OtpType = 'TOTP' | 'HOTP';

export type CategoryType = 'All' | 'Work' | 'Personal' | 'Finance' | 'Cloud' | 'Social' | 'Other';

export interface TotpEntry {
  id: string;
  name: string; // Account identifier, e.g. "user@example.com"
  issuer: string; // e.g. "Google", "GitHub", "Cloudflare"
  secret: string; // Base32 encoded secret key
  algorithm: AlgorithmType;
  digits: 6 | 8;
  period: number; // in seconds (usually 30)
  counter?: number; // for HOTP
  type: OtpType;
  category: CategoryType;
  isFavorite: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

export interface UserAuth {
  isSetup: boolean;
  email: string;
  pinHash: string; // PBKDF2 hash of user's 6-digit PIN
  saltHex: string;
  provider: 'email' | 'google' | 'linkedin' | 'facebook';
  displayName: string;
  avatarUrl?: string;
  createdAt: number;
  lastLoginAt: number;
}

export interface AppSettings {
  autoLockMinutes: number; // 1, 2, 5, 10, 15, 30, 0 = never
  antiKeyloggerRandomized: boolean; // Randomize numpad button positions
  soundEffects: boolean;
  theme: 'dark-navy' | 'windows-dark' | 'amoled-black';
  viewMode: 'tablet7' | 'mobile' | 'desktop';
  copyTimeoutSeconds: number; // auto-clear clipboard (default 30)
  githubRepoUrl: string;
  showSecretKeys: boolean;
  lastBackupDate?: string;
}

export interface CloudBackupState {
  provider: 'onedrive' | 'gdrive';
  isConnected: boolean;
  accountEmail: string | null;
  lastBackupTimestamp: number | null;
  backupFileName: string | null;
  autoSync: boolean;
  lastStatus: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

export interface MigrationOtpParameter {
  secret: Uint8Array;
  name: string;
  issuer: string;
  algorithm: number; // 1=SHA1, 2=SHA256, 3=SHA512, 4=MD5
  digits: number; // 1=6 digits, 2=8 digits
  type: number; // 1=HOTP, 2=TOTP
  counter: number;
}

export interface MigrationPayload {
  otpParameters: MigrationOtpParameter[];
  version: number;
  batchSize: number;
  batchIndex: number;
  batchId: number;
}

export interface EncryptedBackupFile {
  app: 'VoTP';
  version: string;
  exportedAt: string;
  iterations: number;
  salt: string; // hex
  iv: string; // hex
  ciphertext: string; // base64
  checksum: string; // SHA-256 hex
}

export interface GitHubReleaseInfo {
  version: string;
  publishedAt: string;
  htmlUrl: string;
  releaseNotes: string;
  hasUpdate: boolean;
  isChecking: boolean;
  lastChecked: number;
  commitHash: string;
}
