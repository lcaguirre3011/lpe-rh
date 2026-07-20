create or replace function public.hr_admin_user_directory()
returns table (
  auth_user_id uuid,
  email text,
  auth_created_at timestamptz,
  last_sign_in_at timestamptz,
  profile_id uuid,
  full_name text,
  role public.hr_user_role,
  is_active boolean,
  profile_created_at timestamptz,
  profile_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  if auth.uid() is null or not private.hr_has_any_role(array['admin'::public.hr_user_role]) then
    raise exception 'No autorizado';
  end if;

  return query
  select
    u.id as auth_user_id,
    u.email::text,
    u.created_at as auth_created_at,
    u.last_sign_in_at,
    p.id as profile_id,
    p.full_name,
    p.role,
    p.is_active,
    p.created_at as profile_created_at,
    p.updated_at as profile_updated_at
  from auth.users u
  left join public.hr_user_profiles p on p.auth_user_id = u.id
  order by coalesce(u.last_sign_in_at, u.created_at) desc;
end;
$$;

create or replace function public.hr_admin_upsert_user_profile(
  target_auth_user_id uuid,
  target_full_name text,
  target_role public.hr_user_role,
  target_is_active boolean
)
returns public.hr_user_profiles
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  target_email text;
  saved_profile public.hr_user_profiles;
begin
  if auth.uid() is null or not private.hr_has_any_role(array['admin'::public.hr_user_role]) then
    raise exception 'No autorizado';
  end if;

  select email::text into target_email
  from auth.users
  where id = target_auth_user_id;

  if target_email is null then
    raise exception 'Usuario Auth no encontrado';
  end if;

  insert into public.hr_user_profiles (auth_user_id, full_name, email, role, is_active)
  values (
    target_auth_user_id,
    coalesce(nullif(trim(target_full_name), ''), replace(split_part(target_email, '@', 1), '.', ' ')),
    target_email,
    target_role,
    coalesce(target_is_active, true)
  )
  on conflict (auth_user_id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      role = excluded.role,
      is_active = excluded.is_active,
      updated_at = now()
  returning * into saved_profile;

  return saved_profile;
end;
$$;

revoke all on function public.hr_admin_user_directory() from public;
revoke all on function public.hr_admin_upsert_user_profile(uuid, text, public.hr_user_role, boolean) from public;
revoke execute on function public.hr_admin_user_directory() from anon;
revoke execute on function public.hr_admin_upsert_user_profile(uuid, text, public.hr_user_role, boolean) from anon;
grant execute on function public.hr_admin_user_directory() to authenticated;
grant execute on function public.hr_admin_upsert_user_profile(uuid, text, public.hr_user_role, boolean) to authenticated;
