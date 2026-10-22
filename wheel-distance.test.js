'use strict';
process.env.PORT='0'; process.env.SPIN_MS='60'; process.env.ROUND_MS='90000';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {server,rooms,wheelDistance}=require('../server');
const simple=(from,to,side,offset)=>assert.deepEqual(wheelDistance(from,to),{from,to,side,offset});
async function post(url,body){const r=await fetch(`http://127.0.0.1:${server.address().port}${url}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();}
test('correctly classify clockwise and counterclockwise offsets using the physical American roulette wheel',()=>{
 simple('25','12','same',2);
 simple('25','30','opposite',1);
 simple('12','25','same',-2);
 simple('30','25','opposite',-1);
 simple('25','25','same',0);
 simple('25','26','opposite',0);
 simple('2','0','same',1); // wraps 2 -> 0
 simple('0','2','same',-1);
 simple('0','00','opposite',0);
 simple('00','0','opposite',0);
 simple('25','10','same',-1);
 assert.equal(wheelDistance('invalid','12'),null);
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 for(const id of ['distanceTransition','distanceLabel','distanceCaption'])assert.match(html,new RegExp('id="'+id+'"'));
});
test('all seated users receive the same latest throw distance and reset clears it',async()=>{
 try{
  const created=await post('/api/create',{name:'Rory',bankroll:1000});
  const room=rooms.get(created.code);
  assert.equal(created.state.latestDistance,null);
  room.history.push('25','12');room.lastResult='12';room.totalSpins=2;
  const host=await post('/api/join',{code:created.code,token:created.token,name:'Rory'});
  const guest=await post('/api/join',{code:created.code,name:'Guest'});
  assert.deepEqual(host.state.latestDistance,{from:'25',to:'12',side:'same',offset:2});
  assert.deepEqual(guest.state.latestDistance,host.state.latestDistance);
  room.history.push('30');room.lastResult='30';room.totalSpins=3;
  const guest2=await post('/api/join',{code:created.code,token:guest.token,name:'Guest'});
  assert.deepEqual(guest2.state.latestDistance,wheelDistance('12','30'));
  room.hostId=room.players[0].id; // No open SSE connections in this test; restore the original host.
  await post('/api/action',{code:created.code,token:created.token,action:'reset',amount:1000});
  const cleared=await post('/api/join',{code:created.code,token:guest.token,name:'Guest'});
  assert.equal(cleared.state.latestDistance,null);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
