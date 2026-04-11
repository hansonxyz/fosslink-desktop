/**
 * Contact Sync Operation
 *
 * Queries contacts.list from phone, diffs against local DB,
 * fetches photos for new/changed contacts via contacts.photos.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { QueryClient } from '../query-client.js';
import type { DatabaseService } from '../../database/database.js';
import { getContactPhotosDir } from '../../utils/paths.js';
import { debugConsole } from '../debug-console.js';

interface ContactFromPhone {
  uid: string;
  name: string;
  phones: string[];
  photoHash: string;
}

interface ContactPhotoResult {
  uid: string;
  mimeType: string;
  data: string; // base64
}

export interface ContactSyncResult {
  total: number;
  added: number;
  updated: number;
  removed: number;
  photosUpdated: number;
}

export async function contactSync(
  queryClient: QueryClient,
  db: DatabaseService,
): Promise<ContactSyncResult> {
  debugConsole.narrative('Synchronizing contacts...');

  const phoneContacts = (await queryClient.query('contacts.list')) as ContactFromPhone[];
  const localContacts = db.getAllContacts();

  const localByUid = new Map(localContacts.map(c => [c.uid, c]));
  const phoneUids = new Set(phoneContacts.map(c => c.uid));
  const photosDir = getContactPhotosDir();
  fs.mkdirSync(photosDir, { recursive: true });

  let added = 0;
  let updated = 0;
  let removed = 0;
  const uidsNeedingPhotos: string[] = [];

  // Upsert contacts from phone
  for (const contact of phoneContacts) {
    const existing = localByUid.get(contact.uid);
    const phoneNumbers = JSON.stringify(contact.phones);

    if (!existing) {
      db.upsertContact({
        uid: contact.uid,
        name: contact.name,
        phone_numbers: phoneNumbers,
        photo_path: null,
        photo_mime: null,
        emails: null,
        addresses: null,
        organization: null,
        notes: null,
        birthday: null,
        nickname: null,
        account_type: null,
        account_name: null,
        timestamp: Date.now(),
      });
      if (contact.photoHash) uidsNeedingPhotos.push(contact.uid);
      added++;
    } else {
      // Update name/phones if changed
      if (existing.name !== contact.name || existing.phone_numbers !== phoneNumbers) {
        db.upsertContact({
          ...existing,
          name: contact.name,
          phone_numbers: phoneNumbers,
          timestamp: Date.now(),
        });
        updated++;
      }
      // Check if photo changed (compare hash — stored in photo_mime as a hack for now)
      if (contact.photoHash && contact.photoHash !== (existing.photo_mime ?? '')) {
        uidsNeedingPhotos.push(contact.uid);
      }
    }
  }

  // Delete contacts not on phone
  for (const local of localContacts) {
    if (!phoneUids.has(local.uid)) {
      db.deleteContact(local.uid);
      removed++;
    }
  }

  // Fetch changed photos
  let photosUpdated = 0;
  if (uidsNeedingPhotos.length > 0) {
    debugConsole.log('query', 'contacts', `Fetching ${uidsNeedingPhotos.length} contact photos...`);

    const photos = (await queryClient.query('contacts.photos', {
      uids: uidsNeedingPhotos,
    })) as ContactPhotoResult[];

    for (const photo of photos) {
      const filePath = path.join(photosDir, `${photo.uid}.jpg`);
      fs.writeFileSync(filePath, Buffer.from(photo.data, 'base64'));

      // Update DB with photo path — store photoHash in photo_mime for change detection
      const contact = db.getContact(photo.uid);
      if (contact) {
        db.upsertContact({
          ...contact,
          photo_path: `${photo.uid}.jpg`,
          photo_mime: phoneContacts.find(c => c.uid === photo.uid)?.photoHash ?? photo.mimeType,
          timestamp: Date.now(),
        });
      }
      photosUpdated++;
    }
  }

  debugConsole.narrative(
    `Contacts synced — ${phoneContacts.length} contacts` +
    (photosUpdated > 0 ? ` (${photosUpdated} photos updated)` : ''),
  );

  return { total: phoneContacts.length, added, updated, removed, photosUpdated };
}
