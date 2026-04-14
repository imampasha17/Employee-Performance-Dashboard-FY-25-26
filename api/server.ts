import express from "express";
console.log("server.ts module loading...");
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously as firebaseSignInAnonymously } from "firebase/auth";
import { 
  initializeFirestore,
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  writeBatch
} from "firebase/firestore";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Initialize Firebase Client SDK
let firebaseApp: any;
let db: any;
let auth: any;
let isAuthReady = false;
let firebaseConfig: any = null;

function loadConfig() {
  if (firebaseConfig) return firebaseConfig;

  // Try loading from environment variables first (standard for production/Vercel)
  if (process.env.FIREBASE_PROJECT_ID) {
    console.log("Loading Firebase config from individual environment variables...");
    firebaseConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      appId: process.env.FIREBASE_APP_ID,
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DB_ID || "(default)",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
    };
    return firebaseConfig;
  }

  // Support a single JSON string env var if provided
  if (process.env.FIREBASE_CONFIG) {
    try {
      console.log("Loading Firebase config from FIREBASE_CONFIG env var...");
      firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
      return firebaseConfig;
    } catch (err) {
      console.error("Error parsing FIREBASE_CONFIG env var:", err);
    }
  }
  
  const possiblePaths = [
    path.join(process.cwd(), "firebase-applet-config.json"),
    path.join(process.cwd(), "api", "firebase-applet-config.json"),
    "firebase-applet-config.json"
  ];
  
  console.log("Checking config paths for fallback:", possiblePaths);
  
  for (const configPath of possiblePaths) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf8");
        firebaseConfig = JSON.parse(content);
        console.log("Firebase config loaded from:", configPath);
        return firebaseConfig;
      }
    } catch (err) {
      // Only log error if not in Vercel, as missing file is expected on Vercel if using env vars
      if (!process.env.VERCEL) {
        console.error(`Error reading config at ${configPath}:`, err);
      }
    }
  }
  
  throw new Error("Firebase configuration not found. Please provide FIREBASE_PROJECT_ID etc. as environment variables or include a firebase-applet-config.json file.");
}

async function getFirebase() {
  if (!firebaseApp) {
    const config = loadConfig();
    if (!config.projectId) {
      throw new Error("Firebase config is missing or invalid");
    }
    console.log("Initializing Firebase for project:", config.projectId);
    firebaseApp = initializeApp(config);
    db = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    }, config.firestoreDatabaseId || "(default)");
    auth = getAuth(firebaseApp);
    console.log("Firebase initialized successfully");
  }
  return { 
    db, 
    auth, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    orderBy,
    writeBatch,
    signInAnonymously: firebaseSignInAnonymously 
  };
}

async function ensureAuthenticated() {
  const { auth, signInAnonymously } = await getFirebase();
  if (isAuthReady && auth.currentUser) return;
  try {
    await signInAnonymously(auth);
    isAuthReady = true;
    console.log("Server authenticated anonymously. UID:", auth.currentUser?.uid);
  } catch (err: any) {
    console.error("Server authentication failed:", err.message);
  }
}

// Helper to ensure admin exists in Firestore
async function ensureAdmin() {
  const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore Timeout in ensureAdmin")), ms));
  try {
    const { db, doc, getDoc, setDoc } = await getFirebase();
    const adminId = "admin-1";
    const adminRef = doc(db, "users", adminId);
    
    const adminSnap = await Promise.race([getDoc(adminRef), timeout(5000)]) as any;
    if (!adminSnap.exists()) {
      console.log("Creating default admin...");
      const hashedPassword = bcrypt.hashSync("admin123", 10);
      await Promise.race([setDoc(adminRef, {
        id: adminId,
        email: "admin@example.com",
        password: hashedPassword,
        role: "admin",
        name: "System Admin",
        accessibleLocations: [],
        createdAt: new Date().toISOString()
      }), timeout(5000)]);
      console.log("Default admin created in Firestore");
    }
  } catch (err) {
    console.error("Failed to check/create admin:", err);
  }
}

// Do not call ensureAdmin at top level to avoid Vercel startup issues
// ensureAdmin()
//   .then(() => console.log("Admin check complete"))
//   .catch(err => console.error("Admin check failed:", err));

async function createServer() {
  console.log("Creating Express server...");
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Global logging middleware
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      try {
        const { db, doc, getDoc } = await getFirebase();
        const userRef = doc(db, "users", decoded.id);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          req.user = {
            id: decoded.id,
            email: userData.email || decoded.email,
            role: userData.role || decoded.role,
            name: userData.name || decoded.name,
            accessibleLocations: userData.accessibleLocations || []
          };
        } else {
          req.user = decoded;
        }
      } catch (dbErr) {
        console.error("Middleware DB error:", dbErr);
        req.user = decoded;
      }
      
      next();
    } catch (err) {
      res.status(401).json({ message: "Invalid token" });
    }
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV, time: new Date().toISOString() });
  });

  app.get("/api/debug", async (req, res) => {
    try {
      const config = loadConfig();
      const { db, auth } = await getFirebase();
      // await ensureAuthenticated();
      res.json({ 
        status: "ok", 
        authReady: isAuthReady, 
        uid: auth?.currentUser?.uid,
        projectId: config.projectId,
        databaseId: config.firestoreDatabaseId,
        env: process.env.NODE_ENV,
        isVercel: !!process.env.VERCEL
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  app.get("/api/ping", (req, res) => {
    res.json({ pong: true, time: new Date().toISOString() });
  });

  app.get("/api/ls", (req, res) => {
    try {
      const files = fs.readdirSync(process.cwd());
      res.json({ 
        cwd: process.cwd(), 
        dirname: __dirname,
        files 
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/test-bcrypt", (req, res) => {
    try {
      const hash = bcrypt.hashSync("test", 10);
      const match = bcrypt.compareSync("test", hash);
      res.json({ hash, match });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/test-firestore", async (req, res) => {
    try {
      const { db, doc, setDoc, getDoc } = await getFirebase();
      // await ensureAuthenticated();
      const testRef = doc(db, "test", "connection");
      await setDoc(testRef, { time: new Date().toISOString() });
      const snap = await getDoc(testRef);
      res.json({ success: true, data: snap.data() });
    } catch (err: any) {
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    console.log("Login attempt for:", email);
    
    const config = loadConfig();
    if (!config.apiKey || !config.projectId) {
      console.error("CRITICAL: Firebase config is missing required fields!");
      return res.status(500).json({ error: "CONFIG_ERROR", message: "Firebase configuration is incomplete." });
    }

    const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore Timeout")), ms));

    try {
      console.log("Ensuring admin exists...");
      await Promise.race([ensureAdmin(), timeout(5000)]);
      
      console.log("Admin check done. Getting Firebase...");
      const { db, collection, query, where, getDocs } = await getFirebase();
      
      console.log("Querying users collection for email:", email);
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      
      const querySnapshot = await Promise.race([getDocs(q), timeout(5000)]) as any;
      
      if (querySnapshot.empty) {
        console.log("No user found with email:", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const userDoc = querySnapshot.docs[0];
      const user = userDoc.data();
      console.log("User found:", user.email, "Role:", user.role);

      if (typeof password !== 'string' || typeof user.password !== 'string') {
        console.log("Invalid password type or missing hash");
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log("Comparing passwords...");
      const isMatch = bcrypt.compareSync(password, user.password);
      if (!isMatch) {
        console.log("Password mismatch for:", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log("Password match. Generating token...");
      const token = jwt.sign({ 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        accessibleLocations: user.accessibleLocations, 
        name: user.name 
      }, JWT_SECRET);

      console.log("Login successful for:", email);
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role, 
          accessibleLocations: user.accessibleLocations, 
          name: user.name 
        } 
      });
    } catch (err: any) {
      console.error("Login error details:", err);
      res.status(500).json({ 
        message: "Internal server error", 
        error: err.message,
        stack: err.stack 
      });
    }
  });

  app.get("/api/me", authenticate, (req: any, res) => {
    res.json({ user: req.user });
  });

  app.get("/api/data", authenticate, async (req: any, res) => {
    try {
      const { db, collection, getDocs, orderBy, query } = await getFirebase();
      const globalRef = collection(db, "global_data");
      
      // Crucial: Sort by index to prevent data scrambling (chunk_10 before chunk_2)
      const q = query(globalRef, orderBy("index", "asc"));
      const querySnapshot = await getDocs(q);
      
      let data: any[] = [];
      querySnapshot.docs.forEach(doc => {
        const docData = doc.data();
        if (docData.payload) {
          try {
            data = data.concat(JSON.parse(docData.payload));
          } catch(e) {
            console.error("Parse payload err", e);
          }
        }
      });

      // Filter data if not admin.
      if (req.user.role !== "admin" && req.user.accessibleLocations && req.user.accessibleLocations.length > 0) {
        data = data.filter((item: any) => req.user.accessibleLocations.includes(item.location));
      }

      console.log(`Delivering ${data.length} records to ${req.user.email}`);
      res.json({ data });
    } catch (err) {
      console.error("Fetch data error:", err);
      res.status(500).json({ message: "Failed to fetch data" });
    }
  });

  app.delete("/api/data", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { db, collection, getDocs, deleteDoc } = await getFirebase();
      const globalRef = collection(db, "global_data");
      const existingDocs = await getDocs(globalRef);
      
      for (const d of existingDocs.docs) {
        await deleteDoc(d.ref);
      }

      res.json({ message: "Data cleared successfully" });
    } catch (err: any) {
      console.error("Clear data error:", err);
      res.status(500).json({ message: "Failed to clear data", error: err.message });
    }
  });

  app.post("/api/upload", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { data } = req.body;
    
    try {
      const { db, collection, getDocs, doc, setDoc, deleteDoc } = await getFirebase();
      const globalRef = collection(db, "global_data");
      const existingDocs = await getDocs(globalRef);
      
      // Delete old chunks in batches of 500 to prevent timeout and stay within Firestore limits
      const docs = existingDocs.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const nextBatch = docs.slice(i, i + 500);
        nextBatch.forEach(d => batch.delete(d.ref));
        await batch.commit();
        console.log(`Cleared batch of ${nextBatch.length} old chunks`);
      }
      
    // Pack into smaller chunks to ensure we stay under 1MB per document
      // and upload individually to avoid the 11MB request payload limit.
      // Increased to 1000 from 200 to reduce total write units and stay within quotas.
      const CHUNK_SIZE = 1000; 
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        const newDocRef = doc(globalRef, `chunk_${i / CHUNK_SIZE}`);
        await setDoc(newDocRef, { 
          payload: JSON.stringify(chunk),
          index: i / CHUNK_SIZE,
          updatedAt: new Date().toISOString()
        });
        console.log(`Uploaded chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(data.length / CHUNK_SIZE)}`);
      }

      res.json({ message: "Data uploaded successfully" });
    } catch (err: any) {
      console.error("Upload error details:", err);
      // Pass back specific error codes like RESOURCE_EXHAUSTED if they exist
      const errorCode = err.code || (err.message?.includes("RESOURCE_EXHAUSTED") ? "RESOURCE_EXHAUSTED" : "SERVER_ERROR");
      res.status(500).json({ 
        message: "Failed to upload data", 
        error: err.message,
        code: errorCode
      });
    }
  });

  app.get("/api/users", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    
    try {
      console.log("Fetching users from Firestore...");
      const { db, collection, getDocs } = await getFirebase();
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);
      console.log(`Found ${querySnapshot.size} user documents.`);
      
      const users = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          email: data.email || "", 
          role: data.role || "user", 
          name: data.name || "Unknown User", 
          accessibleLocations: data.accessibleLocations || [] 
        };
      });
      console.log("Returning users:", users.map(u => ({ id: u.id, email: u.email })));
      res.json({ users });
    } catch (err: any) {
      console.error("Error fetching users:", err);
      res.status(500).json({ message: "Failed to fetch users", error: err.message });
    }
  });

  app.post("/api/users", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { email, password, role, name, accessibleLocations } = req.body;

    try {
      console.log("Creating new user:", email);
      const { db, collection, query, where, getDocs, doc, setDoc } = await getFirebase();
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const existing = await getDocs(q);

      if (!existing.empty) {
        console.log("User creation failed: email already exists:", email);
        return res.status(400).json({ message: "User already exists" });
      }

      const id = Math.random().toString(36).substr(2, 9);
      const newUser = {
        id,
        email,
        password: bcrypt.hashSync(password, 10),
        role,
        name,
        accessibleLocations: accessibleLocations || [],
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", id), newUser);
      console.log("User created successfully with ID:", id);

      res.json({ user: { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name, accessibleLocations: newUser.accessibleLocations } });
    } catch (err: any) {
      console.error("Error creating user:", err);
      res.status(500).json({ message: "Failed to create user", error: err.message });
    }
  });

  app.patch("/api/users/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { id } = req.params;
    const { accessibleLocations, name, role, email, password } = req.body;
    
    try {
      console.log(`Updating user ${id}:`, { email, role, name, accessibleLocations });
      // await ensureAuthenticated();
      const { db, doc, getDoc, collection, query, where, getDocs, updateDoc } = await getFirebase();
      const userRef = doc(db, "users", id);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.warn(`Update failed: User ${id} not found.`);
        return res.status(404).json({ message: "User not found" });
      }

      const updates: any = {};

      if (email !== undefined) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const existing = await getDocs(q);
        if (!existing.empty && existing.docs[0].id !== id) {
          console.log(`Update failed: Email ${email} already in use.`);
          return res.status(400).json({ message: "Email already in use" });
        }
        updates.email = email;
      }
      
      if (password !== undefined && password !== "") {
        console.log("Hashing new password for user:", id);
        updates.password = bcrypt.hashSync(password, 10);
      }

      if (accessibleLocations !== undefined) updates.accessibleLocations = accessibleLocations;
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;

      await updateDoc(userRef, updates);
      console.log(`User ${id} updated successfully.`);
      res.json({ message: "User updated successfully" });
    } catch (err: any) {
      console.error(`Error updating user ${id}:`, err);
      res.status(500).json({ message: "Failed to update user", error: err.message });
    }
  });

  app.delete("/api/users/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { id } = req.params;
    
    try {
      // await ensureAuthenticated();
      const { db, doc, getDoc, deleteDoc } = await getFirebase();
      const userRef = doc(db, "users", id);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return res.status(404).json({ message: "User not found" });

      await deleteDoc(userRef);
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("EXPRESS GLOBAL ERROR:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: err.message,
        stack: err.stack
      });
    }
  });

  return app;
}

async function startServer() {
  const app = await createServer();
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && process.env.SEPARATE_VITE !== "true") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export { createServer };

// Only start the standalone server if NOT running as a serverless function
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  startServer().catch(err => {
    console.error("Failed to start server:", err);
  });
}
