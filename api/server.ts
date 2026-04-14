import express from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  serverTimestamp
} from "firebase/firestore";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

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

let firebaseApp: any;
let db: any;

async function getFirebase() {
  if (!firebaseApp) {
    const config = loadConfig();
    console.log("Initializing Firebase for project:", config.projectId);
    
    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
    
    if (config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)") {
      // Use the standard getFirestore but with settings if needed
      db = getFirestore(firebaseApp, config.firestoreDatabaseId);
    } else {
      db = getFirestore(firebaseApp);
    }
  }
  return { db };
}

// Utility for operation timeouts
const withTimeout = (promise: Promise<any>, ms: number, label: string) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation Timeout: ${label}`)), ms))
  ]);
};

// No longer needed: we rely on JWT for dashboard security 
// and the database is currently configured to allow the server.
async function ensureAuthenticated() {
  return; 
}

// Helper to ensure admin exists in Firestore
async function ensureAdmin() {
  try {
    const { db } = await getFirebase();
    const adminId = "admin-1";
    const adminRef = doc(db, "users", adminId);
    
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      console.log("Creating default admin account...");
      const hashedPassword = bcrypt.hashSync("admin123", 10);
      await setDoc(adminRef, {
        id: adminId,
        email: "admin@dashboard.com",
        password: hashedPassword,
        role: "admin",
        name: "System Admin",
        accessibleLocations: [],
        createdAt: new Date().toISOString()
      });
      console.log("Default admin account live: admin@dashboard.com / admin123");
    }
  } catch (err) {
    console.error("Failed to check/create admin account:", err);
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
        const { db } = await getFirebase();
        const userRef = doc(db, "users", decoded.id);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data() as any;
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
      res.json({ 
        status: "ok", 
        projectId: config.projectId,
        databaseId: config.firestoreDatabaseId,
        hasApiKey: !!config.apiKey,
        hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
        nodeEnv: process.env.NODE_ENV,
        isVercel: !!process.env.VERCEL,
        time: new Date().toISOString()
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
      const { db } = await getFirebase();
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
    
    try {
      await ensureAdmin();
      
      const { db } = await getFirebase();
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const userDoc = querySnapshot.docs[0];
      const user = userDoc.data() as any;

      if (typeof password !== 'string' || typeof user.password !== 'string') {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isMatch = bcrypt.compareSync(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ 
        id: userDoc.id, 
        email: user.email, 
        role: user.role, 
        accessibleLocations: user.accessibleLocations, 
        name: user.name 
      }, JWT_SECRET);

      res.json({ 
        token, 
        user: { 
          id: userDoc.id, 
          email: user.email, 
          role: user.role, 
          accessibleLocations: user.accessibleLocations, 
          name: user.name 
        } 
      });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Internal server error", error: err.message });
    }
  });

  app.get("/api/me", authenticate, (req: any, res) => {
    res.json({ user: req.user });
  });

  app.get("/api/data", authenticate, async (req: any, res) => {
    try {
      const { db } = await getFirebase();
      
      const metaRef = doc(db, "metadata", "latest_upload");
      const metaSnap = await getDoc(metaRef);
      const latestUploadId = metaSnap.exists() ? metaSnap.data().uploadId : null;

      if (!latestUploadId) {
        return res.json({ data: [] });
      }
      
      const globalRef = collection(db, "global_data");
      const q = query(globalRef, where("uploadId", "==", latestUploadId));
      const querySnapshot = await getDocs(q);
      
      let segments: { index: number, data: any[] }[] = [];
      querySnapshot.forEach(docSnap => {
        const docData = docSnap.data();
        if (docData.payload) {
          try {
            segments.push({
              index: docData.index || 0,
              data: JSON.parse(docData.payload)
            });
          } catch(e) {
            console.error("Parse payload err", e);
          }
        }
      });

      segments.sort((a, b) => a.index - b.index);
      let data = segments.flatMap(s => s.data);

      if (req.user.role !== "admin" && req.user.accessibleLocations && req.user.accessibleLocations.length > 0) {
        data = data.filter((item: any) => req.user.accessibleLocations.includes(item.location));
      }

      res.json({ data });
    } catch (err: any) {
      console.error("Fetch data error:", err);
      res.status(500).json({ message: "Failed to fetch data", error: err.message });
    }
  });

  app.delete("/api/data", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { db } = await getFirebase();
      const metaRef = doc(db, "metadata", "latest_upload");
      await deleteDoc(metaRef);
      res.json({ message: "Data cleared successfully" });
    } catch (err: any) {
      console.error("Clear data error:", err);
      res.status(500).json({ message: "Failed to clear data", error: err.message });
    }
  });

  // DEPRECATED: Old single-request upload (replaced by chunked upload)
  app.post("/api/upload", authenticate, async (req: any, res) => {
    res.status(405).json({ message: "Use /api/upload-chunk and finalize instead." });
  });

  app.post("/api/upload-chunk", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { data, chunkIndex, uploadId } = req.body;
    if (!uploadId) return res.status(400).json({ message: "Missing uploadId" });

    try {
      const { db } = await getFirebase();
      const globalRef = collection(db, "global_data");
      const chunkDocRef = doc(globalRef, `chunk_${uploadId}_${chunkIndex}`);
      
      await withTimeout(setDoc(chunkDocRef, { 
        payload: JSON.stringify(data),
        index: chunkIndex,
        uploadId: uploadId,
        updatedAt: new Date().toISOString()
      }), 12000, `Upload Chunk ${chunkIndex}`); // 12s timeout for setDoc
      
      res.json({ success: true, message: `Chunk ${chunkIndex} saved` });
    } catch (err: any) {
      console.error(`Error saving chunk ${chunkIndex}:`, err);
      res.status(500).json({ message: `Failed to save chunk ${chunkIndex}`, error: err.message });
    }
  });

  app.post("/api/finalize-upload", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { uploadId } = req.body;
    if (!uploadId) return res.status(400).json({ message: "Missing uploadId" });

    try {
      const { db } = await getFirebase();
      const metaRef = doc(db, "metadata", "latest_upload");
      await setDoc(metaRef, { 
        uploadId: uploadId,
        finalizedAt: new Date().toISOString()
      }, { merge: true });

      res.json({ success: true, message: "Upload finalized" });
    } catch (err: any) {
      console.error("Finalization error:", err);
      res.status(500).json({ message: "Failed to finalize upload", error: err.message });
    }
  });

  app.get("/api/users", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    
    try {
      const { db } = await getFirebase();
      const usersRef = collection(db, "users");
      const usersSnap = await getDocs(usersRef);
      
      const users = usersSnap.docs.map(docSnap => {
        const data = docSnap.data() as any;
        return { 
          id: docSnap.id, 
          email: data.email || "", 
          role: data.role || "user", 
          name: data.name || "Unknown User", 
          accessibleLocations: data.accessibleLocations || [] 
        };
      });
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
      const { db } = await getFirebase();
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const existing = await getDocs(q);

      if (!existing.empty) {
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
      res.json({ user: { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name, accessibleLocations: newUser.accessibleLocations } });
    } catch (err: any) {
      console.error("Error creating user:", err);
      res.status(500).json({ message: "Failed to create user", error: err.message });
    }
  });

  app.patch("/api/users/:id", authenticate, async (req: any, res: any) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { id } = req.params;
    const { accessibleLocations, name, role, email, password } = req.body;
    
    try {
      const { db } = await getFirebase();
      const userRef = doc(db, "users", id);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return res.status(404).json({ message: "User not found" });
      }

      const updates: any = {};

      if (email !== undefined) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const existing = await getDocs(q);
        if (!existing.empty && existing.docs[0].id !== id) {
          return res.status(400).json({ message: "Email already in use" });
        }
        updates.email = email;
      }
      
      if (password !== undefined && password !== "") {
        updates.password = bcrypt.hashSync(password, 10);
      }

      if (accessibleLocations !== undefined) updates.accessibleLocations = accessibleLocations;
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;

      await updateDoc(userRef, updates);
      res.json({ message: "User updated successfully" });
    } catch (err: any) {
      console.error(`Error updating user ${id}:`, err);
      res.status(500).json({ message: "Failed to update user", error: err.message });
    }
  });

  app.delete("/api/users/:id", authenticate, async (req: any, res: any) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { id } = req.params;
    
    try {
      const { db } = await getFirebase();
      await deleteDoc(doc(db, "users", id));
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
