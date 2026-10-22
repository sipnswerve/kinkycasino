'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const client = fs.readFileSync(path.join(__dirname,'../public/client.js'),'utf8');
const html = fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const server = fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const batch = fs.readFileSync(path.join(__dirname,'../START_LOCAL_WINDOWS.bat'),'utf8');
const wheel=['0',28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,'00',27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2].map(String);

// Isolate the same pure, production classification functions used by the SVG renderer.
const begin=client.indexOf('function wheelColumn(');
const end=client.indexOf('const outerFill=',begin);
assert.ok(begin!==-1&&end>begin,'Production wheel classification functions must exist');
const classify=vm.runInNewContext(client.slice(begin,end)+';({wheelColumn,wheelDozen})');

test('all 38 pockets show the CORRECT A/B/C column and 1/2/3 dozen, with 0/00 blank',()=>{
 assert.equal(wheel.length,38);
 for(const pocket of wheel){
  const isZero=pocket==='0'||pocket==='00';
  const num=Number(pocket);
  const expectedColumn=isZero?'':'ABC'[(num-1)%3];
  const expectedDozen=isZero?'':String(Math.ceil(num/12));
  assert.equal(classify.wheelColumn(pocket),expectedColumn,`${pocket} column`);
  assert.equal(classify.wheelDozen(pocket),expectedDozen,`${pocket} dozen`);
 }
 assert.equal(classify.wheelColumn('1'),'A');
 assert.equal(classify.wheelColumn('2'),'B');
 assert.equal(classify.wheelColumn('3'),'C');
 assert.equal(classify.wheelDozen('12'),'1');
 assert.equal(classify.wheelDozen('13'),'2');
 assert.equal(classify.wheelDozen('24'),'2');
 assert.equal(classify.wheelDozen('25'),'3');
 assert.equal(classify.wheelColumn('00'),'');
 assert.equal(classify.wheelDozen('0'),'');
});

test('ring wedges and upright text use computed labels, not the old incorrect hard-coded sequences',()=>{
 assert.doesNotMatch(client,/outerSeq|innerSeq|displayOrder|outerByNum|innerByNum/);
 assert.match(client,/const column=wheelColumn\(num\),dozen=wheelDozen\(num\)/);
 assert.match(client,/fill:outerFill\[column\]/);
 assert.match(client,/fill:innerFill\[dozen\]/);
 assert.match(client,/outerText\.textContent=column/);
 assert.match(client,/innerText\.textContent=dozen/);
 assert.match(client,/topIndex=WHEEL\.indexOf\('00'\)/);
 assert.match(client,/wheelStart=-90-\(topIndex\+\.5\)\*step/);
 assert.match(client,/positionWheelLabels\(angle\)/);
 assert.match(client,/setWheelAngle\(v\)/);
 assert.doesNotMatch(html,/#spinGroup\{transform-origin/);
 assert.match(html,/Wheel V4 · Accurate dozens & columns · Upright labels/);
 assert.match(html,/A<\/b> = 1st column/);
 assert.match(html,/1<\/b> = 1–12/);
});

test('browser update and Windows launcher avoid loading an old cached V3 server',()=>{
 assert.match(html,/\/client\.js\?v=correct-dozens-columns-v4-20261022/);
 assert.match(server,/Cache-Control':'no-store, max-age=0, must-revalidate/);
 assert.match(server,/version:'4\.0\.0',wheel:'correct-dozens-columns-v4-20261022'/);
 assert.match(batch,/PORT=3036/);
 assert.match(batch,/\$r\.wheel -eq 'correct-dozens-columns-v4-20261022'/);
});
