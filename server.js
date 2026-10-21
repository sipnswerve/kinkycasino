'use strict';
// American roulette multiplayer demo. Play credits only: no payments, prizes, or real money.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT === '0' ? 0 : (Number(process.env.PORT) || 3000);
const SPIN_MS = Math.max(50, Number(process.env.SPIN_MS) || 4300);
// Every betting round lasts 90 seconds unless all occupied seats ready up first.
const ROUND_MS = Math.max(100, Number(process.env.ROUND_MS) || 90000);
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 150, MAX_BETS = 500, MAX_PLAYERS = 6;
const ALL = Array.from({length:36}, (_,i)=>String(i+1));
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].map(String));
const WHEEL = ['0',28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,'00',27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2].map(String);
const CHIP_VALUES = new Set([1,5,10,25,100]);
const PAYOUTS = {straight:35,split:17,street:11,corner:8,sixline:5};
const OUTSIDE = Object.create(null);
function define(id,label,nums,payout) { OUTSIDE[id] = {type:id,label,numbers:nums.map(String),payout}; }
define('low','1–18',ALL.filter(n=>Number(n)<=18),1);
define('high','19–36',ALL.filter(n=>Number(n)>=19),1);
define('even','Even',ALL.filter(n=>Number(n)%2===0),1);
define('odd','Odd',ALL.filter(n=>Number(n)%2===1),1);
define('red','Red',ALL.filter(n=>RED.has(n)),1);
define('black','Black',ALL.filter(n=>!RED.has(n)),1);
for(let i=0;i<3;i++) define('dozen'+(i+1),`${i+1}${i===0?'st':i===1?'nd':'rd'} Dozen`,ALL.slice(i*12,(i+1)*12),2);
for(let i=0;i<3;i++) define('col'+i,`${i===0?'Top':i===1?'Middle':'Bottom'} Column`,ALL.filter(n=>(Number(n)-1)%3===2-i),2);
define('basket','Five-number Basket',['0','00','1','2','3'],6);
const rooms = new Map();

function cleanName(input) {
  return String(input ?? '').trim().replace(/[\u0000-\u001F\u007F]/g,'').slice(0,24) || 'Player';
}
function freshCode() {
  let code;
  do { code = Array.from({length:7},()=>ROOM_CHARS[crypto.randomInt(ROOM_CHARS.length)]).join(''); } while (rooms.has(code));
  return code;
}
function validCode(code) { return typeof code==='string' && /^[A-Z2-9]{7}$/.test(code.toUpperCase()) ? code.toUpperCase() : null; }
function validBankroll(amount) { return Number.isSafeInteger(amount) && amount>=1 && amount<=100000000; }
function publicPlayer(player,room) { return {id:player.id,seat:player.seat,name:player.name,bankroll:player.bankroll,pl:player.pl,betTotal:player.bets.reduce((s,b)=>s+b.stake,0),ready:player.ready,online:player.streams.size>0,isHost:player.id===room.hostId}; }
function exposureFor(bets) { const result=Object.fromEntries(WHEEL.map(n=>[n,0])); for(const bet of bets) for(const n of bet.numbers) result[n]+=bet.stake; return result; }
function snapshot(room,player) {
  const otherBets=room.players.filter(p=>p!==player).flatMap(p=>p.bets);
  return { code:room.code,initialBankroll:room.initialBankroll,hostId:room.hostId,
    you:publicPlayer(player,room),players:room.players.map(p=>publicPlayer(p,room)),
    bets:player.bets, lastBets:player.lastBets,
    mineExposure:exposureFor(player.bets),otherExposure:exposureFor(otherBets),
    history:room.history.slice(-25),lastResult:room.lastResult,
    lastSettlement:player.lastSettlement,
    spin:room.spin ? {...room.spin} : null,round:room.round,
    nextSpinAt:room.nextSpinAt,roundDurationMs:ROUND_MS,serverNow:Date.now(),
    totalSpins:room.totalSpins };
}
function sseSend(res, type, payload) {
  if(res.destroyed || res.writableEnded) return;
  try { res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`); } catch(e) { /* connection closed */ }
}
function broadcast(room) {
  room.updatedAt=Date.now();
  for(const player of room.players) {
    const state=snapshot(room,player);
    for(const stream of player.streams) sseSend(stream,'state',state);
  }
}
function assignHost(room) {
  if(room.players.some(p=>p.id===room.hostId && p.streams.size>0))return;
  const successor=room.players.find(p=>p.streams.size>0);
  if(successor)room.hostId=successor.id;
}
// The countdown belongs to the SERVER, so iPhones and computers share one deadline.
function scheduleRound(room) {
  if(room.roundTimer)clearTimeout(room.roundTimer);
  for(const player of room.players)player.ready=false;
  room.nextSpinAt=Date.now()+ROUND_MS;
  const timer=setTimeout(()=>{
    if(room.roundTimer!==timer||room.spin)return;
    room.roundTimer=null;
    spinRoom(room,'timer');
  },ROUND_MS);
  room.roundTimer=timer;
  timer.unref();
}
function everybodyReady(room){return room.players.length>0&&room.players.every(p=>p.ready);}
function createRoom(name,amount) {
  const now=Date.now();
  const room={code:freshCode(),initialBankroll:amount,hostId:null,players:[],history:[],lastResult:null,spin:null,round:0,totalSpins:0,updatedAt:now,lastHumanActivityAt:now,nextBet:0,nextSpinAt:null,roundTimer:null};
  rooms.set(room.code,room);
  const player=addPlayer(room,name);room.hostId=player.id;
  scheduleRound(room);
  return {room,player};
}
function addPlayer(room,name) {
  const seat=Array.from({length:MAX_PLAYERS},(_,i)=>i+1).find(s=>!room.players.some(p=>p.seat===s));
  const player={id:crypto.randomUUID(),token:crypto.randomBytes(24).toString('hex'),name:cleanName(name),seat,bankroll:room.initialBankroll,pl:0,bets:[],ready:false,lastBets:[],lastSettlement:null,streams:new Set()};
  room.players.push(player);return player;
}
function membership(room,token) { return room.players.find(p=>typeof token==='string' && p.token===token); }
function fail(message,status=400) {const e=new Error(message);e.status=status;throw e;}
function asNumbers(raw) {
  if(!Array.isArray(raw) || raw.length>6)return null;
  if(!raw.every(n=>typeof n==='string' && /^(00|0|[1-9]|[12]\d|3[0-6])$/.test(n)))return null;
  const values=[...new Set(raw)].sort((a,b)=>Number(a)-Number(b));
  return values.length===raw.length?values:null;
}
function insideValid(type,values) {
  if(type==='straight')return values.length===1 && WHEEL.includes(values[0]);
  const nums=values.map(Number);
  if(nums.some(n=>n<1||n>36))return false;
  if(type==='split')return nums.length===2 && (nums[1]-nums[0]===3 || (nums[1]-nums[0]===1 && Math.floor((nums[0]-1)/3)===Math.floor((nums[1]-1)/3)));
  if(type==='street')return nums.length===3 && (nums[0]-1)%3===0 && nums.every((n,i)=>n===nums[0]+i);
  if(type==='corner')return nums.length===4 && (nums[0]-1)%3!==2 && nums.every((n,i)=>n===[nums[0],nums[0]+1,nums[0]+3,nums[0]+4][i]);
  if(type==='sixline')return nums.length===6 && nums[0]%3===1 && nums.every((n,i)=>n===nums[0]+i);
  return false;
}
function betDefinition(type,rawNumbers) {
  if(OUTSIDE[type])return { ...OUTSIDE[type],numbers:[...OUTSIDE[type].numbers]};
  if(!Object.hasOwn(PAYOUTS,type))fail('Unknown bet type.');
  const numbers=asNumbers(rawNumbers);
  if(!numbers||!insideValid(type,numbers))fail('Invalid group of roulette numbers.');
  const label=type[0].toUpperCase()+type.slice(1)+' · '+numbers.join(', ');
  return {type,label,numbers,payout:PAYOUTS[type]};
}
function spinRoom(room,reason) {
  if(room.spin)fail('The wheel is already spinning.');
  if(room.roundTimer){clearTimeout(room.roundTimer);room.roundTimer=null;}
  room.nextSpinAt=null;
  const result=WHEEL[crypto.randomInt(WHEEL.length)];
  const startedAt=Date.now();
  room.spin={id:crypto.randomUUID(),result,reason,startedAt,endsAt:startedAt+SPIN_MS};
  broadcast(room);
  setTimeout(()=> {
    if(!room.spin)return;
    for(const player of room.players) {
      const wagered=player.bets.reduce((s,b)=>s+b.stake,0);
      const returned=player.bets.filter(b=>b.numbers.includes(result)).reduce((s,b)=>s+b.stake*(b.payout+1),0);
      player.lastBets=player.bets.map(({type,label,numbers,payout,stake})=>({type,label,numbers:[...numbers],payout,stake}));
      player.bankroll+=returned;player.pl+=returned-wagered;
      player.lastSettlement={result,wagered,returned,net:returned-wagered,round:room.round+1};
      player.bets=[];
    }
    room.round++;room.totalSpins++;room.history.push(result);
    if(room.history.length>25)room.history.shift();
    room.lastResult=result;room.spin=null;
    scheduleRound(room); // A fresh 90-second betting window begins after settlement.
    broadcast(room);
  },SPIN_MS);
}
function executeAction(room,player,body) {
  const action=body.action;
  if(['add','remove','undo','clear','repeat'].includes(action)&&player.ready)
    fail('Cancel Ready to Spin before editing your bets.');
  if(action==='add') {
    if(room.spin)fail('Bets are locked during the spin.');
    if(player.bets.length>=MAX_BETS)fail('Maximum 500 chips per round.');
    if(!CHIP_VALUES.has(body.stake))fail('Invalid chip value.');
    if(player.bankroll<body.stake)fail('Not enough credits for that chip.');
    const def=betDefinition(body.betType,body.numbers);
    player.bankroll-=body.stake;
    player.bets.push({id:++room.nextBet,...def,stake:body.stake});
  } else if(action==='remove') {
    if(room.spin)fail('Bets are locked during the spin.');
    const i=player.bets.findIndex(b=>b.id===body.betId);
    if(i<0)fail('Your bet was not found.');
    player.bankroll+=player.bets[i].stake;player.bets.splice(i,1);
  } else if(action==='undo') {
    if(room.spin)fail('Bets are locked during the spin.');
    const b=player.bets.pop();if(!b)fail('There are no bets to undo.');
    player.bankroll+=b.stake;
  } else if(action==='clear') {
    if(room.spin)fail('Bets are locked during the spin.');
    player.bankroll+=player.bets.reduce((s,b)=>s+b.stake,0);player.bets=[];
  } else if(action==='repeat') {
    if(room.spin)fail('Bets are locked during the spin.');
    if(!player.lastBets.length)fail('You have no previous bets.');
    const cost=player.lastBets.reduce((s,b)=>s+b.stake,0);
    if(cost>player.bankroll)fail('Not enough credits to repeat your bets.');
    if(player.bets.length+player.lastBets.length>MAX_BETS)fail('Too many chips on the table.');
    for(const bet of player.lastBets) {
      const def=betDefinition(bet.type,bet.numbers);
      player.bankroll-=bet.stake;player.bets.push({id:++room.nextBet,...def,stake:bet.stake});
    }
  } else if(action==='ready') {
    if(room.spin)fail('The wheel is already spinning.');
    if(typeof body.ready!=='boolean')fail('Ready must be true or false.');
    player.ready=body.ready;
    if(everybodyReady(room)){spinRoom(room,'ready');return;}
  } else if(action==='spin') {
    fail('Spins start automatically when everyone is ready or the 90-second timer expires.');
  } else if(action==='reset') {
    if(room.hostId!==player.id)fail('Only the current host can reset the table.',403);
    if(room.spin)fail('Finish the spin before resetting.');
    const amount=Number(body.amount);
    if(!validBankroll(amount))fail('Starting credits must be between 1 and 100,000,000.');
    room.initialBankroll=amount;room.history=[];room.lastResult=null;room.totalSpins=0;room.round=0;
    for(const p of room.players) {p.bankroll=amount;p.pl=0;p.bets=[];p.lastBets=[];p.lastSettlement=null;}
    scheduleRound(room);
  } else if(action==='kick') {
    if(room.hostId!==player.id)fail('Only the host can free an empty seat.',403);
    if(room.spin)fail('Finish the spin before freeing a seat.');
    const target=room.players.find(p=>p.id===body.playerId);
    if(!target || target===player || target.streams.size>0)fail('Only offline guest seats can be freed.');
    room.players=room.players.filter(p=>p!==target);
    if(everybodyReady(room)){spinRoom(room,'ready');return;}
  } else fail('Unknown action.');
  broadcast(room);
}

const PUBLIC_DIR=path.join(__dirname,'public');
function json(res,status,payload) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));}
async function bodyJson(req) {
  let count=0;const parts=[];
  for await(const chunk of req) {count+=chunk.length;if(count>16384)fail('Request is too large.',413);parts.push(chunk);}
  try {return JSON.parse(Buffer.concat(parts).toString('utf8'));} catch {fail('Invalid JSON request.');}
}
function getRoom(code) {const room=rooms.get(validCode(code));if(!room)fail('Table not found. The server may have restarted; create a new table.',404);return room;}
function getUser(room,token) {const player=membership(room,token);if(!player)fail('Your seat has expired. Rejoin with your name to take an available seat.',401);return player;}
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true});
    if(req.method==='POST'&&url.pathname==='/api/create'){
      const body=await bodyJson(req);
      const amount=Number(body.bankroll ?? 1000);
      if(!validBankroll(amount))fail('Invalid starting bankroll.');
      if(rooms.size>=MAX_ROOMS)fail('Too many active tables. Please try later.',503);
      const {room,player}=createRoom(body.name,amount);
      return json(res,200,{code:room.code,token:player.token,state:snapshot(room,player)});
    }
    if(req.method==='POST'&&url.pathname==='/api/join'){
      const body=await bodyJson(req),room=getRoom(body.code);
      room.lastHumanActivityAt=Date.now();
      let player=membership(room,body.token);
      if(!player) {
        if(room.players.length>=MAX_PLAYERS)fail('This table is full (6 of 6 seats).',409);
        player=addPlayer(room,body.name);
      }
      if(player.streams.size===0 && !room.players.some(p=>p.id===room.hostId&&p.streams.size>0))room.hostId=player.id;
      broadcast(room);
      return json(res,200,{code:room.code,token:player.token,state:snapshot(room,player)});
    }
    if(req.method==='POST'&&url.pathname==='/api/action'){
      const body=await bodyJson(req),room=getRoom(body.code),player=getUser(room,body.token);
      room.lastHumanActivityAt=Date.now();
      executeAction(room,player,body);
      return json(res,200,{ok:true});
    }
    if(req.method==='GET'&&url.pathname==='/events'){
      const room=getRoom(url.searchParams.get('code'));
      const player=getUser(room,url.searchParams.get('token'));
      room.lastHumanActivityAt=Date.now();
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});
      res.write(': welcome\n\n');player.streams.add(res);
      assignHost(room);broadcast(room);
      const heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': ping\n\n');},15000);
      req.on('close',()=>{clearInterval(heartbeat);player.streams.delete(res);assignHost(room);broadcast(room);});
      return;
    }
    if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/client.js'||url.pathname==='/favicon.ico')){
      if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
      const file=url.pathname==='/client.js'?'client.js':'index.html';
      res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      return fs.createReadStream(path.join(PUBLIC_DIR,file)).pipe(res);
    }
    return json(res,404,{error:'Page not found.'});
  } catch(e) {if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Server error.'});}
});
// Old idle tables are removed automatically. This is a casual in-memory simulator.
const cleanup=setInterval(()=>{const now=Date.now();for(const [code,room] of rooms)if(!room.players.some(p=>p.streams.size>0)&&!room.spin&&now-room.lastHumanActivityAt>24*60*60*1000){if(room.roundTimer)clearTimeout(room.roundTimer);rooms.delete(code);}},3600000);
cleanup.unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`Roulette multiplayer listening on http://localhost:${PORT}`));
module.exports={server,rooms,insideValid,betDefinition};
