-- 1. Fix RLS Recursion by making security functions more efficient
-- We ensure these functions bypass RLS by being SECURITY DEFINER and owned by postgres
CREATE OR REPLACE FUNCTION public.get_auth_role()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_delegated_role text;
  v_start timestamp with time zone;
  v_end timestamp with time zone;
begin
  -- Use a direct query that bypasses RLS because of SECURITY DEFINER
  select role, delegated_role, delegation_start, delegation_end 
  into v_role, v_delegated_role, v_start, v_end
  from public.users
  where id = auth.uid();

  if v_delegated_role is not null then
    if (v_start is null or now() >= v_start) and (v_end is null or now() <= v_end) then
      return v_delegated_role;
    end if;
  end if;

  return v_role;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_active_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.users
    where id = auth.uid()
    and is_active = true
  );
$function$;

-- 2. Ensure system_documents has a proper foreign key to users for joining
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'system_documents_uploaded_by_fkey'
    ) THEN
        ALTER TABLE public.system_documents 
        ADD CONSTRAINT system_documents_uploaded_by_fkey 
        FOREIGN KEY (uploaded_by) REFERENCES public.users(id);
    END IF;
END $$;

-- 3. Simplify the system_documents RLS to prevent deep nesting
DROP POLICY IF EXISTS "Users can view documents they have access to" ON public.system_documents;
CREATE POLICY "Users can view documents they have access to" ON public.system_documents
FOR SELECT TO authenticated 
USING (
    uploaded_by = auth.uid() OR 
    get_auth_role() IN ('admin', 'ceo') OR
    EXISTS (
        SELECT 1 FROM document_permissions dp 
        WHERE dp.document_id = id AND dp.role = get_auth_role()
    )
);