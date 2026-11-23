import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVsiaVAYQvAr5V8YvJLTSDloZGJ2Am1ds",
  authDomain: "spinks-softech-pm-plan-handel.firebaseapp.com",
  projectId: "spinks-softech-pm-plan-handel",
  storageBucket: "spinks-softech-pm-plan-handel.firebasestorage.app",
  messagingSenderId: "578006645720",
  appId: "1:578006645720:web:707da175bb1245145550ad",
  measurementId: "G-NPWDFTVDGQ"
};

const app = initializeApp(firebaseConfig);
if (typeof window !== "undefined") {
  try {
    getAnalytics(app);
  } catch {
    // Ignore analytics errors in restricted environments
  }
}
const db = getFirestore(app);
const DOC_REF = doc(db, "ToolSyncPM", "mainState");
const MAX_DOC_BYTES = 750 * 1024; // ~750 KB safety threshold

export function downloadBackupJson(payload) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ToolSyncPM_AutoFallback_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function loadCloudState() {
  try {
    const snap = await getDoc(DOC_REF);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn("Firestore load fallback to local:", err);
  }
  return null;
}

export async function saveCloudState(statePayload, onFallbackDownload) {
  const cleanPayload = {
    version: statePayload.version ?? 2,
    year: statePayload.year ?? 2026,
    month: statePayload.month ?? 10,
    monthRosterMap: statePayload.monthRosterMap || {},
    monthExchangeMap: statePayload.monthExchangeMap || {},
    matrixState: statePayload.matrixState || {},
    updatedAt: new Date().toISOString()
  };

  const serialized = JSON.stringify(cleanPayload);
  const byteSize = new Blob([serialized]).size;

  if (byteSize > MAX_DOC_BYTES) {
    downloadBackupJson(cleanPayload);
    if (typeof onFallbackDownload === "function") {
      onFallbackDownload("size_limit", byteSize);
    }
    return { savedCloud: false, downloaded: true };
  }

  try {
    await setDoc(DOC_REF, cleanPayload, { merge: true });
    return { savedCloud: true, downloaded: false };
  } catch (err) {
    console.warn("Firestore save failed, triggering JSON download:", err);
    downloadBackupJson(cleanPayload);
    if (typeof onFallbackDownload === "function") {
      onFallbackDownload("cloud_error", byteSize, err);
    }
    return { savedCloud: false, downloaded: true };
  }
}

window.toolSyncCloud = {
  load: loadCloudState,
  save: saveCloudState,
  downloadJson: downloadBackupJson
};