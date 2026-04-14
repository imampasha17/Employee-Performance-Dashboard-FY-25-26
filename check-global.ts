import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";

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

    const globalRef = collection(db, "global_data");
    const snapshot = await getDocs(globalRef);
    
    let totalItems = 0;
    console.log(`Found ${snapshot.docs.length} documents in global_data.`);
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.payload) {
        try {
          const parsed = JSON.parse(data.payload);
          totalItems += parsed.length;
          console.log(`- ${doc.id} contains ${parsed.length} items`);
        } catch(e) {
          console.log(`- ${doc.id} failed to parse JSON`);
        }
      }
    });
    
    console.log(`\nTotal items stored: ${totalItems}`);
    process.exit(0);
  } catch (err: any) {
    console.error("\n[ERROR] Check Failed:", err.message);
    process.exit(1);
  }
}

main();
