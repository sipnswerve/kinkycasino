'use strict';
process.env.PORT='0'; process.env.SPIN_MS='60'; process.env.ROUND_MS='90000';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {server,rooms}=require('../server');
async function post(port,url,data){const r=await fetch(`http://127.0.0.1:${port}${url}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};}
async function close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
test('ALL IN uses exactly all remaining credits with one valid standard bet; undo, ready and limits protected',async()=>{
 try{
  const port=server.address().port;
  const create=await post(port,'/api/create',{name:'Rory',bankroll:1000});
  const {code,token}=create.data;
  const room=rooms.get(code),player=room.players[0];
  let result=await post(port,'/api/action',{code,token,action:'add',betType:'black',stake:25});
  assert.equal(result.status,200);assert.equal(player.bankroll,975);
  // Fake client stake must never be used for all-in, even when a number is supplied.
  result=await post(port,'/api/action',{code,token,action:'add',betType:'red',stake:1,allIn:true});
  assert.equal(result.status,200);assert.equal(player.bets[1].stake,975);assert.equal(player.bankroll,0);
  result=await post(port,'/api/action',{code,token,action:'add',betType:'low',allIn:true});
  assert.equal(result.status,400);assert.match(result.data.error,/available credits/i);
  result=await post(port,'/api/action',{code,token,action:'undo'});
  assert.equal(result.status,200);assert.equal(player.bankroll,975);
  result=await post(port,'/api/action',{code,token,action:'add',betType:'straight',numbers:['00'],allIn:true});
  assert.equal(result.status,200);assert.equal(player.bets.at(-1).stake,975);
  result=await post(port,'/api/action',{code,token,action:'clear'});
  assert.equal(result.status,200);assert.equal(player.bankroll,1000);
  result=await post(port,'/api/action',{code,token,action:'add',betType:'corner',numbers:['1','2','4','5'],allIn:true});
  assert.equal(result.status,200);assert.equal(player.bankroll,0);assert.equal(player.bets[0].stake,1000);
  result=await post(port,'/api/action',{code,token,action:'add',betType:'red',stake:7});
  assert.equal(result.status,400); // Normal chip whitelist still applies.
  result=await post(port,'/api/action',{code,token,action:'add',betType:'red',allIn:'true'});
  assert.equal(result.status,400); // Type spoofing rejected.
  // Extra player means readiness won't immediately trigger a spin.
  const guest=await post(port,'/api/join',{code,name:'friend'});assert.equal(guest.status,200);
  result=await post(port,'/api/action',{code,token,action:'ready',ready:true});assert.equal(result.status,200);
  result=await post(port,'/api/action',{code,token,action:'add',betType:'red',allIn:true});
  assert.equal(result.status,400);assert.match(result.data.error,/Cancel Ready/i);
  result=await post(port,'/api/action',{code,token,action:'ready',ready:false});assert.equal(result.status,200);
  result=await post(port,'/api/action',{code,token,action:'undo'});assert.equal(result.status,200);assert.equal(player.bankroll,1000);
  result=await post(port,'/api/action',{code,token,action:'add',betType:'sixline',numbers:['1','2','3','4','5','6'],allIn:true});
  assert.equal(result.status,200);assert.equal(player.bets[0].stake,1000);
 }finally{await close();}
});
