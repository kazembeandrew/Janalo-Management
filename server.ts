import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const SUPABASE_URL = "https://tfpzehyrkzbenjobkdsz.supabase.co";
const DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmcHplaHlya3piZW5qb2JrZHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDc1MjIsImV4cCI6MjA4Njk4MzUyMn0.p5NEtPP5xAlqBbZwibnkZv2MH4RVYfVKqt8MewTHNsQ";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Admin client for privileged operations
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || DEFAULT_ANON_KEY);

/**
 * AUTH MIDDLEWARE
 * Verifies the user's JWT and checks if they have the required role.
 */
const authorizeAdmin = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.get?.('authorization') || req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "No authorization header" });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) return res.status(401).json({ error: "Invalid session" });

    // Check role in public.users table
    const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!profile || !['admin', 'ceo', 'hr'].includes(profile.role)) {
        return res.status(403).json({ error: "Unauthorized: Insufficient permissions" });
    }

    req.user = user;
    next();
};

// --- API ROUTES ---

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        admin_enabled: !!SERVICE_ROLE_KEY,
        timestamp: new Date().toISOString()
    });
});

app.post("/api/admin/create-user", authorizeAdmin, async (req, res) => {
  const { email, password, full_name, role } = req.body;

  if (!SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Server misconfigured: Missing Service Key" });
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

    res.json({ success: true, user: authData.user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/update-user-role", authorizeAdmin, async (req, res) => {
  const { userId, newRole } = req.body;
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { role: newRole } });
    await supabaseAdmin.from('users').update({ role: newRole }).eq('id', userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/reset-password", authorizeAdmin, async (req, res) => {
  const { userId, newPassword } = req.body;
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();