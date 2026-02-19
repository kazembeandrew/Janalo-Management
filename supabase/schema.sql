-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS TABLE (Extends Auth)
create table if not exists public.users (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text check (role in ('admin', 'ceo', 'loan_officer')),
  is_active boolean default true,
  deletion_status text check (deletion_status in ('pending', 'approved', 'none')) default 'none',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Ensure deletion_status exists if table was already created
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='users' and column_name='deletion_status') then
    alter table public.users add column deletion_status text check (deletion_status in ('pending', 'approved', 'none')) default 'none';
  end if;
end $$;

-- 2. BORROWERS TABLE
create table if not exists public.borrowers (
  id uuid default uuid_generate_v4() primary key,
  full_name text not null,
  phone text,
  address text,
  employment text,
  created_by uuid references public.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. LOANS TABLE
create table if not exists public.loans (
  id uuid default uuid_generate_v4() primary key,
  borrower_id uuid references public.borrowers(id),
  officer_id uuid references public.users(id),
  principal_amount decimal(12,2) not null,
  interest_rate decimal(5,2) not null,
  interest_type text check (interest_type in ('flat', 'reducing')),
  term_months integer not null,
  disbursement_date date not null,
  monthly_installment decimal(12,2),
  total_payable decimal(12,2),
  principal_outstanding decimal(12,2),
  interest_outstanding decimal(12,2),
  penalty_outstanding decimal(12,2) default 0,
  status text, 
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Ensure updated_at exists (Fix for "record new has no field updated_at")
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='loans' and column_name='updated_at') then
    alter table public.loans add column updated_at timestamp with time zone default timezone('utc'::text, now());
  end if;
end $$;

-- Ensure penalty_outstanding exists
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='loans' and column_name='penalty_outstanding') then
    alter table public.loans add column penalty_outstanding decimal(12,2) default 0;
  end if;
end $$;

-- Update Loan Status Constraint
do $$
begin
  -- Drop old constraint if exists (try multiple names common in supabase)
  if exists (select 1 from information_schema.table_constraints where constraint_name = 'loans_status_check') then
    alter table public.loans drop constraint loans_status_check;
  end if;
end $$;

alter table public.loans add constraint loans_status_check 
  check (status in ('active', 'completed', 'defaulted', 'pending', 'rejected', 'reassess'));

-- Trigger to handle updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_loans_updated_at on public.loans;
create trigger update_loans_updated_at
before update on public.loans
for each row execute procedure update_updated_at_column();

-- 4. REPAYMENTS TABLE
create table if not exists public.repayments (
  id uuid default uuid_generate_v4() primary key,
  loan_id uuid references public.loans(id),
  amount_paid decimal(12,2) not null,
  principal_paid decimal(12,2),
  interest_paid decimal(12,2),
  penalty_paid decimal(12,2) default 0,
  payment_date date default CURRENT_DATE,
  recorded_by uuid references public.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Ensure penalty_paid exists
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='repayments' and column_name='penalty_paid') then
    alter table public.repayments add column penalty_paid decimal(12,2) default 0;
  end if;
end $$;

-- 5. EXPENSES TABLE
create table if not exists public.expenses (
  id uuid default uuid_generate_v4() primary key,
  category text not null,
  description text,
  amount decimal(12,2) not null,
  date date not null default CURRENT_DATE,
  recorded_by uuid references public.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. LOAN NOTES TABLE (Communication)
create table if not exists public.loan_notes (
  id uuid default uuid_generate_v4() primary key,
  loan_id uuid references public.loans(id) on delete cascade,
  user_id uuid references public.users(id),
  content text not null,
  is_system boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 7. LOAN DOCUMENTS TABLE
create table if not exists public.loan_documents (
  id uuid default uuid_generate_v4() primary key,
  loan_id uuid references public.loans(id) on delete cascade,
  type text,
  file_name text,
  storage_path text not null,
  mime_type text default 'image/jpeg',
  file_size integer, -- in bytes
  created_at timestamp with time zone default timezone('utc'::text, now())
);

do $$
begin
  if exists (select 1 from information_schema.table_constraints where constraint_name = 'loan_documents_type_check') then
    alter table public.loan_documents drop constraint loan_documents_type_check;
  end if;
end $$;

alter table public.loan_documents add constraint loan_documents_type_check 
  check (type in ('id_card', 'collateral', 'contract', 'application_form', 'guarantor', 'other', 'visitation_proof'));

-- 8. VISITATIONS TABLE (New)
create table if not exists public.visitations (
  id uuid default uuid_generate_v4() primary key,
  loan_id uuid references public.loans(id) on delete cascade,
  officer_id uuid references public.users(id),
  visit_date date default CURRENT_DATE,
  notes text not null,
  location_lat decimal(10, 8),
  location_long decimal(11, 8),
  image_path text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 9. MESSAGING SYSTEM TABLES

create table if not exists public.conversations (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.conversation_participants (
    conversation_id uuid references public.conversations(id) on delete cascade,
    user_id uuid references public.users(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    primary key (conversation_id, user_id)
);

create table if not exists public.direct_messages (
    id uuid default uuid_generate_v4() primary key,
    conversation_id uuid references public.conversations(id) on delete cascade,
    sender_id uuid references public.users(id),
    content text,
    is_read boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    attachment_path text,
    attachment_name text,
    attachment_type text
);

-- Add attachment columns safely if previously missed
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='direct_messages' and column_name='attachment_path') then
    alter table public.direct_messages add column attachment_path text;
    alter table public.direct_messages add column attachment_name text;
    alter table public.direct_messages add column attachment_type text;
  end if;
end $$;

-- =========================================================================
-- SECURITY HELPERS (STRICT ACCESS CONTROL)
-- =========================================================================

-- Helper to check if current user is active (Used in RLS)
create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
    and is_active = true
  );
$$;

-- Helper to get auth role, returns NULL if inactive (Gatekeeper for Role Based Access)
create or replace function public.get_auth_role()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  user_info record;
begin
  select role, is_active into user_info
  from public.users
  where id = auth.uid();
  
  if user_info.is_active is not true then
    return null; -- Inactive users have no role
  end if;
  
  return user_info.role;
end;
$$;

-- FIX: Helper to get my conversations safely, returns empty if inactive
create or replace function public.get_my_conversations()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select conversation_id 
  from conversation_participants 
  where user_id = auth.uid()
  and exists (select 1 from public.users where id = auth.uid() and is_active = true)
$$;

create or replace function public.cleanup_old_applications()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.loans
  where status = 'rejected'
  and updated_at < (now() - interval '24 hours');

  delete from public.loans
  where status = 'reassess'
  and updated_at < (now() - interval '7 days');
end;
$$;

-- =========================================================================
-- SERVER-SIDE ANALYTICS RPCs
-- =========================================================================

-- 1. Dashboard Overview Stats
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER -- Respects RLS of the caller
AS $$
DECLARE
  result json;
BEGIN
  -- We aggregate based on rows the user can see (RLS)
  SELECT json_build_object(
    'total_disbursed', COALESCE(SUM(principal_amount), 0),
    'principal_outstanding', COALESCE(SUM(principal_outstanding) FILTER (WHERE status = 'active'), 0),
    'interest_outstanding', COALESCE(SUM(interest_outstanding) FILTER (WHERE status = 'active'), 0),
    'active_count', COUNT(*) FILTER (WHERE status = 'active'),
    'completed_count', COUNT(*) FILTER (WHERE status = 'completed'),
    'defaulted_count', COUNT(*) FILTER (WHERE status = 'defaulted'),
    'earned_interest', COALESCE(SUM(total_payable - principal_amount) FILTER (WHERE status = 'completed'), 0),
    'total_clients', COUNT(DISTINCT borrower_id),
    'par_count', (
      -- Subquery for PAR 30 logic. 
      -- Note: SECURITY INVOKER ensures 'loans' table inside here is filtered by RLS.
      SELECT COUNT(*)
      FROM loans l2
      WHERE l2.status = 'active'
      -- Since we can't easily join to the outer scope in a scalar subquery used in aggregation easily without group by,
      -- we just run the logic on the table again.
      -- IMPORTANT: This counts *all* visible loans that match the criteria.
      AND (
         COALESCE(
          (SELECT MAX(payment_date) FROM repayments r WHERE r.loan_id = l2.id),
          l2.disbursement_date
         ) < (CURRENT_DATE - INTERVAL '30 days')
      )
    )
  )
  INTO result
  FROM loans;

  RETURN result;
END;
$$;

-- 2. Monthly Revenue (Last 6 months)
CREATE OR REPLACE FUNCTION public.get_monthly_revenue()
RETURNS TABLE (
  month text,
  income numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_char(date_trunc('month', payment_date), 'YYYY-MM') as month,
    SUM(interest_paid + penalty_paid) as income
  FROM repayments
  WHERE payment_date >= (CURRENT_DATE - INTERVAL '6 months')
  -- RLS on 'repayments' ensures user only sees relevant data
  GROUP BY 1
  ORDER BY 1;
END;
$$;

-- 3. Officer Performance (Admin/CEO primarily)
CREATE OR REPLACE FUNCTION public.get_officer_performance()
RETURNS TABLE (
  officer_id uuid,
  officer_name text,
  active_count bigint,
  portfolio_value numeric,
  at_risk_count bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    COUNT(l.id) FILTER (WHERE l.status = 'active') as active_count,
    COALESCE(SUM(l.principal_outstanding + l.interest_outstanding) FILTER (WHERE l.status = 'active'), 0) as portfolio_value,
    COUNT(l.id) FILTER (WHERE l.status = 'defaulted') as at_risk_count
  FROM users u
  LEFT JOIN loans l ON l.officer_id = u.id
  WHERE u.role = 'loan_officer'
  GROUP BY u.id, u.full_name
  ORDER BY portfolio_value DESC;
END;
$$;

-- 4. Status Breakdown for Reports
CREATE OR REPLACE FUNCTION public.get_loan_status_breakdown()
RETURNS TABLE (
  status text,
  total_value numeric,
  count bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.status,
    COALESCE(SUM(l.principal_outstanding + l.interest_outstanding), 0),
    COUNT(*)
  FROM loans l
  GROUP BY l.status;
END;
$$;

-- 5. Disbursement Timeline
CREATE OR REPLACE FUNCTION public.get_disbursement_timeline()
RETURNS TABLE (
  month text,
  amount numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
    SUM(principal_amount)
  FROM loans
  GROUP BY 1
  ORDER BY 1;
END;
$$;

-- RLS
alter table public.users enable row level security;
alter table public.borrowers enable row level security;
alter table public.loans enable row level security;
alter table public.repayments enable row level security;
alter table public.expenses enable row level security;
alter table public.loan_notes enable row level security;
alter table public.loan_documents enable row level security;
alter table public.visitations enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.direct_messages enable row level security;

-- POLICIES

-- Users
-- 1. Own profile: ALLOW even if inactive (Required for Frontend to detect status and show logout message)
drop policy if exists "Users can view their own profile" on public.users;
create policy "Users can view their own profile" on public.users for select using (auth.uid() = id);

-- 2. Admin view: Safe via get_auth_role()
drop policy if exists "Admins can view all profiles" on public.users;
create policy "Admins can view all profiles" on public.users for select using (public.get_auth_role() = 'admin');

-- 3. View colleagues: Requires active status
drop policy if exists "View colleagues" on public.users;
create policy "View colleagues" on public.users for select using (auth.role() = 'authenticated' and public.is_active_user());

-- Cleanup old policies
drop policy if exists "Admins can update users" on public.users;
drop policy if exists "Admins and CEO can update users" on public.users;

-- Allow Admin to update (Revoke Access/Request Deletion) AND CEO to update (Reject Deletion)
create policy "Admins and CEO can update users" on public.users for update 
  using (public.get_auth_role() in ('admin', 'ceo'));

drop policy if exists "CEO can delete users" on public.users;
create policy "CEO can delete users" on public.users for delete 
  using (public.get_auth_role() = 'ceo');

-- Borrowers
drop policy if exists "View Borrowers" on public.borrowers;
create policy "View Borrowers" on public.borrowers for select using (
  (created_by = auth.uid() or public.get_auth_role() in ('admin', 'ceo'))
  and public.is_active_user()
);

drop policy if exists "Create Borrowers" on public.borrowers;
create policy "Create Borrowers" on public.borrowers for insert with check (public.get_auth_role() in ('admin', 'loan_officer'));

drop policy if exists "Update Borrowers" on public.borrowers;
create policy "Update Borrowers" on public.borrowers for update using (
  (created_by = auth.uid() and public.get_auth_role() = 'loan_officer')
  or public.get_auth_role() in ('admin', 'ceo')
);

-- Loans
drop policy if exists "Admins and CEO view all loans" on public.loans;
create policy "Admins and CEO view all loans" on public.loans for select using (public.get_auth_role() in ('admin', 'ceo'));

drop policy if exists "Officers view assigned loans" on public.loans;
create policy "Officers view assigned loans" on public.loans for select using (officer_id = auth.uid() and public.is_active_user());

drop policy if exists "Officers create loans" on public.loans;
create policy "Officers create loans" on public.loans for insert with check (officer_id = auth.uid() and public.get_auth_role() = 'loan_officer');

drop policy if exists "Admins create loans" on public.loans;
create policy "Admins create loans" on public.loans for insert with check (public.get_auth_role() = 'admin');

drop policy if exists "Officers update own loans" on public.loans;
create policy "Officers update own loans" on public.loans for update using (officer_id = auth.uid() and public.is_active_user());

drop policy if exists "Admin CEO Update Loans" on public.loans;
create policy "Admin CEO Update Loans" on public.loans for update using (public.get_auth_role() in ('admin', 'ceo'));

drop policy if exists "Delete Loans" on public.loans;
create policy "Delete Loans" on public.loans for delete using (
    (status = 'pending' or status = 'rejected' or status = 'reassess') 
    and ( (officer_id = auth.uid() and public.is_active_user()) or public.get_auth_role() = 'admin' )
);

-- Repayments
drop policy if exists "View Repayments" on public.repayments;
create policy "View Repayments" on public.repayments for select using (
  exists (select 1 from public.loans where id = repayments.loan_id and (officer_id = auth.uid() or public.get_auth_role() in ('admin', 'ceo')))
  and public.is_active_user()
);

drop policy if exists "Create Repayments" on public.repayments;
create policy "Create Repayments" on public.repayments for insert with check (public.get_auth_role() in ('admin', 'loan_officer'));

-- Expenses
drop policy if exists "View expenses" on public.expenses;
create policy "View expenses" on public.expenses for select using (public.get_auth_role() in ('admin', 'ceo'));

drop policy if exists "Manage expenses" on public.expenses;
create policy "Manage expenses" on public.expenses for all using (public.get_auth_role() in ('admin', 'ceo'));

-- Notes & Documents & Visitations
drop policy if exists "View Notes" on public.loan_notes;
create policy "View Notes" on public.loan_notes for select using (
  exists (select 1 from public.loans where id = loan_notes.loan_id and (officer_id = auth.uid() or public.get_auth_role() in ('admin', 'ceo')))
  and public.is_active_user()
);
drop policy if exists "Create Notes" on public.loan_notes;
create policy "Create Notes" on public.loan_notes for insert with check (
  exists (select 1 from public.loans where id = loan_notes.loan_id and (officer_id = auth.uid() or public.get_auth_role() in ('admin', 'ceo', 'loan_officer')))
);

drop policy if exists "View Documents" on public.loan_documents;
create policy "View Documents" on public.loan_documents for select using (
  exists (select 1 from public.loans where id = loan_documents.loan_id and (officer_id = auth.uid() or public.get_auth_role() in ('admin', 'ceo')))
  and public.is_active_user()
);
drop policy if exists "Upload Documents" on public.loan_documents;
create policy "Upload Documents" on public.loan_documents for insert with check (
  exists (select 1 from public.loans where id = loan_documents.loan_id and (officer_id = auth.uid() or public.get_auth_role() in ('admin', 'loan_officer')))
);
drop policy if exists "Delete Documents" on public.loan_documents;
create policy "Delete Documents" on public.loan_documents for delete using (
  exists (select 1 from public.loans where id = loan_documents.loan_id and (officer_id = auth.uid() or public.get_auth_role() = 'admin'))
);

drop policy if exists "View Visitations" on public.visitations;
create policy "View Visitations" on public.visitations for select using (
  exists (select 1 from public.loans where id = visitations.loan_id and (officer_id = auth.uid() or public.get_auth_role() in ('admin', 'ceo')))
  and public.is_active_user()
);
drop policy if exists "Create Visitations" on public.visitations;
create policy "Create Visitations" on public.visitations for insert with check (
  exists (select 1 from public.loans where id = visitations.loan_id and (officer_id = auth.uid() or public.get_auth_role() = 'loan_officer'))
);

-- MESSAGING POLICIES
drop policy if exists "View Conversations" on public.conversations;
drop policy if exists "Users can view conversations they are in" on public.conversations;
create policy "Users can view conversations they are in"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id
      and cp.user_id = auth.uid()
    )
  );

drop policy if exists "Insert Conversations" on public.conversations;
drop policy if exists "Users can insert conversations" on public.conversations;
create policy "Users can insert conversations"
  on public.conversations for insert
  with check (true);

drop policy if exists "View Participants" on public.conversation_participants;
drop policy if exists "Users can view participants of their conversations" on public.conversation_participants;
create policy "Users can view participants of their conversations"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id
      and cp.user_id = auth.uid()
    )
  );

drop policy if exists "Insert Participants" on public.conversation_participants;
drop policy if exists "Users can add participants" on public.conversation_participants;
create policy "Users can add participants"
  on public.conversation_participants for insert
  with check (true);

drop policy if exists "View Messages" on public.direct_messages;
drop policy if exists "Users can view messages in their conversations" on public.direct_messages;
create policy "Users can view messages in their conversations"
  on public.direct_messages for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id
      and cp.user_id = auth.uid()
    )
  );

drop policy if exists "Send Messages" on public.direct_messages;
drop policy if exists "Users can send messages to their conversations" on public.direct_messages;
create policy "Users can send messages to their conversations"
  on public.direct_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id
      and cp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update (read) messages in their conversations" on public.direct_messages;
create policy "Users can update (read) messages in their conversations"
  on public.direct_messages for update
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id
      and cp.user_id = auth.uid()
    )
  );

-- Storage Buckets
insert into storage.buckets (id, name, public) values ('loan-documents', 'loan-documents', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('chat-attachments', 'chat-attachments', true) on conflict (id) do nothing;

-- Ensure Storage Policies also check for active status
drop policy if exists "Auth users upload docs" on storage.objects;
create policy "Auth users upload docs" on storage.objects for insert with check (bucket_id = 'loan-documents' and auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Auth users select docs" on storage.objects;
create policy "Auth users select docs" on storage.objects for select using (bucket_id = 'loan-documents' and auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Auth users upload chat" on storage.objects;
create policy "Auth users upload chat" on storage.objects for insert with check (bucket_id = 'chat-attachments' and auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Auth users select chat" on storage.objects;
create policy "Auth users select chat" on storage.objects for select using (bucket_id = 'chat-attachments' and auth.role() = 'authenticated' and public.is_active_user());

create or replace function public.create_new_conversation(recipient_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  new_convo_id uuid;
begin
  -- 1. Create Conversation
  insert into public.conversations (created_at, updated_at) values (now(), now())
  returning id into new_convo_id;

  -- 2. Add Participants (Current User + Recipient)
  insert into public.conversation_participants (conversation_id, user_id)
  values 
    (new_convo_id, auth.uid()),
    (new_convo_id, recipient_id);

  return new_convo_id;
end;
$$;

-- Helper to count unread messages
create or replace function public.get_unread_message_count()
returns integer
language plpgsql
security definer
as $$
begin
  return (
    select count(*)
    from public.direct_messages dm
    join public.conversation_participants cp on cp.conversation_id = dm.conversation_id
    where cp.user_id = auth.uid() -- I am in the conversation
    and dm.sender_id != auth.uid() -- I didn't send it
    and dm.is_read = false -- It hasn't been read
  );
end;
$$;

-- Helper to get comprehensive notification counts
create or replace function public.get_notification_counts()
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_inbox_count integer;
  v_loan_count integer;
begin
  -- Get user role
  select role into v_role from public.users where id = v_user_id;

  -- 1. Inbox Count (Unread messages where I am a participant)
  select count(*) into v_inbox_count
  from public.direct_messages dm
  join public.conversation_participants cp on cp.conversation_id = dm.conversation_id
  where cp.user_id = v_user_id
  and dm.sender_id != v_user_id
  and dm.is_read = false;

  -- 2. Loan Action Count (Role Dependent)
  if v_role in ('admin', 'ceo') then
    -- Admin/CEO: Count Pending Loans (Need Approval)
    select count(*) into v_loan_count
    from public.loans
    where status = 'pending';
  elsif v_role = 'loan_officer' then
    -- Officer: Count Reassess (Need Fix) + Rejected (Need Action)
    select count(*) into v_loan_count
    from public.loans
    where officer_id = v_user_id
    and status in ('reassess', 'rejected');
  else
    v_loan_count := 0;
  end if;

  return json_build_object(
    'inbox', v_inbox_count,
    'loans', v_loan_count
  );
end;
$$;

-- Helper to get conversation list with details
create or replace function public.get_my_conversations_details()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_user_name text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    c.id as conversation_id,
    u.id as other_user_id,
    u.full_name as other_user_name,
    (select content from direct_messages dm where dm.conversation_id = c.id order by created_at desc limit 1) as last_message,
    (select created_at from direct_messages dm where dm.conversation_id = c.id order by created_at desc limit 1) as last_message_at,
    (select count(*) from direct_messages dm where dm.conversation_id = c.id and dm.sender_id != auth.uid() and dm.is_read = false) as unread_count
  from conversations c
  join conversation_participants cp_me on cp_me.conversation_id = c.id and cp_me.user_id = auth.uid()
  join conversation_participants cp_other on cp_other.conversation_id = c.id and cp_other.user_id != auth.uid()
  join users u on u.id = cp_other.user_id
  order by last_message_at desc nulls last;
end;
$$;

-- Trigger New User
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'loan_officer')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();