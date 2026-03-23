
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

const checkUsersStatus = async () => {
  try {
    console.log('Checking user status in database...\n');
    
    // Get all users
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, is_active, deletion_status')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`Total users in database: ${allUsers.length}\n`);
    
    // Group users by status
    const active = allUsers.filter(u => u.is_active === true && (u.deletion_status === null || u.deletion_status === 'none'));
    const inactive = allUsers.filter(u => u.is_active === false);
    const archived = allUsers.filter(u => u.deletion_status === 'approved');
    const pendingApproval = allUsers.filter(u => u.deletion_status === 'pending_approval');

    console.log('=== USER STATUS SUMMARY ===');
    console.log(`Active users: ${active.length}`);
    console.log(`Inactive users (is_active = false): ${inactive.length}`);
    console.log(`Archived users (deletion_status = 'approved'): ${archived.length}`);
    console.log(`Pending approval (deletion_status = 'pending_approval'): ${pendingApproval.length}`);

    if (inactive.length > 0 || archived.length > 0) {
      console.log('\n=== INACTIVE/ARCHIVED USERS ===');
      const problemUsers = [...inactive, ...archived];
      problemUsers.forEach(u => {
        console.log(`\n  Email: ${u.email}`);
        console.log(`  Name: ${u.full_name}`);
        console.log(`  Role: ${u.role}`);
        console.log(`  is_active: ${u.is_active}`);
        console.log(`  deletion_status: ${u.deletion_status}`);
      });
    }

    console.log('\n=== SOLUTION ===');
    if (inactive.length > 0 || archived.length > 0) {
      console.log('Run the following command to reactivate all users:');
      console.log('  node reactivate_all_users.js --confirm');
    } else {
      console.log('All users are already active.');
    }

  } catch (error) {
    console.error('Error checking users:', error.message);
    process.exit(1);
  }
};

checkUsersStatus();
