import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncUsers() {
  console.log('Syncing users from auth.users to public.users...\n');

  try {
    // Get all auth users
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError.message);
      return;
    }

    console.log(`Found ${authData.users.length} users in auth.users\n`);

    for (const user of authData.users) {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', user.id)
        .single();

      if (existingProfile) {
        console.log(`✓ Profile exists for ${user.email}`);
        continue;
      }

      // Create profile
      const email = user.email;
      const fullName = email.split('@')[0];
      const formattedName = fullName.charAt(0).toUpperCase() + fullName.slice(1);

      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: email,
          full_name: formattedName,
          role: 'loan_officer', // default role
          is_active: true
        });

      if (insertError) {
        console.error(`✗ Error creating profile for ${email}:`, insertError.message);
      } else {
        console.log(`✓ Created profile for ${email}`);
      }
    }

    // Final check
    console.log('\n--- Final User List ---');
    const { data: profiles } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    profiles.forEach(p => {
      console.log(`- ${p.email}: ${p.full_name} (${p.role}) - Active: ${p.is_active}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

syncUsers();
