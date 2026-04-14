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

    const collections = ["global_data", "sales", "users"];
    for (const collName of collections) {
      const ref = collection(db, collName);
      const snapshot = await getDocs(ref);
      console.log(`Collection '${collName}': ${snapshot.docs.length} documents`);
      if (snapshot.docs.length > 0) {
        console.log(`  Example doc ID: ${snapshot.docs[0].id}`);
      }
    }
    
    process.exit(0);
  } catch (err: any) {
    console.error("\n[ERROR]:", err.message);
    process.exit(1);
  }
}

main();
