import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header passed')

    // 1. Verify Caller (Must be Admin)
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Invalid token')

    const { data: callerProfile, error: profileError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !callerProfile) throw new Error('Caller profile not found')
    if (callerProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only Admins can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Init Admin Client
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Create User
    const { email, password, full_name, role } = await req.json()

    if (!email || !password || !full_name) {
      throw new Error('Missing required fields')
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (createError) throw createError

    // 4. Update Role in public.users
    // Use upsert to handle potential race conditions with the DB trigger
    if (newUser.user) {
        const { error: upsertError } = await supabaseAdmin
            .from('users')
            .upsert({ 
                id: newUser.user.id,
                email: email,
                full_name: full_name,
                role: role || 'loan_officer',
                is_active: true
            })
        
        if (upsertError) {
             console.error("Failed to set profile/role", upsertError)
             // Non-blocking, but good to log
        }
    }

    return new Response(
      JSON.stringify({ message: 'User created successfully', user: newUser.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})