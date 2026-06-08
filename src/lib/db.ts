import { db } from './firebase';
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
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
  createdAt?: Timestamp | Date;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  lastMessageAt: Timestamp;
}

export const saveApiKey = async (userId: string, provider: 'openai' | 'google', apiKey: string): Promise<void> => {
  const keyDoc = doc(db, 'userSettings', userId);
  await setDoc(keyDoc, { [`${provider}_api_key`]: apiKey }, { merge: true });
};

export const getApiKeys = async (userId: string) => {
  const keyDoc = doc(db, 'userSettings', userId);
  const snap = await getDoc(keyDoc);
  if (snap.exists()) {
    return {
      openai: snap.data()['openai_api_key'] as string | undefined,
      google: snap.data()['google_api_key'] as string | undefined,
    };
  }
  return { openai: undefined, google: undefined };
};

export const createSession = async (userId: string, title: string): Promise<string> => {
  const sessionRef = collection(db, 'chatSessions');
  const docRef = await addDoc(sessionRef, {
    userId,
    title,
    lastMessageAt: Timestamp.now()
  });
  return docRef.id;
};

export const getSessions = async (userId: string): Promise<ChatSession[]> => {
  const sessionRef = collection(db, 'chatSessions');
  const q = query(sessionRef, where('userId', '==', userId), orderBy('lastMessageAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  const sessionDoc = doc(db, 'chatSessions', sessionId);
  await deleteDoc(sessionDoc);
};

export const renameSession = async (sessionId: string, newTitle: string): Promise<void> => {
  const sessionDoc = doc(db, 'chatSessions', sessionId);
  await setDoc(sessionDoc, { title: newTitle }, { merge: true });
};

export const saveMessage = async (sessionId: string, message: ChatMessage): Promise<void> => {
  const messageRef = collection(db, 'chatSessions', sessionId, 'messages');
  await addDoc(messageRef, {
    role: message.role,
    content: message.content,
    createdAt: Timestamp.now()
  });
  
  const sessionDoc = doc(db, 'chatSessions', sessionId);
  await setDoc(sessionDoc, { lastMessageAt: Timestamp.now() }, { merge: true });
};

export const getMessages = async (sessionId: string): Promise<ChatMessage[]> => {
  const messageRef = collection(db, 'chatSessions', sessionId, 'messages');
  const q = query(messageRef, orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
};
