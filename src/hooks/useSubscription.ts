import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSubscriptionStatus(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-sub", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: active }, { data: reqs }] = await Promise.all([
        supabase.rpc("has_active_subscription", { _director: userId! }),
        supabase.from("subscription_requests").select("*").eq("director_id", userId!).order("created_at", { ascending: false }),
      ]);
      return { active: active === true, requests: reqs ?? [] };
    },
  });
}

