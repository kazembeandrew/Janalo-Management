import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- First, create the system_documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('financial', 'hr', 'operational', 'general', 'template', 'loan_application')),
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean re-application)
DROP POLICY IF EXISTS "Users can view documents they have access to" ON public.system_documents;
DROP POLICY IF EXISTS "Staff can upload documents" ON public.system_documents;
DROP POLICY IF EXISTS "Staff can update their own documents" ON public.system_documents;
DROP POLICY IF EXISTS "Admins can manage system documents" ON public.system_documents;
DROP POLICY IF EXISTS "Authenticated users can view system documents" ON public.system_documents;
DROP POLICY IF EXISTS "Staff can insert system documents" ON public.system_documents;
DROP POLICY IF EXISTS "Admins and owner can update system documents" ON public.system_documents;
DROP POLICY IF EXISTS "Admins can delete system documents" ON public.system_documents;

-- SELECT: Any authenticated user can view
CREATE POLICY "Authenticated users can view system documents" 
ON public.system_documents
FOR SELECT TO authenticated USING (true);

-- INSERT: Allow staff roles (hr, accountant, loan_officer) plus admin/ceo to upload
CREATE POLICY "Staff can insert system documents" 
ON public.system_documents
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() IN ('admin', 'ceo', 'hr', 'accountant', 'loan_officer')
);

-- UPDATE: Allow admins/ceo or the original uploader to update
CREATE POLICY "Admins and owner can update system documents" 
ON public.system_documents
FOR UPDATE TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo') OR uploaded_by = auth.uid()
);

-- DELETE: Only admins/ceo can delete
CREATE POLICY "Admins can delete system documents" 
ON public.system_documents
FOR DELETE TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_documents_category ON public.system_documents(category);
CREATE INDEX IF NOT EXISTS idx_system_documents_uploaded_by ON public.system_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_system_documents_created_at ON public.system_documents(created_at);
`;

async function createTable() {
  try {
    console.log('Creating system_documents table and RLS policies...');
    await pool.query(sql);
    console.log('✅ Table created and RLS policies applied successfully!');
    
    // Verify
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'system_documents' AND table_schema = 'public'
    `);
    
    if (result.rows.length > 0) {
      console.log('\n✅ Table "system_documents" now exists!');
      
      // Show policies
      const policies = await pool.query(`
        SELECT policyname, cmd 
        FROM pg_policies 
        WHERE tablename = 'system_documents'
      `);
      
      console.log('\nRLS Policies applied:');
      policies.rows.forEach(row => {
        console.log(`  - ${row.policyname}: ${row.cmd}`);
      });
    } else {
      console.log('❌ Table still not found');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

createTable();
