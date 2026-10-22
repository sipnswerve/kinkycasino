# Rory’s Roulette — Reference Wheel V3 · Six-Player Casino

**Rory’s Roulette** is a neon-gold, casino-style, real-time American double-zero roulette **simulator for play credits only**. Up to six friends can join the same table from iPhone, Android, Mac, or Windows, each with their own bankroll and bets. Everyone watches the same animated wheel and the same 25-spin history.

## Put it online to share a link (recommended)

You need to **deploy this folder as a web service**. Opening `public/index.html` directly will not enable multiplayer. The easiest route is GitHub + Render:

1. Extract the ZIP.
2. Create a new GitHub repository at https://github.com/new . Upload the **contents** of this folder (`server.js`, `package.json`, `render.yaml`, `public/`, etc.) into the repository's **top level**, and commit. (Do not upload just the ZIP.)
3. Go to https://dashboard.render.com/ . Choose **New → Web Service**, and connect the GitHub repository.
4. Choose Node, select **Free** if available, use **Build Command: `npm install`** and **Start Command: `npm start`**. The repo also includes a `render.yaml` configuration for Render Blueprints.
5. Once the deployment shows **Live**, Render gives you an HTTPS address like `https://your-service-name.onrender.com`. This is the link to open on any PC or iPhone.
6. Open that address, enter your name, and select **CREATE NEW TABLE**. Tap **Copy invite link** and send it to up to **five friends**. When they open it, they enter their own name and tap **JOIN TABLE**.

Each table has its own seven-character room code. You can create multiple rooms. Spins start automatically when all occupied seats tap **Ready to Spin**, or when the shared 90-second countdown reaches zero (whichever happens first). The host can reset the table and free offline seats. The host role passes to another connected player if the host disconnects.

## NEW — Correct Dozens and Columns Wheel V4 (Oct 22, 2026)

The decorative band labels are now **calculated from the actual winning pocket number**: 1/2/3 are 1–12 / 13–24 / 25–36, and A/B/C are the first/second/third roulette columns (A = 1,4,7..., B = 2,5,8..., C = 3,6,9...). Neither 0 nor 00 is part of any dozen or column, so those band cells are blank neutral gray. All 38 slots were checked for correct classification.

The V4 Windows launcher uses port **3036** and checks the V4 server health marker, and the updated browser script uses a fresh cache-busting version.

## Earlier Reference-Style Wheel V3 (Oct 22, 2026)

The wheel now resembles the user-provided reference image: the **00 pocket is centered at 12 o’clock**, the wheel has the pastel **A/B/C outer ring**, red/black/green numbered pockets, pink/blue/lime **1/2/3 inner ring**, fine radial divisions, and a **blank white center**. The wheel rotates during spins, but all pocket numbers and group letters remain horizontally upright and readable. Live gold and blue bet highlighting still works. Confirm you are using V3 by looking for the text **“Wheel V4 · Accurate dozens & columns · Upright labels”** beside the Live Wheel Coverage heading.

### If your wheel still looks old

**Updating a downloaded ZIP does not automatically update your deployed site.** Upload/commit the actual files inside the ZIP to your *existing GitHub repository* and wait for Render to show a successful deployment of that commit. Then refresh the live page with Ctrl+Shift+R on Windows or reload Safari on iPhone. The HTML is now served with `Cache-Control: no-store` and the JS has a unique `?v=correct-dozens-columns-v4-20261022` URL to prevent old browser caches from showing the previous wheel.

**Windows local testing:** double-click `START_LOCAL_WINDOWS.bat` in this extracted folder. This build opens **http://localhost:3036/** instead of the old **http://localhost:3000/** so an earlier copy running in another console window cannot trick you into testing the old wheel. The launcher also checks the server version before opening the browser. Close any old Rory’s Roulette server windows before starting a new game.

### Updating a previously deployed table

If you already deployed the earlier multiplayer ZIP, update the same GitHub repository with the **new files from this ZIP** (especially `server.js`, `public/index.html` and `public/client.js`) and commit the changes. If Render automatic deployments are enabled, Render will redeploy the updated version at your **existing website address**. Note that redeploying restarts the in-memory server and clears rooms, seats, chips and history; create a new room once the updated version is live. You do **not** need to register another Render service.

### Note about free hosting

Render's free web services may sleep after 15 minutes with no incoming activity. The first visitor after sleeping may need to wait for the service to wake. **Rooms, players, and spin history live in server memory**, so a host restart, deployment, or free-service spin-down clears all tables. Keep a game session active to prevent idle spin-down; if the server restarts, create a new table. To keep rooms permanently, this code would need database persistence.

## Run locally on Windows (for testing)

1. Install Node.js 20+ from https://nodejs.org/ (if needed).
2. Double-click **START_LOCAL_WINDOWS.bat**, or open a terminal in this folder and run `node server.js`.
3. On your own PC, the launcher opens http://localhost:3036 . (Running `node server.js` manually without `PORT` uses http://localhost:3000 instead.)
4. Your friends can't reach `localhost` on your computer over the internet. For remote iPhones and PCs, deploy using the instructions above.

No npm packages or external API keys are needed to run this app.

## NEW: Last 25 Throw Distances (S / O)

Just beneath **Last 25 Spins** is a **Last Throw Distance** display and a **Last 25 Throw Distances** grid, both synchronized for all six players. Each tile displays a short code and its corresponding transition, newest first:

- **`S +2`** for **25 → 12** (same side, clockwise two pockets).
- **`O +1`** for **25 → 30** (opposite side, one pocket clockwise from the opposite pocket).
- Negative offsets such as **`O -8`** mean counterclockwise.
- **`S`** = same side; **`O`** = opposite side. **`+`** = clockwise; **`−`** = counterclockwise. Offsets use the real American 38-pocket wheel arrangement, and range from −9 to +9.

Distances appear after the **second** spin (the first spin has no previous result). The oldest distance remains computable even when only the **last 25 winning numbers** are visible: the server internally remembers the 26th-oldest pocket solely to calculate that distance. After 26 or more spins, the full grid displays 25 distance comparisons. Table reset clears both histories. This display describes past spins only; roulette outcomes remain independent.

## Fix for unresponsive bets and wheel

The previous build had a missing `id="chipbar"` in the casino page. When a player created or joined a table, the JavaScript attempted to update that element and crashed, preventing live updates. That has been fixed. A new automated UI contract test checks that every element used by the game script exists in the page so this regression is caught in future builds.

**To test the multiplayer version, run `START_LOCAL_WINDOWS.bat` and open `http://localhost:3000`, or deploy to a Node hosting service. Opening `public/index.html` by itself is not a multiplayer test: the server is required to place bets and spin the wheel.**

## What changed in this version

- The casino, lobby, desktop layout and iPhone layout are branded **Rory’s Roulette**, with casino-style gold, magenta and glowing lights. Animations respect the device’s Reduce Motion setting.
- **⚡ ALL IN** is a one-time betting selection: press it in the chip row, then pick where to put every credit you still have available. It works with number, outside, and inside group bets. Betting is calculated on the server so no credits already wagered are counted again.
- Latest wheel-distance indicator and a 25-item S/O distance history compare each spin against its predecessor in the shared American wheel order.
- All previously supported table features are intact: 6 private seats, 90-second shared auto-spin, early ready-up spins, betting coverage, accurate payouts, and shared 25-spin history.

## How to play

- **All In:** tap the flashy **⚡ ALL IN** button above the betting board, then choose **one** valid betting spot (straight number, outside bet, or selected split/street/corner/six-line). The **server** immediately wagers *all currently uncommitted play credits*, not the original starting bankroll or any credits already on the table. All In applies to **one next bet** and then automatically switches back to the previously selected chip. You can tap it again to cancel before placing the bet, or use Undo/Clear to get credits back before the spin. If the available bankroll is zero, All In is disabled.
- **Seats:** maximum six players per private table. Returning players are recognized in the same browser by a private saved seat token; the invite link contains only the room code.
- **Bets:** individual play-credit bankrolls, chips, straight, split, street, corner, six-line, columns, dozens, even/odd, red/black, high/low and the five-number basket.
- **Coverage:** gold wheel pockets are covered by **your** current bets; bright blue pockets by **others'** bets. Both colors can mark a pocket if bets overlap. Total coverage is table-wide.
- **One wheel:** the SERVER starts each spin **either when every occupied seat is ready OR after a maximum 90-second betting window**, whichever happens first. No player needs to click a manual spin button. The wheel is shared by everyone, and bets lock during the spin. Every pocket has a 1/38 probability, using cryptographically secure server-side randomness. Standard American roulette payouts apply.
- **Ready to Spin:** each player taps the prominent Ready button in the countdown panel (also available below their bet slip). Ready players can't edit their wagers unless they tap the button again to cancel readiness. All occupied seats count, including temporarily disconnected players; disconnected seats cannot press ready, but the 90-second auto-spin still occurs. There is no need to wait for all six seats to fill—only the currently occupied seats matter.
- **90-second timer:** the synchronized `MM:SS` clock on every device counts down to the next spin, with a visual progress bar. The timer starts at room creation and **restarts for a full 90 seconds after each result has been settled**. It also resets when the host resets the table. Late joiners share the existing deadline; they do not restart the clock. During a spin the timer reads `SPINNING`. Server clock timestamps are used to keep iPhones/PCs aligned.
- **History:** newest-first 25-spin result list plus up to 25 signed S/O comparisons are identical on all devices. Each seat's own winnings and P/L are calculated on the server.
- **Controls:** Ready/Cancel Ready, Undo, Clear bets, Repeat last, host-only Reset table. The reset affects all seats, credits and history.
- **iPhone:** open the HTTPS link in Safari/Chrome. Swipe horizontally inside the numbered betting grid to access all 36 numbers and columns.

## Files

- `server.js` — Node HTTP server, server-side bets and payouts, table management, live Server-Sent Events (SSE).
- `public/index.html` — mobile-ready responsive wheel and betting table.
- `public/client.js` — iPhone/desktop interactions and shared state updates.
- `render.yaml` — optional Render blueprint.
- `test/multiplayer.test.js`, `test/autospin.test.js`, `test/extra.test.js`, `test/allin.test.js`, and `test/wheel-distance.test.js`, and `test/ui-contract.test.js` — HTTP and UI contract tests, including synchronized early spins, timeout spins, resets, and 25-result history. Run with `npm test` (Windows, macOS or Linux). Tests use short timers without changing the production 90-second setting.

**Entertainment only. No payment processing, cash wagers, or monetary rewards.**
