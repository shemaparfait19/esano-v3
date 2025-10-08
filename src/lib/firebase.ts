// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration.
// This is a public configuration and is safe to be in client-side code.
const firebaseConfig = {
  apiKey: "AIzaSyBkfXSjTEvHUq0U01sayIwS36ALVx-dKuY",
  authDomain: "esano-ai-genealogy-explorer.firebaseapp.com",
  projectId: "esano-ai-genealogy-explorer",
  storageBucket: "esano-ai-genealogy-explorer.appspot.com",
  messagingSenderId: "955274882186",
  appId: "1:955274882186:web:1c97929adafc3f7c2d5173",
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, auth, storage };
