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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || DEFAULT_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Initialize Supabase Client
// We use the service role key if available, otherwise fallback to anon key to prevent crash.
// Admin features will only work if the service role key is actually provided.
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || DEFAULT_ANON_KEY);

// --- ADMIN API ROUTES ---

// Create User
app.post("/api/admin/create-user", async (req, res) => {
  const { email, password, full_name, role } = req.body;

  try {
    if (!SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Admin actions are disabled.");
    }

    // 1. Create user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (authError) throw authError;
    
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
    if (!SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Admin actions are disabled.");
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: error.message });
  }
});

// Send Email
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
  res.json({ status: "ok" });
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