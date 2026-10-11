import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy path — keep old shared links working.
export const Route = createFileRoute("/d/$token")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/director-access/$token", params: { token: params.token } });
  },
});
