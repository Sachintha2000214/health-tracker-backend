// config/firebaseConfig.js — works on Vercel + local
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) return null;

  // Vercel/CI usually store private key with literal \n
  if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

  console.log('[firebase] Using ENV credentials for project:', projectId);
  return { credential: admin.credential.cert({ projectId, clientEmail, privateKey }), projectId };
}

function fromFile() {
  // Local fallback (adjust if you keep the JSON elsewhere)
  const saPath =
    process.env.FIREBASE_SA_PATH ||
    path.join(process.cwd(), 'serviceAccountKey.json'); // project root

  if (!existsSync(saPath)) return null;

  const sa = JSON.parse(readFileSync(saPath, 'utf-8'));
  if (!sa.private_key || !sa.client_email || !sa.project_id) {
    throw new Error('[firebase] Invalid serviceAccount JSON (missing fields).');
  }
  console.log('[firebase] Using FILE credentials:', sa.client_email, 'project:', sa.project_id);
  return { credential: admin.credential.cert(sa), projectId: sa.project_id };
}

const picked = fromEnv() || fromFile();
if (!picked) {
  throw new Error('[firebase] No credentials found. Set ENV on Vercel or FIREBASE_SA_PATH locally.');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: picked.credential,
    projectId: picked.projectId,
    storageBucket: `${picked.projectId}.appspot.com`,
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
export const bucket = admin.storage().bucket();

// Call this once at startup to fail fast if creds are wrong
export async function assertFirestoreReady() {
  await db.listCollections(); // forces token mint; throws if invalid_grant/unauth
  console.log('[firebase] Firestore auth OK');
}
