import admin from 'firebase-admin';
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage"; // Used for client-side interactions
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert `import.meta.url` to __dirname equivalent
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read service account key file dynamically
const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf-8'));
const firebaseConfig = {
  apiKey: "AIzaSyDPv_zn9htolezldHejWdH-0QB_Ruj8obI",
  authDomain: "smart-health-tracker-a9dcb.firebaseapp.com",
  projectId: "smart-health-tracker-a9dcb",
  storageBucket: "smart-health-tracker-a9dcb.firebasestorage.app",
  messagingSenderId: "146490072121",
  appId: "1:146490072121:web:cc8855e59cf81851ba81e8",
  measurementId: "G-790080CTZM"
};

const app = initializeApp(firebaseConfig);

// Initialize Firebase Admin (For Server SDK - Required for Bucket Access)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: firebaseConfig.storageBucket
});
export const storage = getStorage(app);
export const auth = getAuth(app);
export const bucket = admin.storage().bucket();
export const db = admin.firestore();
