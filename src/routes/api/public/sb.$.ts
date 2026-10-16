import { createFileRoute } from "@tanstack/react-router";

// Same-origin relay for the browser's backend calls, so users on networks that
// block the backend domain still reach it through the site's own address.
// Auth is enforced by the backend itself (apikey + user bearer token are forwarded).
const PASS = [
  "apikey",
  "authorization",
  "content-type",
  "prefer",
  "range",
  "accept",
  "accept-profile",
  "content-profile",
  "x-client-info",
  "x-supabase-api-version",
];
const ALLOWED = /^(rest|auth|storage|functions)\/v1\//;

async function relay(request: Request, splat: string) {
  if (!ALLOWED.test(splat)) return new Response("Not found", { status: 404 });
  const base = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  if (!base) return new Response("Not configured", { status: 500 });
  const src = new URL(request.url);
  const target = `${base.replace(/\/$/, "")}/${splat}${src.search}`;
  const headers = new Headers();
  for (const h of PASS) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const res = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });
  const out = new Headers(res.headers);
  out.delete("content-encoding");
  out.delete("content-length");
  out.delete("transfer-encoding");
  out.set("cache-control", "no-store");
  return new Response(res.body, { status: res.status, headers: out });
}

const handler = ({ request, params }: { request: Request; params: { _splat?: string } }) =>
  relay(request, params._splat ?? "");

export const Route = createFileRoute("/api/public/sb/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PATCH: handler,
      PUT: handler,
      DELETE: handler,
      HEAD: handler,
    },
  },
});
