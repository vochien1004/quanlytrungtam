// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Web app's Firebase configuration from user's provided credentials
export const firebaseConfig = {
  apiKey: "AIzaSyAdzeYBZYVwHMh54-7aY9Rs8WgPRxSjQxo",
  authDomain: "tthocgioi-9d836.firebaseapp.com",
  projectId: "tthocgioi-9d836",
  storageBucket: "tthocgioi-9d836.firebasestorage.app",
  messagingSenderId: "1039061723065",
  appId: "1:1039061723065:web:acec62fb0423f47877b868"
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore with persistent local cache for instant cold-starts
function createFirestoreInstance() {
  if (typeof window === 'undefined') {
    try {
      return initializeFirestore(app, { ignoreUndefinedProperties: true });
    } catch {
      return getFirestore(app);
    }
  }
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch {
    return getFirestore(app);
  }
}

export const db = createFirestoreInstance();

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Secondary Auth Instance for creating users without logging out the current Admin
export function getSecondaryAuth() {
  const secondaryAppName = 'SecondaryAdminAuthApp';
  const secondaryApp = getApps().find(a => a.name === secondaryAppName) 
    || initializeApp(firebaseConfig, secondaryAppName);
  return getAuth(secondaryApp);
}

// Secondary Firestore Instance matching Secondary Auth
export function getSecondaryDb() {
  const secondaryAppName = 'SecondaryAdminAuthApp';
  const secondaryApp = getApps().find(a => a.name === secondaryAppName) 
    || initializeApp(firebaseConfig, secondaryAppName);
  try {
    return initializeFirestore(secondaryApp, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(secondaryApp);
  }
}

// Secondary Storage Instance matching Secondary Auth
export function getSecondaryStorage() {
  const secondaryAppName = 'SecondaryAdminAuthApp';
  const secondaryApp = getApps().find(a => a.name === secondaryAppName) 
    || initializeApp(firebaseConfig, secondaryAppName);
  return getStorage(secondaryApp);
}


