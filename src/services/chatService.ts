import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  setDoc, 
  doc, 
  getDoc,
  Timestamp 
} from 'firebase/firestore';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Timestamp;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  lastMessageAt: Timestamp;
}

export const saveUserApiKey = async (userId: string, provider: string, apiKey: string) => {
  const keyDoc = doc(db, 'userSettings', userId);
  await setDoc(keyDoc, {
    [`${provider}_api_key`]: apiKey
  }, { merge: true });
};

export const getUserApiKey = async (userId: string, provider: string) => {
  const keyDoc = doc(db, 'userSettings', userId);
  const snap = await getDoc(keyDoc);
  if (snap.exists()) {
    return snap.data()[`${provider}_api_key`] as string | undefined;
  }
  return undefined;
};

export const createChatSession = async (userId: string, title: string) => {
  const sessionRef = collection(db, 'chatSessions');
  const docRef = await addDoc(sessionRef, {
    userId,
    title,
    lastMessageAt: Timestamp.now()
  });
  return docRef.id;
};

export const saveMessage = async (sessionId: string, message: Omit<ChatMessage, 'createdAt'>) => {
  const messageRef = collection(db, 'chatSessions', sessionId, 'messages');
  await addDoc(messageRef, {
    ...message,
    createdAt: Timestamp.now()
  });
  
  // Update session lastMessageAt
  const sessionDoc = doc(db, 'chatSessions', sessionId);
  await setDoc(sessionDoc, { lastMessageAt: Timestamp.now() }, { merge: true });
};

export const getMessages = async (sessionId: string) => {
  const messageRef = collection(db, 'chatSessions', sessionId, 'messages');
  const q = query(messageRef, orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage & { id: string }));
};

export const getUserSessions = async (userId: string) => {
  const sessionRef = collection(db, 'chatSessions');
  const q = query(sessionRef, where('userId', '==', userId), orderBy('lastMessageAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
};
