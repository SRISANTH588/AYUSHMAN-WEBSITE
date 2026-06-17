import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA5O2Wjgqsz0haLLDTyn0aR9XoaHybVDFQ",
  authDomain: "ayushman-physiofit-5b6ad.firebaseapp.com",
  projectId: "ayushman-physiofit-5b6ad",
  storageBucket: "ayushman-physiofit-5b6ad.firebasestorage.app",
  messagingSenderId: "803515776402",
  appId: "1:803515776402:web:8f96c6a1c02aa91620954b"
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
