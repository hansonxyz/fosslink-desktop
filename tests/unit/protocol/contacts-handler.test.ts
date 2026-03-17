import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ContactsHandler, parseVcard, detectImageFormat } from '../../../src/protocol/standard/contacts-handler.js';
import type { PhoneEntry, EmailEntry, AddressEntry } from '../../../src/protocol/standard/contacts-handler.js';
import { DatabaseService } from '../../../src/database/database.js';
import type { ProtocolMessage } from '../../../src/network/packet.js';
import type { DeviceConnection } from '../../../src/network/ws-server.js';
import { initializeLogger, resetLogger } from '../../../src/utils/logger.js';

function createMockConnection(): DeviceConnection {
  return {
    deviceId: 'test-device-id-12345678901234567890',
    deviceName: 'Test Phone',
    ws: {} as any,
    connected: true,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as DeviceConnection;
}

describe('detectImageFormat', () => {
  it('should detect JPEG from magic bytes', () => {
    // JPEG starts with FF D8 FF
    const jpegBase64 = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00]).toString('base64');
    const result = detectImageFormat(jpegBase64);
    expect(result.ext).toBe('jpg');
    expect(result.mime).toBe('image/jpeg');
  });

  it('should detect PNG from magic bytes', () => {
    // PNG starts with 89 50 4E 47
    const pngBase64 = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D]).toString('base64');
    const result = detectImageFormat(pngBase64);
    expect(result.ext).toBe('png');
    expect(result.mime).toBe('image/png');
  });

  it('should default to JPEG for unknown format', () => {
    const unknownBase64 = Buffer.from([0x00, 0x01, 0x02, 0x03]).toString('base64');
    const result = detectImageFormat(unknownBase64);
    expect(result.ext).toBe('jpg');
    expect(result.mime).toBe('image/jpeg');
  });

  it('should default to JPEG for empty data', () => {
    const result = detectImageFormat('');
    expect(result.ext).toBe('jpg');
    expect(result.mime).toBe('image/jpeg');
  });
});

describe('parseVcard', () => {
  it('should extract name from FN line', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:John Doe\nEND:VCARD');
    expect(result.name).toBe('John Doe');
  });

  it('should extract phone numbers with types', () => {
    const result = parseVcard(
      'BEGIN:VCARD\nFN:Jane\nTEL;TYPE=CELL:+15551234567\nTEL;TYPE=HOME:+15559876543\nEND:VCARD',
    );
    expect(result.phoneNumbers).toEqual([
      { number: '+15551234567', type: 'cell' },
      { number: '+15559876543', type: 'home' },
    ]);
  });

  it('should default phone type to "other" when no TYPE specified', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:Test\nTEL:+15551111111\nEND:VCARD');
    expect(result.phoneNumbers).toEqual([{ number: '+15551111111', type: 'other' }]);
  });

  it('should return empty name for vCard without FN', () => {
    const result = parseVcard('BEGIN:VCARD\nTEL:+15551234567\nEND:VCARD');
    expect(result.name).toBe('');
  });

  it('should return empty phone numbers for vCard without TEL', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:No Phone\nEND:VCARD');
    expect(result.phoneNumbers).toEqual([]);
  });

  it('should handle Windows-style line endings', () => {
    const result = parseVcard('BEGIN:VCARD\r\nFN:Windows User\r\nTEL:+15551234567\r\nEND:VCARD');
    expect(result.name).toBe('Windows User');
    expect(result.phoneNumbers).toEqual([{ number: '+15551234567', type: 'other' }]);
  });

  it('should handle multiple phone types', () => {
    const vcard = [
      'BEGIN:VCARD',
      'FN:Multi Phone',
      'TEL;TYPE=CELL:+15551111111',
      'TEL;TYPE=WORK:+15552222222',
      'TEL;TYPE=HOME;TYPE=VOICE:+15553333333',
      'END:VCARD',
    ].join('\n');

    const result = parseVcard(vcard);
    expect(result.phoneNumbers).toHaveLength(3);
    expect(result.phoneNumbers[0]).toEqual({ number: '+15551111111', type: 'cell' });
    expect(result.phoneNumbers[1]).toEqual({ number: '+15552222222', type: 'work' });
    expect(result.phoneNumbers[2]).toEqual({ number: '+15553333333', type: 'home' });
  });

  it('should handle empty vCard', () => {
    const result = parseVcard('');
    expect(result.name).toBe('');
    expect(result.phoneNumbers).toEqual([]);
    expect(result.photo).toBeNull();
    expect(result.emails).toEqual([]);
    expect(result.addresses).toEqual([]);
    expect(result.organization).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.birthday).toBeNull();
    expect(result.nickname).toBeNull();
    expect(result.accountType).toBeNull();
    expect(result.accountName).toBeNull();
  });

  it('should extract PHOTO base64 data', () => {
    const vcard = 'BEGIN:VCARD\nFN:Photo Contact\nTEL:+15551234567\nPHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRg==\nEND:VCARD';
    const result = parseVcard(vcard);
    expect(result.name).toBe('Photo Contact');
    expect(result.photo).toBe('/9j/4AAQSkZJRg==');
  });

  it('should handle vCard line folding (continuation lines)', () => {
    const vcard = 'BEGIN:VCARD\nFN:Folded\nPHOTO;ENCODING=b;TYPE=JPEG:AAAA\n BBBB\n CCCC\nTEL:+15551234567\nEND:VCARD';
    const result = parseVcard(vcard);
    expect(result.photo).toBe('AAAABBBBCCCC');
    expect(result.phoneNumbers).toEqual([{ number: '+15551234567', type: 'other' }]);
  });

  it('should return null photo when no PHOTO line', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:No Photo\nTEL:+15551234567\nEND:VCARD');
    expect(result.photo).toBeNull();
  });

  // --- Email parsing ---

  it('should extract emails with types', () => {
    const vcard = [
      'BEGIN:VCARD',
      'FN:Email Person',
      'EMAIL;TYPE=HOME:home@example.com',
      'EMAIL;TYPE=WORK:work@example.com',
      'END:VCARD',
    ].join('\n');

    const result = parseVcard(vcard);
    expect(result.emails).toEqual([
      { address: 'home@example.com', type: 'home' },
      { address: 'work@example.com', type: 'work' },
    ]);
  });

  it('should default email type to "other"', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:Test\nEMAIL:test@example.com\nEND:VCARD');
    expect(result.emails).toEqual([{ address: 'test@example.com', type: 'other' }]);
  });

  // --- Address parsing ---

  it('should parse ADR fields into formatted addresses', () => {
    const vcard = [
      'BEGIN:VCARD',
      'FN:Address Person',
      'ADR;TYPE=HOME:;;123 Main St;Springfield;IL;62701;US',
      'END:VCARD',
    ].join('\n');

    const result = parseVcard(vcard);
    expect(result.addresses).toHaveLength(1);
    expect(result.addresses[0]!.type).toBe('home');
    expect(result.addresses[0]!.formatted).toContain('123 Main St');
    expect(result.addresses[0]!.formatted).toContain('Springfield');
  });

  it('should skip empty ADR parts', () => {
    const vcard = 'BEGIN:VCARD\nFN:Test\nADR;TYPE=WORK:;;Office Park;;;;\nEND:VCARD';
    const result = parseVcard(vcard);
    expect(result.addresses).toHaveLength(1);
    expect(result.addresses[0]!.formatted).toBe('Office Park');
  });

  // --- Organization ---

  it('should extract ORG field', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:Test\nORG:Acme Corp\nEND:VCARD');
    expect(result.organization).toBe('Acme Corp');
  });

  it('should join ORG parts with comma', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:Test\nORG:Acme Corp;Engineering\nEND:VCARD');
    expect(result.organization).toBe('Acme Corp, Engineering');
  });

  // --- Notes ---

  it('should extract NOTE field', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:Test\nNOTE:Important person\nEND:VCARD');
    expect(result.notes).toBe('Important person');
  });

  // --- Birthday ---

  it('should extract BDAY in YYYYMMDD format', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:Test\nBDAY:19900115\nEND:VCARD');
    expect(result.birthday).toBe('1990-01-15');
  });

  it('should pass through BDAY in YYYY-MM-DD format', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:Test\nBDAY:1990-01-15\nEND:VCARD');
    expect(result.birthday).toBe('1990-01-15');
  });

  // --- Nickname ---

  it('should extract NICKNAME field', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:Robert\nNICKNAME:Bob\nEND:VCARD');
    expect(result.nickname).toBe('Bob');
  });

  // --- Account info (custom X- extensions) ---

  it('should extract X-ACCOUNT-TYPE', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:Test\nX-ACCOUNT-TYPE:com.google\nEND:VCARD');
    expect(result.accountType).toBe('com.google');
  });

  it('should extract X-ACCOUNT-NAME', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:Test\nX-ACCOUNT-NAME:user@gmail.com\nEND:VCARD');
    expect(result.accountName).toBe('user@gmail.com');
  });

  // --- Return null for missing optional fields ---

  it('should return null for all optional fields when not present', () => {
    const result = parseVcard('BEGIN:VCARD\nFN:Minimal\nTEL:+15551234567\nEND:VCARD');
    expect(result.emails).toEqual([]);
    expect(result.addresses).toEqual([]);
    expect(result.organization).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.birthday).toBeNull();
    expect(result.nickname).toBeNull();
    expect(result.accountType).toBeNull();
    expect(result.accountName).toBeNull();
  });

  // --- Full vCard with all fields ---

  it('should parse a complete vCard with all fields', () => {
    const vcard = [
      'BEGIN:VCARD',
      'FN:John Doe',
      'TEL;TYPE=CELL:+15551234567',
      'TEL;TYPE=HOME:+15559876543',
      'EMAIL;TYPE=WORK:john@work.com',
      'ADR;TYPE=HOME:;;123 Main St;Springfield;IL;62701;US',
      'ORG:Acme Corp;Engineering',
      'NOTE:VIP contact',
      'BDAY:19850315',
      'NICKNAME:Johnny',
      'X-ACCOUNT-TYPE:com.google',
      'X-ACCOUNT-NAME:john@gmail.com',
      'PHOTO;ENCODING=b;TYPE=JPEG:dGVzdA==',
      'END:VCARD',
    ].join('\n');

    const result = parseVcard(vcard);
    expect(result.name).toBe('John Doe');
    expect(result.phoneNumbers).toHaveLength(2);
    expect(result.phoneNumbers[0]).toEqual({ number: '+15551234567', type: 'cell' });
    expect(result.emails).toEqual([{ address: 'john@work.com', type: 'work' }]);
    expect(result.addresses).toHaveLength(1);
    expect(result.organization).toBe('Acme Corp, Engineering');
    expect(result.notes).toBe('VIP contact');
    expect(result.birthday).toBe('1985-03-15');
    expect(result.nickname).toBe('Johnny');
    expect(result.accountType).toBe('com.google');
    expect(result.accountName).toBe('john@gmail.com');
    expect(result.photo).toBe('dGVzdA==');
  });
});

describe('ContactsHandler', () => {
  let tmpDir: string;
  let contactPhotosDir: string;
  let db: DatabaseService;
  let connection: DeviceConnection;
  let handler: ContactsHandler;

  beforeEach(() => {
    initializeLogger({ level: 'error', pretty: false });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contacts-handler-test-'));
    contactPhotosDir = path.join(tmpDir, 'contact-photos');
    db = new DatabaseService(path.join(tmpDir, 'test.db'));
    db.open();
    connection = createMockConnection();

    handler = new ContactsHandler({
      db,
      getConnection: () => connection,
      contactPhotosDir,
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resetLogger();
  });

  describe('handleUidsResponse', () => {
    it('should parse UIDs in array format', () => {
      let receivedUids: string[] = [];
      handler.onUidsReceived((uids) => { receivedUids = uids; });

      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_uids_timestamps',
        body: { uids: ['uid1', 'uid2', 'uid3'] },
      };

      handler.handleUidsResponse(packet, connection);
      expect(receivedUids).toEqual(['uid1', 'uid2', 'uid3']);
    });

    it('should parse UIDs in object format (uid: timestamp)', () => {
      let receivedUids: string[] = [];
      handler.onUidsReceived((uids) => { receivedUids = uids; });

      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_uids_timestamps',
        body: { 'uid1': 1700000000, 'uid2': 1700000001 },
      };

      handler.handleUidsResponse(packet, connection);
      expect(receivedUids).toContain('uid1');
      expect(receivedUids).toContain('uid2');
    });

    it('should automatically request vCards after receiving UIDs', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_uids_timestamps',
        body: { uids: ['uid1', 'uid2'] },
      };

      handler.handleUidsResponse(packet, connection);

      expect(connection.send).toHaveBeenCalledTimes(1);
      expect(connection.send).toHaveBeenCalledWith('fosslink.contacts.request_photo', expect.objectContaining({ uids: ['uid1', 'uid2'] }));
    });

    it('should not request vCards when no UIDs', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_uids_timestamps',
        body: { uids: [] },
      };

      handler.handleUidsResponse(packet, connection);
      expect(connection.send).not.toHaveBeenCalled();
    });
  });

  describe('handleVcardsResponse', () => {
    it('should parse vCards and persist contacts', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: {
          'uid1': 'BEGIN:VCARD\nFN:John Doe\nTEL:+15551234567\nEND:VCARD',
          'uid2': 'BEGIN:VCARD\nFN:Jane Smith\nTEL:+15559876543\nEND:VCARD',
          'uids': ['uid1', 'uid2'],
        },
      };

      handler.handleVcardsResponse(packet, connection);

      expect(db.getContactCount()).toBe(2);
      const john = db.getContact('uid1');
      expect(john).toBeDefined();
      expect(john!.name).toBe('John Doe');
      const phones = JSON.parse(john!.phone_numbers) as PhoneEntry[];
      expect(phones).toEqual([{ number: '+15551234567', type: 'other' }]);
    });

    it('should skip contacts with no name', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: {
          'uid1': 'BEGIN:VCARD\nTEL:+15551234567\nEND:VCARD',
          'uids': ['uid1'],
        },
      };

      handler.handleVcardsResponse(packet, connection);
      expect(db.getContactCount()).toBe(0);
    });

    it('should skip the "uids" key', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: {
          'uid1': 'BEGIN:VCARD\nFN:Test\nTEL:+1555\nEND:VCARD',
          'uids': ['uid1'],
        },
      };

      handler.handleVcardsResponse(packet, connection);
      expect(db.getContactCount()).toBe(1);
      expect(db.getContact('uids')).toBeUndefined();
    });

    it('should handle contact with multiple phone numbers and types', () => {
      const vcard = 'BEGIN:VCARD\nFN:Multi Phone\nTEL;TYPE=CELL:+15551111111\nTEL;TYPE=HOME:+15552222222\nEND:VCARD';
      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: { 'uid1': vcard },
      };

      handler.handleVcardsResponse(packet, connection);

      const contact = db.getContact('uid1');
      expect(contact).toBeDefined();
      const numbers = JSON.parse(contact!.phone_numbers) as PhoneEntry[];
      expect(numbers).toHaveLength(2);
      expect(numbers[0]).toEqual({ number: '+15551111111', type: 'cell' });
      expect(numbers[1]).toEqual({ number: '+15552222222', type: 'home' });
    });

    it('should fire onContactsUpdated callback', () => {
      let receivedCount = 0;
      handler.onContactsUpdated((contacts) => { receivedCount = contacts.length; });

      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: {
          'uid1': 'BEGIN:VCARD\nFN:Test\nTEL:+1555\nEND:VCARD',
        },
      };

      handler.handleVcardsResponse(packet, connection);
      expect(receivedCount).toBe(1);
    });

    it('should update existing contacts', () => {
      const packet1: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: { 'uid1': 'BEGIN:VCARD\nFN:Old Name\nTEL:+1555\nEND:VCARD' },
      };
      handler.handleVcardsResponse(packet1, connection);
      expect(db.getContact('uid1')!.name).toBe('Old Name');

      const packet2: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: { 'uid1': 'BEGIN:VCARD\nFN:New Name\nTEL:+1555\nEND:VCARD' },
      };
      handler.handleVcardsResponse(packet2, connection);
      expect(db.getContact('uid1')!.name).toBe('New Name');
    });

    it('should write photo to disk and store photo_path and photo_mime', () => {
      // Real JPEG magic bytes + some padding
      const jpegBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      const jpegBase64 = jpegBytes.toString('base64');
      const vcard = `BEGIN:VCARD\nFN:Photo Person\nTEL:+15551234567\nPHOTO;ENCODING=b;TYPE=JPEG:${jpegBase64}\nEND:VCARD`;
      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: { 'uid1': vcard },
      };

      handler.handleVcardsResponse(packet, connection);

      const contact = db.getContact('uid1');
      expect(contact).toBeDefined();
      expect(contact!.photo_path).toBe('uid1.jpg');
      expect(contact!.photo_mime).toBe('image/jpeg');

      // Verify file exists on disk
      const filePath = path.join(contactPhotosDir, 'uid1.jpg');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath)).toEqual(jpegBytes);
    });

    it('should write PNG photo to disk with correct extension', () => {
      const pngBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const pngBase64 = pngBytes.toString('base64');
      const vcard = `BEGIN:VCARD\nFN:PNG Person\nTEL:+15551234567\nPHOTO;ENCODING=b;TYPE=PNG:${pngBase64}\nEND:VCARD`;
      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: { 'uid1': vcard },
      };

      handler.handleVcardsResponse(packet, connection);

      const contact = db.getContact('uid1');
      expect(contact!.photo_path).toBe('uid1.png');
      expect(contact!.photo_mime).toBe('image/png');

      const filePath = path.join(contactPhotosDir, 'uid1.png');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should store null photo_path for contacts without PHOTO line', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: {
          'uid1': 'BEGIN:VCARD\nFN:No Photo\nTEL:+15551234567\nEND:VCARD',
        },
      };
      handler.handleVcardsResponse(packet, connection);
      const contact = db.getContact('uid1');
      expect(contact).toBeDefined();
      expect(contact!.photo_path).toBeNull();
      expect(contact!.photo_mime).toBeNull();
    });

    it('should persist all extended vCard fields', () => {
      const vcard = [
        'BEGIN:VCARD',
        'FN:Full Contact',
        'TEL;TYPE=CELL:+15551234567',
        'EMAIL;TYPE=WORK:full@example.com',
        'ADR;TYPE=HOME:;;123 Main St;Springfield;IL;62701;US',
        'ORG:Acme Corp;Engineering',
        'NOTE:Important person',
        'BDAY:19900115',
        'NICKNAME:FC',
        'X-ACCOUNT-TYPE:com.google',
        'X-ACCOUNT-NAME:full@gmail.com',
        'END:VCARD',
      ].join('\n');

      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: { 'uid1': vcard },
      };

      handler.handleVcardsResponse(packet, connection);

      const contact = db.getContact('uid1');
      expect(contact).toBeDefined();
      expect(contact!.name).toBe('Full Contact');

      const phones = JSON.parse(contact!.phone_numbers) as PhoneEntry[];
      expect(phones).toEqual([{ number: '+15551234567', type: 'cell' }]);

      const emails = JSON.parse(contact!.emails!) as EmailEntry[];
      expect(emails).toEqual([{ address: 'full@example.com', type: 'work' }]);

      const addresses = JSON.parse(contact!.addresses!) as AddressEntry[];
      expect(addresses).toHaveLength(1);
      expect(addresses[0]!.type).toBe('home');

      expect(contact!.organization).toBe('Acme Corp, Engineering');
      expect(contact!.notes).toBe('Important person');
      expect(contact!.birthday).toBe('1990-01-15');
      expect(contact!.nickname).toBe('FC');
      expect(contact!.account_type).toBe('com.google');
      expect(contact!.account_name).toBe('full@gmail.com');
    });

    it('should skip non-string vCard values', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.contacts.response_vcards',
        body: {
          'uid1': 12345, // not a string
          'uid2': 'BEGIN:VCARD\nFN:Valid\nTEL:+1555\nEND:VCARD',
        },
      };

      handler.handleVcardsResponse(packet, connection);
      expect(db.getContactCount()).toBe(1);
    });
  });

  describe('outgoing requests', () => {
    it('should send requestAllUidsTimestamps packet', () => {
      handler.requestAllUidsTimestamps();
      expect(connection.send).toHaveBeenCalledTimes(1);
      expect(connection.send).toHaveBeenCalledWith('fosslink.contacts.sync', expect.any(Object));
    });

    it('should send requestVcardsByUid packet with UIDs', () => {
      handler.requestVcardsByUid(['uid1', 'uid2', 'uid3']);
      expect(connection.send).toHaveBeenCalledTimes(1);
      expect(connection.send).toHaveBeenCalledWith('fosslink.contacts.request_photo', expect.objectContaining({ uids: ['uid1', 'uid2', 'uid3'] }));
    });

    it('should not throw when not connected', () => {
      const disconnectedHandler = new ContactsHandler({
        db,
        getConnection: () => undefined,
        contactPhotosDir,
      });
      disconnectedHandler.requestAllUidsTimestamps();
      disconnectedHandler.requestVcardsByUid(['uid1']);
    });
  });
});
