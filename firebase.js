import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { 
      getFirestore, collection, collectionGroup, doc, setDoc, onSnapshot, updateDoc, deleteDoc, getDocs, getDoc, getDocsFromServer, getDocFromServer 
    } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

    // Configuració de Firebase
    const firebaseConfig = {
      apiKey: "AIzaSyAIsRgPh7d3pN5gEdwenOUKJZyp3cYIPVQ",
      authDomain: "dinamica-escape-room-microbit.firebaseapp.com",
      projectId: "dinamica-escape-room-microbit",
      storageBucket: "dinamica-escape-room-microbit.firebasestorage.app",
      messagingSenderId: "888747913131",
      appId: "1:888747913131:web:5d98e15807534bba892cee"
    };

    // Inicialitzar Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // Exposar al scope global per compatibilitat amb la lògica UI
    window.db = db;
    window.fs = { collection, collectionGroup, doc, setDoc, onSnapshot, updateDoc, deleteDoc, getDocs, getDoc, getDocsFromServer, getDocFromServer };
    window.dispatchEvent(new CustomEvent('firebase-ready'));
