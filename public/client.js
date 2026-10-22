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
const defaultFill={red:'#ed171c',black:'#151515',green:'#007c34'};
let state=null, session=null, chip=5,allIn=false,allInPending=false,spinning=false,spinAngle=0,shownSpinId=null, toastTimeout=null,events=null,serverOffset=0;
const bettingLocked=()=>spinning||!!state?.you?.ready;
const $grid=el('numberGrid');
for(let row=2;row>=0;row--)for(let col=0;col<12;col++){
 const num=String(col*3+row+1),b=document.createElement('button');b.className='bet-cell '+colorOf(num);b.dataset.num=num;b.textContent=num;b.title='Bet on '+num;$grid.append(b);
}
for(let row=0;row<3;row++){const b=document.createElement('button');b.className='bet-cell';const letter='CBA'[row];b.textContent=letter+' · 2:1';b.title=letter+' column · '+out['col'+row].label;b.dataset.outside='col'+row;el('columnGrid').append(b);}
const NS='http://www.w3.org/2000/svg',wheelSvg=el('wheelSvg'),spinG=el('spinGroup'),wheelPaths=new Map();
const labelOrbit=svgElem('g',{id:'wheelLabelOrbit'}),outerLabelNodes=[],innerLabelNodes=[],numberLabelNodes=[];
let currentWheelAngle=0,wheelAnimFrame=null;
function svgElem(tag,attrs={}){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));return e;}
function polar(r,a){const z=a*Math.PI/180;return [250+r*Math.cos(z),250+r*Math.sin(z)];}
function ringSector(inner,outer,a1,a2){const p1=polar(outer,a1),p2=polar(outer,a2),q2=polar(inner,a2),q1=polar(inner,a1);return `M ${p1.join(' ')} A ${outer} ${outer} 0 0 1 ${p2.join(' ')} L ${q2.join(' ')} A ${inner} ${inner} 0 0 0 ${q1.join(' ')} Z`;}
function norm(a){return ((a%360)+360)%360;}
const step=360/38,topIndex=WHEEL.indexOf('00'),wheelStart=-90-(topIndex+.5)*step;
// Wheel ring labels come from the actual roulette betting groups, not a
// hard-coded visual pattern. Neither 0 nor 00 belongs to a dozen/column.
function wheelColumn(num){
 if(num==='0'||num==='00')return '';
 return 'ABC'[(Number(num)-1)%3]; // A: 1,4,7... B: 2,5,8... C: 3,6,9...
}
function wheelDozen(num){
 if(num==='0'||num==='00')return '';
 return String(Math.ceil(Number(num)/12)); // 1–12 / 13–24 / 25–36
}
const outerFill={A:'#d2c9f3',B:'#ece4b0',C:'#d9d9d9','':'#f1f1f1'};
const innerFill={'1':'#f3bfd4','2':'#9edced','3':'#b3e63b','':'#f1f1f1'};
while(spinG.firstChild)spinG.firstChild.remove();
wheelSvg.insertBefore(labelOrbit,spinG.nextSibling);
spinG.append(svgElem('circle',{cx:250,cy:250,r:236,fill:'#efefef',stroke:'#bcbcbc','stroke-width':1}));
spinG.append(svgElem('circle',{cx:250,cy:250,r:226,fill:'#f7f7f7',stroke:'#9c9c9c','stroke-width':1}));
for(let i=0;i<38;i++){
 const boundary=wheelStart+i*step;
 const [x1,y1]=polar(205,boundary),[x2,y2]=polar(240,boundary);
 spinG.append(svgElem('line',{x1,y1,x2,y2,stroke:'#9a9a9a','stroke-width':1.1}));
}
WHEEL.forEach((num,i)=>{
 const begin=wheelStart+i*step,end=begin+step,mid=begin+step/2;
 const column=wheelColumn(num),dozen=wheelDozen(num);
 spinG.append(svgElem('path',{d:ringSector(195,226,begin,end),fill:outerFill[column],stroke:'#a9a9a9','stroke-width':.8}));
 const path=svgElem('path',{d:ringSector(166,195,begin,end),fill:defaultFill[colorOf(num)],class:'sector','data-num':num});spinG.append(path);wheelPaths.set(num,path);
 spinG.append(svgElem('path',{d:ringSector(143,166,begin,end),fill:innerFill[dozen],stroke:'#b9b9b9','stroke-width':.65}));
 const outerText=svgElem('text',{class:'wheel-outer-label'});outerText.textContent=column;labelOrbit.append(outerText);outerLabelNodes.push({node:outerText,angle:mid,radius:211});
 const numText=svgElem('text',{class:'wheel-number-label'});numText.textContent=num;labelOrbit.append(numText);numberLabelNodes.push({node:numText,angle:mid,radius:180});
 const innerText=svgElem('text',{class:'wheel-inner-label'});innerText.textContent=dozen;labelOrbit.append(innerText);innerLabelNodes.push({node:innerText,angle:mid,radius:154});
});
spinG.append(svgElem('circle',{cx:250,cy:250,r:143,fill:'#ffffff',stroke:'#aaaaaa','stroke-width':1}));
spinG.append(svgElem('circle',{cx:250,cy:250,r:166,fill:'none',stroke:'#969696','stroke-width':1}));
spinG.append(svgElem('circle',{cx:250,cy:250,r:195,fill:'none',stroke:'#8f8f8f','stroke-width':1}));
spinG.append(svgElem('circle',{cx:250,cy:250,r:226,fill:'none',stroke:'#b0b0b0','stroke-width':1}));
function positionWheelLabels(angle){
 for(const item of outerLabelNodes){const [x,y]=polar(item.radius,item.angle+angle);item.node.setAttribute('x',x);item.node.setAttribute('y',y);}
 for(const item of numberLabelNodes){const [x,y]=polar(item.radius,item.angle+angle);item.node.setAttribute('x',x);item.node.setAttribute('y',y);}
 for(const item of innerLabelNodes){const [x,y]=polar(item.radius,item.angle+angle);item.node.setAttribute('x',x);item.node.setAttribute('y',y);}
}
function setWheelAngle(angle){currentWheelAngle=angle;spinG.setAttribute('transform',`rotate(${angle} 250 250)`);positionWheelLabels(angle);}
setWheelAngle(0);
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
 }catch(error){
   if(error instanceof TypeError)throw new Error('Cannot reach the game server. Run START_LOCAL_WINDOWS.bat or open your deployed website; opening the HTML file alone will not work.');
   if(error.name==='AbortError')throw new Error('Server request timed out. Check the server is running.');
   throw error;
 }finally{clearTimeout(timeout);}
}
async function action(action,fields={}){
 if(!session)return;
 try {await api('/api/action',{code:session.code,token:session.token,action,...fields});return true;}
 catch(err){toast(err.message||'Network error. Check your connection.');return false;}
}
async function addBet(data,stake=chip){
 if(!state||bettingLocked()||allInPending)return;
 const isAllIn=allIn;
 if(state.you.bankroll<1){toast('No available credits. Undo a bet or wait for the next spin.');return;}
 if(!isAllIn&&state.you.bankroll<stake){toast('Not enough credits for this chip.');return;}
 if(isAllIn){allInPending=true;updateAll();}
 const accepted=await action('add',{betType:data.type,numbers:data.numbers,...(isAllIn?{allIn:true}:{stake})});
 if(isAllIn){allInPending=false;if(accepted)allIn=false;updateAll();}
}
// The click position itself selects the bet type; no separate selector.
function onNumber(num){if(!bettingLocked())addBet({type:'straight',numbers:[String(num)]});}
function gridHitTarget(x,y){
  const col=Math.max(0,Math.min(11,Math.floor(x))),row=Math.max(0,Math.min(2,Math.floor(y)));
  const nearVertical=Math.round(x),nearHorizontal=Math.round(y);
  const atCol=nearVertical>=1&&nearVertical<=11&&Math.abs(x-nearVertical)<.19;
  const atRow=nearHorizontal>=1&&nearHorizontal<=2&&Math.abs(y-nearHorizontal)<.19;
  const outerEdge=y<.16||y>2.84;
  const n=(c,r)=>String(c*3+3-r);
  if(outerEdge){
    if(atCol){const a=(nearVertical-1)*3+1;return {type:'sixline',numbers:Array.from({length:6},(_,i)=>String(a+i))};}
    return {type:'street',numbers:[1,2,3].map(i=>String(col*3+i))};
  }
  if(atCol&&atRow){const a=nearVertical-1,r=nearHorizontal-1;return {type:'corner',numbers:[n(a,r),n(a,r+1),n(a+1,r),n(a+1,r+1)]};}
  if(atCol){return {type:'split',numbers:[n(nearVertical-1,row),n(nearVertical,row)]};}
  if(atRow){return {type:'split',numbers:[n(col,nearHorizontal-1),n(col,nearHorizontal)]};}
  return {type:'straight',numbers:[n(col,row)]};
}
function pointerBet(e){
 if(!state||bettingLocked()||allInPending)return;
 const rect=$grid.getBoundingClientRect();
 const x=(e.clientX-rect.left)/rect.width*12,y=(e.clientY-rect.top)/rect.height*3;
 if(x<0||x>=12||y<0||y>=3)return;
 const bet=gridHitTarget(x,y);
 el('builderMsg').textContent=bet.type.toUpperCase()+' · '+bet.numbers.join(' / ')+' · '+MODE[bet.type].payout+':1';
 addBet(bet);
}
function positionForBet(b){
 const pts=b.numbers.filter(n=>n!=='0'&&n!=='00').map(n=>{const v=Number(n)-1;return {x:(Math.floor(v/3)+.5)/12,y:(2-v%3+.5)/3};});
 if(!pts.length)return null;
 let x=pts.reduce((a,v)=>a+v.x,0)/pts.length,y=pts.reduce((a,v)=>a+v.y,0)/pts.length;
 if(b.type==='street'||b.type==='sixline')y=.045;
 return {x,y};
}
function updateBoardBets(){
 if(!state)return;
 const overlay=el('boardMarkers');overlay.replaceChildren();
 const all=new Map();
 for(const b of state.bets){
  const key=state.you.seat+'|'+b.type+'|'+b.numbers.join(',');
  let r=all.get(key);if(!r){r={seat:state.you.seat,name:state.you.name,type:b.type,numbers:b.numbers,stake:0,count:0,self:true};all.set(key,r);}
  r.stake+=b.stake;r.count++;
 }
 for(const r of state.otherBoardBets||[]){const key=r.seat+'|'+r.type+'|'+r.numbers.join(',');all.set(key,{...r,self:false});}
 const posCounts=new Map();
 for(const b of all.values()){
  if(out[b.type]){
   const btn=document.querySelector('[data-outside="'+b.type+'"]');if(!btn)continue;
   // Appended after clearing the prior display below.
   continue;
  }
  if(b.type==='basket')continue;
  const pt=positionForBet(b);if(!pt)continue;
  const k=pt.x.toFixed(4)+'|'+pt.y.toFixed(4);const index=posCounts.get(k)||0;posCounts.set(k,index+1);
  const badge=document.createElement('span');badge.className='board-marker'+(b.self?' self':'')+(b.count>1?' multiple':'');
  badge.textContent=String(b.seat)+(b.count>1?'×'+b.count:'');
  badge.title=(b.self?'Your':b.name+'’s')+' '+b.type+' '+b.numbers.join(', ')+' · '+money(b.stake);
  badge.style.left=(pt.x*100)+'%';badge.style.top=(pt.y*100)+'%';
  badge.style.transform='translate(calc(-50% + '+((index%3)*12-12)+'px),calc(-50% + '+(Math.floor(index/3)*11)+'px))';
  overlay.append(badge);
 }
 for(const btn of document.querySelectorAll('[data-outside]')){
   btn.querySelector('.outside-marker-group')?.remove();
   const matching=[...all.values()].filter(x=>x.type===btn.dataset.outside);
   if(!matching.length)continue;
   const holder=document.createElement('span');holder.className='outside-marker-group';
   for(const b of matching){const badge=document.createElement('span');badge.className='outside-seat-marker'+(b.self?' self':'');badge.textContent=String(b.seat);badge.title=(b.self?'Your':b.name+'’s')+' bet '+money(b.stake);holder.append(badge);}
   btn.append(holder);
 }
}
function updateWheel(){if(!state)return;
 const mine=state.mineExposure,covered=WHEEL.filter(n=>(mine[n]||0)>0);
 const peak=Math.max(...WHEEL.map(n=>mine[n]||0),1);
 for(const n of WHEEL){const path=wheelPaths.get(n),my=mine[n]||0;
  path.classList.toggle('covered',!!my);path.classList.remove('other-hit');
  path.classList.toggle('last-hit',state.lastResult===n&&!my);
  if(my){const amt=my/peak;path.setAttribute('fill',amt>.67?'#ffdf83':amt>.27?'#edbc66':'#d9a95e');path.setAttribute('stroke','#ffe6a1');path.setAttribute('stroke-width','1.7');}
  else{path.setAttribute('fill',state.lastResult===n?'#6adeb5':defaultFill[colorOf(n)]);path.setAttribute('stroke','#16251c');path.setAttribute('stroke-width','1.3');}
 }
 el('coveredCount').textContent=covered.length+' / 38';el('coveredPct').textContent=(covered.length/38*100).toFixed(1)+'%';el('activeBets').textContent=state.bets.length;el('hubNumber').textContent=covered.length+' / 38';
 document.querySelectorAll('button[data-num]').forEach(b=>{const n=b.dataset.num;b.classList.toggle('covered',!!mine[n]);b.classList.toggle('other-covered',!!state.otherExposure[n]&&!mine[n]);});
 document.querySelectorAll('[data-outside]').forEach(b=>b.classList.toggle('active-bet',state.bets.some(x=>x.type===b.dataset.outside)));
 updateBoardBets();
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
  btn.disabled=spinning||allInPending;
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
 const distances=el('distanceHistoryItems');distances.replaceChildren();
 const pairs=Array.isArray(state.distanceHistory)?state.distanceHistory:[];
 const recentPairs=[...pairs].reverse().filter(Boolean).slice(0,25);
 el('distanceHistoryCount').textContent=recentPairs.length+' / 25 measured';
 if(!recentPairs.length){
  const waiting=document.createElement('span');waiting.className='history-empty';
  waiting.textContent='Distances appear after the second spin.';distances.append(waiting);
 }else{
  for(const [index,d] of recentPairs.entries()){
   const tile=document.createElement('div');tile.className='throw-history-item '+d.side+(index===0?' latest':'');
   const code=document.createElement('strong');code.className='throw-history-code';
   code.textContent=(d.side==='opposite'?'O':'S')+' '+(d.offset>=0?'+'+d.offset:d.offset);
   const path=document.createElement('small');path.className='throw-history-path';path.textContent=d.from+' → '+d.to;
   tile.title=path.textContent+' · '+(d.side==='opposite'?'Opposite':'Same')+' '+(d.offset>=0?'+'+d.offset:d.offset);
   tile.append(code,path);distances.append(tile);
  }
 }
 const d=state.latestDistance;
 const label=el('distanceLabel'),caption=el('distanceCaption');
 if(d){
  // The server determines clockwise (+) vs counterclockwise (-), and
  // whether the shorter offset is from the old pocket or its opposite.
  const signed=d.offset>=0?'+'+d.offset:String(d.offset);
  label.textContent=(d.side==='opposite'?'O':'S')+' '+signed;
  label.classList.toggle('opposite',d.side==='opposite');
  el('distanceTransition').textContent=d.from+' → '+d.to;
  caption.textContent=d.side==='opposite'?'Offset from the pocket directly opposite '+d.from+'.':'Offset from the previous pocket ('+d.from+').';
 }else{
  label.textContent='—';label.classList.remove('opposite');
  el('distanceTransition').textContent='Waiting for two spins';
  caption.textContent='Appears after the second spin.';
 }
}
function animateSpin(spin){if(!spin||spin.id===shownSpinId)return;shownSpinId=spin.id;
 const i=WHEEL.indexOf(spin.result),mid=wheelStart+i*step+step/2,target=norm(-90-mid);
 const increment=(target-(spinAngle%360)+360)%360;spinAngle+=6*360+increment;
 const from=currentWheelAngle,to=spinAngle,duration=Math.min(4250,Math.max(350,spin.endsAt-Date.now()-30));
 if(wheelAnimFrame)cancelAnimationFrame(wheelAnimFrame);
 const started=performance.now();
 const ease=t=>1-Math.pow(1-t,4);
 const tick=now=>{
  const p=Math.min(1,(now-started)/duration),v=from+(to-from)*ease(p);
  setWheelAngle(v);
  if(p<1)wheelAnimFrame=requestAnimationFrame(tick);else{wheelAnimFrame=null;setWheelAngle(to);}
 };
 wheelAnimFrame=requestAnimationFrame(tick);
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
 el('selectedChip').textContent=allIn?(allInPending?'Placing ALL IN…':'Next bet: '+money(state.you.bankroll)+' · ALL IN'):'Selected: '+money(chip);
 el('allInButton').textContent=allIn?'ALL IN · '+money(state.you.bankroll):'⚡ ALL IN';
 el('allInButton').classList.toggle('active',allIn);
 document.querySelectorAll('.chip').forEach(b=>b.classList.toggle('active',!allIn&&Number(b.dataset.value)===chip));
 el('allInButton').setAttribute('aria-pressed',String(allIn));
 el('allInButton').disabled=bettingLocked()||allInPending||state.you.bankroll<=0;
 el('chipbar').classList.toggle('all-in-selected',allIn);
 for(const b of document.querySelectorAll('.bet-cell,.outside-cell,.basket-btn,.chip'))b.disabled=bettingLocked()||allInPending;
 updateWheel();updateTicket();drawResult();seats();updateCountdown();
 if(state.spin){animateSpin(state.spin);el('resultTitle').textContent='Wheel spinning…';el('resultDesc').textContent='All bets are locked until the result.';}
}
function acceptState(next){if(!next||!session||next.code!==session.code)return;if(state&&next.round!==state.round){allIn=false;}serverOffset=next.serverNow-Date.now();state=next;updateAll();}
function connectEvents(){if(events)events.close();events=new EventSource('/events?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token));
 events.addEventListener('state',e=>{try {acceptState(JSON.parse(e.data));}catch(err){console.warn('Invalid table update',err);}});
 events.onopen=()=>{el('connectionText').textContent='Live · Shared table';el('connectionDot').classList.remove('offline');};
 events.onerror=()=>{el('connectionText').textContent='Reconnecting…';el('connectionDot').classList.add('offline');};
}
function storedName(){try{return localStorage.getItem('roulette_name')||'';}catch{return '';}}
function savedToken(code){try{return localStorage.getItem('roulette_seat_'+code)||'';}catch{return '';}}
function saveIdentity(code,token,name){try{localStorage.setItem('roulette_seat_'+code,token);localStorage.setItem('roulette_name',name);}catch{}}
function showLobby(err=''){
 el('lobby').hidden=false;el('app').hidden=true;
 el('lobbyError').textContent=err|| (location.protocol==='file:'?'Run START_LOCAL_WINDOWS.bat or deploy the website; HTML alone cannot run multiplayer.':'');
 el('playerName').value=storedName();
}
function enter(reply,name){session={code:reply.code,token:reply.token};saveIdentity(reply.code,reply.token,name);
 el('lobby').hidden=true;el('app').hidden=false;el('lobbyError').textContent='';
 try{history.replaceState(null,'',location.pathname);}catch{}
 acceptState(reply.state);connectEvents();
}
async function joinRoom(name,token=''){return api('/api/enter',{name,token});}
let joining=false;
async function withLobbyTask(job){if(joining)return;joining=true;el('enterTable').disabled=true;el('lobbyError').textContent='';try{await job();}catch(e){el('lobbyError').textContent=e.message||'Could not join the table.';}finally{joining=false;el('enterTable').disabled=false;}}
el('enterTable').onclick=()=>withLobbyTask(async()=>{
 const name=el('playerName').value.trim();if(!name)throw new Error('Enter your name to take a seat.');
 const reply=await joinRoom(name,savedToken('CASINO7'));enter(reply,name);
});
el('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')el('enterTable').click();});
el('copyLink').onclick=async()=>{const link=location.origin+location.pathname;
 try{await navigator.clipboard.writeText(link);toast('Game link copied! Anyone with the link can join this shared table.');}catch{prompt('Copy the game link:',link);}
};
// The number grid's hit location selects a straight, split, corner, street or six-line.
$grid.addEventListener('click',pointerBet);
for(const btn of document.querySelectorAll('.zero-grid button[data-num]'))btn.addEventListener('click',()=>onNumber(btn.dataset.num));
for(const btn of document.querySelectorAll('[data-outside]'))btn.addEventListener('click',()=>addBet(out[btn.dataset.outside]));
for(const btn of document.querySelectorAll('.chip'))btn.addEventListener('click',()=>{if(bettingLocked()||allInPending)return;allIn=false;chip=Number(btn.dataset.value);document.querySelectorAll('.chip').forEach(b=>b.classList.toggle('active',b===btn));updateAll();});
el('allInButton').onclick=()=>{if(!state||bettingLocked()||allInPending)return;if(!allIn&&state.you.bankroll<1)return toast('No available credits to bet All In.');allIn=!allIn;document.querySelectorAll('.chip').forEach(b=>b.classList.toggle('active',!allIn&&Number(b.dataset.value)===chip));updateAll();};
el('undoButton').onclick=()=>action('undo');el('clearButton').onclick=()=>action('clear');
const toggleReady=()=>{if(state&&!spinning)action('ready',{ready:!state.you.ready});};
el('spinButton').onclick=toggleReady;el('readyButton').onclick=toggleReady;
el('repeatButton').onclick=()=>action('repeat');
setInterval(updateCountdown,125);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateCountdown();});
el('resetSession').onclick=()=>{if(spinning)return;const amount=Number(el('startBankroll').value);if(!Number.isSafeInteger(amount)||amount<1||amount>100000000)return toast('Enter 1 to 100,000,000 credits.');
 if(confirm('Reset the entire shared table, all six players’ credits, bets and history?'))action('reset',{amount});};
document.addEventListener('keydown',e=>{if(!state||e.target.matches('input,textarea')||spinning)return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();action('undo');}else if(e.key==='Escape'){allIn=false;updateAll();}
 else if(/^[1-6]$/.test(e.key)&&!e.ctrlKey){const options=[1,5,10,25,100,500],btn=document.querySelector(`.chip[data-value="${options[Number(e.key)-1]}"]`);if(btn)btn.click();}
 else if((e.key==='s'||e.key==='S')&&!e.ctrlKey&&!e.metaKey){toggleReady();}
});
// Join the sole default table. The token is a private, device-stored seat identifier, not a password.
showLobby();
if(savedToken('CASINO7'))withLobbyTask(async()=>{
 try{const name=storedName()||'Player';const reply=await joinRoom(name,savedToken('CASINO7'));enter(reply,name);}
 catch(err){if(/expired|full|not found/i.test(err.message)){try{localStorage.removeItem('roulette_seat_CASINO7');}catch{}}throw err;}
});
})();
