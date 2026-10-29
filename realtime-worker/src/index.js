import { DurableObject } from "cloudflare:workers";

/**
 * One room per spelling competition. Browsers connect through the Pages
 * /api/realtime route; the Pages API broadcasts only after database writes.
 */
export class CompetitionRoom extends DurableObject {
  async fetch(request) {
    if (request.method === "POST" && new URL(request.url).pathname === "/broadcast") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
      }

      const message = JSON.stringify(payload);
      let sent = 0;
      for (const socket of this.ctx.getWebSockets()) {
        try {
          socket.send(message);
          sent++;
        } catch (error) {
          console.error("Could not send realtime message:", error?.message || error);
        }
      }

      return Response.json({ success: true, sent });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({
      type: "connected",
      connected_at: Date.now()
    }));

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(_socket, _message) {
    // Clients are subscribers only. State changes must go through the Pages API.
  }

  async webSocketClose(socket, code, reason) {
    try {
      socket.close(code, reason);
    } catch {
      // The peer may already have closed.
    }
  }

  async webSocketError(socket) {
    try {
      socket.close(1011, "Realtime connection error");
    } catch {
      // The socket may already be closed.
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Public worker endpoint only accepts WebSocket connections. It does not
    // expose the Durable Object's internal /broadcast route.
    if (url.pathname !== "/ws" || request.headers.get("Upgrade") !== "websocket") {
      return new Response("Not found", { status: 404 });
    }

    const competitionId = url.searchParams.get("competition_id");
    if (!competitionId) {
      return new Response("competition_id is required", { status: 400 });
    }

    const id = env.COMPETITION_ROOM.idFromName(`competition:${competitionId}`);
    return env.COMPETITION_ROOM.get(id).fetch(request);
  }
};
