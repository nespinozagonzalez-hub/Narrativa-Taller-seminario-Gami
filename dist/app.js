(function () {
  'use strict';

  const C = window.Treasure;
  const $ = id => document.getElementById(id);
  const KEY = 'taller-ruta-tesoro-v1';
  const ASSETS = './assets/';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SCENES = [
    {
      title: 'Toda gran aventura comienza con una tripulación.',
      text: 'El mapa nos llevará hasta la isla del tesoro. Antes de zarpar, necesitamos una tripulación dispuesta a probar, compartir y tomar decisiones.',
      task: 'Primera misión. Elijan un nombre, creen su bandera y prueben un juego de la ludoteca.'
    },
    {
      title: 'Las ideas toman el timón.',
      text: 'Ya conocen algunas de las reglas de este mar. Ahora les toca decidir cuáles llevarán a sus propias clases.',
      task: 'Misión de la travesía. Conviertan una mecánica que probaron en un desafío que ayude a aprender.'
    },
    {
      title: 'El tesoro se comparte.',
      text: 'Cada tripulación trae una idea diferente al llegar a la isla.',
      task: 'Última misión de la mañana. Compartan su mini gamificación y una decisión de diseño que quieran probar.'
    }
  ];
  const CHAPTERS = ['La tripulación se reúne', 'Las ideas toman el timón', 'El tesoro se comparte'];
  const SHOP_TEXT = {
    hint: 'Una orientación adicional para tu misión.',
    example: 'Un ejemplo que puedas adaptar a tu propuesta.',
    consult: 'Dos minutos para revisar una idea con el relator.',
    wind: 'Avanza dos casillas hacia la isla.'
  };
  const PIPS = {
    1: [[27, 27]],
    2: [[14, 14], [40, 40]],
    3: [[14, 14], [27, 27], [40, 40]],
    4: [[14, 14], [40, 14], [14, 40], [40, 40]],
    5: [[14, 14], [40, 14], [27, 27], [14, 40], [40, 40]],
    6: [[14, 12], [40, 12], [14, 27], [40, 27], [14, 42], [40, 42]]
  };

  const initialTimer = () => ({ minutes: 15, remaining: 900000, deadline: 0 });
  let game = C.initial();
  let history = [];
  let timer = initialTimer();
  let busy = false;
  let scenePreview = 0;
  let toastTimeout;
  let confirmAction;
  let loadWarning = '';
  let routePoints = [];
  let drawnLength = 0;
  const shipElements = new Map();
  const cardElements = new Map();

  function loadSavedGame() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      try {
        const saved = C.backup(JSON.parse(raw));
        game = saved.game;
        history = saved.history;
        timer = saved.timer;
      } catch (_) {
        localStorage.setItem(KEY + '-recuperacion', raw);
        loadWarning = 'No se pudo abrir el guardado anterior. Se conservó una copia de recuperación en este navegador.';
      }
    } catch (_) {
      loadWarning = 'Este navegador no permite guardar. Descarga un respaldo antes de cerrar.';
    }
  }

  function announce(message) {
    $('liveAnnouncer').textContent = message;
  }

  function toast(message) {
    clearTimeout(toastTimeout);
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 4800);
  }

  function currentBackup() {
    return { app: 'ruta-del-tesoro', version: C.VERSION, game, history, timer };
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(currentBackup()));
      $('saveStatus').textContent = 'Guardado en este navegador';
    } catch (_) {
      $('saveStatus').textContent = 'Descarga un respaldo antes de cerrar';
    }
  }

  function active() { return game.teams.slice(0, game.count); }
  function selected() { return game.teams[game.selected - 1]; }
  function coinText(count) { return count + (count === 1 ? ' moneda' : ' monedas'); }
  function atTreasure(team) { return team.position === game.routeLength; }

  function commit(action) {
    if (busy) return false;
    try {
      const previous = game;
      const next = C.apply(game, action);
      history.push(C.clone(previous));
      history = history.slice(-30);
      game = next;
      persist();
      render();
      const arrived = active().filter(team =>
        atTreasure(team) && previous.teams[team.id - 1].position !== previous.routeLength
      );
      if (arrived.length) toast(arrived.map(C.teamName).join(', ') + ': ¡en la isla del tesoro!');
      return true;
    } catch (error) {
      toast(error.message);
      return false;
    }
  }

  function svg(tag, attrs, parent) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    if (parent) parent.appendChild(element);
    return element;
  }

  function drawRoute() {
    if (drawnLength === game.routeLength) return;
    drawnLength = game.routeLength;
    const curve = $('routeGuide');
    const length = curve.getTotalLength();
    const stops = document.createDocumentFragment();
    routePoints = [];
    for (let step = 0; step <= drawnLength; step++) {
      const point = curve.getPointAtLength(length * step / drawnLength);
      routePoints.push([point.x, point.y]);
      const major = step % 5 === 0 || step === drawnLength;
      svg('circle', {
        cx: point.x, cy: point.y, r: major ? 15 : 6.5,
        class: major ? 'route-dot major' : 'route-dot'
      }, stops);
      if (major) svg('text', { x: point.x, y: point.y, class: 'route-number' }, stops).textContent = step;
    }
    $('routeStops').replaceChildren(stops);
    $('oceanMap').setAttribute('aria-label', 'Mapa con ' + drawnLength + ' casillas entre el puerto de salida y la isla del tesoro');
  }

  function addShipMarker(id, color) {
    const ship = svg('g', { class: 'ship', tabindex: 0, role: 'button', 'data-team': id }, $('shipsLayer'));
    ship.style.setProperty('--ship-color', color);
    svg('title', {}, ship);
    svg('circle', { r: 28, class: 'hit-area' }, ship);
    svg('circle', { r: 28, class: 'select-ring' }, ship);
    svg('image', {
      href: ASSETS + 'barco-pirata.webp', x: -29, y: -25, width: 58, height: 43, class: 'ship-art'
    }, ship);
    svg('circle', { cx: 17, cy: -16, r: 10, class: 'ship-color' }, ship);
    svg('text', { x: 17, y: -16, class: 'ship-number' }, ship).textContent = id;
    ship.addEventListener('click', () => selectTeam(id));
    ship.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectTeam(id);
      }
    });
    shipElements.set(id, ship);
  }

  function addCrewCard(id, color) {
    const card = document.createElement('div');
    card.className = 'crew-card';
    card.style.setProperty('--ship-color', color);
    card.innerHTML =
      '<button class="crew-select"><span class="crew-number"></span><span class="crew-details">' +
      '<span class="crew-name"></span><span class="crew-ship-name" hidden></span>' +
      '<span class="crew-progress-label"><span class="position"></span><span class="last-roll"></span></span>' +
      '</span></button><div class="crew-coins"><svg aria-hidden="true"><use href="#i-coin"/></svg>' +
      '<span class="balance"></span><button class="coin-add">+</button></div>' +
      '<div class="crew-progress" aria-hidden="true"><span></span></div>';
    card.querySelector('.crew-number').textContent = id;
    card.querySelector('.crew-select').addEventListener('click', () => selectTeam(id));
    card.querySelector('.coin-add').addEventListener('click', () => {
      if (commit({ type: 'coin', id, amount: 1 })) toast(C.teamName(game.teams[id - 1]) + ': +1 moneda.');
    });
    $('crewList').appendChild(card);
    cardElements.set(id, card);
  }

  function addNameFields(id, color) {
    const row = document.createElement('div');
    row.className = 'name-row';
    row.id = 'nameRow' + id;
    row.style.setProperty('--ship-color', color);
    const number = document.createElement('span');
    number.className = 'crew-number';
    number.textContent = id;
    row.appendChild(number);
    for (const [key, text, hint] of [['name', 'Tripulación', C.NAMES[id - 1]], ['shipName', 'Barco', 'Opcional']]) {
      const label = document.createElement('label');
      label.className = 'field';
      label.textContent = text;
      const input = document.createElement('input');
      input.id = key + id;
      input.name = key + id;
      input.maxLength = C.MAX_NAME;
      input.placeholder = hint;
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'Nombre ' + (key === 'name' ? 'de la tripulación ' : 'del barco ') + id);
      label.appendChild(input);
      row.appendChild(label);
    }
    $('nameFields').appendChild(row);
  }

  function selectTeam(id) {
    if (busy || id > game.count) return;
    game.selected = id;
    persist();
    render();
  }

  function drawDie(face) {
    const die = $('die');
    die.replaceChildren();
    if (face) {
      const element = svg('svg', { viewBox: '0 0 54 54', 'aria-hidden': 'true' }, die);
      PIPS[face].forEach(([cx, cy]) => svg('circle', { cx, cy, r: '4.5' }, element));
    } else {
      const mark = document.createElement('span');
      mark.textContent = '?';
      die.appendChild(mark);
    }
    die.setAttribute('aria-label', face ? 'Dado: ' + face : 'Dado sin lanzar');
  }

  function rollLabel(roll) {
    if (!roll) return '';
    if (roll.mode === 'double') return 'Dado ' + roll.face + ' × 2 = ' + C.rollValue(roll);
    if (roll.mode === 'reroll') return 'Nueva tirada: ' + roll.face;
    return 'Dado ' + roll.face;
  }

  function renderTeams() {
    const occupied = new Map();
    for (const team of active()) {
      if (!occupied.has(team.position)) occupied.set(team.position, []);
      occupied.get(team.position).push(team.id);
    }

    for (const team of game.teams) {
      const visible = team.id <= game.count;
      const card = cardElements.get(team.id);
      const ship = shipElements.get(team.id);
      card.hidden = !visible;
      ship.style.display = visible ? '' : 'none';
      if (!visible) continue;

      const primaryName = C.teamName(team);
      const hasTwoNames = team.name && team.shipName && team.name !== team.shipName;
      const fullName = hasTwoNames ? team.name + ', barco ' + team.shipName : primaryName;
      const isSelected = team.id === game.selected;
      const isArrived = atTreasure(team);
      const button = card.querySelector('.crew-select');
      const crewShipName = card.querySelector('.crew-ship-name');

      card.classList.toggle('selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
      button.setAttribute('aria-label', fullName + ', ' + (isArrived ? 'en la isla' : 'casilla ' + team.position + ' de ' + game.routeLength));
      button.title = fullName;
      button.disabled = busy;
      card.querySelector('.crew-name').textContent = primaryName;
      crewShipName.hidden = !hasTwoNames;
      crewShipName.textContent = hasTwoNames ? team.shipName : '';
      card.querySelector('.position').textContent = isArrived ? 'En la isla' : team.position + ' / ' + game.routeLength;
      card.querySelector('.last-roll').textContent = rollLabel(team.lastRoll);
      card.querySelector('.balance').textContent = team.coins;
      card.querySelector('.balance').setAttribute('aria-label', coinText(team.coins));
      const add = card.querySelector('.coin-add');
      add.setAttribute('aria-label', 'Dar una moneda a ' + primaryName);
      add.disabled = busy || team.coins >= 999;
      card.querySelector('.crew-progress span').style.width = (team.position / game.routeLength * 100) + '%';

      const passengers = occupied.get(team.position);
      let [x, y] = routePoints[team.position];
      if (passengers.length > 1) {
        const offset = passengers.indexOf(team.id);
        const angle = -Math.PI / 2 + 2 * Math.PI * offset / passengers.length;
        const radius = passengers.length > 4 ? 50 : 29 + passengers.length * 3;
        x += Math.cos(angle) * radius;
        y += Math.sin(angle) * radius;
      }
      ship.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
      ship.classList.toggle('selected', isSelected);
      ship.setAttribute('aria-pressed', String(isSelected));
      ship.setAttribute('aria-label', fullName + ', casilla ' + team.position + ' de ' + game.routeLength);
      ship.querySelector('title').textContent = fullName;
    }
  }

  function render() {
    drawRoute();
    renderTeams();
    const team = selected();
    const arrived = active().filter(atTreasure).length;
    const distance = game.routeLength - team.position;

    $('selectedName').textContent = C.teamName(team);
    $('selectedPosition').textContent = distance === 0
      ? '¡Esta tripulación ya llegó al tesoro!'
      : (team.position ? 'Casilla ' + team.position : 'En el puerto') +
        ' · ' + distance + (distance === 1 ? ' casilla hasta el tesoro' : ' casillas hasta el tesoro');
    $('rollOutcome').textContent = rollLabel(team.lastRoll);
    $('rollOutcome').hidden = !team.lastRoll || team.lastRoll.mode === 'roll';
    $('selectedCoins').textContent = coinText(team.coins);
    $('upgradeHint').textContent = C.rollProblem(game, team) ||
      (team.coins < C.SHOP.reroll.cost ? 'Necesitas al menos 2 monedas.' : 'Puedes usar un canje en esta tirada.');
    $('roundLabel').textContent = 'Ronda ' + game.round;
    $('routeLengthLabel').textContent = game.routeLength + ' casillas';
    $('arrivalCount').textContent = arrived + ' de ' + game.count + ' en la isla';
    $('chapterLabel').textContent = CHAPTERS[game.chapter];

    $('rollBtn').disabled = busy || atTreasure(team);
    $('roundBtn').disabled = busy || arrived === game.count;
    $('undoBtn').disabled = busy || !history.length;
    $('backBtn').disabled = busy || team.position === 0;
    $('forwardBtn').disabled = busy || atTreasure(team);
    $('rerollBtn').disabled = busy || Boolean(C.buyProblem(game, team, 'reroll'));
    $('doubleBtn').disabled = busy || Boolean(C.buyProblem(game, team, 'double'));
    for (const id of ['shopBtn', 'settingsBtn', 'editNamesBtn', 'routeBtn', 'storyBtn']) $(id).disabled = busy;
    $('treasureBtn').hidden = arrived !== game.count;
    $('treasureBtn').disabled = busy;
    document.body.classList.toggle('is-busy', busy);
    if (!busy) drawDie(team.lastRoll?.face);
  }

  function randomDie() {
    const sample = new Uint32Array(1);
    do { window.crypto.getRandomValues(sample); } while (sample[0] >= 4294967292);
    return sample[0] % 6 + 1;
  }

  async function animateRoll() {
    busy = true;
    render();
    $('die').classList.add('rolling');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wiggle = reducedMotion ? null : setInterval(() => drawDie(randomDie()), 90);
    try {
      await new Promise(resolve => setTimeout(resolve, reducedMotion ? 140 : 640));
    } finally {
      clearInterval(wiggle);
      $('die').classList.remove('rolling');
      busy = false;
    }
  }

  async function roll(all) {
    if (busy) return;
    const moving = (all ? active() : [selected()]).filter(team => !atTreasure(team));
    if (!moving.length) return;
    const dice = Object.fromEntries(moving.map(team => [team.id, randomDie()]));
    await animateRoll();
    if (commit({ type: all ? 'rollAll' : 'roll', dice })) {
      announce(all
        ? 'Ronda ' + game.round + ' completada. Consulta el resultado de cada tripulación.'
        : C.teamName(selected()) + ' sacó ' + dice[selected().id] + ' y avanzó a la casilla ' + selected().position + '.');
    }
  }

  async function useRollUpgrade(key) {
    if (busy) return;
    const team = selected();
    const issue = C.buyProblem(game, team, key);
    if (issue) return;
    const action = { type: 'buy', id: team.id, item: key };
    if (key === 'reroll') {
      action.face = randomDie();
      await animateRoll();
    }
    if (commit(action)) {
      const updated = game.teams[team.id - 1];
      const summary = rollLabel(updated.lastRoll) + (atTreasure(updated) ? ' · ¡En la isla!' : ' · Casilla ' + updated.position);
      toast(summary + ' · −' + coinText(C.SHOP[key].cost));
    }
  }

  function open(id) {
    const dialog = $(id);
    if (!dialog.open) dialog.showModal();
  }

  function confirm(title, message, callback) {
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = message;
    confirmAction = callback;
    open('confirmDialog');
  }

  function loadSettings(focus) {
    $('teamCount').value = game.count;
    $('routeLength').value = game.routeLength;
    for (const team of game.teams) {
      $('name' + team.id).value = team.name;
      $('shipName' + team.id).value = team.shipName;
    }
    updateNameVisibility();
    updateLengthControls();
    open('settingsDialog');
    if (focus) $(focus).focus();
  }

  function updateNameVisibility() {
    $('nameRow7').hidden = $('teamCount').value === '6';
  }

  function updateLengthControls() {
    const length = $('routeLength').valueAsNumber;
    $('lengthDown').disabled = Number.isFinite(length) && length <= C.MIN_STEPS;
    $('lengthUp').disabled = Number.isFinite(length) && length >= C.MAX_STEPS;
  }

  function changeLength(step) {
    const input = $('routeLength');
    input.value = Math.max(C.MIN_STEPS, Math.min(C.MAX_STEPS, Math.trunc(input.valueAsNumber || game.routeLength) + step));
    updateLengthControls();
  }

  function renderScene() {
    const scene = SCENES[scenePreview];
    $('storyTitle').textContent = scene.title;
    $('storyText').textContent = scene.text;
    $('storyTask').textContent = scene.task;
    $('storyArt').src = ASSETS + (scenePreview === 2 ? 'cofre-pirata.webp' : 'barco-pirata.webp');
    document.querySelectorAll('[data-scene]').forEach(button => {
      const active = Number(button.dataset.scene) === scenePreview;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderShop() {
    const team = selected();
    $('shopBalance').textContent = C.teamName(team) + ' · ' + coinText(team.coins);
    $('shopItems').replaceChildren();
    for (const [key, description] of Object.entries(SHOP_TEXT)) {
      const item = C.SHOP[key];
      const button = document.createElement('button');
      button.className = 'shop-item';
      button.disabled = busy || Boolean(C.buyProblem(game, team, key));
      const copy = document.createElement('span');
      const name = document.createElement('strong');
      const detail = document.createElement('small');
      const price = document.createElement('span');
      name.textContent = item.name;
      detail.textContent = description;
      copy.append(name, detail);
      price.className = 'shop-price';
      price.textContent = coinText(item.cost);
      button.append(copy, price);
      button.addEventListener('click', () => {
        if (commit({ type: 'buy', item: key })) {
          renderShop();
          $('shopBalance').focus();
        }
      });
      $('shopItems').appendChild(button);
    }
  }

  function remaining() {
    return timer.deadline ? Math.max(0, timer.deadline - Date.now()) : timer.remaining;
  }

  function renderTimer() {
    const seconds = Math.ceil(remaining() / 1000);
    $('timerValue').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    $('timerBtn').textContent = timer.deadline ? 'Pausar' : 'Iniciar';
    $('timerMinutes').disabled = Boolean(timer.deadline);
    $('timerHint').textContent = seconds === 0 ? 'Ya puedes convocar a las tripulaciones.' : 'El reloj avisa cuándo volver al mapa.';
    document.querySelector('.timer-panel').classList.toggle('timer-ready', seconds === 0);
  }

  loadSavedGame();
  C.COLORS.forEach((color, i) => {
    const id = i + 1;
    addShipMarker(id, color);
    addCrewCard(id, color);
    addNameFields(id, color);
  });

  document.querySelectorAll('[data-close]').forEach(button =>
    button.addEventListener('click', () => button.closest('dialog').close())
  );
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
        dialog.close();
      }
    });
  });

  $('acceptConfirmBtn').addEventListener('click', () => {
    const callback = confirmAction;
    confirmAction = null;
    $('confirmDialog').close();
    if (callback) callback();
  });
  $('cancelConfirmBtn').addEventListener('click', () => $('confirmDialog').close());

  $('rollBtn').addEventListener('click', () => roll(false));
  $('roundBtn').addEventListener('click', () => roll(true));
  $('rerollBtn').addEventListener('click', () => useRollUpgrade('reroll'));
  $('doubleBtn').addEventListener('click', () => useRollUpgrade('double'));
  $('undoBtn').addEventListener('click', () => {
    if (busy || !history.length) return;
    game = history.pop();
    persist();
    render();
    toast('Última acción deshecha.');
  });
  $('backBtn').addEventListener('click', () => commit({ type: 'move', amount: -1 }));
  $('forwardBtn').addEventListener('click', () => commit({ type: 'move', amount: 1 }));
  $('helpBtn').addEventListener('click', () => open('helpDialog'));
  $('treasureBtn').addEventListener('click', () => open('treasureDialog'));
  $('fullscreenBtn').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) {
      toast('No se pudo activar la pantalla completa en este navegador.');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    $('fullscreenBtn').setAttribute('aria-label', document.fullscreenElement ? 'Salir de pantalla completa' : 'Activar pantalla completa');
  });

  $('settingsBtn').addEventListener('click', () => loadSettings());
  $('editNamesBtn').addEventListener('click', () => loadSettings('name' + game.selected));
  $('routeBtn').addEventListener('click', () => loadSettings('routeLength'));
  $('teamCount').addEventListener('change', updateNameVisibility);
  $('routeLength').addEventListener('input', updateLengthControls);
  $('lengthDown').addEventListener('click', () => changeLength(-1));
  $('lengthUp').addEventListener('click', () => changeLength(1));
  $('settingsForm').addEventListener('submit', event => {
    event.preventDefault();
    const names = game.teams.map(team => ({
      name: $('name' + team.id).value,
      shipName: $('shipName' + team.id).value
    }));
    if (commit({ type: 'settings', count: Number($('teamCount').value), routeLength: $('routeLength').valueAsNumber, names })) {
      $('settingsDialog').close();
      toast('Expedición guardada · ' + game.count + ' barcos · ' + game.routeLength + ' casillas.');
    }
  });
  $('resetBtn').addEventListener('click', () => confirm(
    '¿Empezamos una nueva aventura?',
    'Se reiniciarán nombres, posiciones, monedas y reloj. Descarga un respaldo si quieres conservar esta partida.',
    () => {
      game = C.initial();
      history = [];
      timer = initialTimer();
      $('timerMinutes').value = timer.minutes;
      persist();
      render();
      renderTimer();
      $('settingsDialog').close();
      toast('Nueva aventura preparada.');
    }
  ));

  $('storyBtn').addEventListener('click', () => {
    scenePreview = game.chapter;
    renderScene();
    open('storyDialog');
  });
  document.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', () => {
    scenePreview = Number(button.dataset.scene);
    renderScene();
  }));
  $('useSceneBtn').addEventListener('click', () => {
    if (commit({ type: 'chapter', chapter: scenePreview })) $('storyDialog').close();
  });
  $('shopBtn').addEventListener('click', () => {
    renderShop();
    open('shopDialog');
  });
  $('logBtn').addEventListener('click', () => {
    const entries = game.log.length ? game.log : ['Las acciones de la partida aparecerán aquí.'];
    $('logList').replaceChildren(...entries.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
    open('logDialog');
  });

  $('timerMinutes').value = timer.minutes;
  $('timerMinutes').addEventListener('change', () => {
    const value = $('timerMinutes').valueAsNumber;
    if (!Number.isInteger(value) || value < 1 || value > 60) {
      $('timerMinutes').value = timer.minutes;
      toast('Elige un tiempo entre 1 y 60 minutos.');
      return;
    }
    timer = { minutes: value, remaining: value * 60000, deadline: 0 };
    persist();
    renderTimer();
  });
  $('timerBtn').addEventListener('click', () => {
    if (timer.deadline) {
      timer.remaining = remaining();
      timer.deadline = 0;
    } else {
      if (timer.remaining === 0) timer.remaining = timer.minutes * 60000;
      timer.deadline = Date.now() + timer.remaining;
    }
    persist();
    renderTimer();
  });
  $('timerResetBtn').addEventListener('click', () => {
    timer.remaining = timer.minutes * 60000;
    timer.deadline = 0;
    persist();
    renderTimer();
  });
  setInterval(() => {
    if (timer.deadline && remaining() === 0) {
      timer.remaining = 0;
      timer.deadline = 0;
      persist();
      toast('¡Es momento de volver al mapa!');
    }
    renderTimer();
  }, 500);

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(currentBackup(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ruta-del-tesoro-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Respaldo descargado.');
  });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 300000) throw new Error('El archivo es demasiado grande para ser un respaldo de esta aventura.');
      const incoming = C.backup(JSON.parse(await file.text()));
      confirm(
        '¿Abrir este respaldo?',
        'Esta partida reemplazará la del navegador. Puedes descargar antes una copia de la partida actual.',
        () => {
          game = incoming.game;
          history = incoming.history;
          timer = incoming.timer;
          $('timerMinutes').value = timer.minutes;
          persist();
          render();
          renderTimer();
          $('settingsDialog').close();
          toast('Respaldo importado.');
        }
      );
    } catch (error) {
      toast(error instanceof SyntaxError ? 'Ese archivo no contiene un respaldo JSON válido.' : error.message);
    }
  });
  window.addEventListener('storage', event => {
    if (event.key === KEY && event.newValue) toast('La aventura cambió en otra pestaña. Recarga esta página antes de continuar.');
  });

  render();
  renderTimer();
  if (loadWarning) {
    $('saveStatus').textContent = 'Revisa el guardado antes de continuar';
    toast(loadWarning);
  }
})();
