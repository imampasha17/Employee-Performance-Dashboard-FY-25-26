import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeFirestore, collection, doc, writeBatch, getDocs } from "firebase/firestore";

async function main() {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId || "(default)");

    console.log("Authenticating...");
    await signInAnonymously(auth);

    const salesRef = collection(db, "sales");
    
    console.log("Generating 2000 dummy chunks...");
    const data = Array(2000).fill(null).map((_, i) => ({
      test: true,
      index: i,
      timestamp: Date.now()
    }));

    console.log("Attempting chunked upload...");
    const CHUNK_SIZE = 400;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(item => {
        const newDocRef = doc(salesRef);
        batch.set(newDocRef, item);
      });
      await batch.commit();
      console.log(`Committed chunk ${i / CHUNK_SIZE + 1}`);
    }
    
    console.log("Write success! Quota is fully active.");
    
    console.log("Cleaning up test documents...");
    const existingDocs = await getDocs(salesRef);
    const deleteBatch = writeBatch(db);
    let count = 0;
    existingDocs.forEach(d => {
      if (d.data().test) {
        deleteBatch.delete(d.ref);
        count++;
      }
    });
    if (count > 0 && count <= 500) await deleteBatch.commit();
    
    console.log("Test success!");
    process.exit(0);
  } catch (err: any) {
    console.error("\n[ERROR] Bulk Test Failed:");
    console.error(err);
    process.exit(1);
  }
}

main();
