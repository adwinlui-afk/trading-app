import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCBB5ClkhaTuCQ6qb7O2Ij9R5RT8JISUAA",
  authDomain: "a-milly-bot-4c3f7.firebaseapp.com",
  projectId: "a-milly-bot-4c3f7",
  storageBucket: "a-milly-bot-4c3f7.firebasestorage.app",
  messagingSenderId: "128688721037",
  appId: "1:128688721037:web:f07e422611928c3886a6c4",
  measurementId: "G-EVWX5XLRHC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };

// ── Auth ──
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (e) {
    console.error('Sign in error:', e);
    return null;
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error('Sign out error:', e);
  }
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── Balance ──
export async function getBalanceDB(userId) {
  try {
    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data().balance || 1000;
    return 1000;
  } catch (e) { return 1000; }
}

export async function setBalanceDB(userId, amount) {
  try {
    const ref = doc(db, 'users', userId);
    await setDoc(ref, { balance: amount }, { merge: true });
  } catch (e) { console.error('setBalance error:', e); }
}

// ── Trades ──
export async function getTradesDB(userId) {
  try {
    const ref = collection(db, 'users', userId, 'trades');
    const q = query(ref, orderBy('openedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) { return []; }
}

export async function addTradeDB(userId, trade) {
  try {
    const ref = doc(collection(db, 'users', userId, 'trades'));
    const newTrade = { ...trade, id: ref.id };
    await setDoc(ref, newTrade);
    return newTrade;
  } catch (e) { console.error('addTrade error:', e); return null; }
}

export async function updateTradeDB(userId, tradeId, updates) {
  try {
    const ref = doc(db, 'users', userId, 'trades', tradeId);
    await updateDoc(ref, updates);
  } catch (e) { console.error('updateTrade error:', e); }
}

// ── 100-Bagger Portfolio ──
export async function getBaggerPortfolioDB(userId) {
  try {
    const ref = collection(db, 'users', userId, 'baggers');
    const snap = await getDocs(ref);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) { return []; }
}

export async function addBaggerPositionDB(userId, position) {
  try {
    const ref = doc(db, 'users', userId, 'baggers', position.ticker);
    await setDoc(ref, position, { merge: true });
  } catch (e) { console.error('addBagger error:', e); }
}

export async function removeBaggerPositionDB(userId, ticker) {
  try {
    const ref = doc(db, 'users', userId, 'baggers', ticker);
    await deleteDoc(ref);
  } catch (e) { console.error('removeBagger error:', e); }
}

// ── Reset ──
export async function resetAllDB(userId) {
  try {
    const trades = await getTradesDB(userId);
    for (const trade of trades) {
      await deleteDoc(doc(db, 'users', userId, 'trades', trade.id));
    }
    const baggers = await getBaggerPortfolioDB(userId);
    for (const b of baggers) {
      await deleteDoc(doc(db, 'users', userId, 'baggers', b.ticker));
    }
    await setBalanceDB(userId, 1000);
  } catch (e) { console.error('reset error:', e); }
}
// ── Settings ──
export async function getSettingsDB(userId) {
  try {
    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().settings) return snap.data().settings;
    return {
      startingBalance: 1000,
      target: 1000000,
      platform: 'BMO InvestorLine',
      stockFee: 9.95,
      etfFee: 0,
      milestones: [1000, 10000, 100000, 1000000],
      currency: 'CAD',
    };
  } catch (e) {
    return {
      startingBalance: 1000,
      target: 1000000,
      platform: 'BMO InvestorLine',
      stockFee: 9.95,
      etfFee: 0,
      milestones: [1000, 10000, 100000, 1000000],
      currency: 'CAD',
    };
  }
}

export async function saveSettingsDB(userId, settings) {
  try {
    const ref = doc(db, 'users', userId);
    await setDoc(ref, { settings }, { merge: true });
  } catch (e) { console.error('saveSettings error:', e); }
}

export { db };