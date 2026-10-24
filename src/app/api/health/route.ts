/** Liveness check for Render. Reports nothing about configuration or secrets. */
export function GET() {
  return Response.json({ status: "ok" });
}
