(function () {
  'use strict';
  const C = window.Treasure;
  const $ = id => document.getElementById(id);
  const KEY = 'taller-ruta-tesoro-v1';
  const NS = 'http://www.w3.org/2000/svg';
  const POINTS = [[110,470],[180,480],[250,470],[320,450],[390,460],[460,435],[500,380],[470,325],[400,300],[330,270],[290,210],[330,150],[400,120],[480,135],[550,170],[625,185],[690,155],[750,140],[810,155],[865,195],[900,250],[910,310],[960,350],[1000,395],[990,450]];
  const SCENES = [
    { title: 'Toda gran aventura comienza con una tripulación.', text: 'El mapa está incompleto y el tesoro espera al otro lado del mar. Para llegar necesitamos algo más que un barco: ideas, decisiones y personas que se atrevan a probar. Hoy cada tripulación encontrará su propia manera de navegar.', task: 'Primera misión: elijan un nombre, creen su bandera y prepárense para descubrir qué nos hace seguir jugando.' },
    { title: 'Las mejores rutas se construyen mientras navegamos.', text: 'Ya conocen algunas de las reglas de este mar. Ahora les toca elegir cuáles llevarán a sus propias clases. Una buena idea puede abrir un camino; probarla juntos nos ayuda a saber hacia dónde seguir.', task: 'Misión de la travesía: tomen una mecánica que hayan vivido y conviértanla en un desafío que ayude a aprender.' },
    { title: 'El tesoro tiene muchas formas de llegar al aula.', text: 'En esta isla no buscamos una única respuesta. Cada tripulación trae una propuesta, una pregunta y una forma distinta de imaginar sus clases. Lo que encontraron hoy vale por lo que podrán hacer con ello.', task: 'Última misión de la mañana: compartan su mini gamificación y una decisión de diseño que quieran seguir probando.' }
  ];
  const SHOP_TEXT = { hint: 'Una orientación adicional para tu misión.', example: 'Un ejemplo que puedas adaptar a tu propuesta.', consult: 'Dos minutos para revisar una idea con el relator.', wind: 'Avanza dos casillas hacia la isla.' };
  let game = C.initial(), history = [], timer = { minutes: 15, remaining: 900000, deadline: 0 };
  let busy = false, scenePreview = 0, toastTimeout, confirmAction = null, loadWarning = '';
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { const saved = C.backup(JSON.parse(raw)); game = saved.game; history = saved.history; timer = saved.timer; }
      catch (_) { localStorage.setItem(KEY + '-recuperacion', raw); loadWarning = 'No se pudo abrir el guardado anterior. Se conservó una copia de recuperación en este navegador.'; }
    }
  } catch (_) { loadWarning = 'Este navegador no permite guardar. Descarga un respaldo antes de cerrar.'; }

  function announce(text) { $('liveAnnouncer').textContent = text; }
  function toast(text) {
    clearTimeout(toastTimeout); $('toast').textContent = text; $('toast').classList.add('visible');
    toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 4800); announce(text);
  }
  function currentBackup() { return { app: 'ruta-del-tesoro', version: 1, game, history, timer }; }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(currentBackup())); $('saveStatus').textContent = 'Guardado en este navegador'; }
    catch (_) { $('saveStatus').textContent = 'Descarga un respaldo antes de cerrar'; }
  }
  function active() { return game.teams.slice(0, game.count); }
  function selected() { return game.teams[game.selected - 1]; }
  function commit(action) {
    if (busy) return false;
    try {
      const previous = game;
      const next = C.apply(game, action);
      history.push(C.clone(previous)); history = history.slice(-30); game = next;
      persist(); render();
      const arrived = active().filter(t => t.position === C.STEPS && previous.teams[t.id - 1].position < C.STEPS);
      if (arrived.length) toast(arrived.map(t => t.name).join(', ') + ': ¡en la isla del tesoro!');
      return true;
    } catch (error) { toast(error.message); return false; }
  }
  function svg(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k,v]) => el.setAttribute(k, v));
    if (parent) parent.appendChild(el);
    return el;
  }
  const route = $('routeLayer');
  const routePath = POINTS.map((p,i) => (i ? 'L' : 'M') + p.join(' ')).join(' ');
  svg('path', { d: routePath, fill:'none', stroke:'#a6c4ad', 'stroke-width':26, opacity:'.05', 'stroke-linecap':'round','stroke-linejoin':'round' }, route);
  svg('path', { d: routePath, fill:'none', stroke:'#a9c5af', 'stroke-width':3, 'stroke-dasharray':'4 11','stroke-linecap':'round' }, route);
  POINTS.forEach(([x,y], i) => {
    svg('circle', { cx:x, cy:y, r:i % 6 === 0 ? 17 : 8, class:'route-dot' + (i % 6 === 0 ? ' major' : '') }, route);
    if (i % 6 === 0) svg('text', { x, y, class:'route-number' }, route).textContent = i;
  });
  const shipElements = new Map();
  const cardElements = new Map();
  for (let i = 0; i < 7; i++) {
    const id = i + 1;
    const group = svg('g', { class:'ship', tabindex:'0', role:'button', 'data-team':id }, $('shipsLayer'));
    svg('circle', { cx:0,cy:0,r:45,class:'select-ring' }, group);
    svg('use', { href:'#shipShape', style:'color:' + C.COLORS[i] }, group);
    const sailOverlay = svg('path', { d:'M-4-29-25 8h21Zm7-3V8h26Z', fill:C.COLORS[i], stroke:'#f5e8c7','stroke-width':'1.5' }, group);
    sailOverlay.setAttribute('pointer-events','none');
    svg('text', { x:12,y:-6,class:'ship-number' }, group).textContent = id;
    const title = svg('title', {}, group); title.textContent = C.NAMES[i];
    group.addEventListener('click', () => selectTeam(id));
    group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTeam(id); } });
    shipElements.set(id, group);
    const card = document.createElement('div'); card.className = 'crew-card'; card.style.setProperty('--ship-color',C.COLORS[i]);
    card.innerHTML = '<button class="crew-select"><span class="crew-number"></span><span class="crew-details"><span class="crew-name"></span><span class="crew-progress-label"><span class="position"></span><span class="last-roll"></span></span></span></button><div class="crew-coins"><svg aria-hidden="true"><use href="#i-coin"/></svg><span class="balance"></span><button class="coin-add">+</button></div><div class="crew-progress" aria-hidden="true"><span></span></div>';
    card.querySelector('.crew-number').textContent = id;
    card.querySelector('.crew-select').addEventListener('click', () => selectTeam(id));
    card.querySelector('.coin-add').addEventListener('click', () => { if (commit({type:'coin',id,amount:1})) toast(game.teams[id-1].name + ': +1 moneda.'); });
    $('crewList').appendChild(card); cardElements.set(id,card);
    const label = document.createElement('label'); label.className = 'field';
    label.textContent = 'Tripulación ' + id;
    const input = document.createElement('input'); input.id = 'name' + id; input.name = 'name' + id; input.maxLength = 28; input.required = true; input.autocomplete = 'off';
    label.appendChild(input); $('nameFields').appendChild(label);
  }
  function selectTeam(id) {
    if (busy || id > game.count) return;
    game.selected = id; persist(); render();
  }
  function drawDie(value) {
    const coords = { 1:[[27,27]],2:[[14,14],[40,40]],3:[[14,14],[27,27],[40,40]],4:[[14,14],[40,14],[14,40],[40,40]],5:[[14,14],[40,14],[27,27],[14,40],[40,40]],6:[[14,12],[40,12],[14,27],[40,27],[14,42],[40,42]] };
    $('die').replaceChildren();
    if (!value) { const text = document.createElement('span');text.textContent='?';$('die').appendChild(text); }
    else { const d = svg('svg',{viewBox:'0 0 54 54','aria-hidden':'true'},$('die'));coords[value].forEach(([cx,cy])=>svg('circle',{cx,cy,r:'4.5'},d)); }
    $('die').setAttribute('aria-label', value ? 'Dado: ' + value : 'Dado sin lanzar');
  }
  function render() {
    const teams = active();
    for (const team of game.teams) {
      const enabled = team.id <= game.count;
      const card = cardElements.get(team.id), ship = shipElements.get(team.id);
      card.hidden = !enabled; ship.style.display = enabled ? '' : 'none';
      if (!enabled) continue;
      card.classList.toggle('selected',team.id === game.selected);
      const button = card.querySelector('.crew-select');
      button.setAttribute('aria-pressed',String(team.id === game.selected)); button.disabled = busy;
      card.querySelector('.crew-name').textContent = team.name;
      card.querySelector('.position').textContent = team.position === C.STEPS ? 'En la isla' : team.position + ' / ' + C.STEPS;
      card.querySelector('.last-roll').textContent = team.lastDice ? 'Dado ' + team.lastDice : '';
      card.querySelector('.balance').textContent = team.coins;
      card.querySelector('.coin-add').setAttribute('aria-label','Dar una moneda a ' + team.name);
      card.querySelector('.coin-add').disabled = busy || team.coins >= 999;
      card.querySelector('.crew-progress span').style.width = (team.position / C.STEPS * 100) + '%';
      const occupants = teams.filter(x => x.position === team.position);
      const at = occupants.findIndex(x => x.id === team.id);
      let [x,y] = POINTS[team.position];
      if (occupants.length > 1) {
        const angle = -Math.PI / 2 + 2 * Math.PI * at / occupants.length;
        const radius = occupants.length === 2 ? 31 : 28 + occupants.length * 5;
        x += Math.cos(angle) * radius; y += Math.sin(angle) * radius;
      }
      ship.setAttribute('transform','translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
      ship.classList.toggle('selected',team.id === game.selected);
      ship.setAttribute('aria-label',team.name + ', casilla ' + team.position + ' de ' + C.STEPS);
      ship.setAttribute('aria-pressed',String(team.id === game.selected));
      ship.querySelector('title').textContent = team.name;
    }
    const t = selected(), arrived = teams.filter(x => x.position === C.STEPS).length;
    $('selectedName').textContent = t.name;
    $('selectedPosition').textContent = t.position === C.STEPS ? '¡Esta tripulación ya llegó al tesoro!' : (t.position === 0 ? 'En el puerto' : 'Casilla ' + t.position) + ' · ' + (C.STEPS-t.position) + ' casillas hasta el tesoro';
    $('roundLabel').textContent = 'Ronda ' + game.round;
    $('crewTotal').textContent = String(game.count).padStart(2,'0');
    $('arrivalCount').textContent = arrived + ' de ' + game.count + ' en la isla';
    $('chapterLabel').textContent = ['La tripulación se reúne','Las ideas toman el timón','El tesoro se comparte'][game.chapter];
    $('rollBtn').disabled = busy || t.position === C.STEPS;
    $('roundBtn').disabled = busy || arrived === game.count;
    $('undoBtn').disabled = busy || !history.length;
    $('shopBtn').disabled = busy;
    $('settingsBtn').disabled = busy;
    $('treasureBtn').hidden = arrived !== game.count;
    $('treasureBtn').disabled = busy;
    document.body.classList.toggle('is-busy',busy);
    if (!busy) drawDie(t.lastDice);
  }
  function randomDie() {
    const sample = new Uint32Array(1); let n;
    do { window.crypto.getRandomValues(sample); n = sample[0]; } while (n >= 4294967292);
    return n % 6 + 1;
  }
  async function roll(all) {
    if (busy) return;
    const moving = (all ? active() : [selected()]).filter(t=>t.position < C.STEPS);
    if (!moving.length) return;
    const dice = Object.fromEntries(moving.map(t=>[t.id,randomDie()]));
    busy = true; render(); $('die').classList.add('rolling');
    const wiggle = setInterval(()=>drawDie(randomDie()),90);
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 750;
    await new Promise(resolve=>setTimeout(resolve,delay));
    clearInterval(wiggle); $('die').classList.remove('rolling'); busy = false;
    if (commit({type:all?'rollAll':'roll',dice})) {
      announce(all ? 'Ronda ' + game.round + ' completada. Consulta el resultado de cada tripulación.' : selected().name + ' sacó ' + dice[selected().id] + ' y avanzó a la casilla ' + selected().position + '.');
    }
  }
  function open(id) { const d=$(id);if (!d.open) d.showModal(); }
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',()=>button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target === dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
  function confirm(title,text,callback) { $('confirmTitle').textContent=title;$('confirmText').textContent=text;confirmAction=callback;open('confirmDialog'); }
  $('acceptConfirmBtn').addEventListener('click',()=>{const callback=confirmAction;confirmAction=null;$('confirmDialog').close();if(callback)callback();});
  $('cancelConfirmBtn').addEventListener('click',()=>$('confirmDialog').close());
  $('rollBtn').addEventListener('click',()=>roll(false));
  $('roundBtn').addEventListener('click',()=>roll(true));
  $('undoBtn').addEventListener('click',()=>{if(busy||!history.length)return;game=history.pop();persist();render();toast('Última acción deshecha.');});
  $('helpBtn').addEventListener('click',()=>open('helpDialog'));
  $('treasureBtn').addEventListener('click',()=>open('treasureDialog'));
  $('fullscreenBtn').addEventListener('click',async()=>{
    try { if(document.fullscreenElement) await document.exitFullscreen();else await document.documentElement.requestFullscreen(); }
    catch(_){toast('No se pudo activar la pantalla completa en este navegador.');}
  });
  document.addEventListener('fullscreenchange',()=>{ $('fullscreenBtn').setAttribute('aria-label',document.fullscreenElement?'Salir de pantalla completa':'Activar pantalla completa'); });
  $('settingsBtn').addEventListener('click',()=>{
    $('teamCount').value=game.count;game.teams.forEach(t=>{$('name'+t.id).value=t.name;});updateNameVisibility();open('settingsDialog');
  });
  function updateNameVisibility(){const count=Number($('teamCount').value);$('name7').closest('label').hidden=count===6;}
  $('teamCount').addEventListener('change',updateNameVisibility);
  $('settingsForm').addEventListener('submit',e=>{
    e.preventDefault();const names=game.teams.map(t=>$('name'+t.id).value.trim()||t.name);
    if(commit({type:'settings',count:Number($('teamCount').value),names})){$('settingsDialog').close();toast('Tripulaciones preparadas. ¡A zarpar!');}
  });
  $('backBtn').addEventListener('click',()=>{commit({type:'move',amount:-1});});
  $('forwardBtn').addEventListener('click',()=>{commit({type:'move',amount:1});});
  $('resetBtn').addEventListener('click',()=>confirm('¿Empezamos una nueva aventura?','Se reiniciarán nombres, posiciones, monedas y reloj. Descarga un respaldo si quieres conservar esta partida.',()=>{
    game=C.initial();history=[];timer={minutes:15,remaining:900000,deadline:0};$('timerMinutes').value=15;persist();render();renderTimer();$('settingsDialog').close();toast('Nueva aventura preparada.');
  }));
  function renderScene(){
    const scene=SCENES[scenePreview];$('storyTitle').textContent=scene.title;$('storyText').textContent=scene.text;$('storyTask').textContent=scene.task;
    document.querySelectorAll('[data-scene]').forEach(b=>{b.classList.toggle('selected',Number(b.dataset.scene)===scenePreview);b.setAttribute('aria-pressed',String(Number(b.dataset.scene)===scenePreview));});
  }
  $('storyBtn').addEventListener('click',()=>{scenePreview=game.chapter;renderScene();open('storyDialog');});
  document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>{scenePreview=Number(b.dataset.scene);renderScene();}));
  $('useSceneBtn').addEventListener('click',()=>{if(commit({type:'chapter',chapter:scenePreview}))$('storyDialog').close();});
  function renderShop(){
    const t=selected();$('shopBalance').textContent=t.name+' · '+t.coins+' '+(t.coins===1?'moneda disponible':'monedas disponibles');$('shopItems').replaceChildren();
    Object.entries(C.SHOP).forEach(([key,item])=>{
      const b=document.createElement('button');b.className='shop-item';b.disabled=busy||t.coins<item.cost||Boolean(item.steps&&t.position===C.STEPS);
      const copy=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('small'),price=document.createElement('span');
      name.textContent=item.name;detail.textContent=SHOP_TEXT[key];copy.append(name,detail);price.className='shop-price';price.textContent=item.cost+' '+(item.cost===1?'moneda':'monedas');b.append(copy,price);
      b.addEventListener('click',()=>{if(commit({type:'buy',item:key})){renderShop();toast(item.name+' canjeado por '+item.cost+' '+(item.cost===1?'moneda.':'monedas.'));}});$('shopItems').appendChild(b);
    });
  }
  $('shopBtn').addEventListener('click',()=>{renderShop();open('shopDialog');});
  $('logBtn').addEventListener('click',()=>{
    $('logList').replaceChildren();(game.log.length?game.log:['La bitácora está lista. La primera decisión está por venir.']).forEach(text=>{const li=document.createElement('li');li.textContent=text;$('logList').appendChild(li);});open('logDialog');
  });
  function remaining(){return timer.deadline?Math.max(0,timer.deadline-Date.now()):timer.remaining;}
  function renderTimer(){
    const seconds=Math.ceil(remaining()/1000);$('timerValue').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    $('timerBtn').textContent=timer.deadline?'Pausar':seconds===0?'Iniciar':'Iniciar';$('timerMinutes').disabled=Boolean(timer.deadline);
    $('timerHint').textContent=seconds===0?'Ya puedes convocar a las tripulaciones.':'Un recordatorio para el próximo alto.';
    document.querySelector('.timer-panel').classList.toggle('timer-ready',seconds===0);
  }
  $('timerMinutes').value=timer.minutes;
  $('timerMinutes').addEventListener('change',()=>{
    const value=Number($('timerMinutes').value);
    if(!Number.isInteger(value)||value<1||value>60){$('timerMinutes').value=timer.minutes;toast('Elige un tiempo entre 1 y 60 minutos.');return;}
    timer.minutes=value;timer.remaining=value*60000;timer.deadline=0;persist();renderTimer();
  });
  $('timerBtn').addEventListener('click',()=>{
    if(timer.deadline){timer.remaining=remaining();timer.deadline=0;}
    else {if(timer.remaining===0)timer.remaining=timer.minutes*60000;timer.deadline=Date.now()+timer.remaining;}
    persist();renderTimer();
  });
  $('timerResetBtn').addEventListener('click',()=>{timer.remaining=timer.minutes*60000;timer.deadline=0;persist();renderTimer();});
  setInterval(()=>{
    if(timer.deadline&&remaining()===0){timer.remaining=0;timer.deadline=0;persist();toast('¡Es momento de volver al mapa! Tú decides cuándo lanzar.');}
    renderTimer();
  },500);
  $('exportBtn').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(currentBackup(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='ruta-del-tesoro-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Respaldo descargado.');
  });
  $('importBtn').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    try {
      if(file.size>300000)throw new Error('El archivo es demasiado grande para ser un respaldo de esta aventura.');
      const incoming=C.backup(JSON.parse(await file.text()));
      confirm('¿Abrir este respaldo?','Se reemplazará la partida de este navegador por la del archivo. Descarga antes una copia de la actual si deseas conservarla.',()=>{
        game=incoming.game;history=incoming.history;timer=incoming.timer;$('timerMinutes').value=timer.minutes;persist();render();renderTimer();$('settingsDialog').close();toast('Respaldo importado. La aventura puede continuar.');
      });
    } catch(error){toast(error instanceof SyntaxError?'Ese archivo no contiene un respaldo JSON válido.':error.message);}
  });
  window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue)toast('La aventura cambió en otra pestaña. Recarga esta página antes de continuar.');});
  render();renderTimer();
  if(loadWarning){$('saveStatus').textContent='Revisa el guardado antes de continuar';toast(loadWarning);}
})();
