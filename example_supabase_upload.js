// Example of how to upload using Supabase client with proper authentication
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  'https://tfpzehyrkzbenjobkdsz.supabase.co',
  'your-anon-key-here' // Get this from Supabase dashboard
);

async function uploadDocumentWithSupabase() {
  try {
    console.log('📤 Uploading document with Supabase client...\n');
    
    // First, authenticate the user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'andrew@janalo.com',
      password: 'user-password-here'
    });
    
    if (authError) {
      console.log('❌ Authentication failed:', authError.message);
      return;
    }
    
    console.log('✅ User authenticated:', authData.user.email);
    
    // Now upload the document
    const documentData = {
      name: 'Test Document.pdf',
      storage_path: '/uploads/test-document.pdf',
      category: 'general',
      file_type: 'application/pdf',
      file_size: 1024,
      uploaded_by: authData.user.id
    };
    
    const { data: uploadData, error: uploadError } = await supabase
      .from('system_documents')
      .insert([documentData])
      .select();
    
    if (uploadError) {
      console.log('❌ Upload failed:', uploadError.message);
      console.log('Details:', uploadError.details);
      return;
    }
    
    console.log('✅ Document uploaded successfully!');
    console.log('Document ID:', uploadData[0].id);
    
    // Clean up
    await supabase
      .from('system_documents')
      .delete()
      .eq('id', uploadData[0].id);
    
    console.log('✅ Cleanup completed');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// Alternative: Upload with existing session token
async function uploadWithExistingToken() {
  try {
    console.log('📤 Uploading with existing session token...\n');
    
    // If you already have a session token from your frontend
    const sessionToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Your JWT token
    
    const supabaseWithToken = createClient(
      'https://tfpzehyrkzbenjobkdsz.supabase.co',
      'your-anon-key-here',
      {
        global: {
          headers: {
            Authorization: `Bearer ${sessionToken}`
          }
        }
      }
    );
    
    const documentData = {
      name: 'Test Document.pdf',
      storage_path: '/uploads/test-document.pdf',
      category: 'general',
      file_type: 'application/pdf',
      file_size: 1024
    };
    
    const { data, error } = await supabaseWithToken
      .from('system_documents')
      .insert([documentData]);
    
    if (error) {
      console.log('❌ Upload failed:', error.message);
    } else {
      console.log('✅ Upload successful with existing token!');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

console.log('Choose one of these approaches:');
console.log('1. Run create_app_user.js to create a restricted database user');
console.log('2. Use the Supabase client with proper authentication');
console.log('3. Ensure your application sends valid JWT tokens with requests');
