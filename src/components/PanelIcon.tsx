import { useQuery } from "@tanstack/react-query";
import { getPanelIcons, type PanelKey } from "@/lib/panel-icons.functions";

export function usePanelIcons() {
  return useQuery({ queryKey: ["panel-icons"], queryFn: () => getPanelIcons(), staleTime: 300_000 });
}

export function PanelIcon({ panel, className = "size-8" }: { panel: PanelKey; className?: string }) {
  const { data } = usePanelIcons();
  const src = data?.[panel];
  if (!src) return null;
  return <img src={src} alt="" className={`${className} shrink-0 rounded-md object-cover`} />;
}
