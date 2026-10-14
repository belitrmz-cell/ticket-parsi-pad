import { createFileRoute } from "@tanstack/react-router";

// Same-origin relay to the backend. It forwards only to the project's own
// backend URL; the backend still enforces auth and row-level security.
const HOP = ["host", "connection", "content-length", "accept-encoding", "cookie", "origin", "referer"];

async function relay({ request, params }: { request: Request; params: { _splat?: string } }) {
  const base = (process.env["SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  if (!base) return new Response("Backend not configured", { status: 500 });
  const path = params._splat ?? "";
  if (!/^(auth|rest|storage|functions)\/v1\//.test(path)) return new Response("Not found", { status: 404 });
  const src = new URL(request.url);
  const headers = new Headers();
  request.headers.forEach((v, k) => {
    if (!HOP.includes(k.toLowerCase())) headers.set(k, v);
  });
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const res = await fetch(`${base}/${path}${src.search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });
  const out = new Headers(res.headers);
  out.delete("content-encoding");
  out.delete("content-length");
  out.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, headers: out });
}

export const Route = createFileRoute("/api/public/sb/$")({
  server: {
    handlers: { GET: relay, POST: relay, PUT: relay, PATCH: relay, DELETE: relay, HEAD: relay },
  },
});
