# American Roulette — Six-Player Live Table

A real-time American double-zero roulette **simulator for play credits only**. Up to six friends can join the same table from iPhone, Android, Mac, or Windows, each with their own bankroll and bets. Everyone watches the same animated wheel and the same 25-spin history.

## Put it online to share a link (recommended)

You need to **deploy this folder as a web service**. Opening `public/index.html` directly will not enable multiplayer. The easiest route is GitHub + Render:

1. Extract the ZIP.
2. Create a new GitHub repository at https://github.com/new . Upload the **contents** of this folder (`server.js`, `package.json`, `render.yaml`, `public/`, etc.) into the repository's **top level**, and commit. (Do not upload just the ZIP.)
3. Go to https://dashboard.render.com/ . Choose **New → Web Service**, and connect the GitHub repository.
4. Choose Node, select **Free** if available, use **Build Command: `npm install`** and **Start Command: `npm start`**. The repo also includes a `render.yaml` configuration for Render Blueprints.
5. Once the deployment shows **Live**, Render gives you an HTTPS address like `https://your-service-name.onrender.com`. This is the link to open on any PC or iPhone.
6. Open that address, enter your name, and select **CREATE NEW TABLE**. Tap **Copy invite link** and send it to up to **five friends**. When they open it, they enter their own name and tap **JOIN TABLE**.

Each table has its own seven-character room code. You can create multiple rooms. Spins start automatically when all occupied seats tap **Ready to Spin**, or when the shared 90-second countdown reaches zero (whichever happens first). The host can reset the table and free offline seats. The host role passes to another connected player if the host disconnects.

### Updating a previously deployed table

If you already deployed the earlier multiplayer ZIP, update the same GitHub repository with the **new files from this ZIP** (especially `server.js`, `public/index.html` and `public/client.js`) and commit the changes. If Render automatic deployments are enabled, Render will redeploy the updated version at your **existing website address**. Note that redeploying restarts the in-memory server and clears rooms, seats, chips and history; create a new room once the updated version is live. You do **not** need to register another Render service.

### Note about free hosting

Render's free web services may sleep after 15 minutes with no incoming activity. The first visitor after sleeping may need to wait for the service to wake. **Rooms, players, and spin history live in server memory**, so a host restart, deployment, or free-service spin-down clears all tables. Keep a game session active to prevent idle spin-down; if the server restarts, create a new table. To keep rooms permanently, this code would need database persistence.

## Run locally on Windows (for testing)

1. Install Node.js 20+ from https://nodejs.org/ (if needed).
2. Double-click **START_LOCAL_WINDOWS.bat**, or open a terminal in this folder and run `node server.js`.
3. On your own PC, open http://localhost:3000 .
4. Your friends can't reach `localhost` on your computer over the internet. For remote iPhones and PCs, deploy using the instructions above.

No npm packages or external API keys are needed to run this app.

## How to play

- **Seats:** maximum six players per private table. Returning players are recognized in the same browser by a private saved seat token; the invite link contains only the room code.
- **Bets:** individual play-credit bankrolls, chips, straight, split, street, corner, six-line, columns, dozens, even/odd, red/black, high/low and the five-number basket.
- **Coverage:** gold wheel pockets are covered by **your** current bets; bright blue pockets by **others'** bets. Both colors can mark a pocket if bets overlap. Total coverage is table-wide.
- **One wheel:** the SERVER starts each spin **either when every occupied seat is ready OR after a maximum 90-second betting window**, whichever happens first. No player needs to click a manual spin button. The wheel is shared by everyone, and bets lock during the spin. Every pocket has a 1/38 probability, using cryptographically secure server-side randomness. Standard American roulette payouts apply.
- **Ready to Spin:** each player taps the prominent Ready button in the countdown panel (also available below their bet slip). Ready players can't edit their wagers unless they tap the button again to cancel readiness. All occupied seats count, including temporarily disconnected players; disconnected seats cannot press ready, but the 90-second auto-spin still occurs. There is no need to wait for all six seats to fill—only the currently occupied seats matter.
- **90-second timer:** the synchronized `MM:SS` clock on every device counts down to the next spin, with a visual progress bar. The timer starts at room creation and **restarts for a full 90 seconds after each result has been settled**. It also resets when the host resets the table. Late joiners share the existing deadline; they do not restart the clock. During a spin the timer reads `SPINNING`. Server clock timestamps are used to keep iPhones/PCs aligned.
- **History:** newest-first 25-spin list is identical on all devices. Each seat's own winnings and P/L are calculated on the server.
- **Controls:** Ready/Cancel Ready, Undo, Clear bets, Repeat last, host-only Reset table. The reset affects all seats, credits and history.
- **iPhone:** open the HTTPS link in Safari/Chrome. Swipe horizontally inside the numbered betting grid to access all 36 numbers and columns.

## Files

- `server.js` — Node HTTP server, server-side bets and payouts, table management, live Server-Sent Events (SSE).
- `public/index.html` — mobile-ready responsive wheel and betting table.
- `public/client.js` — iPhone/desktop interactions and shared state updates.
- `render.yaml` — optional Render blueprint.
- `test/multiplayer.test.js`, `test/autospin.test.js`, and `test/extra.test.js` — HTTP integration tests, including synchronized early spins, timeout spins, resets, and 25-result history. Run with `npm test` (Windows, macOS or Linux). Tests use short timers without changing the production 90-second setting.

**Entertainment only. No payment processing, cash wagers, or monetary rewards.**
