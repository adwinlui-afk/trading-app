import { db } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

export async function getWatchlistDB(userId) {
  try {
    const ref = collection(db, 'users', userId, 'watchlist');
    const snap = await getDocs(ref);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) { return []; }
}

export async function addToWatchlistDB(userId, stock) {
  try {
    const ref = doc(db, 'users', userId, 'watchlist', stock.ticker);
    await setDoc(ref, stock, { merge: true });
  } catch (e) { console.error('addWatchlist error:', e); }
}

export async function removeFromWatchlistDB(userId, ticker) {
  try {
    const ref = doc(db, 'users', userId, 'watchlist', ticker);
    await deleteDoc(ref);
  } catch (e) { console.error('removeWatchlist error:', e); }
}