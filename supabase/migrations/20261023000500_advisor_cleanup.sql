-- Security advisor: rls_auto_enable() is Supabase's event-trigger helper from the project's "automatic RLS"
-- option. Event triggers run it as its owner, so nobody needs EXECUTE on it through the API.
-- (set_agree / set_vote stay callable by signed-in users on purpose: they only touch the caller's own key.)
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
