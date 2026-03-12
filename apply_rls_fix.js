import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- Drop existing incorrect policy for system_documents
DROP POLICY IF EXISTS "Admins can manage system documents" ON public.system_documents;

-- Create proper RLS policies for system_documents

-- SELECT: Any authenticated user can view system documents
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

-- DELETE: Only admins/ceo can delete system documents
CREATE POLICY "Admins can delete system documents" 
ON public.system_documents
FOR DELETE TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));
`;

async function applyFix() {
  try {
    console.log('Applying RLS fix to system_documents table...');
    await pool.query(sql);
    console.log('✓ RLS policies applied successfully!');
    
    // Verify policies
    const result = await pool.query(`
      SELECT policyname, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'system_documents'
    `);
    
    console.log('\nCurrent policies:');
    result.rows.forEach(row => {
      console.log(`  - ${row.policyname}: ${row.cmd}`);
    });
    
    console.log('\n✅ Fix complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error applying fix:', err.message);
    process.exit(1);
  }
}

applyFix();
