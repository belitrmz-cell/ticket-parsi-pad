import { createFileRoute } from "@tanstack/react-router";

// Home-screen shortcuts installed with the old manifest open this URL.
export const Route = createFileRoute("/api/public/manifest/")({
  server: {
    handlers: {
      GET: async () => new Response(null, { status: 302, headers: { Location: "/admin/login" } }),
    },
  },
});
