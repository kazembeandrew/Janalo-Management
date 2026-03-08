import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedAdminUser() {
  console.log('Seeding admin user: Andrew with email andrew@janalo.com...');

  const adminEmail = 'andrew@janalo.com';
  const adminPassword = 'Password123!';
  const adminName = 'Andrew';

  try {
    // First, try to create user using the auth admin API
    console.log('Creating user via Supabase Admin API...');
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: adminName
      }
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('✓ User already exists in auth.users!');
        
        // Get the existing user
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
          console.error('Error listing users:', listError.message);
          return;
        }
        
        const existingUser = users.users.find(u => u.email === adminEmail);
        if (!existingUser) {
          console.error('User not found in auth');
          return;
        }
        
        console.log(`Existing user ID: ${existingUser.id}`);
        console.log(`Email: ${existingUser.email}`);
        console.log(`Email confirmed: ${existingUser.email_confirmed_at ? 'Yes' : 'No'}`);
        
        // Check if profile exists
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', existingUser.id)
          .single();
        
        if (profileError) {
          console.log('User profile does not exist, creating...');
          
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: existingUser.id,
              email: adminEmail,
              full_name: adminName,
              role: 'admin',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (insertError) {
            console.error('Error creating profile:', insertError.message);
          } else {
            console.log('✓ User profile created successfully!');
          }
        } else {
          console.log('✓ User profile already exists!');
          console.log(`  Role: ${profile.role}`);
          console.log(`  Full name: ${profile.full_name}`);
          console.log(`  Active: ${profile.is_active}`);
        }
        
        console.log('\n=== ADMIN USER VERIFIED ===');
        console.log(`Email: ${adminEmail}`);
        console.log(`User ID: ${existingUser.id}`);
        console.log('\nYou can login with:');
        console.log(`Password: Password123! (or existing password)`);
        return;
      }
      
      console.error('Error creating auth user:', authError.message);
      return;
    }
    
    console.log('✓ Auth user created successfully!');
    console.log(`User ID: ${authData.user.id}`);
    
    // Now create the user profile in public.users
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: adminEmail,
        full_name: adminName,
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('Error creating user profile:', profileError.message);
    } else {
      console.log('✓ User profile created successfully!');
    }
    
    console.log('\n=== ADMIN USER SEEDED SUCCESSFULLY ===');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log(`Role: admin`);

  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
}

seedAdminUser();
