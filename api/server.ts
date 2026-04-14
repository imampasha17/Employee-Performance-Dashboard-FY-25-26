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
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("CRITICAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '100mb' }));

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
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

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "supabase", time: new Date().toISOString() });
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) return res.status(401).json({ message: "Invalid credentials" });

      const isMatch = bcrypt.compareSync(password, user.password);
      if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign({ 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        name: user.name 
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
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/data", authenticate, async (req: any, res) => {
    try {
      let query = supabase.from('sales').select('*');
      
      // Filter by location if not admin
      if (req.user.role !== "admin" && req.user.accessibleLocations?.length > 0) {
        query = query.in('location', req.user.accessibleLocations);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Map back to camelCase for frontend compatibility
      const mappedData = data.map(row => ({
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
        current_due_value: Number(row.current_due_value),
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

  // Single-shot upload for Supabase (Truncate and Insert)
  app.post("/api/upload", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ message: "Invalid data format" });

    try {
      console.log(`Clearing old data and inserting ${data.length} records...`);

      // 1. Delete all existing sales data (as requested: "old data should delete")
      const { error: deleteError } = await supabase.from('sales').delete().neq('location', '___TRUNCATE_HACK___');
      if (deleteError) throw deleteError;

      // 2. Prepare data for bulk insert
      const rows = data.map(mapRowToSupabase);

      // 3. Bulk insert (Supabase handles thousands of rows in chunks automatically or we can batch)
      const BATCH_SIZE = 2000;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from('sales').insert(batch);
        if (insertError) throw insertError;
        console.log(`Inserted batch ${i/BATCH_SIZE + 1}`);
      }

      res.json({ success: true, message: "Data replaced successfully" });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ message: "Failed to upload data", error: err.message });
    }
  });

  app.delete("/api/data", authenticate, async (req: any, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      await supabase.from('sales').delete().neq('location', '___TRUNCATE_HACK___');
      res.json({ message: "Data cleared successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to clear data" });
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
  app.listen(PORT, () => {
    console.log(`Supabase-backed server running on port ${PORT}`);
  });
}

createServer().catch(err => {
  console.error("Failed to start server:", err);
});
