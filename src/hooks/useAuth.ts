import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string;
  mobile: string;
  email: string;
  username: string;
  status: "pending" | "approved" | "rejected";
  is_active: boolean;
  booth_token: string;
  entry_token: string;
  max_booth_operators: number;
  created_at: string;
};

export type AuthState = {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  role: "admin" | "director" | null;
  reason: string | null;
};

const initial: AuthState = {
  loading: true,
  userId: null,
  profile: null,
  role: null,
  reason: null,
};

/** Session + profile state. Re-checks periodically so a deactivated account is kicked out. */
export function useAuth(): AuthState & { refresh: () => void } {
  const [state, setState] = useState<AuthState>(initial);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setState({ loading: false, userId: null, profile: null, role: null, reason: null });
      return;
    }
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    const role = (roles?.[0]?.role as "admin" | "director" | undefined) ?? null;

    if (role === "director" && profile && (!profile.is_active || profile.status !== "approved")) {
      await supabase.auth.signOut();
      setState({
        loading: false,
        userId: null,
        profile: null,
        role: null,
        reason: profile.status === "rejected" ? "حساب شما رد شده است." : "حساب شما غیرفعال است.",
      });
      return;
    }

    setState({
      loading: false,
      userId: user.id,
      profile: (profile as Profile) ?? null,
      role,
      reason: null,
    });
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void load(), 0);
    });
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => {
      sub.subscription.unsubscribe();
      clearInterval(timer);
    };
  }, [load]);

  return { ...state, refresh: () => void load() };
}
