import { AlgorithmType, OtpType, TotpEntry } from '../types/otp';
import { bytesToBase32, base32ToBytes } from './crypto';

// Protobuf wire types
const WIRE_VARINT = 0;
const WIRE_LENGTH_DELIMITED = 2;

/**
 * Binary reader for Protobuf streams
 */
class ProtoReader {
  private buffer: Uint8Array;
  private pos: number = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
  }

  get isEOF(): boolean {
    return this.pos >= this.buffer.length;
  }

  readVarint(): number {
    let result = 0;
    let shift = 0;
    while (this.pos < this.buffer.length) {
      const byte = this.buffer[this.pos++];
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) {
        return result;
      }
      shift += 7;
      if (shift > 35) {
        throw new Error('Varint is too large');
      }
    }
    throw new Error('Unexpected EOF while reading varint');
  }

  readBytes(length: number): Uint8Array {
    if (this.pos + length > this.buffer.length) {
      throw new Error('Unexpected EOF while reading bytes');
    }
    const bytes = this.buffer.slice(this.pos, this.pos + length);
    this.pos += length;
    return bytes;
  }

  readString(length: number): string {
    const bytes = this.readBytes(length);
    return new TextDecoder().decode(bytes);
  }

  skip(wireType: number) {
    if (wireType === WIRE_VARINT) {
      this.readVarint();
    } else if (wireType === WIRE_LENGTH_DELIMITED) {
      const len = this.readVarint();
      this.readBytes(len);
    } else if (wireType === 1) {
      // 64-bit
      this.readBytes(8);
    } else if (wireType === 5) {
      // 32-bit
      this.readBytes(4);
    } else {
      throw new Error(`Unsupported wire type: ${wireType}`);
    }
  }
}

/**
 * Binary writer for Protobuf streams
 */
class ProtoWriter {
  private chunks: number[] = [];

  writeVarint(val: number) {
    let value = Math.floor(val);
    while (value > 0x7f) {
      this.chunks.push((value & 0x7f) | 0x80);
      value >>>= 7;
    }
    this.chunks.push(value & 0x7f);
  }

  writeTag(fieldNumber: number, wireType: number) {
    this.writeVarint((fieldNumber << 3) | wireType);
  }

  writeBytes(fieldNumber: number, bytes: Uint8Array) {
    this.writeTag(fieldNumber, WIRE_LENGTH_DELIMITED);
    this.writeVarint(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      this.chunks.push(bytes[i]);
    }
  }

  writeString(fieldNumber: number, str: string) {
    const enc = new TextEncoder();
    const bytes = enc.encode(str);
    this.writeBytes(fieldNumber, bytes);
  }

  writeVarintField(fieldNumber: number, value: number) {
    this.writeTag(fieldNumber, WIRE_VARINT);
    this.writeVarint(value);
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

/**
 * Parse single OtpParameters protobuf message
 */
function parseOtpParameters(bytes: Uint8Array): Partial<TotpEntry> | null {
  const reader = new ProtoReader(bytes);
  let secretBytes: Uint8Array | null = null;
  let name = '';
  let issuer = '';
  let algorithmNum = 1; // 1=SHA1, 2=SHA256, 3=SHA512
  let digitsNum = 1; // 1=6 digits, 2=8 digits
  let typeNum = 2; // 1=HOTP, 2=TOTP
  let counter = 0;

  while (!reader.isEOF) {
    const tag = reader.readVarint();
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x07;

    switch (fieldNumber) {
      case 1: { // secret (bytes)
        const len = reader.readVarint();
        secretBytes = reader.readBytes(len);
        break;
      }
      case 2: { // name (string)
        const len = reader.readVarint();
        name = reader.readString(len);
        break;
      }
      case 3: { // issuer (string)
        const len = reader.readVarint();
        issuer = reader.readString(len);
        break;
      }
      case 4: { // algorithm (enum)
        algorithmNum = reader.readVarint();
        break;
      }
      case 5: { // digits (enum)
        digitsNum = reader.readVarint();
        break;
      }
      case 6: { // type (enum)
        typeNum = reader.readVarint();
        break;
      }
      case 7: { // counter (int64)
        counter = reader.readVarint();
        break;
      }
      default:
        reader.skip(wireType);
    }
  }

  if (!secretBytes || secretBytes.length === 0) {
    return null;
  }

  const secretBase32 = bytesToBase32(secretBytes);

  let algorithm: AlgorithmType = 'SHA1';
  if (algorithmNum === 2) algorithm = 'SHA256';
  else if (algorithmNum === 3) algorithm = 'SHA512';

  const digits: 6 | 8 = digitsNum === 2 ? 8 : 6;
  const type: OtpType = typeNum === 1 ? 'HOTP' : 'TOTP';

  // If issuer is empty, check if name contains "Issuer:Account"
  let cleanName = name;
  let cleanIssuer = issuer;
  if (!cleanIssuer && name.includes(':')) {
    const parts = name.split(':');
    cleanIssuer = parts[0].trim();
    cleanName = parts.slice(1).join(':').trim();
  } else if (cleanIssuer && cleanName.startsWith(cleanIssuer + ':')) {
    cleanName = cleanName.substring(cleanIssuer.length + 1).trim();
  }

  return {
    name: cleanName || 'Unnamed Account',
    issuer: cleanIssuer || 'General',
    secret: secretBase32,
    algorithm,
    digits,
    period: 30,
    counter,
    type,
    category: determineCategory(cleanIssuer || cleanName),
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Determine default category based on issuer name
 */
export function determineCategory(issuer: string): TotpEntry['category'] {
  const lower = (issuer || '').toLowerCase();
  if (
    lower.includes('google') ||
    lower.includes('microsoft') ||
    lower.includes('aws') ||
    lower.includes('azure') ||
    lower.includes('cloudflare') ||
    lower.includes('digitalocean') ||
    lower.includes('vercel')
  ) {
    return 'Cloud';
  }
  if (
    lower.includes('github') ||
    lower.includes('gitlab') ||
    lower.includes('jira') ||
    lower.includes('slack') ||
    lower.includes('work') ||
    lower.includes('atlassian') ||
    lower.includes('corporate')
  ) {
    return 'Work';
  }
  if (
    lower.includes('binance') ||
    lower.includes('coinbase') ||
    lower.includes('kraken') ||
    lower.includes('bank') ||
    lower.includes('paypal') ||
    lower.includes('stripe') ||
    lower.includes('crypto')
  ) {
    return 'Finance';
  }
  if (
    lower.includes('facebook') ||
    lower.includes('twitter') ||
    lower.includes('x.com') ||
    lower.includes('linkedin') ||
    lower.includes('discord') ||
    lower.includes('instagram') ||
    lower.includes('reddit')
  ) {
    return 'Social';
  }
  return 'Personal';
}

/**
 * Parse Google Authenticator otpauth-migration:// URI
 */
export function parseMigrationUri(uri: string): TotpEntry[] {
  let url: URL;
  try {
    url = new URL(uri.trim());
  } catch {
    throw new Error('Invalid URI structure');
  }

  if (url.protocol !== 'otpauth-migration:') {
    throw new Error('Not an otpauth-migration protocol URI');
  }

  const dataParam = url.searchParams.get('data');
  if (!dataParam) {
    throw new Error('Missing "data" parameter in migration URI');
  }

  // Decode URL safe Base64
  let base64 = dataParam.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  const binaryString = atob(base64);
  const buffer = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i);
  }

  const reader = new ProtoReader(buffer);
  const entries: TotpEntry[] = [];

  while (!reader.isEOF) {
    const tag = reader.readVarint();
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x07;

    if (fieldNumber === 1 && wireType === WIRE_LENGTH_DELIMITED) {
      // otp_parameters repeated message
      const len = reader.readVarint();
      const paramBytes = reader.readBytes(len);
      const parsed = parseOtpParameters(paramBytes);
      if (parsed && parsed.secret) {
        entries.push({
          id: 'totp_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
          name: parsed.name || 'Account',
          issuer: parsed.issuer || 'General',
          secret: parsed.secret,
          algorithm: parsed.algorithm || 'SHA1',
          digits: parsed.digits || 6,
          period: parsed.period || 30,
          counter: parsed.counter || 0,
          type: parsed.type || 'TOTP',
          category: parsed.category || 'Personal',
          isFavorite: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    } else {
      reader.skip(wireType);
    }
  }

  return entries;
}

/**
 * Generate Google Authenticator compatible otpauth-migration:// URI
 */
export function createMigrationUri(entries: TotpEntry[]): string {
  const rootWriter = new ProtoWriter();

  for (const entry of entries) {
    const paramWriter = new ProtoWriter();

    // 1. Secret (bytes)
    const secretBytes = base32ToBytes(entry.secret);
    paramWriter.writeBytes(1, secretBytes);

    // 2. Name
    const fullName = entry.issuer ? `${entry.issuer}:${entry.name}` : entry.name;
    paramWriter.writeString(2, fullName);

    // 3. Issuer
    if (entry.issuer) {
      paramWriter.writeString(3, entry.issuer);
    }

    // 4. Algorithm (1=SHA1, 2=SHA256, 3=SHA512)
    let algoNum = 1;
    if (entry.algorithm === 'SHA256') algoNum = 2;
    else if (entry.algorithm === 'SHA512') algoNum = 3;
    paramWriter.writeVarintField(4, algoNum);

    // 5. Digits (1=6 digits, 2=8 digits)
    paramWriter.writeVarintField(5, entry.digits === 8 ? 2 : 1);

    // 6. Type (1=HOTP, 2=TOTP)
    paramWriter.writeVarintField(6, entry.type === 'HOTP' ? 1 : 2);

    // 7. Counter
    if (entry.counter) {
      paramWriter.writeVarintField(7, entry.counter);
    }

    const paramBytes = paramWriter.getBytes();
    rootWriter.writeBytes(1, paramBytes);
  }

  // Version 1
  rootWriter.writeVarintField(2, 1);
  // Batch size 1
  rootWriter.writeVarintField(3, 1);
  // Batch index 0
  rootWriter.writeVarintField(4, 0);
  // Batch ID
  rootWriter.writeVarintField(5, Math.floor(Math.random() * 100000));

  const rootBytes = rootWriter.getBytes();
  let binary = '';
  for (let i = 0; i < rootBytes.length; i++) {
    binary += String.fromCharCode(rootBytes[i]);
  }
  const base64 = btoa(binary);

  return `otpauth-migration://offline?data=${encodeURIComponent(base64)}`;
}

/**
 * Parse standard otpauth://totp/... or otpauth://hotp/... URI
 */
export function parseOtpauthUri(uri: string): Partial<TotpEntry> {
  const url = new URL(uri.trim());
  if (url.protocol !== 'otpauth:') {
    throw new Error('Not an otpauth URI');
  }

  const type: OtpType = url.hostname.toLowerCase() === 'hotp' ? 'HOTP' : 'TOTP';
  let path = decodeURIComponent(url.pathname).replace(/^\//, '');

  let issuer = url.searchParams.get('issuer') || '';
  let name = path;

  if (path.includes(':')) {
    const parts = path.split(':');
    if (!issuer) issuer = parts[0].trim();
    name = parts.slice(1).join(':').trim();
  }

  const secret = url.searchParams.get('secret') || '';
  if (!secret) {
    throw new Error('Missing secret parameter');
  }

  const algorithmRaw = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase();
  let algorithm: AlgorithmType = 'SHA1';
  if (algorithmRaw === 'SHA256') algorithm = 'SHA256';
  if (algorithmRaw === 'SHA512') algorithm = 'SHA512';

  const digitsParam = parseInt(url.searchParams.get('digits') || '6', 10);
  const digits: 6 | 8 = digitsParam === 8 ? 8 : 6;

  const period = parseInt(url.searchParams.get('period') || '30', 10);
  const counter = parseInt(url.searchParams.get('counter') || '0', 10);

  return {
    name: name || 'Account',
    issuer: issuer || 'General',
    secret,
    algorithm,
    digits,
    period,
    counter,
    type,
    category: determineCategory(issuer || name),
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create standard otpauth://totp/ URI
 */
export function createOtpauthUri(entry: TotpEntry): string {
  const typeStr = entry.type === 'HOTP' ? 'hotp' : 'totp';
  const label = encodeURIComponent(
    entry.issuer ? `${entry.issuer}:${entry.name}` : entry.name
  );
  const params = new URLSearchParams();
  params.set('secret', entry.secret);
  if (entry.issuer) {
    params.set('issuer', entry.issuer);
  }
  if (entry.algorithm !== 'SHA1') {
    params.set('algorithm', entry.algorithm);
  }
  if (entry.digits !== 6) {
    params.set('digits', entry.digits.toString());
  }
  if (entry.type === 'TOTP' && entry.period !== 30) {
    params.set('period', entry.period.toString());
  }
  if (entry.type === 'HOTP' && entry.counter !== undefined) {
    params.set('counter', entry.counter.toString());
  }

  return `otpauth://${typeStr}/${label}?${params.toString()}`;
}
