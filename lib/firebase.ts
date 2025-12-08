import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ↓↓↓ ここをあなたのFirebaseの画面に出てきた内容に書き換えてください ↓↓↓
const firebaseConfig = {
  apiKey: "AIzaSyAP8Vij81hzk-p31T7kjxVem6Hx5_Y1Kck",
  authDomain: "chousei-app.firebaseapp.com",
  projectId: "chousei-app",
  storageBucket: "chousei-app.firebasestorage.app",
  messagingSenderId: "297860717730",
  appId: "1:297860717730:web:f13a3201081809821b4bfb"
};
// ↑↑↑ ここまで ↑↑↑

// Firebaseを初期化
const app = initializeApp(firebaseConfig);
// データベース(Firestore)を使う準備
const db = getFirestore(app);

export { db };