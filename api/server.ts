import express from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { fileURLToPath } from 'url';
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

let supabase: any;

try {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
} catch (err) {
  console.error("Supabase Init Error:", err);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_DATA_FILE = path.join(__dirname, 'local_data.json');
let localDataCache: any[] = [];

if (fs.existsSync(LOCAL_DATA_FILE)) {
  try {
    localDataCache = JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf-8'));
    console.log(`Loaded ${localDataCache.length} records from local cache`);
  } catch(e) {
    console.error("Failed to parse local data cache", e);
  }
}

// Helper for camelCase to snake_case mapping for Supabase
function mapRowToSupabase(row: any) {
  return {
    source: row.source,
    location_code: row.locationCode,
    location: row.location,
    employee_code: row.employeeCode,
    employee_name: row.employeeName,
    joining_date: row.joiningDate,
    order_no: row.orderNo,
    profile_no: row.profileNo,
    customer_name: row.customerName,
    scheme_type: row.schemeType,
    scheme_status: row.schemeStatus,
    installment_amount: row.installmentAmount || 0,
    expected_inst_amount: row.expectedInstAmount || 0,
    current_received_amount: row.currentReceivedAmount || 0,
    total_due: row.totalDue || 0,
    paid_customer_count: row.paidCustomerCount || 0,
    collection_received_value: row.collectionReceivedValue || 0,
    collection_percent: row.collectionPercent || 0,
    payment_against_overdue_value: row.paymentAgainstOverdueValue || 0,
    current_due_collection_value: row.currentDueCollectionValue || 0,
    scheme_discount: row.schemeDiscount || 0,
    enrolment_count: row.enrolmentCount || 0,
    enrolment_value: row.enrolmentValue || 0,
    overdue_count: row.overdueCount || 0,
    overdue_value: row.overdueValue || 0,
    od_collection_count: row.odCollectionCount || 0,
    od_collection_value: row.odCollectionValue || 0,
    current_due_count: row.currentDueCount || 0,
    current_due_value: row.currentDueValue || 0,
    cd_collection_count: row.cdCollectionCount || 0,
    cd_collection_value: row.cdCollectionValue || 0,
    forclosed_count: row.forclosedCount || 0,
    forclosed_value: row.forclosedValue || 0,
    redemption_actual: row.redemptionActual || 0,
    redemption_pending: row.redemptionPending || 0,
    re_enrolment_count: row.reEnrolmentCount || 0,
    re_enrolment_value: row.reEnrolmentValue || 0,
    up_sale_count: row.upSaleCount || 0,
    up_sale_value: row.upSaleValue || 0
  };
}

export async function createServer() {
  const app = express();
  app.use(express.json({ limit: '100mb' }));

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global express error:", err);
    res.status(500).json({ message: "Global Server Error", error: err.message || JSON.stringify(err) });
  });

  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Unauthorized" });
    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (!supabase) {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name,
          accessibleLocations: decoded.accessibleLocations || []
        };
        return next();
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.id)
        .single();

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          accessibleLocations: user.accessible_locations || []
        };
      } else {
        req.user = decoded;
      }
      next();
    } catch (err) {
      res.status(401).json({ message: "Invalid token" });
    }
  };

  app.get("/api/me", authenticate, (req: any, res) => {
    res.json({ user: req.user });
  });

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mode: supabase ? "supabase" : "local", 
      hasUrl: !!SUPABASE_URL,
      time: new Date().toISOString() 
    });
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      if (!supabase || !SUPABASE_URL) {
        // Fallback for local development if Supabase is not configured
        if (email === "admin@example.com" && password === "admin123") {
          console.log("Using local fallback login");
          const token = jwt.sign({ 
            id: "local-admin", 
            email: "admin@example.com", 
            role: "admin", 
            name: "Local Admin",
            accessibleLocations: []
          }, JWT_SECRET);

          return res.json({ 
            token, 
            user: { 
              id: "local-admin", 
              email: "admin@example.com", 
              role: "admin", 
              name: "Local Admin",
              accessibleLocations: []
            } 
          });
        }
        return res.status(401).json({ message: "Invalid credentials. For local access use: admin@example.com / admin123" });
      }

      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .limit(1);

      if (error) {
        console.error("Supabase Login Fetch Error:", error);
        return res.status(500).json({ message: `Database error: ${error.message}` });
      }
      
      const user = users && users.length > 0 ? users[0] : null;
      if (!user) return res.status(401).json({ message: "Invalid credentials (User not found)" });

      const isMatch = bcrypt.compareSync(password, user.password);
      if (!isMatch) return res.status(401).json({ message: "Invalid credentials (Password mismatch)" });

      const token = jwt.sign({ 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        name: user.name,
        accessibleLocations: user.accessible_locations || []
      }, JWT_SECRET);

      res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role, 
          name: user.name,
          accessibleLocations: user.accessible_locations || []
        } 
      });
    } catch (err: any) {
      console.error("Login catch error:", err);
      res.status(500).json({ message: `Internal server error: ${err.message}` });
    }
  });

  app.get("/api/data", authenticate, async (req: any, res) => {
    try {
      if (!supabase) {
        let processedData = localDataCache;
        if (req.user.role !== "admin" && req.user.accessibleLocations?.length > 0) {
          const allowed = req.user.accessibleLocations.map((l: string) => l.toLowerCase().trim());
          processedData = localDataCache.filter((row: any) => 
            allowed.includes((row.location || "").toLowerCase().trim())
          );
        }
        
        // Map back to camelCase for frontend compatibility
        const mappedData = processedData.map((row: any) => ({
          id: row.id,
          source: row.source,
          locationCode: row.location_code,
          location: row.location,
          employeeCode: row.employee_code,
          employeeName: row.employee_name,
          joiningDate: row.joining_date,
          orderNo: row.order_no,
          profileNo: row.profile_no,
          customerName: row.customer_name,
          schemeType: row.scheme_type,
          schemeStatus: row.scheme_status,
          installmentAmount: Number(row.installment_amount),
          expectedInstAmount: Number(row.expected_inst_amount),
          currentReceivedAmount: Number(row.current_received_amount),
          totalDue: Number(row.total_due),
          paidCustomerCount: Number(row.paid_customer_count),
          collectionReceivedValue: Number(row.collection_received_value),
          collectionPercent: Number(row.collection_percent),
          paymentAgainstOverdueValue: Number(row.payment_against_overdue_value),
          currentDueCollectionValue: Number(row.current_due_collection_value),
          schemeDiscount: Number(row.scheme_discount),
          enrolmentCount: Number(row.enrolment_count),
          enrolmentValue: Number(row.enrolment_value),
          overdueCount: Number(row.overdue_count),
          overdueValue: Number(row.overdue_value),
          odCollectionCount: Number(row.od_collection_count),
          odCollectionValue: Number(row.od_collection_value),
          currentDueCount: Number(row.current_due_count),
          currentDueValue: Number(row.current_due_value),
          cdCollectionCount: Number(row.cd_collection_count),
          cdCollectionValue: Number(row.cd_collection_value),
          forclosedCount: Number(row.forclosed_count),
          forclosedValue: Number(row.forclosed_value),
          redemptionActual: Number(row.redemption_actual),
          redemptionPending: Number(row.redemption_pending),
          reEnrolmentCount: Number(row.re_enrolment_count),
          reEnrolmentValue: Number(row.re_enrolment_value),
          upSaleCount: Number(row.up_sale_count),
          upSaleValue: Number(row.up_sale_value)
        }));

        return res.json({ data: mappedData });
      }
      let allData: any[] = [];
      let start = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase.from('sales').select('*').range(start, start + step - 1);
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = allData.concat(data);
          start += step;
          if (data.length < step) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      // Disable caching for this endpoint to ensure sync across users
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      let processedData = allData;

      // Filter by location if not admin
      if (req.user.role !== "admin" && req.user.accessibleLocations?.length > 0) {
        const allowed = req.user.accessibleLocations.map((l: string) => l.toLowerCase().trim());
        processedData = data.filter(row => 
          allowed.includes((row.location || "").toLowerCase().trim())
        );
      }

      // Map back to camelCase for frontend compatibility
      const mappedData = processedData.map(row => ({
        id: row.id,
        source: row.source,
        locationCode: row.location_code,
        location: row.location,
        employeeCode: row.employee_code,
        employeeName: row.employee_name,
        joiningDate: row.joining_date,
        orderNo: row.order_no,
        profileNo: row.profile_no,
        customerName: row.customer_name,
        schemeType: row.scheme_type,
        schemeStatus: row.scheme_status,
        installmentAmount: Number(row.installment_amount),
        expectedInstAmount: Number(row.expected_inst_amount),
        currentReceivedAmount: Number(row.current_received_amount),
        totalDue: Number(row.total_due),
        paidCustomerCount: Number(row.paid_customer_count),
        collectionReceivedValue: Number(row.collection_received_value),
        collectionPercent: Number(row.collection_percent),
        paymentAgainstOverdueValue: Number(row.payment_against_overdue_value),
        currentDueCollectionValue: Number(row.current_due_collection_value),
        schemeDiscount: Number(row.scheme_discount),
        enrolmentCount: Number(row.enrolment_count),
        enrolmentValue: Number(row.enrolment_value),
        overdueCount: Number(row.overdue_count),
        overdueValue: Number(row.overdue_value),
        odCollectionCount: Number(row.od_collection_count),
        odCollectionValue: Number(row.od_collection_value),
        currentDueCount: Number(row.current_due_count),
        currentDueValue: Number(row.current_due_value),
        cdCollectionCount: Number(row.cd_collection_count),
        cdCollectionValue: Number(row.cd_collection_value),
        forclosedCount: Number(row.forclosed_count),
        forclosedValue: Number(row.forclosed_value),
        redemptionActual: Number(row.redemption_actual),
        redemptionPending: Number(row.redemption_pending),
        reEnrolmentCount: Number(row.re_enrolment_count),
        reEnrolmentValue: Number(row.re_enrolment_value),
        upSaleCount: Number(row.up_sale_count),
        upSaleValue: Number(row.up_sale_value)
      }));

      res.json({ data: mappedData });
    } catch (err: any) {
      console.error("Fetch data error:", err);
      res.status(500).json({ message: "Failed to fetch data", error: err.message });
    }
  });

  // --- CHUNKED UPLOAD FOR LARGE FILES (SUPABASE) ---
  
  // 1. Initial Start (Clears the table)
  app.post("/api/upload/start", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      if (!supabase) {
        localDataCache = [];
        fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(localDataCache));
        return res.json({ success: true, message: "Local mode: Data cleared locally" });
      }
      // Universal delete filter: 'source' is always present in valid rows
      const { error: deleteError } = await supabase.from('sales')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (deleteError) throw deleteError;
      res.json({ success: true, message: "Table cleared, ready for chunks" });
    } catch (err: any) {
      console.error("Upload start error:", err);
      res.status(500).json({ message: "Failed to start upload", error: err.message });
    }
  });

  // 2. Upload Chunk (Appends data)
  app.post("/api/upload/chunk", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ message: "Invalid data format" });

    try {
      if (!supabase) {
        const rows = data.map(mapRowToSupabase);
        localDataCache.push(...rows);
        fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(localDataCache));
        return res.json({ success: true, message: `Local mode: ${data.length} records saved locally` });
      }
      const rows = data.map(mapRowToSupabase);
      const { error: insertError } = await supabase.from('sales').insert(rows);
      if (insertError) throw insertError;
      
      res.json({ success: true, message: `Inserted chunk of ${data.length} records` });
    } catch (err: any) {
      console.error("Chunk upload error:", err);
      res.status(500).json({ message: "Failed to upload chunk", error: err.message });
    }
  });

  app.delete("/api/data", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      if (!supabase) {
        localDataCache = [];
        fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(localDataCache));
        return res.json({ message: "Local mode: Data cleared successfully" });
      }
      const { error } = await supabase.from('sales')
        .delete()
        .not('source', 'is', 'null');
      
      if (error) throw error;
      res.json({ message: "Data cleared successfully" });
    } catch (err: any) {
      console.error("Clear data error:", err);
      res.status(500).json({ message: "Failed to clear data", error: err.message });
    }
  });

  // User Management
  app.get("/api/users", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) return res.status(500).json({ error: error.message });
    
    res.json({ 
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        accessibleLocations: u.accessible_locations || []
      }))
    });
  });

  app.post("/api/users", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { email, password, role, name, accessibleLocations } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    
    const { error } = await supabase.from('users').insert({
      id,
      email,
      password: bcrypt.hashSync(password, 10),
      role,
      name,
      accessible_locations: accessibleLocations || []
    });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.patch("/api/users/:id", authenticate, async (req: any, res: any) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { id } = req.params;
    const { accessibleLocations, name, role, email, password } = req.body;
    
    const updates: any = {};
    if (email) updates.email = email;
    if (password) updates.password = bcrypt.hashSync(password, 10);
    if (name) updates.name = name;
    if (role) updates.role = role;
    if (accessibleLocations) updates.accessible_locations = accessibleLocations;

    const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.delete("/api/users/:id", authenticate, async (req: any, res: any) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Serve Frontend
  const distPath = path.join(__dirname, "../dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (!req.url.startsWith("/api/")) {
        res.sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  const PORT = process.env.PORT || 3001;
  // Only listen if we are NOT on Vercel
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`Supabase-backed server running on port ${PORT}`);
    });
  }

  return app;
}

// Only run standalone if this is the entry point
if (process.argv[1]?.includes('server.ts') || process.argv[1]?.includes('server.js')) {
  createServer().catch(err => {
    console.error("Failed to start server:", err);
  });
}
