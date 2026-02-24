# Deployment Guide for Supabase Edge Functions

This project uses Supabase Edge Functions for secure server-side operations (creating users, resetting passwords, sending email notifications, and AI processing).

## Prerequisites

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```
   (Or use `brew install supabase/tap/supabase` on macOS)

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   Get your Project Reference ID from the Supabase Dashboard URL (e.g., `https://supabase.com/dashboard/project/your-project-id`).
   ```bash
   supabase link --project-ref your-project-id
   ```

## Deploying Functions

Run the following commands to deploy the functions to the edge:

```bash
# Deploy create-user function
supabase functions deploy create-user

# Deploy reset-user-password function
supabase functions deploy reset-user-password

# Deploy send-email-notification function
supabase functions deploy send-email-notification

# Deploy google-ai-proxy function
supabase functions deploy google-ai-proxy
```

## Environment Variables

### Standard Variables
Standard Supabase environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`) are automatically injected by the platform.

### Custom Secrets

#### Email Service (Resend)
1. Get your API Key from [Resend](https://resend.com).
2. Set the secret:
```bash
supabase secrets set RESEND_API_KEY=re_123456789
```

#### Google AI (Gemini)
1. Get your API Key from [Google AI Studio](https://aistudio.google.com/).
2. Set the secret:
```bash
supabase secrets set API_KEY=AIzaSy...
```

## Troubleshooting

If you encounter permission errors:
- Ensure you have linked the correct project.
- Verify that your Supabase project has Edge Functions enabled.
- Check the logs in the Supabase Dashboard > Edge Functions > Logs.