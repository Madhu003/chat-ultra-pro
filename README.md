# Chat Ultra Pro

A ChatGPT-like application built with:
- **React (Vite)**
- **Firebase Auth & Firestore**
- **Vercel AI SDK**
- **Tailwind CSS**
- **Atomic Design Structure**

## Features
- Google & Email Authentication (via Firebase)
- User-provided API keys stored securely in Firestore
- Chat history saved and synced with Firestore
- Real-time streaming responses via Vercel AI SDK

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Firebase Setup:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Google & Email)
   - Enable Firestore Database
   - Update `src/lib/firebase.ts` with your config (already done with provided config)

3. **Run locally:**
   ```bash
   npm run dev
   ```

4. **Deploy:**
   ```bash
   firebase login
   firebase init
   npm run build
   firebase deploy
   ```

## Project Structure (Atomic)
- `src/components/atoms`: Basic components like Buttons.
- `src/components/molecules`: Combinations of atoms like ChatInterface.
- `src/components/organisms`: Larger blocks like Navbar and Sidebar.
- `src/services`: Firebase and AI interaction logic.
- `src/context`: Auth state management.
