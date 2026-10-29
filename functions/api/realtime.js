/**
 * Cloudflare Pages route: /api/realtime?competition_id=123
 * Configure a Durable Object binding named REALTIME_DO in Pages settings.
 */
export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const competitionId = url.searchParams.get("competition_id");

  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("WebSocket upgrade required", { status: 426 });
  }

  if (!competitionId) {
    return Response.json(
      { success: false, error: "competition_id is required" },
      { status: 400 }
    );
  }

  const namespace = context.env.REALTIME_DO;
  if (!namespace) {
    return Response.json(
      { success: false, error: "Realtime is not configured. Add the REALTIME_DO Durable Object binding in Cloudflare Pages." },
      { status: 503 }
    );
  }

  const id = namespace.idFromName(`competition:${competitionId}`);
  const room = namespace.get(id);
  return room.fetch(request);
}
