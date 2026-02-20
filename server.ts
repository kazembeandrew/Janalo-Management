import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Default credentials for the project
const DEFAULT_URL = "https://tfpzehyrkzbenjobkdsz.supabase.co";
const DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmcHplaHlya3piZW5qb2JrZHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDc1MjIsImV4cCI6MjA4Njk4MzUyMn0.p5NEtPP5xAlqBbZwibnkZv2MH4RVYfVKqt8MewTHNsQ";

// Robust environment variable detection
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || "";

// Initialize Supabase Admin Client
// If SERVICE_ROLE_KEY is missing, we use the anon key so the server doesn't crash, 
// but admin functions will return a 401/403 error which we handle below.
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || DEFAULT_ANON_KEY);

// Startup Health Check
console.log("--- Server Configuration ---");
console.log(`URL: ${SUPABASE_URL}`);
console.log(`Service Role Key: ${SERVICE_ROLE_KEY ? "DETECTED (starts with " + SERVICE_ROLE_KEY.substring(0, 5) + "...)" : "MISSING"}`);
if (!SERVICE_ROLE_KEY) {
    console.warn("⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. User creation and password resets will fail.");
}
console.log("---------------------------");

// --- ADMIN API ROUTES ---

// Create User
app.post("/api/admin/create-user", async (req, res) => {
  const { email, password, full_name, role } = req.body;

  if (!SERVICE_ROLE_KEY) {
      return res.status(500).json({ 
          error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Admin actions are disabled." 
      });
  }

  try {
    // 1. Create user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (authError) throw authError;

    // 2. Update the public users table (Supabase trigger usually handles this, but we ensure role is set)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ role: role })
      .eq('id', authData.user.id);

    if (updateError) console.warn("Note: User created but role update in public table failed. Check triggers.");
    
    res.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: error.message });
  }
});

// Reset Password
app.post("/api/admin/reset-password", async (req, res) => {
  const { userId, newPassword } = req.body;

  if (!SERVICE_ROLE_KEY) {
      return res.status(500).json({ 
          error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Admin actions are disabled." 
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