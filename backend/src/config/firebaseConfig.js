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
  apiKey: "AIzaSyC72CbpHIM67m_rWj6-b_FqEZTn31YEM38",
  authDomain: "health-meal-tracker.firebaseapp.com",
  projectId: "health-meal-tracker",
  storageBucket: "health-meal-tracker.firebasestorage.app",
  messagingSenderId: "925144812217",
  appId: "1:925144812217:web:55e96c7cdfddf3222ba968",
  measurementId: "G-RWK5MHLQJT"
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