// Guard against errors that only appear after entering the table in a browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');

test('every statically accessed DOM element exists exactly once', () => {
  const used = [...js.matchAll(/\bel\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
  for (const id of new Set(used)) {
    const matches = [...html.matchAll(/\bid=["']([^"']+)["']/g)].filter(m => m[1] === id);
    assert.equal(matches.length, 1, `Missing or duplicated element id="${id}"`);
  }
});

test('critical table controls are present', () => {
  for (const id of ['chipbar','numberGrid','spinButton','readyButton','countdownText','historyItems','distanceLabel','distanceHistoryItems','distanceHistoryCount','allInButton'])
    assert.match(html, new RegExp('id="' + id + '"'));
});


test('throw-distance UI uses S/O labels and includes 25-result history', () => {
 assert.match(html, /Last 25 Throw Distances/);
 assert.match(html, /S = same side/);
 assert.match(html, /O = opposite side/);
 assert.match(js, /recentPairs=\[\.\.\.pairs\]\.reverse\(\)\.filter\(Boolean\)\.slice\(0,25\)/);
 assert.match(js, /\(d\.side==='opposite'\?'O':'S'\)/);
});
