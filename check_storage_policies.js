import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkStoragePolicies() {
  try {
    console.log('🔍 Checking Supabase Storage policies...\n');
    
    // 1. Check storage buckets
    console.log('1. Storage buckets:');
    const buckets = await pool.query(`
      SELECT id, name, public, file_size_limit, allowed_mime_types
      FROM storage.buckets
      ORDER BY name
    `);
    
    if (buckets.rows.length === 0) {
      console.log('   ❌ No storage buckets found');
    } else {
      buckets.rows.forEach(bucket => {
        console.log(`   - ${bucket.name} (ID: ${bucket.id})`);
        console.log(`     Public: ${bucket.public}`);
        console.log(`     File size limit: ${bucket.file_size_limit || 'None'}`);
        console.log(`     Allowed MIME types: ${bucket.allowed_mime_types || 'Any'}`);
      });
    }
    
    // 2. Check storage policies
    console.log('\n2. Storage policies:');
    const policies = await pool.query(`
      SELECT 
        p.policyname,
        p.cmd,
        p.qual as using_clause,
        p.with_check,
        b.name as bucket_name
      FROM pg_policies p
      JOIN storage.buckets b ON p.tablename = 'objects' AND (p.qual LIKE '%' || b.id || '%' OR p.with_check LIKE '%' || b.id || '%')
      ORDER BY b.name, p.cmd
    `);
    
    if (policies.rows.length === 0) {
      console.log('   ❌ No storage policies found');
    } else {
      policies.rows.forEach(policy => {
        console.log(`   - ${policy.policyname}`);
        console.log(`     Bucket: ${policy.bucket_name}`);
        console.log(`     Operation: ${policy.cmd}`);
        if (policy.using_clause) console.log(`     USING: ${policy.using_clause}`);
        if (policy.with_check) console.log(`     WITH CHECK: ${policy.with_check}`);
        console.log('');
      });
    }
    
    // 3. Check if loan-documents bucket exists
    console.log('3. Checking loan-documents bucket specifically:');
    const loanBucket = await pool.query(`
      SELECT id, name, public
      FROM storage.buckets
      WHERE name = 'loan-documents'
    `);
    
    if (loanBucket.rows.length === 0) {
      console.log('   ❌ loan-documents bucket does not exist');
      console.log('   🔧 Creating loan-documents bucket...');
      
      await pool.query(`
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('loan-documents', 'loan-documents', false)
      `);
      console.log('   ✅ loan-documents bucket created');
    } else {
      console.log(`   ✅ loan-documents bucket exists (ID: ${loanBucket.rows[0].id})`);
      console.log(`   Public: ${loanBucket.rows[0].public}`);
    }
    
    // 4. Create storage policies if needed
    console.log('\n4. Creating storage policies for loan-documents...');
    
    // Drop existing policies
    await pool.query(`
      DROP POLICY IF EXISTS "Users can upload to loan-documents" ON storage.objects;
      DROP POLICY IF EXISTS "Users can view loan-documents" ON storage.objects;
      DROP POLICY IF EXISTS "Admins can manage loan-documents" ON storage.objects;
    `);
    
    // Create new policies
    const policiesSQL = `
      -- Users can upload to loan-documents
      CREATE POLICY "Users can upload to loan-documents" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'loan-documents' AND 
        get_auth_role() IN ('admin', 'ceo', 'hr', 'accountant', 'loan_officer')
      );
      
      -- Users can view their own loan documents
      CREATE POLICY "Users can view loan-documents" ON storage.objects
      FOR SELECT TO authenticated USING (
        bucket_id = 'loan-documents' AND 
        (get_auth_role() IN ('admin', 'ceo') OR auth.uid()::text = (storage.foldername(name))[1])
      );
      
      -- Admins can manage all loan documents
      CREATE POLICY "Admins can manage loan-documents" ON storage.objects
      FOR ALL TO authenticated USING (
        bucket_id = 'loan-documents' AND 
        get_auth_role() IN ('admin', 'ceo')
      );
    `;
    
    await pool.query(policiesSQL);
    console.log('   ✅ Storage policies created');
    
    // 5. Test the policies
    console.log('\n5. Testing storage policies...');
    
    // Check current policies
    const finalPolicies = await pool.query(`
      SELECT policyname, cmd
      FROM pg_policies 
      WHERE tablename = 'objects' AND (qual LIKE '%loan-documents%' OR with_check LIKE '%loan-documents%')
      ORDER BY cmd
    `);
    
    console.log('   Final policies for loan-documents:');
    finalPolicies.rows.forEach(policy => {
      console.log(`   - ${policy.policyname}: ${policy.cmd}`);
    });
    
    console.log('\n✅ Storage setup complete!');
    console.log('🔧 Your upload should now work. Try uploading again.');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkStoragePolicies();
