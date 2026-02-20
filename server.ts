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

// Try to find the service role key in various common env var names
const SERVICE_ROLE_KEY = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SERVICE_ROLE_KEY || 
    "";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_URL;

// Initialize Supabase Client - Use Service Role if available, otherwise fallback to Anon (Admin actions will fail)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || DEFAULT_ANON_KEY);

if (!SERVICE_ROLE_KEY) {
    console.warn("⚠️ [SERVER] SUPABASE_SERVICE_ROLE_KEY is not detected. Admin actions (User Creation/Password Reset) will fail until this secret is added to your environment.");
}

// --- ADMIN API ROUTES ---

// Create User (Maker: Admin creates, Status: Pending)
app.post("/api/admin/create-user", async (req, res) => {
  const { email, password, full_name, role } = req.body;

  try {
    // 1. Create user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (authError) {
        // If it's a 401/403, it's likely the missing service role key
        if (authError.status === 401 || authError.status === 403) {
            throw new Error("Unauthorized: The server requires a valid SUPABASE_SERVICE_ROLE_KEY to perform admin actions.");
        }
        throw authError;
    }

    // 2. Immediately set to inactive and mark as pending approval in the public users table
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        is_active: false, 
        deletion_status: 'pending_approval',
        role: role 
      })
      .eq('id', authData.user.id);

    if (updateError) throw updateError;
    
    res.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: error.message });
  }
});

// Reset Password
app.post("/api/admin/reset-password", async (req, res) => {
  const { userId, newPassword } = req.body;

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) {
        if (error.status === 401 || error.status === 403) {
            throw new Error("Unauthorized: The server requires a valid SUPABASE_SERVICE_ROLE_KEY to perform admin actions.");
        }
        throw error;
    }
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
    console.error("Error sending email:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
      status: "ok", 
      admin_enabled: !!SERVICE_ROLE_KEY,
      supabase_url: SUPABASE_URL 
  });
});

async function startServer() {
  // Vite middleware for development
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