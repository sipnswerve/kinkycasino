'use strict';
process.env.PORT='0';process.env.SPIN_MS='70';process.env.ROUND_MS='350';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {server,rooms}=require('../server');
async function post(url,data){const response=await fetch(`http://127.0.0.1:${server.address().port}${url}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,data:await response.json()};}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('90 second server timer (accelerated): recurring automatic spins, reset, join, and ready cancellation',async()=>{
 const {data:created}=await post('/api/create',{name:'One',bankroll:1000});
 const code=created.code, owner=created.token, room=rooms.get(code);
 const live=new AbortController();
 const stream=await fetch(`http://127.0.0.1:${server.address().port}/events?code=${code}&token=${owner}`,{signal:live.signal});
 assert.equal(stream.status,200);
 assert.equal(created.state.roundDurationMs,350);
 assert.equal(created.state.you.ready,false);
 const {data:second}=await post('/api/join',{code,name:'Two'});
 const {data:third}=await post('/api/join',{code,name:'Three'});
 const initialDeadline=room.nextSpinAt;
 assert.ok(initialDeadline-Date.now()>100);
 assert.equal((await post('/api/action',{code,token:owner,action:'ready',ready:true})).status,200);
 assert.equal(room.players[0].ready,true);
 assert.equal((await post('/api/action',{code,token:owner,action:'ready',ready:false})).status,200);
 assert.equal(room.players[0].ready,false);
 assert.equal((await post('/api/action',{code,token:owner,action:'ready',ready:true})).status,200);
 assert.equal((await post('/api/action',{code,token:second.token,action:'ready',ready:true})).status,200);
 assert.equal(room.spin,null); // seat three hasn't clicked Ready
 assert.ok(Math.abs(room.nextSpinAt-initialDeadline)<5); // readiness does not reset deadline
 assert.equal((await post('/api/action',{code,token:third.token,action:'ready',ready:true})).status,200);
 assert.ok(room.spin);assert.equal(room.spin.reason,'ready');
 await pause(125);
 assert.equal(room.spin,null);assert.equal(room.totalSpins,1);
 assert.ok(room.nextSpinAt>Date.now()+150);
 assert.ok(room.players.every(p=>!p.ready));
 // No one is ready; countdown still forces the next spin and repeats every round.
 await pause(320);
 assert.ok(room.spin || room.totalSpins>=2);
 await pause(135);
 assert.ok(room.totalSpins>=2);
 assert.equal(room.history.length,room.totalSpins);
 const beforeReset=room.totalSpins;
 const reset=await post('/api/action',{code,token:owner,action:'reset',amount:500});
 assert.equal(reset.status,200);
 assert.equal(room.totalSpins,0);assert.equal(room.history.length,0);
 assert.ok(room.nextSpinAt>Date.now()+150);
 assert.ok(room.players.every(p=>p.bankroll===500));
 // New arrival participates in the early-spin unanimity vote.
 const {data:fourth}=await post('/api/join',{code,name:'Four'});
 for(const t of [owner,second.token,third.token]){
  assert.equal((await post('/api/action',{code,token:t,action:'ready',ready:true})).status,200);
 }
 assert.equal(room.spin,null);
 assert.equal((await post('/api/action',{code,token:fourth.token,action:'ready',ready:true})).status,200);
 assert.equal(room.spin.reason,'ready');
 await pause(120);
 assert.equal(room.totalSpins,1);
 live.abort();await pause(15);server.closeAllConnections();await new Promise(r=>server.close(r));
});
