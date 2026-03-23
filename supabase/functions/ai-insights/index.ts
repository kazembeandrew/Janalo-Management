import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Create Supabase client to verify token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { type } = await req.json()
    
    // Generate portfolio insights based on real data
    let insights = []
    
    // Fetch real portfolio data for insights
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Get loan statistics
    const { data: loanStats } = await supabaseAdmin
      .from('loans')
      .select('status, principal_amount, principal_outstanding, disbursement_date')
      .in('status', ['active', 'defaulted', 'pending', 'pending_approval']);
    
    const activeLoans = loanStats?.filter(l => l.status === 'active') || [];
    const pendingLoans = loanStats?.filter(l => l.status === 'pending' || l.status === 'pending_approval') || [];
    const defaultedLoans = loanStats?.filter(l => l.status === 'defaulted') || [];
    
    const totalPortfolio = activeLoans.reduce((sum, l) => sum + (l.principal_outstanding || 0), 0);
    const totalPending = pendingLoans.reduce((sum, l) => sum + (l.principal_amount || 0), 0);
    const parRatio = totalPortfolio > 0 ? (defaultedLoans.reduce((sum, l) => sum + (l.principal_outstanding || 0), 0) / totalPortfolio) * 100 : 0;
    
    if (type === 'dashboard_summary') {
      // Build insights based on actual portfolio data
      insights = [];
      
      // Active loans count insight
      if (activeLoans.length > 0) {
        insights.push({
          id: '1',
          type: 'info',
          title: 'Active Portfolio',
          description: `You have ${activeLoans.length} active loans with total outstanding of MK ${totalPortfolio.toLocaleString()}.`,
          impact: 'medium',
          actionable: false,
          createdAt: new Date().toISOString()
        });
      }
      
      // PAR ratio warning
      if (parRatio > 10) {
        insights.push({
          id: '2', 
          type: 'warning',
          title: 'High PAR Ratio Alert',
          description: `Your Portfolio at Risk (PAR) ratio is ${parRatio.toFixed(1)}%, which exceeds the 10% threshold. ${defaultedLoans.length} loans are in default status.`,
          impact: 'high',
          actionable: true,
          createdAt: new Date().toISOString()
        });
      } else if (parRatio > 5) {
        insights.push({
          id: '2', 
          type: 'warning',
          title: 'PAR Ratio Warning',
          description: `Your Portfolio at Risk (PAR) ratio is ${parRatio.toFixed(1)}%. Consider monitoring closely.`,
          impact: 'medium',
          actionable: true,
          createdAt: new Date().toISOString()
        });
      }
      
      // Pending applications
      if (pendingLoans.length > 0) {
        insights.push({
          id: '3',
          type: 'opportunity', 
          title: 'Pending Loan Applications',
          description: `You have ${pendingLoans.length} pending loan applications worth MK ${totalPending.toLocaleString()}. Review and process to grow your portfolio.`,
          impact: 'medium',
          actionable: true,
          createdAt: new Date().toISOString()
        });
      }
      
      // Defaulted loans
      if (defaultedLoans.length > 0) {
        const totalDefaulted = defaultedLoans.reduce((sum, l) => sum + (l.principal_outstanding || 0), 0);
        insights.push({
          id: '4',
          type: 'warning', 
          title: 'Defaulted Loans Require Attention',
          description: `${defaultedLoans.length} loans are in default status with total outstanding of MK ${totalDefaulted.toLocaleString()}. Consider collection strategies.`,
          impact: 'high',
          actionable: true,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Calculate confidence based on data completeness
    const confidence = loanStats && loanStats.length > 0 ? 0.85 : 0.3;
    
    const response = {
      insights,
      summary: parRatio > 10 
        ? 'Portfolio requires attention due to high PAR ratio. Immediate action recommended.'
        : parRatio > 5 
        ? 'Portfolio is manageable but PAR ratio warrants monitoring.'
        : 'Portfolio performance is stable.',
      confidence,
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
