// ============================================================
// Firebase Configuration
// ============================================================
// כיצד למלא:
// 1. נכנס ל: https://console.firebase.google.com
// 2. בחר את הפרויקט שלך
// 3. Project Settings → General → Your apps → Config
// 4. העתק את הערכים והדבק כאן

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCMSPc473CqGSnC8Fk1r-bz_y2ZsI8QhGs",
  authDomain:        "globus-game.firebaseapp.com",
  projectId:         "globus-game",
  storageBucket:     "globus-game.firebasestorage.app",
  messagingSenderId: "174589885110",
  appId:             "1:174589885110:web:32eac1af53686e67484417"
};

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
