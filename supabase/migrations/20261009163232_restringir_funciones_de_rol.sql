-- ============================================================
-- 4) Restringir las funciones de rol
-- ============================================================
-- Por defecto Postgres da EXECUTE a PUBLIC (todos, incluido anon). Se lo quitamos
-- y se lo devolvemos solo a los usuarios con sesión iniciada.
-- (Es migración nueva y no una edición de la 1 porque esa ya se aplicó en Supabase.)
--
-- El aviso del linter "authenticated_security_definer_function_executable" queda
-- aceptado a propósito: las políticas RLS ejecutan estas funciones con los permisos
-- del usuario logueado, así que necesita poder llamarlas. Solo devuelven true/false
-- sobre el propio usuario.
revoke execute on function public.es_personal() from public, anon;
revoke execute on function public.es_dueno()    from public, anon;
grant  execute on function public.es_personal() to authenticated;
grant  execute on function public.es_dueno()    to authenticated;
