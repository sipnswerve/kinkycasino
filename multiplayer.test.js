'use strict';
process.env.PORT='0';process.env.SPIN_MS='60';process.env.ROUND_MS='90000';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {server,rooms,wheelDistance}=require('../server');
async function post(port,url,data){
 const response=await fetch(`http://127.0.0.1:${port}${url}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 return {status:response.status,data:await response.json()};
}
async function stream(port,code,token){const controller=new AbortController();const response=await fetch(`http://127.0.0.1:${port}/events?code=${code}&token=${token}`,{signal:controller.signal});assert.equal(response.status,200);return controller;}
const pause=(ms=25)=>new Promise(resolve=>setTimeout(resolve,ms));
test('six seats, shared readiness, private bets, payouts, reset, automatic ready spins and 25 results',async()=>{
 const port=server.address().port;
 const created=await post(port,'/api/create',{name:'Dealer',bankroll:1000});
 assert.equal(created.status,200);
 const code=created.data.code,owner=created.data.token;
 assert.match(code,/^[A-Z2-9]{7}$/);
 assert.ok(created.data.state.nextSpinAt-created.data.state.serverNow>89900);
 const ownerStream=await stream(port,code,owner);
 const tokens=[owner];
 for(let i=0;i<5;i++){
  const extra=await post(port,'/api/join',{code,name:`Guest${i}`});
  assert.equal(extra.status,200);tokens.push(extra.data.token);
 }
 const full=await post(port,'/api/join',{code,name:'Overflow'});
 assert.equal(full.status,409);
 const same=await post(port,'/api/join',{code,name:'Owner again',token:owner});
 assert.equal(same.status,200);assert.equal(same.data.state.players.length,6);
 assert.ok(same.data.state.nextSpinAt>0);
 let invalid=await post(port,'/api/action',{code,token:tokens[1],action:'add',betType:'split',numbers:['1','4','5'],stake:5});
 assert.equal(invalid.status,400);
 invalid=await post(port,'/api/action',{code,token:tokens[1],action:'add',betType:'split',numbers:['1','6'],stake:5});
 assert.equal(invalid.status,400);
 invalid=await post(port,'/api/action',{code,token:owner,action:'spin'});
 assert.equal(invalid.status,400); // manual spins removed for everybody, including host
 const a=await post(port,'/api/action',{code,token:owner,action:'add',betType:'red',stake:5});
 const b=await post(port,'/api/action',{code,token:tokens[1],action:'add',betType:'black',stake:10});
 assert.equal(a.status,200);assert.equal(b.status,200);
 const table=rooms.get(code);
 assert.equal(table.players[0].bankroll,995);
 assert.equal(table.players[1].bankroll,990);
 assert.equal(table.players[0].bets[0].numbers.length,18);
 for(let i=0;i<5;i++){
  const ready=await post(port,'/api/action',{code,token:tokens[i],action:'ready',ready:true});
  assert.equal(ready.status,200);
  assert.equal(table.spin,null);
 }
 invalid=await post(port,'/api/action',{code,token:owner,action:'add',betType:'straight',numbers:['0'],stake:5});
 assert.equal(invalid.status,400);assert.match(invalid.data.error,/Cancel Ready/);
 assert.equal(table.players.filter(p=>p.ready).length,5);
 const spinning=await post(port,'/api/action',{code,token:tokens[5],action:'ready',ready:true});
 assert.equal(spinning.status,200);
 assert.ok(table.spin);assert.equal(table.spin.reason,'ready');assert.equal(table.nextSpinAt,null);
 const fixed=table.spin.result;
 invalid=await post(port,'/api/action',{code,token:tokens[1],action:'add',betType:'straight',numbers:['0'],stake:5});
 assert.equal(invalid.status,400);
 await pause(115);
 assert.equal(table.spin,null);assert.equal(table.lastResult,fixed);assert.equal(table.history.length,1);
 const firstSnapshot=await post(port,'/api/join',{code,name:'Dealer',token:owner});
 assert.deepEqual(firstSnapshot.data.state.distanceHistory,[null]);
 assert.equal(table.players.filter(p=>p.ready).length,0);
 assert.ok(table.nextSpinAt>Date.now()+88000);
 const expectedA=RED_COLOR(fixed)==='red'?1005:995;
 const expectedB=RED_COLOR(fixed)==='black'?1010:990;
 assert.equal(table.players[0].bankroll,expectedA);
 assert.equal(table.players[1].bankroll,expectedB);
 assert.equal(table.players[0].bets.length,0);
 const repeat=await post(port,'/api/action',{code,token:tokens[1],action:'repeat'});
 assert.equal(repeat.status,200);assert.equal(table.players[1].bets.length,1);
 const undo=await post(port,'/api/action',{code,token:tokens[1],action:'undo'});
 assert.equal(undo.status,200);assert.equal(table.players[1].bets.length,0);
 const resetByGuest=await post(port,'/api/action',{code,token:tokens[1],action:'reset',amount:2500});
 assert.equal(resetByGuest.status,403);
 const reset=await post(port,'/api/action',{code,token:owner,action:'reset',amount:2500});
 assert.equal(reset.status,200);assert.equal(table.history.length,0);assert.equal(table.historyPrevious,null);assert.ok(table.nextSpinAt>Date.now()+88000);
 assert.equal(table.players[1].bankroll,2500);assert.equal(table.players[2].bankroll,2500);
 for(let i=0;i<26;i++){
  for(let j=0;j<6;j++){
   const ready=await post(port,'/api/action',{code,token:tokens[j],action:'ready',ready:true});
   assert.equal(ready.status,200);
  }
  await pause(100);
  assert.equal(table.spin,null);
 }
 assert.equal(table.totalSpins,26);assert.equal(table.history.length,25);
 assert.notEqual(table.historyPrevious,null);
 const completed=await post(port,'/api/join',{code,name:'Dealer',token:owner});
 const history=completed.data.state.history,distances=completed.data.state.distanceHistory;
 assert.equal(history.length,25);assert.equal(distances.length,25);
 assert.deepEqual(distances[0],wheelDistance(table.historyPrevious,history[0]));
 for(let i=1;i<25;i++)assert.deepEqual(distances[i],wheelDistance(history[i-1],history[i]));
 assert.deepEqual(completed.data.state.latestDistance,distances.at(-1));
 const guestResult=await post(port,'/api/join',{code,name:'Guest0',token:tokens[1]});
 assert.deepEqual(guestResult.data.state.distanceHistory,distances);
 table.hostId=table.players[0].id; // Restore test host if the unattended SSE stream disconnected during 26 rounds.
 const finalReset=await post(port,'/api/action',{code,token:owner,action:'reset',amount:1000});
 assert.equal(finalReset.status,200);
 const clear=await post(port,'/api/join',{code,name:'Dealer',token:owner});
 assert.deepEqual(clear.data.state.distanceHistory,[]);
 assert.equal(table.historyPrevious,null);
 ownerStream.abort();await pause(20);
 server.closeAllConnections();await new Promise(r=>server.close(r));
});
function RED_COLOR(n){return n==='0'||n==='00'?'green':new Set('1 3 5 7 9 12 14 16 18 19 21 23 25 27 30 32 34 36'.split(' ')).has(n)?'red':'black';}
