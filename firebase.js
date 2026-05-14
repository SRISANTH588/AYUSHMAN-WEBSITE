// Firebase Configuration — Ayushman PhysioFIT
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDC3xGBni7Hl59c1UWeLw87-ng-PlLWSUg",
  authDomain: "ayushman-physiofit-218ae.firebaseapp.com",
  projectId: "ayushman-physiofit-218ae",
  storageBucket: "ayushman-physiofit-218ae.firebasestorage.app",
  messagingSenderId: "797309711753",
  appId: "1:797309711753:web:a2489fdccdf9a88b12dd58"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
