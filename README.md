# Rory’s Kinky Casino — Multiplayer V5

An American double-zero roulette simulator using **play credits only** (no money, prizes or payments). One public shared six-seat table, playable from an iPhone or PC. Each player has their own bankroll, bet slip and wheel coverage; everyone sees the same outcome and last 25 results/distances.

## What’s new in V5

- **Name:** Rory’s Kinky Casino, on the lobby and table.
- **Just enter your name:** There are no game passwords, invite codes, room creation steps, or separate private tables. Every visitor at your deployment URL lands at the same table. Only six seats can be occupied at once. Returning visitors on the same browser reconnect using their automatically saved *seat token* (not a password). If all six seats are occupied, a seventh player gets a full-table message. The host can free an offline seat.
- **Direct betting:** No inside-bet mode tabs. Tap the **center of a number** for straight (35:1), **a line between adjacent numbers** for split (17:1), **four-number intersection** for corner (8:1), **top or bottom edge** above/below a three-number street (11:1), and **top or bottom edge at the dividing line between streets** for six-line (5:1). Zero, double-zero, dozens, columns, red/black, odd/even, 1–18/19–36, and the five-number basket still work. On phones the board scrolls horizontally. The text above the board shows the last bet target tapped.
- **$500 chip:** $1, $5, $10, $25, $100, **$500**, and All In.
- **Who bet where:** Your own chips are marked **gold**, other players’ bets are marked **blue**, with their seat number, directly on the betting board. A number’s outline also indicates if a friend has a covered straight/inside/outside number. The **wheel only highlights YOUR covered pockets**, not your friends’.
- **Phone-friendly screen:** The betting table is immediately below the wheel and its quick result; the 25-spin and throw-distance histories are below the betting table. On desktop, histories remain in the left column.
- **Spin timing:** Everyone sees the synchronized 90-second timer. All occupied seats clicking Ready spins early. Bets lock when ready/spinning; players may cancel readiness before a spin.
- **Correct wheel groups:** A/B/C = first/second/third column; 1/2/3 = first/second/third dozen; no group for 0 or 00. Pocket labels stay upright during wheel rotation.

## Update your EXISTING GitHub + Render website

1. **Extract this ZIP before uploading.** Do not upload the ZIP as the application.
2. Make sure the *top level* of your GitHub repository looks exactly like this:

```
server.js
package.json
render.yaml
START_LOCAL_WINDOWS.bat
README.md
public/
    index.html
    client.js
test/
    ...test files...
```

**Important:** `index.html` and `client.js` must be inside `public/`, not at your repository root. Keep test files inside `test/`. Previously uploading individual files flattened your directories and caused Render's `ENOENT .../public/index.html` error. Using GitHub Desktop to commit the extracted folder structure is safer than uploading every file individually in the browser. Verify that GitHub displays `public/` as a folder before redeploying.

3. Push/commit these changes to your existing repository.
4. On your existing Render Web Service, use **Runtime: Node**, **Build Command: `npm install`**, **Start Command: `npm start`**. No backticks, quotes or dollar signs in those commands. Trigger **Manual Deploy → Deploy latest commit** if automatic deployments aren't enabled.
5. Open the SAME Render link that you and your friends already share. You should see **Rory’s Kinky Casino** and a **TAKE A SEAT** button, not Create/Join Table. Your friends all visit this same URL—no room suffix or code.

**Important:** This version intentionally replaces the old multi-room system with one shared table. In-memory balances, occupied seats, current bets and history will reset when the server restarts or when Render spins down a free instance. Multiple Render instances would each have their own table; use a **single server instance** unless you add persistent shared storage.

## Run on your PC

Install Node.js 20 or later. Extract the ZIP and double-click `START_LOCAL_WINDOWS.bat`. It opens **http://localhost:3037** and verifies the new V5 server version so an old local version cannot be mistaken for the update. Or run `npm start` in the extracted folder and open http://localhost:3000 . Keep the server console window open. For multiplayer across iPhones and friends’ homes, use your deployed Render URL instead of localhost.

## Tests

Run `npm test` to test payouts, six-seat limits, the server timer, All In, the new $500 chip, single shared room, direct bet-position classification, wheel-group labels and distance history. All 17 automated tests passed when this archive was produced. Desktop and mobile browser layout and on-screen betting were additionally verified.

**For entertainment only.** No payments or real-money bets.
