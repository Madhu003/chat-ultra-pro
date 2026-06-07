import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBEj9B-X7GJAN4zvfBoF80RPtdkJGCJLvI",
  authDomain: "chat-ultra-pro.firebaseapp.com",
  projectId: "chat-ultra-pro",
  storageBucket: "chat-ultra-pro.firebasestorage.app",
  messagingSenderId: "982339000443",
  appId: "1:982339000443:web:3b89578830e838fbecaade"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
