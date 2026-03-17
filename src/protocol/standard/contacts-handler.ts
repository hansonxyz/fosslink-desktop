/**
 * Contacts Protocol Handler
 *
 * Two-step contact sync:
 * 1. Send request_all_uids_timestamps → receive response_uids_timestamps
 * 2. Send request_vcards_by_uid with UIDs → receive response_vcards
 *
 * The UIDs response can come in two formats:
 * - Array format: { uids: string[] }
 * - Object format: { "uid1": timestamp, "uid2": timestamp, ... }
 *
 * vCards are returned as body keys (UID → vCard string), with a "uids" key to skip.
 *
 * Contact photos are written to disk (contactPhotosDir/{uid}.{ext}) rather than
 * stored inline. Format (JPEG/PNG) is auto-detected from magic bytes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '../../utils/logger.js';
import type { Logger } from '../../utils/logger.js';
import {
  MSG_CONTACTS_SYNC,
  MSG_CONTACTS_REQUEST_PHOTO,
} from '../../network/packet.js';
import type { ProtocolMessage } from '../../network/packet.js';
import type { DeviceConnection } from '../../network/ws-server.js';
import type { DatabaseService, ContactRow } from '../../database/database.js';

// --- Exported types ---

export interface PhoneEntry {
  number: string;
  type: string;
}

export interface EmailEntry {
  address: string;
  type: string;
}

export interface AddressEntry {
  formatted: string;
  type: string;
}

export interface ParsedVcard {
  name: string;
  phoneNumbers: PhoneEntry[];
  emails: EmailEntry[];
  addresses: AddressEntry[];
  organization: string | null;
  notes: string | null;
  birthday: string | null;
  nickname: string | null;
  accountType: string | null;
  accountName: string | null;
  photo: string | null;
}

export interface ContactsHandlerOptions {
  db: DatabaseService;
  getConnection: () => DeviceConnection | undefined;
  contactPhotosDir: string;
}

type UidsReceivedCallback = (uids: string[]) => void;
type ContactsUpdatedCallback = (contacts: ContactRow[]) => void;

/**
 * Detect image format from base64-encoded data by checking magic bytes.
 * Returns { ext, mime } — defaults to JPEG for unknown formats.
 */
export function detectImageFormat(base64Data: string): { ext: string; mime: string } {
  try {
    const buf = Buffer.from(base64Data, 'base64');
    if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
      return { ext: 'jpg', mime: 'image/jpeg' };
    }
    if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      return { ext: 'png', mime: 'image/png' };
    }
  } catch {
    // Invalid base64 — fall through to default
  }
  return { ext: 'jpg', mime: 'image/jpeg' };
}

/**
 * Extract the first TYPE= value from a vCard property parameter string.
 * e.g. "TEL;TYPE=CELL:..." → "cell", "TEL;TYPE=HOME;TYPE=VOICE:..." → "home"
 * Returns "other" if no TYPE found.
 */
function extractType(propertyLine: string): string {
  const upperLine = propertyLine.toUpperCase();
  const typeMatch = /;TYPE=([^;:]+)/i.exec(upperLine);
  if (typeMatch) {
    return typeMatch[1]!.toLowerCase();
  }
  return 'other';
}

/**
 * Parse a vCard string to extract all contact fields.
 * Handles vCard line folding (RFC 6350 §3.2): continuation lines start with space/tab.
 */
export function parseVcard(vcard: string): ParsedVcard {
  // Unfold continuation lines before parsing
  const unfolded = vcard.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  let name = '';
  const phoneNumbers: PhoneEntry[] = [];
  const emails: EmailEntry[] = [];
  const addresses: AddressEntry[] = [];
  let organization: string | null = null;
  let notes: string | null = null;
  let birthday: string | null = null;
  let nickname: string | null = null;
  let accountType: string | null = null;
  let accountName: string | null = null;
  let photo: string | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (upper.startsWith('FN:')) {
      name = line.substring(3).trim();
    } else if (upper.startsWith('TEL')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const number = line.substring(colonIdx + 1).trim();
        if (number) {
          phoneNumbers.push({ number, type: extractType(line) });
        }
      }
    } else if (upper.startsWith('EMAIL')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const address = line.substring(colonIdx + 1).trim();
        if (address) {
          emails.push({ address, type: extractType(line) });
        }
      }
    } else if (upper.startsWith('ADR')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const rawValue = line.substring(colonIdx + 1);
        // ADR format: PO Box;Extended;Street;City;Region;Postal;Country
        const parts = rawValue.split(';').map((p) => p.trim()).filter(Boolean);
        if (parts.length > 0) {
          addresses.push({ formatted: parts.join(', '), type: extractType(line) });
        }
      }
    } else if (upper.startsWith('ORG:')) {
      const rawValue = line.substring(4).trim();
      if (rawValue) {
        organization = rawValue.split(';').map((p) => p.trim()).filter(Boolean).join(', ');
      }
    } else if (upper.startsWith('NOTE:')) {
      const rawValue = line.substring(5).trim();
      if (rawValue) {
        notes = rawValue;
      }
    } else if (upper.startsWith('BDAY:')) {
      let rawValue = line.substring(5).trim();
      if (rawValue) {
        // Normalize YYYYMMDD → YYYY-MM-DD
        if (/^\d{8}$/.test(rawValue)) {
          rawValue = `${rawValue.substring(0, 4)}-${rawValue.substring(4, 6)}-${rawValue.substring(6, 8)}`;
        }
        birthday = rawValue;
      }
    } else if (upper.startsWith('NICKNAME:')) {
      const rawValue = line.substring(9).trim();
      if (rawValue) {
        nickname = rawValue;
      }
    } else if (upper.startsWith('X-ACCOUNT-TYPE:')) {
      const rawValue = line.substring(15).trim();
      if (rawValue) {
        accountType = rawValue;
      }
    } else if (upper.startsWith('X-ACCOUNT-NAME:')) {
      const rawValue = line.substring(15).trim();
      if (rawValue) {
        accountName = rawValue;
      }
    } else if (upper.startsWith('PHOTO')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const data = line.substring(colonIdx + 1).trim();
        if (data) {
          photo = data;
        }
      }
    }
  }

  return {
    name,
    phoneNumbers,
    emails,
    addresses,
    organization,
    notes,
    birthday,
    nickname,
    accountType,
    accountName,
    photo,
  };
}

export class ContactsHandler {
  private db: DatabaseService;
  private getConnection: () => DeviceConnection | undefined;
  private contactPhotosDir: string;
  private logger: Logger;
  private uidsReceivedCallbacks: UidsReceivedCallback[] = [];
  private contactsUpdatedCallbacks: ContactsUpdatedCallback[] = [];

  constructor(options: ContactsHandlerOptions) {
    this.db = options.db;
    this.getConnection = options.getConnection;
    this.contactPhotosDir = options.contactPhotosDir;
    this.logger = createLogger('contacts-handler');
  }

  /**
   * Handle contacts UIDs/timestamps response.
   * Extracts UIDs and automatically requests vCards for all of them.
   */
  handleUidsResponse(packet: ProtocolMessage, _connection: DeviceConnection): void {
    const body = packet.body;
    const uids: string[] = [];

    // Format 1: { uids: string[] }
    if (Array.isArray(body['uids'])) {
      for (const uid of body['uids'] as unknown[]) {
        if (typeof uid === 'string') {
          uids.push(uid);
        }
      }
    } else {
      // Format 2: { "uid1": timestamp, "uid2": timestamp, ... }
      for (const key of Object.keys(body)) {
        if (typeof body[key] === 'number' || typeof body[key] === 'string') {
          uids.push(key);
        }
      }
    }

    this.logger.info('protocol.contacts', 'UIDs received', { count: uids.length });
    this.fireUidsReceived(uids);

    // Automatically request vCards for all UIDs
    if (uids.length > 0) {
      this.requestVcardsByUid(uids);
    }
  }

  /**
   * Handle contacts vCards response.
   * Body keys are UIDs, values are vCard strings. "uids" key is skipped.
   * Photos are written to disk at contactPhotosDir/{uid}.{ext}.
   */
  handleVcardsResponse(packet: ProtocolMessage, _connection: DeviceConnection): void {
    const body = packet.body;
    const contacts: ContactRow[] = [];

    for (const uid of Object.keys(body)) {
      if (uid === 'uids') continue;

      const vcardStr = body[uid];
      if (typeof vcardStr !== 'string') continue;

      const parsed = parseVcard(vcardStr);
      if (!parsed.name) {
        this.logger.debug('protocol.contacts', 'Skipping contact with no name', { uid });
        continue;
      }

      // Write photo to disk if present
      let photoPath: string | null = null;
      let photoMime: string | null = null;
      if (parsed.photo) {
        const { ext, mime } = detectImageFormat(parsed.photo);
        const filename = `${uid}.${ext}`;
        fs.mkdirSync(this.contactPhotosDir, { recursive: true });
        fs.writeFileSync(path.join(this.contactPhotosDir, filename), Buffer.from(parsed.photo, 'base64'));
        photoPath = filename;
        photoMime = mime;
      }

      contacts.push({
        uid,
        name: parsed.name,
        phone_numbers: JSON.stringify(parsed.phoneNumbers),
        photo_path: photoPath,
        photo_mime: photoMime,
        emails: parsed.emails.length > 0 ? JSON.stringify(parsed.emails) : null,
        addresses: parsed.addresses.length > 0 ? JSON.stringify(parsed.addresses) : null,
        organization: parsed.organization,
        notes: parsed.notes,
        birthday: parsed.birthday,
        nickname: parsed.nickname,
        account_type: parsed.accountType,
        account_name: parsed.accountName,
        timestamp: Date.now(),
      });
    }

    if (contacts.length > 0) {
      this.db.upsertContacts(contacts);
    }

    const withPhotos = contacts.filter((c) => c.photo_path !== null).length;
    this.logger.info('protocol.contacts', 'Contacts synced', { count: contacts.length, withPhotos });
    this.fireContactsUpdated(contacts);
  }

  // --- Outgoing requests ---

  requestAllUidsTimestamps(): void {
    const conn = this.getConnection();
    if (!conn) {
      this.logger.warn('protocol.contacts', 'Cannot request contacts: not connected');
      return;
    }
    conn.send(MSG_CONTACTS_SYNC, {});
    this.logger.debug('protocol.contacts', 'Requested all UIDs');
  }

  requestVcardsByUid(uids: string[]): void {
    const conn = this.getConnection();
    if (!conn) {
      this.logger.warn('protocol.contacts', 'Cannot request vCards: not connected');
      return;
    }
    conn.send(MSG_CONTACTS_REQUEST_PHOTO, { uids });
    this.logger.debug('protocol.contacts', 'Requested vCards', { count: uids.length });
  }

  // --- Callbacks ---

  onUidsReceived(cb: UidsReceivedCallback): void {
    this.uidsReceivedCallbacks.push(cb);
  }

  onContactsUpdated(cb: ContactsUpdatedCallback): void {
    this.contactsUpdatedCallbacks.push(cb);
  }

  private fireUidsReceived(uids: string[]): void {
    for (const cb of this.uidsReceivedCallbacks) {
      cb(uids);
    }
  }

  private fireContactsUpdated(contacts: ContactRow[]): void {
    for (const cb of this.contactsUpdatedCallbacks) {
      cb(contacts);
    }
  }
}
