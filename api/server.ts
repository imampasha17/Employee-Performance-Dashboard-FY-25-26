import express from "express";
import admin from "firebase-admin";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { fileURLToPath } from 'url';

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

let adminApp: admin.app.App | null = null;
let adminDb: admin.firestore.Firestore | null = null;

async function getAdminDb() {
  if (!adminApp) {
    const config = loadConfig();
    console.log("Initializing Firebase Admin for project:", config.projectId);
    
    // Check for service account in env or config
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountVar) {
      const sa = JSON.parse(serviceAccountVar);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(sa),
        databaseId: config.firestoreDatabaseId || "(default)"
      });
    } else {
      // Fallback to project ID (works in environments with default credentials)
      adminApp = admin.initializeApp({
        projectId: config.projectId,
        databaseId: config.firestoreDatabaseId || "(default)"
      });
    }
    
    adminDb = adminApp.firestore();
    // Set settings for better performance on Vercel
    adminDb.settings({ ignoreUndefinedProperties: true });
    console.log("Firebase Admin initialized successfully");
  }
  return adminDb!;
}

// No longer needed with Admin SDK
async function ensureAuthenticated() {
  return; 
}

// Helper to ensure admin exists in Firestore
async function ensureAdmin() {
  try {
    const db = await getAdminDb();
    const adminId = "admin-1";
    const adminRef = db.collection("users").doc(adminId);
    
    const adminSnap = await adminRef.get();
    if (!adminSnap.exists) {
      console.log("Creating default admin...");
      const hashedPassword = bcrypt.hashSync("admin123", 10);
      await adminRef.set({
        id: adminId,
        email: "admin@dashboard.com",
        password: hashedPassword,
        role: "admin",
        name: "System Admin",
        accessibleLocations: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log("Default admin created: admin@dashboard.com / admin123");
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
        const db = await getAdminDb();
        const userSnap = await db.collection("users").doc(decoded.id).get();
        
        if (userSnap.exists) {
          const userData = userSnap.data() || {};
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
      const db = await getAdminDb();
      res.json({ 
        status: "ok", 
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
      const db = await getAdminDb();
      const testRef = db.collection("test").doc("connection");
      await testRef.set({ time: new Date().toISOString() });
      const snap = await testRef.get();
      res.json({ success: true, data: snap.data() });
    } catch (err: any) {
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    console.log("Login attempt for:", email);
    
    try {
      console.log("Ensuring admin exists...");
      await ensureAdmin();
      
      const db = await getAdminDb();
      console.log("Querying users for email:", email);
      const querySnapshot = await db.collection("users").where("email", "==", email).get();
      
      if (querySnapshot.empty) {
        console.log("No user found with email:", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const userDoc = querySnapshot.docs[0];
      const user = userDoc.data();

      if (typeof password !== 'string' || typeof user.password !== 'string') {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log("Comparing passwords...");
      const isMatch = bcrypt.compareSync(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        accessibleLocations: user.accessibleLocations, 
        name: user.name 
      }, JWT_SECRET);

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
      console.error("Login error:", err);
      res.status(500).json({ message: "Internal server error", error: err.message });
    }
  });

  app.get("/api/me", authenticate, (req: any, res) => {
    res.json({ user: req.user });
  });

  app.get("/api/data", authenticate, async (req: any, res) => {
    try {
      const db = await getAdminDb();
      
      // 1. Get the pointer to the latest successful upload
      const metaRef = db.collection("metadata").doc("latest_upload");
      const metaSnap = await metaRef.get();
      const latestUploadId = metaSnap.exists ? metaSnap.data()?.uploadId : null;

      if (!latestUploadId) {
        console.log("No latest upload found in metadata.");
        return res.json({ data: [] });
      }

      console.log(`Fetching data for snapshot: ${latestUploadId}`);
      
      // 2. Query only chunks that belong to this snapshot
      // IMPORTANT: Removing orderBy("index") to avoid requiring a custom composite index.
      // We will sort in memory since there are only as many docs as chunks (e.g. 10-20).
      const globalRef = db.collection("global_data");
      const querySnapshot = await globalRef.where("uploadId", "==", latestUploadId).get();
      
      let segments: { index: number, data: any[] }[] = [];
      querySnapshot.forEach(doc => {
        const docData = doc.data();
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

      // Sort segments in memory by index
      segments.sort((a, b) => a.index - b.index);
      let data = segments.flatMap(s => s.data);

      // Filter data if not admin.
      if (req.user.role !== "admin" && req.user.accessibleLocations && req.user.accessibleLocations.length > 0) {
        data = data.filter((item: any) => req.user.accessibleLocations.includes(item.location));
      }

      console.log(`Delivering ${data.length} records to ${req.user.email} from snap ${latestUploadId}`);
      res.json({ data });
    } catch (err: any) {
      console.error("Fetch data error:", err);
      res.status(500).json({ message: "Failed to fetch data", error: err.message });
    }
  });

  app.delete("/api/data", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const db = await getAdminDb();
      
      // Instant clear by removing the pointer
      const metaRef = db.collection("metadata").doc("latest_upload");
      await metaRef.delete();

      console.log("Database 'cleared' by removing latest_upload pointer.");
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
    
    if (!uploadId) {
      return res.status(400).json({ message: "Missing uploadId" });
    }

    try {
      const db = await getAdminDb();
      const globalRef = db.collection("global_data");

      // Use a unique ID for each chunk in this specific upload session
      const chunkDocId = `chunk_${uploadId}_${chunkIndex}`;
      await globalRef.doc(chunkDocId).set({ 
        payload: JSON.stringify(data),
        index: chunkIndex,
        uploadId: uploadId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Saved snapshot chunk ${uploadId} - ${chunkIndex}. Size: ${data.length} records.`);
      res.json({ success: true, message: `Chunk ${chunkIndex} of session ${uploadId} saved` });
    } catch (err: any) {
      console.error(`Error saving chunk ${chunkIndex}:`, err);
      res.status(500).json({ 
        message: `Failed to save chunk ${chunkIndex}`, 
        error: err.message
      });
    }
  });

  app.post("/api/finalize-upload", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    const { uploadId } = req.body;
    if (!uploadId) return res.status(400).json({ message: "Missing uploadId" });

    try {
      const db = await getAdminDb();
      
      // Update the pointer to make this upload live
      const metaRef = db.collection("metadata").doc("latest_upload");
      await metaRef.set({ 
        uploadId: uploadId,
        finalizedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log(`Upload ${uploadId} is now LIVE.`);
      res.json({ success: true, message: "Upload finalized" });
    } catch (err: any) {
      console.error("Finalization error:", err);
      res.status(500).json({ message: "Failed to finalize upload", error: err.message });
    }
  });

  app.get("/api/users", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    
    try {
      const db = await getAdminDb();
      const usersSnap = await db.collection("users").get();
      
      const users = usersSnap.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
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
      const db = await getAdminDb();
      const existing = await db.collection("users").where("email", "==", email).get();

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
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("users").doc(id).set(newUser);
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
      const db = await getAdminDb();
      const userRef = db.collection("users").doc(id);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return res.status(404).json({ message: "User not found" });
      }

      const updates: any = {};

      if (email !== undefined) {
        const existing = await db.collection("users").where("email", "==", email).get();
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

      await userRef.update(updates);
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
      const db = await getAdminDb();
      await db.collection("users").doc(id).delete();
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
