
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase URL or Service Role Key is missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const reactivateUser = async (email) => {
  if (!email) {
    console.error('Please provide an email address.');
    process.exit(1);
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, is_active')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: single row not found
        throw error;
    }
    
    if (!user) {
      console.log(`User with email "${email}" not found.`);
      return;
    }

    if (user.is_active) {
      console.log(`User "${email}" is already active.`);
      return;
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ 
        is_active: true, 
        revocation_reason: null,
        deletion_status: null
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    console.log(`Successfully reactivated user: ${updatedUser.email}`);
  } catch (error) {
    console.error('Error reactivating user:', error.message);
  }
};

const userEmail = process.argv[2];
reactivateUser(userEmail);
