import { AlgorithmType, TotpEntry } from '../types/otp';

// RFC 4648 Base32 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decode Base32 string into Uint8Array
 */
export function base32ToBytes(base32: string): Uint8Array {
  // Clean input: remove whitespace, dashes, padding, and convert to uppercase
  const clean = base32.replace(/[\s\-=]/g, '').toUpperCase();
  if (!clean) return new Uint8Array(0);

  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean.charAt(i);
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base32 character: "${char}"`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Encode Uint8Array into RFC 4648 Base32 string
 */
export function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Convert buffer to Hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert Hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[\s\-]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derive AES-256-GCM key and PIN hash using PBKDF2 with 600,000 iterations (OWASP standard)
 */
export async function deriveKeyAndHash(
  pin: string,
  salt: Uint8Array
): Promise<{ key: CryptoKey; pinHash: string }> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey', 'deriveBits']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const hashBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return {
    key,
    pinHash: bytesToHex(new Uint8Array(hashBits)),
  };
}

/**
 * Encrypt plaintext data using AES-256-GCM
 */
export async function encryptData(
  plaintext: string,
  key: CryptoKey
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const enc = new TextEncoder();
  const encodedData = enc.encode(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encodedData
  );

  return {
    iv: bytesToHex(iv),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
  };
}

/**
 * Decrypt ciphertext data using AES-256-GCM
 */
export async function decryptData(
  ciphertextBase64: string,
  ivHex: string,
  key: CryptoKey
): Promise<string> {
  const iv = hexToBytes(ivHex);
  const binaryString = atob(ciphertextBase64);
  const encryptedBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    encryptedBytes[i] = binaryString.charCodeAt(i);
  }

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encryptedBytes
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

/**
 * Compute SHA-256 checksum
 */
export async function computeSha256(data: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * RFC 6238 TOTP Code Generator
 */
export async function generateTotpCode(
  secretBase32: string,
  options: {
    time?: number;
    period?: number;
    digits?: number;
    algorithm?: AlgorithmType;
  } = {}
): Promise<{ code: string; secondsRemaining: number; progress: number }> {
  const period = options.period || 30;
  const digits = options.digits || 6;
  const algorithm = options.algorithm || 'SHA1';
  const now = options.time !== undefined ? options.time : Date.now();

  const epochSeconds = Math.floor(now / 1000);
  const currentStep = Math.floor(epochSeconds / period);
  const secondsRemaining = period - (epochSeconds % period);
  const progress = ((period - secondsRemaining) / period) * 100;

  // Convert secret from Base32 to raw bytes
  const keyBytes = base32ToBytes(secretBase32);

  // Map algorithm name to Web Crypto standard
  const hashName =
    algorithm === 'SHA256' ? 'SHA-256' : algorithm === 'SHA512' ? 'SHA-512' : 'SHA-1';

  // Import key for HMAC
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: hashName } },
    false,
    ['sign']
  );

  // 8-byte big-endian counter
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  // High 32 bits = 0 (valid for ~68 years from epoch step)
  counterView.setUint32(0, Math.floor(currentStep / 0x100000000), false);
  counterView.setUint32(4, currentStep & 0xffffffff, false);

  // Compute HMAC
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hashBytes = new Uint8Array(signature);

  // Dynamic Truncation (RFC 4226 Section 5.3)
  const offset = hashBytes[hashBytes.length - 1] & 0x0f;
  const binaryCode =
    ((hashBytes[offset] & 0x7f) << 24) |
    ((hashBytes[offset + 1] & 0xff) << 16) |
    ((hashBytes[offset + 2] & 0xff) << 8) |
    (hashBytes[offset + 3] & 0xff);

  const otp = binaryCode % Math.pow(10, digits);
  const formattedCode = otp.toString().padStart(digits, '0');

  return {
    code: formattedCode,
    secondsRemaining,
    progress,
  };
}

/**
 * Format 6 or 8-digit OTP with a space in middle for easy visual scanning
 */
export function formatOtpDisplay(code: string): string {
  if (code.length === 6) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }
  if (code.length === 8) {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
  }
  return code;
}

/**
 * Validate secret key in Base32 format
 */
export function isValidBase32Secret(secret: string): boolean {
  if (!secret) return false;
  const clean = secret.replace(/[\s\-=]/g, '').toUpperCase();
  if (clean.length < 4) return false;
  for (let i = 0; i < clean.length; i++) {
    if (BASE32_ALPHABET.indexOf(clean[i]) === -1) {
      return false;
    }
  }
  return true;
}

/**
 * Web Audio sound effects synthesizer
 */
class SoundEffects {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playKeypadClick() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.045);
    } catch {
      // Audio playback fails gracefully if muted
    }
  }

  playCopySuccess() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880, now + 0.08); // A5

      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(1174.66, now + 0.08); // D6

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.22);
      osc2.stop(now + 0.22);
    } catch {
      // Audio playback fails gracefully
    }
  }

  playLock() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, this.ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.095);
    } catch {
      // Audio playback fails gracefully
    }
  }
}

export const sounds = new SoundEffects();
