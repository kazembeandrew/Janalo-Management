import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Default credentials for the project
const SUPABASE_URL = "https://tfpzehyrkzbenjobkdsz.supabase.co";
const DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmcHplaHlya3piZW5qb2JrZHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDc1MjIsImV4cCI6MjA4Njk4MzUyMn0.p5NEtPP5xAlqBbZwibnkZv2MH4RVYfVKqt8MewTHNsQ";

// The Service Role Key is required for administrative tasks (creating users, resetting passwords)
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || DEFAULT_ANON_KEY);

// Startup Health Check
console.log("--- Janalo Server Configuration ---");
console.log(`Supabase URL: ${SUPABASE_URL}`);
if (SERVICE_ROLE_KEY) {
    console.log("✅ SUPABASE_SERVICE_ROLE_KEY detected. Admin features enabled.");
} else {
    console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY is missing. User management features will be restricted.");
}
console.log("----------------------------------");

// --- API ROUTES ---

// Health Check for UI to verify server status
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        admin_enabled: !!SERVICE_ROLE_KEY,
        timestamp: new Date().toISOString()
    });
});

// Create User
app.post("/api/admin/create-user", async (req, res) => {
  const { email, password, full_name, role } = req.body;

  if (!SERVICE_ROLE_KEY) {
      return res.status(500).json({ 
          error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Please add it to your environment variables." 
      });
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (authError) throw authError;

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ role: role })
      .eq('id', authData.user.id);

    if (updateError) console.warn("User created, but profile role update failed.");
    
    res.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update User Role (Promotion)
app.post("/api/admin/update-user-role", async (req, res) => {
  const { userId, newRole } = req.body;

  if (!SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." });
  }

  try {
    // 1. Update Auth Metadata
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { role: newRole }
    });

    if (authError) throw authError;

    // 2. Update Public Profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);

    if (profileError) throw profileError;

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating user role:", error);
    res.status(500).json({ error: error.message });
  }
});

// Reset Password
app.post("/api/admin/reset-password", async (req, res) => {
  const { userId, newPassword } = req.body;

  if (!SERVICE_ROLE_KEY) {
      return res.status(500).json({ 
          error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server." 
      });
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: error.message });
  }
});

// Send Email (Simulation)
app.post("/api/admin/send-email", async (req, res) => {
  const { to, subject, html } = req.body;
  try {
    console.log(`[EMAIL SIMULATION] To: ${to}, Subject: ${subject}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();