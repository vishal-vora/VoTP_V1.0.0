import { AppSettings, CloudBackupState, EncryptedBackupFile, TotpEntry, UserAuth } from '../types/otp';
import { computeSha256, decryptData, deriveKeyAndHash, encryptData, hexToBytes } from './crypto';

const STORAGE_KEYS = {
  USER_AUTH: 'votp_user_auth_v1',
  ENCRYPTED_VAULT: 'votp_encrypted_vault_v1',
  APP_SETTINGS: 'votp_settings_v1',
  CLOUD_BACKUP: 'votp_cloud_backup_v1',
  SQLITE_SCHEMA_SIM: 'votp_sqlite_meta_v1',
};

export const DEFAULT_SETTINGS: AppSettings = {
  autoLockMinutes: 5,
  antiKeyloggerRandomized: true,
  soundEffects: true,
  theme: 'windows-dark',
  viewMode: 'tablet7',
  copyTimeoutSeconds: 30,
  githubRepoUrl: 'https://github.com/vishal-vora/VoTP',
  showSecretKeys: false,
};

export const INITIAL_DEMO_ENTRIES: TotpEntry[] = [
  {
    id: 'totp_demo_google_1',
    name: 'vishalnvora@gmail.com',
    issuer: 'Google',
    secret: 'JBSWY3DPEHPK3PXP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    type: 'TOTP',
    category: 'Cloud',
    isFavorite: true,
    notes: 'Primary Google Work & Personal SSO',
    createdAt: Date.now() - 86400000 * 14,
    updatedAt: Date.now() - 86400000 * 14,
  },
  {
    id: 'totp_demo_cloudflare_2',
    name: 'admin@autoenginiea.com',
    issuer: 'Cloudflare',
    secret: 'KZXW6YTBOJUW4ZZK',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    type: 'TOTP',
    category: 'Cloud',
    isFavorite: true,
    notes: 'DNS & Edge Security Gateway',
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 10,
  },
  {
    id: 'totp_demo_github_3',
    name: 'vishal-vora',
    issuer: 'GitHub',
    secret: 'NBSWY3DPEHPK3PXP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    type: 'TOTP',
    category: 'Work',
    isFavorite: true,
    notes: 'VoTP OpenSource Codebase 2FA',
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'totp_demo_aws_4',
    name: 'root-account@autoenginiea.com',
    issuer: 'AWS',
    secret: 'MFXGKYTCGB2W4ZLS',
    algorithm: 'SHA256',
    digits: 6,
    period: 30,
    type: 'TOTP',
    category: 'Cloud',
    isFavorite: false,
    notes: 'Cloud Infrastructure Console',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'totp_demo_microsoft_5',
    name: 'vishal.vora@outlook.com',
    issuer: 'Microsoft',
    secret: 'MZXW6YTBOJUW4ZZK',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    type: 'TOTP',
    category: 'Personal',
    isFavorite: false,
    notes: 'OneDrive & Windows Live Login',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 3,
  },
];

/**
 * Load user auth state
 */
export function loadUserAuth(): UserAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_AUTH);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save user auth state
 */
export function saveUserAuth(user: UserAuth): void {
  localStorage.setItem(STORAGE_KEYS.USER_AUTH, JSON.stringify(user));
}

/**
 * Load App settings
 */
export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save App settings
 */
export function saveAppSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(settings));
}

/**
 * Load Cloud Backup state
 */
export function loadCloudBackupState(): CloudBackupState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLOUD_BACKUP);
    if (!raw) {
      return {
        provider: 'onedrive',
        isConnected: false,
        accountEmail: null,
        lastBackupTimestamp: null,
        backupFileName: 'votp_vault_backup.json.enc',
        autoSync: true,
        lastStatus: 'idle',
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      provider: 'onedrive',
      isConnected: false,
      accountEmail: null,
      lastBackupTimestamp: null,
      backupFileName: 'votp_vault_backup.json.enc',
      autoSync: true,
      lastStatus: 'idle',
    };
  }
}

/**
 * Save Cloud Backup state
 */
export function saveCloudBackupState(state: CloudBackupState): void {
  localStorage.setItem(STORAGE_KEYS.CLOUD_BACKUP, JSON.stringify(state));
}

/**
 * Save vault entries encrypted with AES-256-GCM using active session CryptoKey
 */
export async function saveVaultEncrypted(
  entries: TotpEntry[],
  sessionKey: CryptoKey
): Promise<void> {
  const json = JSON.stringify(entries);
  const encrypted = await encryptData(json, sessionKey);
  localStorage.setItem(STORAGE_KEYS.ENCRYPTED_VAULT, JSON.stringify(encrypted));
}

/**
 * Load vault entries decrypted with active session CryptoKey
 */
export async function loadVaultDecrypted(sessionKey: CryptoKey): Promise<TotpEntry[]> {
  const raw = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_VAULT);
  if (!raw) {
    return [];
  }

  const { iv, ciphertext } = JSON.parse(raw);
  const decryptedJson = await decryptData(ciphertext, iv, sessionKey);
  return JSON.parse(decryptedJson);
}

/**
 * Export full vault as encrypted .votp.json.enc backup file
 */
export async function createEncryptedBackupFile(
  entries: TotpEntry[],
  pin: string
): Promise<EncryptedBackupFile> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { key } = await deriveKeyAndHash(pin, salt);
  const json = JSON.stringify({
    entries,
    exportedAt: new Date().toISOString(),
    generator: 'VoTP - Autoenginiea Private Limited',
  });

  const { iv, ciphertext } = await encryptData(json, key);
  const checksum = await computeSha256(ciphertext);

  return {
    app: 'VoTP',
    version: '1.2.0',
    exportedAt: new Date().toISOString(),
    iterations: 600000,
    salt: Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join(''),
    iv,
    ciphertext,
    checksum,
  };
}

/**
 * Import encrypted .votp.json.enc backup file using user PIN
 */
export async function restoreEncryptedBackupFile(
  backup: EncryptedBackupFile,
  pin: string
): Promise<TotpEntry[]> {
  if (backup.app !== 'VoTP') {
    throw new Error('Invalid backup file format: App signature mismatch');
  }

  // Verify SHA-256 Checksum
  const computedChecksum = await computeSha256(backup.ciphertext);
  if (computedChecksum !== backup.checksum) {
    throw new Error('Backup integrity verification failed: Checksum mismatch');
  }

  const saltBytes = hexToBytes(backup.salt);
  const { key } = await deriveKeyAndHash(pin, saltBytes);

  try {
    const decryptedJson = await decryptData(backup.ciphertext, backup.iv, key);
    const parsed = JSON.parse(decryptedJson);
    return parsed.entries || [];
  } catch {
    throw new Error('Decryption failed. Incorrect PIN or corrupted backup payload.');
  }
}

/**
 * SQLite Simulation Inspector Helper
 * Returns structured tables representing the SQLite database ~/.votp/votp.db
 */
export function getSqliteDatabaseSnapshot(): {
  databasePath: string;
  tables: { name: string; rowCount: number; schema: string; rows: Record<string, unknown>[] }[];
} {
  const auth = loadUserAuth();
  const rawEncryptedVault = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_VAULT);
  const settings = loadAppSettings();
  const cloud = loadCloudBackupState();

  return {
    databasePath: '~/.votp/votp.db (AES-256-GCM encrypted at rest)',
    tables: [
      {
        name: 'tbl_users',
        rowCount: auth ? 1 : 0,
        schema: 'CREATE TABLE tbl_users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, pin_hash TEXT, salt_hex TEXT, provider TEXT, created_at INTEGER, last_login_at INTEGER);',
        rows: auth
          ? [
              {
                id: 1,
                email: auth.email,
                pin_hash: auth.pinHash.substring(0, 16) + '...[REDACTED_600K_PBKDF2]',
                salt_hex: auth.saltHex,
                provider: auth.provider,
                created_at: auth.createdAt,
                last_login_at: auth.lastLoginAt,
              },
            ]
          : [],
      },
      {
        name: 'tbl_vault_secrets',
        rowCount: rawEncryptedVault ? 1 : 0,
        schema: 'CREATE TABLE tbl_vault_secrets (id INTEGER PRIMARY KEY, iv_hex TEXT, ciphertext_blob TEXT, updated_at INTEGER, encryption_standard TEXT);',
        rows: rawEncryptedVault
          ? [
              {
                id: 1,
                iv_hex: JSON.parse(rawEncryptedVault).iv,
                ciphertext_blob: JSON.parse(rawEncryptedVault).ciphertext.substring(0, 32) + '...[AES-256-GCM]',
                updated_at: Date.now(),
                encryption_standard: 'AES-256-GCM / PBKDF2-SHA256 (600,000 iterations)',
              },
            ]
          : [],
      },
      {
        name: 'tbl_app_settings',
        rowCount: 1,
        schema: 'CREATE TABLE tbl_app_settings (key TEXT PRIMARY KEY, value_json TEXT);',
        rows: Object.entries(settings).map(([k, v]) => ({ key: k, value_json: JSON.stringify(v) })),
      },
      {
        name: 'tbl_cloud_backup_sync',
        rowCount: 1,
        schema: 'CREATE TABLE tbl_cloud_backup_sync (provider TEXT, account_email TEXT, last_sync_time INTEGER, status TEXT);',
        rows: [
          {
            provider: cloud.provider,
            account_email: cloud.accountEmail || 'none',
            last_sync_time: cloud.lastBackupTimestamp || 'never',
            status: cloud.lastStatus,
          },
        ],
      },
    ],
  };
}
