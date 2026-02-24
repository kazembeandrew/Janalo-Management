-- Update get_auth_role to account for active delegations
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
  -- Get both primary and delegated role info
  select role, delegated_role, delegation_start, delegation_end 
  into v_role, v_delegated_role, v_start, v_end
  from public.users
  where id = auth.uid();

  -- If there is an active delegation, return the delegated role
  -- This allows the user to assume the permissions of the delegated role
  if v_delegated_role is not null then
    if (v_start is null or now() >= v_start) and (v_end is null or now() <= v_end) then
      return v_delegated_role;
    end if;
  end if;

  -- Otherwise return the primary role
  return v_role;
end;
$function$;