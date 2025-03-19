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
  apiKey: "AIzaSyBNjaHJtRjnEoviA3b1TSFft82pd9bZWSw",
  authDomain: "health-tracker-d1568.firebaseapp.com",
  projectId: "health-tracker-d1568",
  storageBucket: "health-tracker-d1568.appspot.com", // ✅ Use correct storage bucket URL
  messagingSenderId: "259246991702",
  appId: "1:259246991702:web:1aab3ca7ec0bd55e47cef7"
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