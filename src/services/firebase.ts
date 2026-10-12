import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import config from '../../firebase-applet-config.json';

// Owner Whitelist: Only this email is authorized to access the system
export const OWNER_EMAIL = 'mrm823994@gmail.com';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || config.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || config.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || config.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || config.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || config.appId,
};

const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || config.firestoreDatabaseId;

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with resilient offline multi-tab persistent cache
function createFirestoreInstance(): Firestore {
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      return initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        firestoreDatabaseId || undefined
      );
    }
  } catch (err) {
    console.warn('Could not initialize persistentLocalCache, falling back to standard Firestore:', err);
  }

  return firestoreDatabaseId
    ? getFirestore(app, firestoreDatabaseId)
    : getFirestore(app);
}

export const db: Firestore = createFirestoreInstance();

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Configure Google Auth Provider
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});

// Connection validation test as mandated by Firebase integration guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system_settings', 'ping'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is currently running in offline mode.');
    }
    return false;
  }
}
