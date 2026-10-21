(()=>{
'use strict';
const WHEEL=['0',28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,'00',27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2].map(String);
const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].map(String));
const ALL=Array.from({length:36},(_,i)=>String(i+1));
const MODE={straight:{size:1,payout:35,label:'Straight'},split:{size:2,payout:17,label:'Split'},street:{size:3,payout:11,label:'Street'},corner:{size:4,payout:8,label:'Corner'},sixline:{size:6,payout:5,label:'Six Line'}};
const out={};
function addOut(id,label,nums,payout){out[id]={type:id,label,numbers:nums.map(String),payout};}
addOut('low','1–18',ALL.filter(n=>+n<=18),1);addOut('high','19–36',ALL.filter(n=>+n>=19),1);
addOut('even','Even',ALL.filter(n=>+n%2===0),1);addOut('odd','Odd',ALL.filter(n=>+n%2===1),1);
addOut('red','Red',ALL.filter(n=>RED.has(n)),1);addOut('black','Black',ALL.filter(n=>!RED.has(n)),1);
for(let i=0;i<3;i++)addOut('dozen'+(i+1),(i+1)+(i===0?'st':i===1?'nd':'rd')+' Dozen',ALL.slice(i*12,(i+1)*12),2);
for(let i=0;i<3;i++)addOut('col'+i,(i===0?'Top':i===1?'Middle':'Bottom')+' Column',ALL.filter(n=>(+n-1)%3===2-i),2);
addOut('basket','Five-number Basket',['0','00','1','2','3'],6);
const el=id=>document.getElementById(id);
const money=n=>(n<0?'−':'')+'$'+Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0});
const colorOf=n=>n==='0'||n==='00'?'green':RED.has(n)?'red':'black';
const defaultFill={red:'#be4545',black:'#212b2c',green:'#168359'};
let state=null, session=null, chip=5,mode='straight',selection=[],spinning=false,spinAngle=0,shownSpinId=null, toastTimeout=null,events=null,serverOffset=0;
const bettingLocked=()=>spinning||!!state?.you?.ready;
const $grid=el('numberGrid');
for(let row=2;row>=0;row--)for(let col=0;col<12;col++){
 const num=String(col*3+row+1),b=document.createElement('button');b.className='bet-cell '+colorOf(num);b.dataset.num=num;b.textContent=num;b.title='Bet on '+num;$grid.append(b);
}
for(let row=0;row<3;row++){const b=document.createElement('button');b.className='bet-cell';b.textContent='2 TO 1';b.title=out['col'+row].label;b.dataset.outside='col'+row;el('columnGrid').append(b);}
const NS='http://www.w3.org/2000/svg',spinG=el('spinGroup'),wheelPaths=new Map();
function svgElem(tag,attrs={}){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));return e;}
function polar(r,a){const z=a*Math.PI/180;return [250+r*Math.cos(z),250+r*Math.sin(z)];}
function ringSector(inner,outer,a1,a2){const p1=polar(outer,a1),p2=polar(outer,a2),q2=polar(inner,a2),q1=polar(inner,a1);return `M ${p1.join(' ')} A ${outer} ${outer} 0 0 1 ${p2.join(' ')} L ${q2.join(' ')} A ${inner} ${inner} 0 0 0 ${q1.join(' ')} Z`;}
const step=360/38;
spinG.append(svgElem('circle',{cx:250,cy:250,r:206,fill:'#372e1f',stroke:'#c7a669','stroke-width':1}));
WHEEL.forEach((num,i)=>{
 const begin=-90+i*step,end=begin+step,mid=begin+step/2;
 spinG.append(svgElem('path',{d:ringSector(194,205,begin,end),fill:defaultFill[colorOf(num)],stroke:'#0b2319','stroke-width':.6}));
 const path=svgElem('path',{d:ringSector(121,193,begin,end),fill:defaultFill[colorOf(num)],class:'sector','data-num':num});spinG.append(path);wheelPaths.set(num,path);
 const xy=polar(158,mid),rot=((mid+90)%360+360)%360;
 const t=svgElem('text',{x:xy[0],y:xy[1],class:'numText',transform:`rotate(${rot>90&&rot<270?rot-180:rot} ${xy[0]} ${xy[1]})`});t.textContent=num;spinG.append(t);
});
spinG.append(svgElem('circle',{cx:250,cy:250,r:121,fill:'none',stroke:'#bf9b62','stroke-width':2}));
spinG.append(svgElem('circle',{cx:250,cy:250,r:192,fill:'none',stroke:'#d1b573','stroke-width':1}));
function toast(msg){const t=el('toast');t.textContent=msg;t.classList.add('visible');if(toastTimeout)clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.remove('visible'),3200);}
function insideValid(type,nums){const v=nums.map(Number).sort((a,b)=>a-b);if(!MODE[type]||v.length!==MODE[type].size||v.some(n=>!Number.isInteger(n)||n<1||n>36))return false;
 switch(type){case 'split':return v[1]-v[0]===3||(v[1]-v[0]===1&&Math.floor((v[0]-1)/3)===Math.floor((v[1]-1)/3));
 case 'street':return v[1]===v[0]+1&&v[2]===v[1]+1&&(v[0]-1)%3===0;
 case 'corner':return (v[0]-1)%3!==2&&v.join(',')===[v[0],v[0]+1,v[0]+3,v[0]+4].join(',');
 case 'sixline':return v[0]%3===1&&v.every((n,i)=>n===v[0]+i);default:return true;}
}
async function api(path,data){
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),15000);
 try { const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:ctrl.signal});
 const reply=await res.json();if(!res.ok)throw new Error(reply.error||'Could not contact server.');return reply;
 }finally{clearTimeout(timeout);}
}
async function action(action,fields={}){
 if(!session)return;
 try {await api('/api/action',{code:session.code,token:session.token,action,...fields});}
 catch(err){toast(err.message||'Network error. Check your connection.');}
}
function addBet(data,stake=chip){if(!state||bettingLocked())return;
 if(state.you.bankroll<stake){toast('Not enough credits for this chip.');return;}
 return action('add',{betType:data.type,numbers:data.numbers,stake});
}
function onNumber(num){if(bettingLocked())return;if(mode==='straight'){addBet({type:'straight',numbers:[num]});return;}
 if(num==='0'||num==='00'){toast('0 / 00 are available as straight or basket bets.');return;}
 if(selection.includes(num))selection=selection.filter(n=>n!==num);else {if(selection.length>=MODE[mode].size)selection=[];selection.push(num);}
 updateAll();
}
function setMode(m){if(bettingLocked())return;mode=m;selection=[];for(const b of document.querySelectorAll('.mode'))b.classList.toggle('active',b.dataset.mode===mode);updateAll();}
function putSelection(){if(bettingLocked()||mode==='straight')return;const nums=selection.map(Number).sort((a,b)=>a-b).map(String);
 if(!insideValid(mode,nums)){toast('Select a valid adjacent '+MODE[mode].label.toLowerCase()+'.');return;}
 selection=[];updateAll();addBet({type:mode,numbers:nums});
}
function updateBuilder(){const box=el('builderMsg'),place=el('placeSelection'),cancel=el('cancelSelection');if(mode==='straight'){box.innerHTML='Mode: <strong>Straight</strong> — tap a number to bet on it.';place.hidden=true;cancel.hidden=true;return;}
 const required=MODE[mode].size,count=selection.length,valid=count===required&&insideValid(mode,selection);
 box.innerHTML='<strong>'+MODE[mode].label+'</strong> — '+(count?selection.map(Number).sort((a,b)=>a-b).join(', ')+' selected. ':'Select '+required+' adjacent numbers. ')+`(${count} / ${required})`+(count===required&&!valid?' <span style="color:#ffaaa2">Not a valid group.</span>':'');
 place.hidden=false;cancel.hidden=!count;place.disabled=!valid||bettingLocked();
}
function updateWheel(){if(!state)return;
 const mine=state.mineExposure,other=state.otherExposure,covered=WHEEL.filter(n=>(mine[n]||0)+(other[n]||0)>0);
 const peak=Math.max(...WHEEL.map(n=>mine[n]||0),1);
 for(const n of WHEEL){const path=wheelPaths.get(n),my=mine[n]||0,their=other[n]||0;
 path.classList.toggle('covered',!!my||!!their);
 path.classList.toggle('other-hit',!my&&!!their);
 path.classList.toggle('last-hit',state.lastResult===n&&!my&&!their);
 if(my){const amt=my/peak;path.setAttribute('fill',amt>.67?'#ffdf83':amt>.27?'#edbc66':'#d9a95e');path.setAttribute('stroke',their?'#65daff':'#ffe6a1');path.setAttribute('stroke-width',their?'3':'1.7');}
 else if(their){path.setAttribute('fill','#55bfe3');path.setAttribute('stroke','#caf4ff');path.setAttribute('stroke-width','1.7');}
 else {path.setAttribute('fill',state.lastResult===n?'#6adeb5':defaultFill[colorOf(n)]);path.setAttribute('stroke','#16251c');path.setAttribute('stroke-width','1.3');}
 }
 el('coveredCount').textContent=covered.length+' / 38';el('coveredPct').textContent=(covered.length/38*100).toFixed(1)+'%';el('activeBets').textContent=state.bets.length;el('hubNumber').textContent=covered.length+' / 38';
 document.querySelectorAll('button[data-num]').forEach(b=>{const n=b.dataset.num;b.classList.toggle('covered',!!mine[n]);b.classList.toggle('other-covered',!!other[n]&&!mine[n]);b.classList.toggle('selected',selection.includes(n));let chipcount=b.querySelector('.chip-count');const count=state.bets.filter(x=>x.numbers.length===1&&x.numbers[0]===n).length;if(count){if(!chipcount){chipcount=document.createElement('span');chipcount.className='chip-count';b.append(chipcount);}chipcount.textContent=count;}else if(chipcount)chipcount.remove();});
 document.querySelectorAll('[data-outside]').forEach(b=>b.classList.toggle('active-bet',state.bets.some(x=>x.type===b.dataset.outside)));
}
function updateTicket(){if(!state)return;const lines=el('ticketLines');lines.replaceChildren();if(!state.bets.length){const msg=document.createElement('div');msg.className='ticket-empty';msg.textContent='No bets yet. Tap a number or outside bet to begin.';lines.append(msg);}else{
 for(const bet of [...state.bets].reverse()){
 const line=document.createElement('div');line.className='ticket-line';const txt=document.createElement('div');txt.className='ticket-line-main';const label=document.createElement('strong');label.textContent=bet.label;const small=document.createElement('small');small.textContent=bet.numbers.length+' covered · '+bet.payout+':1';txt.append(label,small);
 const amount=document.createElement('span');amount.className='ticket-line-amount';amount.textContent=money(bet.stake);
 const remove=document.createElement('button');remove.className='remove-bet';remove.textContent='×';remove.title='Remove this chip';remove.setAttribute('aria-label','Remove '+bet.label);remove.disabled=bettingLocked();remove.onclick=()=>action('remove',{betId:bet.id});line.append(txt,amount,remove);lines.append(line);
 }}
 const total=state.bets.reduce((s,b)=>s+b.stake,0);el('wagerTotal').textContent=money(total);el('ticketSub').textContent=state.bets.length?`${state.bets.length} chip${state.bets.length===1?'':'s'} on your bet slip`:'Your chips appear here';
 el('undoButton').disabled=!state.bets.length||bettingLocked();el('clearButton').disabled=!state.bets.length||bettingLocked();
 el('repeatButton').disabled=!state.lastBets.length||bettingLocked();
 for(const id of ['spinButton','readyButton']){
  const btn=el(id);
  btn.disabled=spinning;
  btn.textContent=spinning?'WHEEL SPINNING…':state.you.ready?'✓ READY · CANCEL':'✓ READY TO SPIN';
  btn.classList.toggle('is-ready',!!state.you.ready);
  btn.setAttribute('aria-pressed',String(!!state.you.ready));
 }

}
function drawResult(){if(!state)return;
 const latest=state.lastResult,orb=el('resultOrb');
 if(latest===null){orb.className='result-orb empty';orb.textContent='?';el('resultTitle').textContent='Ready to play';el('resultDesc').textContent='All seats ready starts an early spin. Otherwise the wheel spins every 90 seconds.';}
 else {orb.className='result-orb '+colorOf(latest);orb.textContent=latest;el('resultTitle').textContent=`${latest} · ${colorOf(latest).toUpperCase()}`;
 const result=state.lastSettlement;
 el('resultDesc').textContent=result&&result.round===state.round ? (result.wagered ? (result.net>=0?'Round profit: +'+money(result.net):'Round loss: '+money(result.net)) : 'You had no bets this round') : 'Shared table result';
 }
 el('spinsText').textContent=state.totalSpins+' spin'+(state.totalSpins===1?'':'s');
 const hist=el('historyItems');hist.replaceChildren();if(!state.history.length){const empty=document.createElement('span');empty.className='history-empty';empty.textContent='Results appear after the first spin.';hist.append(empty);}else{
 for(const [index,n] of [...state.history].reverse().entries()){const b=document.createElement('span');b.className='history-ball '+colorOf(n)+(index===0?' latest':'');b.textContent=n;b.title=(index===0?'Latest: ':'Result: ')+n;hist.append(b);}}
}
function animateSpin(spin){if(!spin||spin.id===shownSpinId)return;shownSpinId=spin.id;
 const i=WHEEL.indexOf(spin.result),target=(360-((i+.5)*step)%360)%360;
 const increment=(target-(spinAngle%360)+360)%360;spinAngle+=6*360+increment;
 const remaining=Math.max(200,spin.endsAt-Date.now());spinG.style.transitionDuration=Math.min(4250,remaining-30)+'ms';
 // Force transition even if the user's screen was suspended while the spin began.
 requestAnimationFrame(()=>{spinG.style.transform=`rotate(${spinAngle}deg)`;});
}
function seats(){if(!state)return;
 const box=el('seatList');box.replaceChildren();for(let seat=1;seat<=6;seat++){
 const p=state.players.find(x=>x.seat===seat),tile=document.createElement('div');tile.className='seat'+(p?' occupied':'')+(p?.id===state.you.id?' self':'')+(p?.ready?' ready':'');
 const marker=document.createElement('span');marker.className='seat-marker seat-color-'+seat;marker.textContent=seat;
 const contents=document.createElement('div');contents.className='seat-info';const title=document.createElement('strong');title.textContent=p?p.name:'Open seat';const sub=document.createElement('small');sub.textContent=p?(p.isHost?'★ Host · ':'')+(p.ready?'✓ Ready · ':p.online?'Betting · ':'Offline · ')+money(p.bankroll)+' · Bet '+money(p.betTotal):'Invite a friend';contents.append(title,sub);
 tile.append(marker,contents);
 if(p&&!p.online&&p.id!==state.you.id&&state.you.isHost&&!spinning){const kick=document.createElement('button');kick.className='kick';kick.textContent='Free';kick.title='Free this offline seat';kick.onclick=()=>{if(confirm('Free '+p.name+'’s seat? Their credits will be removed.'))action('kick',{playerId:p.id});};tile.append(kick);}
 box.append(tile);
 }
 el('playerCount').textContent=state.players.length+' / 6 seated';
 el('roomCode').textContent=state.code;
 el('roleNote').textContent=state.you.isHost?'You are the host · Spins are automatic':'You are in seat '+state.you.seat+' · Shared automatic spins';
 el('resetSession').disabled=!state.you.isHost||spinning;
 el('startBankroll').disabled=!state.you.isHost||spinning;
 el('sessionSettings').hidden=!state.you.isHost;
}
// Live display is based on the server's deadline, not a separate timer on each phone.
function updateCountdown(){if(!state)return;
 const active=!!state.spin;
 const remaining=active?0:Math.max(0,(state.nextSpinAt||Date.now())-(Date.now()+serverOffset));
 const secs=Math.ceil(remaining/1000),mm=Math.floor(secs/60),ss=secs%60;
 el('countdownText').textContent=active?'SPINNING':String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0');
 el('countdownText').classList.toggle('in-spin',active);
 const share=active?100:100*(1-Math.min(1,remaining/(state.roundDurationMs||90000)));
 el('countdownBar').style.width=share.toFixed(2)+'%';
 const ready=state.players.filter(p=>p.ready).length,total=state.players.length;
 el('readySummary').textContent=ready+' / '+total+' seated players ready';
 el('roundStateText').textContent=active?'All bets locked until the result':state.you.ready?'You’re ready · Tap again to edit your bets':remaining<=0?'Starting next spin…':'All seated players ready = early spin';
 el('roundBanner').classList.toggle('urgent',!active&&remaining<=15000);
 el('roundBanner').classList.toggle('round-spinning',active);
}
function updateAll(){if(!state)return;
 spinning=!!state.spin;el('app').classList.toggle('spinning',spinning);
 el('bankrollText').textContent=money(state.you.bankroll);el('profitText').textContent=(state.you.pl>0?'+':'')+money(state.you.pl);el('profitText').className=state.you.pl>0?'positive':state.you.pl<0?'negative':'';
 el('selectedChip').textContent='Selected: '+money(chip);
 for(const b of document.querySelectorAll('.bet-cell,.outside-cell,.basket-btn,.mode,.chip'))b.disabled=bettingLocked();
 updateWheel();updateBuilder();updateTicket();drawResult();seats();updateCountdown();
 if(state.spin){animateSpin(state.spin);el('resultTitle').textContent='Wheel spinning…';el('resultDesc').textContent='All bets are locked until the result.';}
}
function acceptState(next){if(!next||!session||next.code!==session.code)return;serverOffset=next.serverNow-Date.now();state=next;updateAll();}
function connectEvents(){if(events)events.close();events=new EventSource('/events?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));
 events.addEventListener('state',e=>{try {acceptState(JSON.parse(e.data));}catch(err){console.warn('Invalid table update',err);}});
 events.onopen=()=>{el('connectionText').textContent='Live · Shared table';el('connectionDot').classList.remove('offline');};
 events.onerror=()=>{el('connectionText').textContent='Reconnecting…';el('connectionDot').classList.add('offline');};
}
function storedName(){try{return localStorage.getItem('roulette_name')||'';}catch{return '';}}
function savedToken(code){try{return localStorage.getItem('roulette_seat_'+code)||'';}catch{return '';}}
function saveIdentity(code,token,name){try{localStorage.setItem('roulette_seat_'+code,token);localStorage.setItem('roulette_name',name);}catch{}}
function showLobby(err=''){el('lobby').hidden=false;el('app').hidden=true;if(err)el('lobbyError').textContent=err;el('inviteCode').value=(new URLSearchParams(location.search).get('room')||'').toUpperCase();el('playerName').value=storedName();}
function enter(reply,name){session={code:reply.code,token:reply.token};saveIdentity(reply.code,reply.token,name);
 el('lobby').hidden=true;el('app').hidden=false;el('lobbyError').textContent='';
 const url=new URL(location.href);url.searchParams.set('room',reply.code);history.replaceState(null,'',url.pathname+'?room='+encodeURIComponent(reply.code));
 acceptState(reply.state);connectEvents();
}
async function joinRoom(code,name,token=''){return api('/api/join',{code,name,token});}
let joining=false;
async function withLobbyTask(job){if(joining)return;joining=true;el('createTable').disabled=true;el('joinTable').disabled=true;el('lobbyError').textContent='';try{await job();}catch(e){el('lobbyError').textContent=e.message||'Could not join table.';}finally{joining=false;el('createTable').disabled=false;el('joinTable').disabled=false;}}
el('createTable').onclick=()=>withLobbyTask(async()=>{const name=el('playerName').value.trim()||'Player',bankroll=Number(el('createBankroll').value);
 const reply=await api('/api/create',{name,bankroll});enter(reply,name);});
el('joinTable').onclick=()=>withLobbyTask(async()=>{const code=el('inviteCode').value.toUpperCase().trim(),name=el('playerName').value.trim()||'Player';
 const reply=await joinRoom(code,name,savedToken(code));enter(reply,name);});
el('inviteCode').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,7);});
el('inviteCode').addEventListener('keydown',e=>{if(e.key==='Enter')el('joinTable').click();});
el('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')el('inviteCode').value?el('joinTable').click():el('createTable').click();});
el('copyLink').onclick=async()=>{if(!session)return;if(['localhost','127.0.0.1'].includes(location.hostname)){toast('Localhost invites only work on your own PC. Deploy online to share with friends.');return;}const link=new URL(location.href);link.searchParams.set('room',session.code);const value=link.toString();
 try{await navigator.clipboard.writeText(value);toast('Invite link copied! Send it to up to 5 friends.');}catch{prompt('Copy this invite link:',value);}
};
for(const btn of document.querySelectorAll('button[data-num]'))btn.addEventListener('click',()=>onNumber(btn.dataset.num));
for(const btn of document.querySelectorAll('[data-outside]'))btn.addEventListener('click',()=>addBet(out[btn.dataset.outside]));
for(const btn of document.querySelectorAll('.chip'))btn.addEventListener('click',()=>{if(bettingLocked())return;chip=Number(btn.dataset.value);document.querySelectorAll('.chip').forEach(b=>b.classList.toggle('active',b===btn));updateAll();});
for(const btn of document.querySelectorAll('.mode'))btn.addEventListener('click',()=>setMode(btn.dataset.mode));
el('cancelSelection').onclick=()=>{selection=[];updateAll();};el('placeSelection').onclick=putSelection;
el('undoButton').onclick=()=>action('undo');el('clearButton').onclick=()=>action('clear');
const toggleReady=()=>{if(state&&!spinning)action('ready',{ready:!state.you.ready});};
el('spinButton').onclick=toggleReady;el('readyButton').onclick=toggleReady;
el('repeatButton').onclick=()=>action('repeat');
setInterval(updateCountdown,125);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateCountdown();});
el('resetSession').onclick=()=>{if(spinning)return;const amount=Number(el('startBankroll').value);if(!Number.isSafeInteger(amount)||amount<1||amount>100000000)return toast('Enter 1 to 100,000,000 credits.');
 if(confirm('Reset the entire shared table, all six players’ credits, bets and history?'))action('reset',{amount});};
document.addEventListener('keydown',e=>{if(!state||e.target.matches('input,textarea')||spinning)return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();action('undo');}else if(e.key==='Escape'){selection=[];updateAll();}
 else if(/^[1-5]$/.test(e.key)&&!e.ctrlKey){const options=[1,5,10,25,100],btn=document.querySelector(`.chip[data-value="${options[Number(e.key)-1]}"]`);if(btn)btn.click();}
 else if((e.key==='s'||e.key==='S')&&!e.ctrlKey&&!e.metaKey){toggleReady();}
});
// The link contains the room code, never the private seat token.
const initialCode=(new URLSearchParams(location.search).get('room')||'').toUpperCase();showLobby();
if(initialCode && /^[A-Z2-9]{7}$/.test(initialCode)&&savedToken(initialCode)){
 withLobbyTask(async()=>{const name=storedName()||'Player';const reply=await joinRoom(initialCode,name,savedToken(initialCode));enter(reply,name);});
}
})();
