import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const DEFAULT_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !DEFAULT_ANON_KEY) {
  console.error('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are required');
  process.exit(1);
}

// Admin client for privileged operations - require service role key
const supabaseAdmin = SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  : createClient(SUPABASE_URL, DEFAULT_ANON_KEY);

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

    if (!profile || !['admin', 'ceo'].includes(profile.role)) {
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
    // Create user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (authError) throw authError;

    // Create profile in public.users
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: full_name || email.split('@')[0],
        role: role || 'loan_officer',
        is_active: true
      });

    if (profileError) {
      // If profile already exists, just update the role
      await supabaseAdmin
        .from('users')
        .update({ role: role })
        .eq('id', authData.user.id);
    }

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

// --- SCHEDULED JOB ENDPOINTS (for cron jobs) ---

app.post("/api/jobs/daily-par-provisioning", authorizeAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.rpc('daily_par_provisioning_job');

        if (error) throw error;

        res.json({
            success: true,
            message: "Daily PAR and provisioning job completed",
            result: data
        });
    } catch (error: any) {
        console.error("Daily PAR job failed:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post("/api/jobs/monthly-financial-statements", authorizeAdmin, async (req, res) => {
    try {
        const month = req.body.month || new Date().toISOString().split('T')[0].substring(0, 7) + '-01';

        const { data, error } = await supabaseAdmin.rpc('generate_monthly_financial_statements', {
            p_month: month
        });

        if (error) throw error;

        res.json({
            success: true,
            message: "Monthly financial statements generated",
            result: data
        });
    } catch (error: any) {
        console.error("Monthly statements job failed:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get("/api/security/audit", authorizeAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.rpc('security_audit_check');

        if (error) throw error;

        res.json({
            success: true,
            audit_results: data
        });
    } catch (error: any) {
        console.error("Security audit failed:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get("/api/compliance/audit-trail", authorizeAdmin, async (req, res) => {
    try {
        const {
            start_date,
            end_date,
            table_name,
            user_id
        } = req.query;

        const { data, error } = await supabaseAdmin.rpc('get_compliance_audit_trail', {
            p_start_date: start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            p_end_date: end_date || new Date().toISOString().split('T')[0],
            p_table_name: table_name || null,
            p_user_id: user_id || null
        });

        if (error) throw error;

        res.json({
            success: true,
            audit_trail: data
        });
    } catch (error: any) {
        console.error("Compliance audit trail failed:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});