
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase URL or Service Role Key is missing.');
  console.error('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const reactivateAllUsers = async () => {
  try {
    console.log('Fetching all inactive users...');
    
    // First, let's see how many users are affected
    const { data: allUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email, full_name, is_active, deletion_status')
      .or('is_active.eq.false,deletion_status.eq.approved,deletion_status.eq.pending_approval');

    if (fetchError) throw fetchError;
    
    console.log(`Found ${allUsers.length} users that need reactivation:`);
    allUsers.forEach(u => {
      console.log(`  - ${u.email} (${u.full_name}) - is_active: ${u.is_active}, deletion_status: ${u.deletion_status}`);
    });

    if (allUsers.length === 0) {
      console.log('No users need reactivation.');
      return;
    }

    const confirm = process.argv.includes('--confirm');
    if (!confirm) {
      console.log('\nTo reactivate all users, run with --confirm flag:');
      console.log('  node reactivate_all_users.js --confirm');
      return;
    }

    console.log('\nReactivating all users...');
    
    // First update deletion_status
    const { data: data1, error: error1 } = await supabase
      .from('users')
      .update({ 
        deletion_status: null
      })
      .eq('deletion_status', 'approved')
      .select('id, email, full_name');
    
    if (error1) {
      console.log('Warning: deletion_status update error:', error1.message);
    }
    
    // Then update is_active
    const { data: data2, error: error2 } = await supabase
      .from('users')
      .update({ 
        is_active: true
      })
      .eq('is_active', false)
      .select('id, email, full_name');
    
    if (error2) {
      console.log('Warning: is_active update error:', error2.message);
    }
    
    const data = data1?.length > 0 ? data1 : data2;
    const error = error1 || error2;
    
    if (error) throw error;

    console.log(`\nSuccessfully reactivated ${data.length} users:`);
    data.forEach(u => {
      console.log(`  ✓ ${u.email} (${u.full_name})`);
    });
    
    console.log('\nAll users are now active and visible in User Management.');
    
  } catch (error) {
    console.error('Error reactivating users:', error.message);
    process.exit(1);
  }
};

reactivateAllUsers();
