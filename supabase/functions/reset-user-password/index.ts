import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS for browser requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Get the current user's JWT from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header passed')
    }

    // 3. Initialize Supabase Client (Client Context) to verify the Caller
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 4. Verify the caller is actually an Admin or CEO
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Invalid token')

    const { data: callerProfile, error: profileError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !callerProfile) throw new Error('Caller profile not found')

    if (callerProfile.role !== 'admin' && callerProfile.role !== 'ceo') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only Admins or CEOs can reset passwords' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Initialize Supabase Admin Client (Service Role) to perform the update
    // This key bypasses RLS and Auth restrictions
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 6. Get request body
    const { userId, newPassword } = await req.json()

    if (!userId || !newPassword) {
      throw new Error('Missing userId or newPassword')
    }

    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    // 7. Perform the Password Update
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ message: 'Password updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})