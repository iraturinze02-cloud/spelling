# Live spelling competition setup (Cloudflare Pages + Neon)

This update adds WebSocket live updates using a Cloudflare Durable Object. The existing Neon database remains the permanent source of truth.

## Files added or changed

- `realtime-worker/`: the Cloudflare Worker that hosts the Durable Object WebSocket room.
- `functions/api/realtime.js`: same-origin WebSocket endpoint at `/api/realtime`.
- `functions/api.js`: broadcasts after competition-state changes and judge votes are saved.
- `spelling/judge.html` and `spelling/timer.html`: subscribe to live updates and count the timer locally between events.
- `spelling/js/competition.js`: teacher panel uses WebSocket notifications with a slower fallback poll.

## One-time Cloudflare setup

The code alone cannot create Cloudflare resources. Complete these steps after pushing this folder to GitHub.

### 1. Deploy the realtime Worker from this same GitHub repository

1. Open the Cloudflare dashboard.
2. Go to **Workers & Pages** and create a Worker connected to this GitHub repository.
3. Set the Worker root directory to `realtime-worker`.
4. Set the build command to `npm install`.
5. Set the deploy command to `npm run deploy`.
6. Deploy it. Its Worker name is configured in `realtime-worker/wrangler.jsonc` as `fila-competition-realtime`.

This Worker exports the Durable Object class `CompetitionRoom`. Do not remove the `migrations` section from `wrangler.jsonc`.

### 2. Bind the Durable Object to your existing Pages project

1. Open **Workers & Pages** and select the existing spelling competition **Pages** project.
2. Go to **Settings → Bindings → Add → Durable Object**.
3. Set **Variable name** to exactly `REALTIME_DO`.
4. Select the `CompetitionRoom` Durable Object namespace from the `fila-competition-realtime` Worker.
5. Save the binding.

### 3. Redeploy Pages

Redeploy the existing Pages project so its Functions receive the new binding. Keep your existing `NEON_URL` environment variable unchanged.

### 4. Test

1. Open the teacher dashboard in one browser tab.
2. Open `spelling/judge.html` in another tab, signed in as a judge.
3. Open `spelling/timer.html` on the universal display.
4. Start the timer, move to another word, and submit a judge vote. The other screens should update from WebSocket broadcasts; the pages keep a 15-second fallback refresh in case a connection drops.

## Notes

- The WebSocket is used for instant notifications; Neon remains the source of truth. The browser fetches the latest competition state when a notification arrives.
- Timer displays count down locally after receiving the start event, avoiding a Neon write every second.
- If the `REALTIME_DO` binding is not configured, the existing API actions should still save to Neon, but live WebSocket connections will not work.
- This change does not replace the existing login system. Before opening the site to untrusted public users, review authentication and password storage; the current API compares passwords directly against the database.
- Legacy files such as `spelling/js/teacher.js` still contain old Netlify Function URLs, but the current `spelling/teacher.html` loads `spelling/js/competition.js`. Avoid switching that page to the legacy script unless its API calls are migrated too.
