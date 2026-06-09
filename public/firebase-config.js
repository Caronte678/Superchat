// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCPGiohg9ldHyxkt27gLwDQxlOr75bjuEI",
  authDomain: "superchat-5fb0d.firebaseapp.com",
  projectId: "superchat-5fb0d",
  storageBucket: "superchat-5fb0d.firebasestorage.app",
  messagingSenderId: "793648413217",
  appId: "1:793648413217:web:bfbf9655cc059f72798160",
  measurementId: "G-SQQVXGK19J",
  databaseURL: "https://superchat-5fb0d-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
export const auth = getAuth(app);
export const database = getDatabase(app);
export default app;
