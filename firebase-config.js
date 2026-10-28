// firebase-config.js
// Aquí se conecta NEXA con Firebase. Es el ÚNICO archivo que
// importa Firebase desde internet: los demás importan desde aquí.
// Si algún día cambias de versión, solo cambias el número en estas dos líneas.

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    setDoc,
    getDoc,
    where,
    arrayUnion,
    arrayRemove,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCuvwnGHymrXDJHutedPoYQQ24_nrTKdgg",
    authDomain: "nexa-5d304.firebaseapp.com",
    projectId: "nexa-5d304",
    storageBucket: "nexa-5d304.firebasestorage.app",
    messagingSenderId: "355192072751",
    appId: "1:355192072751:web:17080d9981551eb2ecb4da"
};

const app = initializeApp(firebaseConfig);

// "auth" es el objeto que maneja a los usuarios
export const auth = getAuth(app);

// "db" es la base de datos Firestore
export const db = getFirestore(app);

// Re-exportamos las funciones que usaremos en otros archivos
export {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    signOut
,
    // Firestore
    collection,
    addDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    setDoc,
    getDoc,
    where,
    arrayUnion,
    arrayRemove,
    serverTimestamp
};