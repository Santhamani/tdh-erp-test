import fs from 'node:fs/promises';
import path from 'node:path';
import admin from 'firebase-admin';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tdh-erp-asquare';
const OUTPUT_DIR = process.env.FIRESTORE_EXPORT_DIR || path.resolve(process.cwd(), 'migration', 'firestore-export');
const COLLECTIONS = [
  'users',
  'arrival_records',
  'weighing_records',
  'quality-check_records',
  'dispatch_records',
  'bin_operation_records',
  'storage_records'
];

function parseArgs() {
  const args = process.argv.slice(2);
  const collectionsArg = args.find((a) => a.startsWith('--collections='));
  if (!collectionsArg) return COLLECTIONS;
  return collectionsArg.replace('--collections=', '').split(',').map((v) => v.trim()).filter(Boolean);
}

async function ensureAdminInitialized() {
  if (admin.apps.length > 0) return;

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required and must point to a Firebase service account JSON file.');
  }

  const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID
  });
}

function serializeFirestoreValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof admin.firestore.Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map((v) => serializeFirestoreValue(v));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeFirestoreValue(v);
    return out;
  }
  return value;
}

async function exportCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const docs = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: serializeFirestoreValue(doc.data())
  }));

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, `${collectionName}.json`);
  await fs.writeFile(filePath, JSON.stringify({ collection: collectionName, count: docs.length, docs }, null, 2), 'utf8');
  return { collectionName, count: docs.length, filePath };
}

async function main() {
  const collections = parseArgs();
  await ensureAdminInitialized();

  const db = admin.firestore();
  const results = [];

  for (const collectionName of collections) {
    const result = await exportCollection(db, collectionName);
    results.push(result);
    console.log(`Exported ${result.collectionName}: ${result.count} docs -> ${result.filePath}`);
  }

  const summaryPath = path.join(OUTPUT_DIR, 'summary.json');
  await fs.writeFile(summaryPath, JSON.stringify({ exportedAt: new Date().toISOString(), results }, null, 2), 'utf8');
  console.log(`Summary written -> ${summaryPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
