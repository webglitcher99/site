// firebase-db.js  -  Google Sheet / Apps Script ki jagah Firebase Firestore
// Use: <script type="module"> import { nextSerial, saveRecord, searchRecord, fileToSmallJpeg } from './firebase-db.js'; </script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, runTransaction,
  collection, query, where, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// ====== 1) YAHAN APNA firebaseConfig PASTE KARO (Firebase Console se) ======
const firebaseConfig = {
  apiKey: "AIzaSyAhgpZwG4RNIB8eqxfAtecpPjyfRxVDTB0",
  authDomain: "hrss-a359f.firebaseapp.com",
  projectId: "hrss-a359f",
  storageBucket: "hrss-a359f.firebasestorage.app",
  messagingSenderId: "1015674335429",
  appId: "1:1015674335429:web:5bf22317bca7eb3e03c0ac",
  measurementId: "G-1VVCVQEC1T"
};
// ==========================================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const idOf = (kramank) => String(kramank).trim().replace(/\//g, "-").toLowerCase();
const fmt = (n) => "HRSS/" + new Date().getFullYear() + "/" + String(n).padStart(4, "0");

// Agla Kramank dikhane ke liye (counter badhata nahi)
export async function nextSerial() {
  const snap = await getDoc(doc(db, "meta", "counter"));
  const n = snap.exists() ? snap.data().n : 0;
  return { ok: true, kramank: fmt(n + 1) };
}

// Photo (File ya dataURL) ko chhota JPEG dataURL banata hai (~20-50KB)
export function fileToSmallJpeg(fileOrDataUrl, max = 400, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    if (typeof fileOrDataUrl === "string") img.src = fileOrDataUrl;
    else {
      const fr = new FileReader();
      fr.onload = () => (img.src = fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(fileOrDataUrl);
    }
  });
}

// Save. d = { kramank?, anushansa, naam, pita, pad, vaidhta, pata, mobile, photo? }
export async function saveRecord(d) {
  try {
    let photo = d.photo || "";
    if (photo && photo.length > 300000) photo = await fileToSmallJpeg(photo); // safety

    const counterRef = doc(db, "meta", "counter");
    const manual = String(d.kramank || "").trim();

    const kramank = await runTransaction(db, async (tx) => {
      let k = manual;
      let n = null;
      if (!k) {
        const c = await tx.get(counterRef);
        n = (c.exists() ? c.data().n : 0) + 1;
        k = fmt(n);
      }
      const ref = doc(db, "records", idOf(k));
      const ex = await tx.get(ref);
      if (ex.exists()) throw new Error("duplicate");
      if (n !== null) tx.set(counterRef, { n });
      tx.set(ref, {
        kramank: k,
        date: serverTimestamp(),
        anushansa: d.anushansa || "",
        naam: d.naam || "",
        pita: d.pita || "",
        pad: d.pad || "",
        vaidhta: d.vaidhta || "",
        pata: d.pata || "",
        mobile: String(d.mobile || ""),
        photo
      });
      return k;
    });
    return { ok: true, kramank };
  } catch (err) {
    return { ok: false, error: err.message === "duplicate" ? "duplicate" : String(err) };
  }
}

// Search: Kramank ya mobile number se
export async function searchRecord(q) {
  q = String(q || "").trim();
  if (!q) return { ok: false };
  let data = null;

  const byId = await getDoc(doc(db, "records", idOf(q)));
  if (byId.exists()) data = byId.data();
  else {
    const qs = await getDocs(query(collection(db, "records"), where("mobile", "==", q), limit(1)));
    if (!qs.empty) data = qs.docs[0].data();
  }
  if (!data) return { ok: false };
  return {
    ok: true, kramank: data.kramank, anushansa: data.anushansa, naam: data.naam,
    pita: data.pita, pad: data.pad, vaidhta: data.vaidhta, pata: data.pata,
    mobile: data.mobile, photo: data.photo || ""
  };
}
