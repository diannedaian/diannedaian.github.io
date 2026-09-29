import {englishText} from './english.js';
import {icons as oldIcons,levelOf} from './model.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={...oldIcons,beaver:'🦫',duck:'🦆',moth:'🦋',bluebird:'🐦',ladybug:'🐞',bat:'🦇',crab:'🦀',dodo:'🦤',dog:'🐕',elephant:'🐘',flamingo:'🦩',hedgehog:'🦔',peacock:'🦚',rat:'🐀',shrimp:'🦐',spider:'🕷️',swan:'🦢',badger:'🦡',blowfish:'🐡',camel:'🐪',giraffe:'🦒',kangaroo:'🦘',ox:'🐂',rabbit:'🐇',sheep:'🐑',snail:'🐌',turtle:'🐢',bison:'🦬',deer:'🦌',dolphin:'🐬',hippo:'🦛',parrot:'🦜',penguin:'🐧',rooster:'🐓',skunk:'🦨',squirrel:'🐿️',whale:'🐋',cow:'🐄',crocodile:'🐊',monkey:'🐒',rhino:'🦏',scorpion:'🦂',seal:'🦭',shark:'🦈',turkey:'🦃',boar:'🐗',cat:'🐈',dragon:'🐉',fly:'🪰',gorilla:'🦍',leopard:'🐆',mammoth:'🦣',snake:'🐍',tiger:'🐅',zombie_fly:'🪰',ram:'🐏',bus:'🚌',chick:'🐥',dirty_rat:'🐀',garlic:'🧄',meat_bone:'🍖',salad_bowl:'🥗',pear:'🍐',canned_food:'🥫',sushi:'🍣',melon:'🍈',mushroom:'🍄',steak:'🥩',pizza:'🍕',chocolate:'🍫',chili:'🌶️',milk:'🥛',cake:'🍰',bread:'🍞',sleeping_pill:'💊',cupcake:'🧁'};
let catalog,manifest,state,selection=null,busy=true,serial=0,frame=0,timer=null;
const name=id=>catalog?.pets.find(p=>p.id===id)?.name||catalog?.foods.find(p=>p.id===id)?.name||id?.replaceAll('_',' ')||'';
const randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const has=kind=>state?.legal.find(a=>a.kind===kind);
function request(payload){if(busy)return;busy=true;stop();$('#error').hidden=true;worker.postMessage({...payload,id:++serial,revision:state?.revision});if(state)render();}
function fail(message){busy=false;$('#error').hidden=false;$('#error').textContent=`${message} If this persists, reload the page. The original trained model is unaffected.`;if(state)render();}
function card(p,index,zone,shop=false){
  if(!p)return `<div class="pet empty"><span class="slot">${index}</span>Empty slot</div>`;
  const id=shop?p.item_id:p.spec_id,spec=catalog.pets.find(x=>x.id===id),food=shop&&p.kind==='food';
  const pet=shop?(p.pet||spec):p,selected=selection?.zone===zone&&selection.index===index;
  const atk=(pet?.attack||0)+(pet?.temporary_attack||0),hp=(pet?.health||0)+(pet?.temporary_health||0);
  const label=`${shop?'Shop':'Team'} ${index}: ${name(id)}${!food?`, Attack ${atk}, Health ${hp}`:''}`;
  return `<button class="pet ${food?'food-card':''} ${p.frozen?'frozen':''} ${selected?'selected':''} ${!shop&&hp<=0?'dead':''}" data-zone="${zone}" data-index="${index}" aria-pressed="${selected}" aria-label="${esc(label)}"><span class="slot">${index}${shop&&p.choice_group!=null?' · Reward':''}</span><span class="emoji" aria-hidden="true">${icons[id]||'🐾'}</span><span class="pet-name">${esc(name(id))}</span>${food?'<span class="stats">Food</span>':`<span class="stats"><span class="attack">⚔ ${atk}</span><span class="health">♥ ${hp}</span></span>`}<span class="pet-meta">${shop?`${p.cost} gold${p.frozen?' · ❄':''}`:`Lv ${levelOf(p)} · ${p.experience}/6 XP`}</span>${pet?.perk?`<span class="temporary">${esc(name(pet.perk))}</span>`:''}</button>`;
}
function team(pets,zone){return Array.from({length:5},(_,i)=>card(pets[i],i,zone)).join('');}
function actionLabel(a){
  const item=state.human.shop[a.source],pet=state.human.team[a.source],target=state.human.team[a.target];
  return ({end_turn:'End turn → Battle',roll:'Roll shop · 1 gold',buy_pet:`Buy ${name(item?.item_id)} · ${item?.cost} gold`,buy_food:`Feed ${a.target}: ${name(target?.spec_id)}`,merge:`Buy and merge → ${a.target}: ${name(target?.spec_id)}`,sell:`Sell ${name(pet?.spec_id)}`,swap_adjacent:`Swap ${a.source} ↔ ${a.target}`,toggle_freeze:`${item?.frozen?'Unfreeze':'Freeze'} ${name(item?.item_id)}`,merge_team:`Merge into ${a.target}: ${name(target?.spec_id)}`})[a.kind]||a.kind;
}
const triggers={buy:'Buy',sell:'Sell',level_up:'Level up',start_battle:'Start of battle',faint:'Faint',friend_summoned:'Friend summoned',start_turn:'Start of turn',end_turn:'End of turn',hurt:'Hurt',after_attack:'After attack',friend_ahead_attacks:'Friend ahead attacks',friend_ahead_faints:'Friend ahead faints',friendly_ate_food:'Friend eats food',knock_out:'Knock out',summoned:'Summoned',friend_faints:'Friend faints',before_attack:'Before attack',friend_bought:'Friend bought',shop_food:'Shop food used'};
function ability(a){
  // Show the catalog's exact fields; avoid inventing descriptions for level-sensitive effects.
  const p=a.params||Object.fromEntries(Object.entries(a).filter(([k])=>!['trigger','effect','id','name','tier','cost','token','curriculum_only'].includes(k)));
  if(!a.effect)return '<p class="small-note">No triggered ability.</p>';
  const labels={attack:'Attack',health:'Health',count:'Count',damage:'Damage',gold:'gold',amount:'Count',perk:'Perk',summon_id:'Summon',food_id:'Stock food',summon_attack:'Summoned attack',summon_health:'Summoned health',max_uses:'Use limit per turn',position:'Position',percent:'Percent',experience:'Experience'};
  const effects={buff:'Buff stats',buff_random_friend:'Buff random friends',buff_subject:'Buff triggering pet',damage_random_enemy:'Damage random enemies',gain_gold:'Gain gold',stock_food:'Stock food',summon:'Summon',buff_shop_pets:'Buff shop pets',buff_self:'Buff self',buff_position:'Buff position',damage_lowest_enemy:'Damage lowest-health enemy',damage_behind:'Damage behind',damage_all:'Damage all pets',gain_melon:'Gain  Melon',faint_pet:'Make target faint',buff_level_friends:'Buff high-level friends',buff_if_level_friend:'Buff if a friend meets the level requirement',copy_ahead_ability:'Copy ability ahead',swallow_ahead:'Swallow pet ahead',buff_random_team:'Buff random teammates',buff_all_pets:'Buff all friends',buff_front_pet:'Buff front pet',replace_milk:'Stock  Milk',damage_last_enemy:'Damage last enemy',gain_peanut:'Gain  Peanut',buff_future_shop:'Buff future shop pets',fly_summon:'Summon Zombie Fly',gain_coconut:'Gain  Coconut',repeat_ahead:'Repeat ability ahead',gain_experience:'Gain experience',set_perk:'Perk'};
  return `<div class="ability-row"><b>${esc(triggers[a.trigger]||'Food effect')}</b>: ${esc(effects[a.effect]||a.effect.replaceAll('_',' '))}${Object.entries(p).filter(([k])=>labels[k.replace('_by_level','')]).map(([k,v])=>`<div>${esc(labels[k.replace('_by_level','')])}${k.endsWith('_by_level')?' (Lv 1/2/3)':''}: ${esc(Array.isArray(v)?v.join(' / '):v)}</div>`).join('')}<details><summary>Full rule parameters</summary><code>${esc(JSON.stringify({effect:a.effect,...p}))}</code></details></div>`;
}
function renderSelection(){
  if(!selection){$('#selection-title').textContent='Select a pet or food';$('#selection-detail').innerHTML='<p>Select a shop card to buy it, or choose a target for food and merging. Select a team pet to sell, swap or merge.</p>';$('#selection-actions').innerHTML='';return;}
  let p;
  if(selection.zone==='shop')p=state.human.shop[selection.index];
  else if(state.phase==='battle')p=state.battle.frames[frame].teams[selection.zone==='human'?0:1][selection.index];
  else p=selection.zone==='human'?state.human.team[selection.index]:state.ai.team[selection.index];
  if(!p){selection=null;renderSelection();return;}
  const id=p.item_id||p.spec_id,meta=catalog.pets.find(x=>x.id===id)||catalog.foods.find(x=>x.id===id);
  $('#selection-title').textContent=`${icons[id]||'🐾'} ${name(id)} · ${selection.index}`;
  $('#selection-detail').innerHTML=`<p>Tier ${meta.tier}${p.choice_group!=null?' · Choose one of two level-up rewards; buying one removes the other.':''}</p>${(meta.abilities||[meta]).map(ability).join('')}`;
  const actions=state.legal.filter(a=>selection.zone==='shop'?a.source===selection.index&&['buy_pet','buy_food','merge','toggle_freeze'].includes(a.kind):selection.zone==='human'&&(a.source===selection.index||a.kind==='swap_adjacent'&&a.target===selection.index)&&['sell','swap_adjacent','merge_team'].includes(a.kind));
  $('#selection-actions').innerHTML=actions.map(a=>`<button data-action="${a.id}" ${busy?'disabled':''} class="${['buy_pet','buy_food','merge'].includes(a.kind)?'primary':''}">${esc(actionLabel(a))}</button>`).join('')||'<p class="small-note">No available actions for this selection.</p>';
}
function render(){
  const s=state.human,inBattle=state.phase==='battle';
  $('#match').hidden=false;$('#new-game').disabled=busy;
  $('#round-title').textContent=state.done?({human:'You won the match!',ai:'The bot won the match',turn_limit:'40-round limit reached · Match ended'})[state.result]:`Round ${inBattle?state.battle.turn:s.turn} · ${inBattle?'Battle replay':'Shopping'}`;
  $('#status').textContent=busy?'Processing action…':state.done?'Replay the last battle or start a new game.':inBattle?'Both sides share this battle result. Continue when you are ready.':'Select a shop card to start buying. The bot cannot see your current team.';
  $('#your-score').innerHTML=`<span>♥ ${s.lives}</span><span>🏆 ${s.wins}</span>${!inBattle?`<span class="gold">● ${s.gold} gold</span>`:''}`;
  $('#ai-score').innerHTML=`<span>♥ ${state.ai.lives}</span><span>🏆 ${state.ai.wins}</span>`;
  $('#action-count').textContent=inBattle?'Actual battle state':`${s.actions_this_turn}/30 actions`;
  $('#shop-area').hidden=inBattle;$('#battle-panel').hidden=!inBattle;
  $('#tier-label').textContent=`Unlocked Tier ${Math.min(6,1+Math.floor((s.turn-1)/2))}`;
  $('#shop').innerHTML=s.shop.map((p,i)=>p?card(p,i,'shop',true):'').join('');
  $('#roll').disabled=busy||!has('roll');$('#end-turn').disabled=busy||!has('end_turn');
  $('#budget-note').textContent=s.gold>=3?'You still have gold; it does not carry over.':s.actions_this_turn>=26?'Near the action limit; battle will be forced.':'';
  $('#next-round').hidden=state.done;$('#next-round').disabled=busy;
  $('#opponent-note').textContent=inBattle?'The bot’s battle team · Same battle, opposite outcomes':'Previously revealed team. This round’s purchases stay hidden until battle.';
  $('#your-team').innerHTML=team(inBattle?state.battle.frames[frame].teams[0]:s.team,'human');
  $('#ai-team').innerHTML=team(inBattle?state.battle.frames[frame].teams[1]:state.ai.team,'ai');
  if(inBattle){const b=state.battle;$('#battle-result').textContent=({win:'You won this round',loss:'The bot won this round',draw:'This round was a draw'})[b.outcome]+(b.human_forced?' · You reached the action limit':'')+(b.ai_forced?' · The bot reached the action limit':'');$('#battle-slider').max=b.frames.length-1;$('#battle-slider').value=frame;$('#frame-count').textContent=`${frame+1} / ${b.frames.length}`;$('#battle-event').textContent=englishText(b.frames[frame].message);}
  $('#model-evidence').innerHTML=`Match seed: ${state.seed}<br>Model SHA: <code>${esc(manifest.checkpoint_sha256)}</code>`;
  $('#ai-decisions').innerHTML=state.ai_decisions.map((d,i)=>`<div class="decision-row"><b>${i+1}. ${esc(englishText(d.label||d.action))}</b>Estimated return ${d.value.toFixed(3)} (not win probability)<ol>${d.top.map(a=>`<li>${esc(englishText(a.label||a.action))} · ${(a.probability*100).toFixed(1)}%</li>`).join('')}</ol></div>`).join('')||'<p>Available after the first battle.</p>';
  renderSelection();
}
function stop(){if(timer)clearInterval(timer);timer=null;$('#battle-play').textContent='▶ Play';}
function jump(n){stop();frame=Math.max(0,Math.min(n,state.battle.frames.length-1));render();}
function play(){if(timer){stop();return;}if(frame>=state.battle.frames.length-1)frame=0;timer=setInterval(()=>{if(frame>=state.battle.frames.length-1){stop();return;}frame++;render();},Number($('#battle-speed').value));$('#battle-play').textContent='Ⅱ Pause';}
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||!state)return;if(button.dataset.zone){selection={zone:button.dataset.zone,index:Number(button.dataset.index)};render();if(innerWidth<=800)$('#selection-title').scrollIntoView({behavior:'smooth',block:'center'});}if(button.dataset.action){const id=Number(button.dataset.action);selection=null;request({type:'action',action:id});}});
$('#roll').onclick=()=>{selection=null;request({type:'action',action:1});};
$('#end-turn').onclick=()=>{selection=null;request({type:'action',action:0});};
$('#next-round').onclick=()=>{selection=null;request({type:'next'});};
$('#new-game').onclick=()=>{if(!state||state.done||confirm('Discard this match and start a new game?')){selection=null;request({type:'start',seed:randomSeed()});}};
$('#battle-start').onclick=()=>jump(0);$('#battle-prev').onclick=()=>jump(frame-1);$('#battle-next').onclick=()=>jump(frame+1);$('#battle-play').onclick=play;$('#battle-slider').oninput=event=>jump(Number(event.target.value));$('#battle-speed').onchange=()=>{if(timer){stop();play();}};
const worker=new Worker('duel-worker.js',{type:'module'});
worker.onerror=()=>fail('The browser runtime failed to start. Check access to jsDelivr or try a newer browser.');
worker.onmessage=({data})=>{
  if(data.status)$('#status').textContent=data.status;
  if(data.error){fail(data.error);return;}
  if(data.metadata){({catalog,manifest}=data.metadata);busy=false;request({type:'start',seed:randomSeed()});}
  if(data.state){const wasBattle=state?.phase==='battle';state=data.state;busy=false;if(state.phase==='battle'&&!wasBattle)frame=0;render();if(state.phase==='battle'&&!wasBattle)play();}
};
