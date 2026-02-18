import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenAI } from "npm:@google/genai@0.15.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProxyRequest {
  model: string
  contents: any
  config?: any
  mode?: 'generate' | 'embed'
}

serve(async (req) => {
  // 1. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Validate Auth (Ensure request comes from your logged-in user)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Invalid or expired token')

    // 3. Parse Body
    const body: ProxyRequest = await req.json()
    const { model, contents, config, mode = 'generate' } = body

    if (!model || !contents) throw new Error('Missing model or contents')

    // 4. Initialize Gemini API
    // @ts-ignore
    const apiKey = Deno.env.get('API_KEY')
    if (!apiKey) throw new Error('Server API_KEY not configured')
    
    const ai = new GoogleGenAI({ apiKey })

    // 5. Execute Request
    let result
    if (mode === 'embed') {
       result = await ai.models.embedContent({
         model: model,
         content: contents,
       })
    } else {
       // Standard Generate Content
       const response = await ai.models.generateContent({
         model: model,
         contents: contents,
         config: config
       })
       result = response
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Proxy error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})