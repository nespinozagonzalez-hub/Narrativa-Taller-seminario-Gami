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
  const SHOP_ICONS = { reroll: 'i-dice', double: 'i-double', steps: 'i-wind', '': 'i-scroll' };
  const PIPS = {
    1: [[27, 27]],
    2: [[14, 14], [40, 40]],
    3: [[14, 14], [27, 27], [40, 40]],
    4: [[14, 14], [40, 14], [14, 40], [40, 40]],
    5: [[14, 14], [40, 14], [27, 27], [14, 40], [40, 40]],
    6: [[14, 12], [40, 12], [14, 27], [40, 27], [14, 42], [40, 42]]
  };
  const ROLL_TIME = 960;
  const STEP_TIME = 235;
  const STEP_PAUSE = 90;
  const listNames = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });
  const routeGuide = $('routeGuide');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  let routeDots = [];
  let routePixels = 0;
  let drawnLength = 0;
  const shipElements = new Map();
  const cardElements = new Map();
  const fleetElements = new Map();
  const SOUND_KEY = 'taller-ruta-tesoro-sonido';
  let soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== 'no'; } catch (_) { /* sin almacenamiento */ }

  // Efectos de sonido sintetizados: no requieren archivos y funcionan sin conexión.
  const sfx = (() => {
    let context;
    function ctx() {
      if (!soundOn) return null;
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      context ??= new Audio();
      if (context.state === 'suspended') context.resume();
      return context;
    }
    function tone(freq, start, length, type = 'sine', volume = .16, slide = 0) {
      const audio = ctx();
      if (!audio) return;
      const at = audio.currentTime + start;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, at + length);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + .012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      osc.connect(gain).connect(audio.destination);
      osc.start(at);
      osc.stop(at + length + .02);
    }
    return {
      tick() { tone(220 + Math.random() * 180, 0, .05, 'square', .05); },
      land() { tone(330, 0, .12, 'triangle', .14); tone(495, .07, .18, 'triangle', .12); },
      step() { tone(180, 0, .09, 'sine', .07, 1.4); },
      coin() { tone(988, 0, .09, 'square', .07); tone(1319, .08, .28, 'square', .07); },
      earn() { tone(660, 0, .1, 'triangle', .12); tone(880, .08, .1, 'triangle', .12); tone(1175, .16, .22, 'triangle', .12); },
      denied() { tone(180, 0, .18, 'sawtooth', .06, .7); },
      fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .12, i === 3 ? .5 : .16, 'triangle', .13)); }
    };
  })();

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
    const notice = $('toast');
    notice.textContent = message;
    if (notice.showPopover && !notice.matches(':popover-open')) notice.showPopover();
    notice.classList.add('visible');
    toastTimeout = setTimeout(() => {
      notice.classList.remove('visible');
      if (notice.hidePopover) notice.hidePopover();
    }, 4800);
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

  function saveAction(next) {
    history.push(game);
    history = history.slice(-30);
    game = next;
    persist();
  }

  function showArrivals(previous) {
    if (previous.routeLength !== game.routeLength) return;
    const arrived = active().filter(team =>
      atTreasure(team) && team.id <= previous.count &&
      previous.teams[team.id - 1].position < game.routeLength
    );
    if (arrived.length) showTreasure(arrived);
  }

  function showTreasure(teams) {
    if (!teams.length) return;
    sfx.fanfare();
    window.TreasureCinema.play({
      names: listNames.format(teams.map(C.teamName)),
      wholeFleet: active().every(atTreasure)
    });
  }

  function commit(action) {
    if (busy) return false;
    try {
      const previous = game;
      saveAction(C.apply(previous, action));
      render();
      showArrivals(previous);
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

  function pointOnRoute(position) {
    const point = routeGuide.getPointAtLength(routePixels * position / drawnLength);
    return [point.x, point.y];
  }

  function drawRoute() {
    if (drawnLength === game.routeLength) return;
    drawnLength = game.routeLength;
    routePixels = routeGuide.getTotalLength();
    const stops = document.createDocumentFragment();
    routePoints = [];
    routeDots = [];
    for (let step = 0; step <= drawnLength; step++) {
      const [x, y] = pointOnRoute(step);
      routePoints.push([x, y]);
      const major = step % 5 === 0 || step === drawnLength;
      routeDots.push(svg('circle', {
        cx: x, cy: y, r: major ? 15 : 6.5,
        class: major ? 'route-dot major' : 'route-dot'
      }, stops));
      if (major) svg('text', { x, y, class: 'route-number' }, stops).textContent = step;
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
      '<span class="balance"></span></div>' +
      '<div class="crew-progress" aria-hidden="true"><span></span></div>';
    card.querySelector('.crew-number').textContent = id;
    card.querySelector('.crew-select').addEventListener('click', () => {
      selectTeam(id);
      $('crewDialog').close();
    });
    $('crewList').appendChild(card);
    cardElements.set(id, card);
  }

  function addFleetChip(id, color) {
    const chip = document.createElement('button');
    chip.className = 'fleet-chip';
    chip.type = 'button';
    chip.style.setProperty('--ship-color', color);
    chip.innerHTML =
      '<span class="crew-number"></span><span class="fleet-copy"><span class="fleet-name"></span>' +
      '<span class="fleet-track"><span></span></span></span>' +
      '<span class="fleet-stats"><span class="fleet-place"></span>' +
      '<span class="fleet-coins"><svg aria-hidden="true"><use href="#i-coin"/></svg><b></b></span></span>' +
      '<svg class="fleet-crown" aria-hidden="true"><use href="#i-crown"/></svg>';
    chip.querySelector('.crew-number').textContent = id;
    chip.addEventListener('click', () => selectTeam(id));
    $('fleetBar').appendChild(chip);
    fleetElements.set(id, chip);
  }

  function ranking() {
    const sorted = active().slice().sort((a, b) => b.position - a.position || b.coins - a.coins);
    const places = new Map();
    sorted.forEach((team, index) => {
      const previous = sorted[index - 1];
      const tie = previous && previous.position === team.position && previous.coins === team.coins;
      places.set(team.id, tie ? places.get(previous.id) : index + 1);
    });
    return places;
  }

  function renderFleet(positions) {
    const places = ranking();
    const anyMoved = active().some(team => team.position > 0);
    $('fleetBar').style.setProperty('--fleet-count', game.count);
    for (const team of game.teams) {
      const chip = fleetElements.get(team.id);
      const visible = team.id <= game.count;
      chip.hidden = !visible;
      if (!visible) continue;
      const position = positions?.get(team.id) ?? team.position;
      const place = places.get(team.id);
      const arrived = position === game.routeLength;
      const isSelected = team.id === game.selected;
      chip.classList.toggle('selected', isSelected);
      chip.classList.toggle('arrived', arrived);
      chip.classList.toggle('leader', anyMoved && place === 1);
      chip.disabled = busy;
      chip.setAttribute('aria-pressed', String(isSelected));
      chip.querySelector('.fleet-name').textContent = C.teamName(team);
      chip.querySelector('.fleet-track span').style.width = (position / game.routeLength * 100) + '%';
      chip.querySelector('.fleet-place').textContent = arrived ? 'Isla' : place + 'º';
      chip.querySelector('.fleet-coins b').textContent = team.coins;
      chip.setAttribute('aria-label', C.teamName(team) + ', ' + (arrived ? 'en la isla' : 'puesto ' + place +
        ', casilla ' + position + ' de ' + game.routeLength) + ', ' + coinText(team.coins));
      chip.title = C.teamName(team);
    }
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

  function drawDie(face, die = $('die')) {
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

  function fleetPositions(teams) {
    return new Map(teams.map(team => [team.id, team.position]));
  }

  function fleetOffsets(positions) {
    const occupied = new Map();
    for (const [id, position] of positions) {
      if (!occupied.has(position)) occupied.set(position, []);
      occupied.get(position).push(id);
    }
    const offsets = new Map();
    for (const ships of occupied.values()) {
      const radius = ships.length > 4 ? 50 : 29 + ships.length * 3;
      ships.forEach((id, index) => {
        const angle = -Math.PI / 2 + 2 * Math.PI * index / ships.length;
        offsets.set(id, ships.length === 1 ? [0, 0] : [Math.cos(angle) * radius, Math.sin(angle) * radius]);
      });
    }
    return offsets;
  }

  function placeShip(id, position, dx, dy) {
    const [x, y] = routePoints[position] || pointOnRoute(position);
    shipElements.get(id).setAttribute('transform', 'translate(' + (x + dx).toFixed(1) + ' ' + (y + dy).toFixed(1) + ')');
  }

  function showCrewPosition(card, position) {
    card.querySelector('.position').textContent =
      position === game.routeLength ? 'En la isla' : position + ' / ' + game.routeLength;
    card.querySelector('.crew-progress span').style.width = (position / game.routeLength * 100) + '%';
  }

  function renderTeams() {
    const positions = fleetPositions(active());
    const offsets = fleetOffsets(positions);
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
      showCrewPosition(card, team.position);
      card.querySelector('.last-roll').textContent = rollLabel(team.lastRoll);
      card.querySelector('.balance').textContent = team.coins;
      card.querySelector('.balance').setAttribute('aria-label', coinText(team.coins));
      placeShip(team.id, team.position, ...offsets.get(team.id));
      ship.classList.toggle('selected', isSelected);
      ship.setAttribute('tabindex', busy ? -1 : 0);
      ship.setAttribute('aria-pressed', String(isSelected));
      ship.setAttribute('aria-disabled', String(busy));
      ship.setAttribute('aria-label', fullName + ', casilla ' + team.position + ' de ' + game.routeLength);
      ship.querySelector('title').textContent = fullName;
    }
  }

  function showSelectedPosition(position) {
    const distance = game.routeLength - position;
    $('selectedPosition').textContent = distance === 0
      ? '¡Esta tripulación ya llegó al tesoro!'
      : (position ? 'Casilla ' + position : 'En el puerto') +
        ' · ' + distance + (distance === 1 ? ' casilla hasta el tesoro' : ' casillas hasta el tesoro');
  }

  function render() {
    drawRoute();
    renderTeams();
    renderFleet();
    const team = selected();
    const arrived = active().filter(atTreasure).length;

    $('selectedName').textContent = C.teamName(team);
    showSelectedPosition(team.position);
    $('rollOutcome').textContent = rollLabel(team.lastRoll);
    $('rollOutcome').hidden = !team.lastRoll || team.lastRoll.mode === 'roll';
    $('selectedCoins').textContent = team.coins;
    $('shopBtn').setAttribute('aria-label', 'Tienda de canjes · ' + C.teamName(team) + ' tiene ' + coinText(team.coins));
    $('coinTeam').textContent = C.teamName(team) + ' · ' + coinText(team.coins);
    $('adjustTeam').textContent = C.teamName(team) + ' · ' +
      (atTreasure(team) ? 'En la isla' : 'Casilla ' + team.position + ' de ' + game.routeLength);
    $('roundLabel').textContent = 'Ronda ' + game.round;
    $('routeLengthLabel').textContent = game.routeLength + ' casillas';
    $('arrivalCount').textContent = arrived + ' de ' + game.count + ' en la isla';
    $('chapterLabel').textContent = CHAPTERS[game.chapter];

    $('rollBtn').disabled = busy || atTreasure(team);
    $('roundBtn').disabled = busy || arrived === game.count;
    $('undoBtn').disabled = busy || !history.length;
    $('backBtn').disabled = busy || team.position === 0;
    $('forwardBtn').disabled = busy || atTreasure(team);
    $('coinMinusBtn').disabled = busy || team.coins === 0;
    $('coinPlusBtn').disabled = busy || team.coins >= 999;
    $('coinAllBtn').disabled = busy;
    for (const id of ['crewBtn', 'optionsBtn', 'shopBtn', 'timerBadge', 'resetBtn']) {
      $(id).disabled = busy;
    }
    $('treasureBtn').hidden = arrived === 0;
    $('treasureBtn').disabled = busy;
    document.body.classList.toggle('is-busy', busy);
    if (!busy) drawDie(team.lastRoll?.face);
  }

  function randomDie() {
    const sample = new Uint32Array(1);
    do { window.crypto.getRandomValues(sample); } while (sample[0] >= 4294967292);
    return sample[0] % 6 + 1;
  }

  function showRoundResults(teams) {
    const list = $('roundResults');
    list.replaceChildren(...teams.map(team => {
      const entry = document.createElement('li');
      const name = document.createElement('span');
      const face = document.createElement('strong');
      entry.style.setProperty('--ship-color', C.COLORS[team.id - 1]);
      name.textContent = C.teamName(team);
      face.textContent = team.lastRoll.face;
      entry.append(name, face);
      return entry;
    }));
    list.hidden = false;
  }

  function describeRoll(before, after) {
    const roll = after.lastRoll;
    const distance = after.position - before.position;
    const result = roll.mode === 'double'
      ? roll.face + ' × 2 = ' + C.rollValue(roll)
      : roll.mode === 'reroll' ? 'Salió ' + roll.face + ' en vez de ' + before.lastRoll.face : 'Salió ' + roll.face;
    if (distance === 0) return result + ' · Se queda en la misma casilla';
    const steps = Math.abs(distance);
    const movement = (distance > 0 ? 'Avanza ' : 'Retrocede ') + steps + (steps === 1 ? ' casilla' : ' casillas');
    return result + ' · ' + movement;
  }

  async function revealDice(previous, teamIds, mode) {
    const overlay = $('rollOverlay');
    const stage = overlay.firstElementChild;
    const die = $('largeDie');
    const teams = teamIds.map(id => game.teams[id - 1]);
    const lead = teams.find(team => team.id === game.selected) || teams[0];
    const isRound = mode === 'rollAll';
    const label = { roll: 'Lanzamiento del dado', rollAll: 'Ronda ' + game.round, double: 'Tirada duplicada', reroll: 'Nueva tirada' };
    const rolling = mode !== 'double' && !reduceMotion.matches;
    $('rollStageLabel').textContent = label[mode];
    $('rollStageTeam').textContent = C.teamName(lead);
    $('rollStageResult').textContent = rolling ? 'Lanzando…' : '';
    $('roundResults').hidden = true;
    drawDie(rolling ? randomDie() : lead.lastRoll.face, die);
    overlay.hidden = false;
    let faces;
    try {
      if (rolling) {
        stage.classList.add('rolling');
        faces = setInterval(() => { drawDie(randomDie(), die); sfx.tick(); }, 95);
        await wait(ROLL_TIME);
        clearInterval(faces);
        stage.classList.remove('rolling');
      }
      drawDie(lead.lastRoll.face, die);
      stage.classList.add('revealed');
      sfx.land();
      const result = describeRoll(previous.teams[lead.id - 1], lead);
      $('rollStageResult').textContent = isRound ? 'Salió ' + lead.lastRoll.face : result;
      if (isRound) showRoundResults(teams);
      announce(isRound ? 'Ronda ' + game.round + '. ' +
        teams.map(team => C.teamName(team) + ' sacó ' + team.lastRoll.face).join('. ') : C.teamName(lead) + '. ' + result);
      await wait(isRound ? 1600 : 1040);
    } finally {
      clearInterval(faces);
      stage.classList.remove('rolling', 'revealed');
      overlay.hidden = true;
    }
  }

  function glideOneStep(start, end) {
    const startOffsets = fleetOffsets(start);
    const endOffsets = fleetOffsets(end);
    return new Promise(resolve => {
      let startedAt;
      function frame(time) {
        startedAt ??= time;
        const fraction = Math.min(1, (time - startedAt) / STEP_TIME);
        const ease = fraction * fraction * (3 - 2 * fraction);
        for (const [id, from] of start) {
          const [x0, y0] = startOffsets.get(id);
          const [x1, y1] = endOffsets.get(id);
          placeShip(id, from + (end.get(id) - from) * ease, x0 + (x1 - x0) * ease, y0 + (y1 - y0) * ease);
        }
        if (fraction === 1 || document.hidden) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  async function sailFleet(previous, mode) {
    let positions = fleetPositions(previous.teams.slice(0, previous.count));
    const targets = fleetPositions(active());
    const steps = Math.max(...Array.from(positions, ([id, from]) => Math.abs(targets.get(id) - from)));
    const captain = mode === 'rollAll' ? 'Flota en movimiento' : C.teamName(selected());
    if (!steps) return;
    for (const [id, position] of positions) {
      shipElements.get(id).classList.toggle('sailing', position !== targets.get(id));
    }
    drawDie(selected().lastRoll?.face);
    $('mapMessage').hidden = reduceMotion.matches || document.hidden;
    for (let step = 1; step <= steps && !document.hidden && !reduceMotion.matches; step++) {
      const next = new Map(Array.from(positions, ([id, from]) => [id, from + Math.sign(targets.get(id) - from)]));
      const touched = new Set(Array.from(next).filter(([id, stop]) => stop !== positions.get(id)).map(([, stop]) => stop));
      $('mapMessage').textContent = captain + ' · Paso ' + step + ' de ' + steps;
      await glideOneStep(positions, next);
      for (const stop of touched) routeDots[stop].classList.add('current-step');
      for (const [id, stop] of next) showCrewPosition(cardElements.get(id), stop);
      renderFleet(next);
      sfx.step();
      showSelectedPosition(next.get(game.selected));
      await wait(STEP_PAUSE);
      for (const stop of touched) routeDots[stop].classList.remove('current-step');
      positions = next;
    }
  }

  async function playDice(action, teamIds, mode, showDice = true) {
    const previous = game;
    let next;
    try {
      next = C.apply(previous, action);
    } catch (error) {
      toast(error.message);
      return false;
    }
    const trigger = document.activeElement;
    busy = true;
    render();
    saveAction(next);
    try {
      if (showDice) await revealDice(previous, teamIds, mode);
      await sailFleet(previous, mode);
    } finally {
      $('mapMessage').hidden = true;
      for (const ship of shipElements.values()) ship.classList.remove('sailing');
      busy = false;
      render();
      if (document.activeElement === document.body && trigger && !trigger.disabled) trigger.focus({ preventScroll: true });
      showArrivals(previous);
    }
    return true;
  }

  async function roll(all) {
    if (busy) return;
    const moving = (all ? active() : [selected()]).filter(team => !atTreasure(team));
    if (!moving.length) return;
    const dice = Object.fromEntries(moving.map(team => [team.id, randomDie()]));
    const type = all ? 'rollAll' : 'roll';
    await playDice({ type, dice }, moving.map(team => team.id), type);
  }

  function coinBurst(cost, origin) {
    const purse = $('shopPurse');
    purse.classList.remove('spent');
    void purse.offsetWidth;
    purse.classList.add('spent');
    if (!cost || reduceMotion.matches) return;
    const float = document.createElement('span');
    float.className = 'coin-float';
    float.textContent = '−' + cost;
    purse.appendChild(float);
    setTimeout(() => float.remove(), 1100);
    if (!origin) return;
    const from = origin.getBoundingClientRect();
    const to = purse.getBoundingClientRect();
    for (let i = 0; i < Math.min(cost, 6); i++) {
      const coin = document.createElement('span');
      coin.className = 'flying-coin';
      coin.style.left = (from.right - 40) + 'px';
      coin.style.top = (from.top + from.height / 2 - 10) + 'px';
      coin.style.setProperty('--dx', (to.left + to.width / 2 - from.right + 40) + 'px');
      coin.style.setProperty('--dy', (to.top + to.height / 2 - from.top - from.height / 2) + 'px');
      coin.style.animationDelay = (i * 70) + 'ms';
      $('shopDialog').appendChild(coin);
      setTimeout(() => coin.remove(), 900 + i * 70);
    }
  }

  async function spend(key, button) {
    if (busy) return;
    const team = selected();
    const item = C.SHOP[key];
    const issue = C.buyProblem(game, team, key);
    if (issue) {
      sfx.denied();
      toast(issue);
      return;
    }
    sfx.coin();
    if (!item.roll && !item.steps) {
      if (commit({ type: 'buy', item: key })) {
        renderShop();
        coinBurst(item.cost, $('shopItems').querySelector('[data-item="' + key + '"]'));
        const card = $('shopItems').querySelector('[data-item="' + key + '"]');
        card?.classList.add('bought');
        toast('¡Canje! ' + C.teamName(team) + ' · ' + item.name + (item.cost ? ' · −' + coinText(item.cost) : ''));
      }
      return;
    }
    coinBurst(item.cost, button);
    const action = { type: 'buy', id: team.id, item: key };
    if (item.effect === 'reroll') action.face = randomDie();
    await wait(reduceMotion.matches ? 0 : 450);
    $('shopDialog').close();
    if (await playDice(action, [team.id], item.effect || 'steps', item.roll) && !$('treasureDialog').open) {
      const updated = game.teams[team.id - 1];
      const summary = (item.roll ? rollLabel(updated.lastRoll) : item.name) + ' · Casilla ' + updated.position;
      toast(summary + (item.cost ? ' · −' + coinText(item.cost) : ''));
    }
  }

  function open(id) {
    const dialog = $(id);
    if (dialog.open) return;
    if (id !== 'confirmDialog') {
      document.querySelectorAll('dialog[open]').forEach(current => current.close());
    }
    dialog.showModal();
  }

  function setProjection(active) {
    document.body.classList.toggle('is-projecting', active);
    const label = active ? 'Salir de pantalla completa' : 'Activar pantalla completa';
    $('fullscreenBtn').setAttribute('aria-label', label);
    $('fullscreenBtn').title = label;
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
    const count = Number($('teamCount').value);
    for (const team of game.teams) {
      $('nameRow' + team.id).hidden = team.id > count;
    }
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
    $('shopTeam').textContent = C.teamName(team);
    $('shopBalance').textContent = team.coins;
    $('shopBalance').setAttribute('aria-label', coinText(team.coins));
    $('shopPurse').style.setProperty('--ship-color', C.COLORS[team.id - 1]);
    $('shopCrews').replaceChildren(...active().map(crew => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'crew-number shop-crew';
      button.textContent = crew.id;
      button.style.setProperty('--ship-color', C.COLORS[crew.id - 1]);
      button.title = C.teamName(crew);
      button.setAttribute('aria-label', C.teamName(crew) + ', ' + coinText(crew.coins));
      button.setAttribute('aria-pressed', String(crew.id === team.id));
      button.addEventListener('click', () => {
        selectTeam(crew.id);
        renderShop();
      });
      return button;
    }));
    $('shopItems').replaceChildren(...Object.entries(C.SHOP).map(([key, item]) => {
      const problem = C.buyProblem(game, team, key);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shop-card';
      button.dataset.item = key;
      button.dataset.effect = item.effect || 'none';
      button.classList.toggle('locked', Boolean(problem));
      button.setAttribute('aria-disabled', String(Boolean(problem) || busy));
      button.innerHTML =
        '<span class="shop-icon" aria-hidden="true"><svg><use href="#' + SHOP_ICONS[item.effect] + '"/></svg></span>' +
        '<span class="shop-copy"><strong></strong><small></small></span>' +
        '<span class="shop-price"><svg aria-hidden="true"><use href="#i-coin"/></svg><b></b></span>' +
        '<span class="shop-lock"></span>';
      button.querySelector('strong').textContent = item.name;
      button.querySelector('small').textContent = item.description;
      button.querySelector('small').hidden = !item.description;
      button.querySelector('.shop-price b').textContent = item.cost || 'Gratis';
      button.querySelector('.shop-lock').textContent = problem;
      button.setAttribute('aria-label', item.name + ', ' + (item.cost ? coinText(item.cost) : 'gratis') +
        (problem ? '. No disponible: ' + problem : ''));
      button.addEventListener('click', () => spend(key, button));
      return button;
    }));
  }

  function remaining() {
    return timer.deadline ? Math.max(0, timer.deadline - Date.now()) : timer.remaining;
  }

  function renderTimer() {
    const seconds = Math.ceil(remaining() / 1000);
    const ready = seconds === 0;
    const time = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    $('timerValue').textContent = time;
    $('timerBtn').textContent = timer.deadline ? 'Pausar' : 'Iniciar';
    $('timerMinutes').disabled = Boolean(timer.deadline);
    $('timerHint').textContent = ready ? 'Ya puedes convocar a las tripulaciones.' : 'El reloj avisa cuándo volver al mapa.';
    document.querySelector('.timer-panel').classList.toggle('timer-ready', ready);
    $('timerBadge').hidden = !timer.deadline && !ready;
    $('timerBadge').classList.toggle('timer-ready', ready);
    $('timerBadgeValue').textContent = ready ? 'Hora de lanzar' : time;
  }

  loadSavedGame();
  C.COLORS.forEach((color, i) => {
    const id = i + 1;
    addShipMarker(id, color);
    addCrewCard(id, color);
    addNameFields(id, color);
    addFleetChip(id, color);
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
  $('coinPlusBtn').addEventListener('click', () => {
    if (commit({ type: 'coin', amount: 1 })) sfx.earn();
  });
  $('coinMinusBtn').addEventListener('click', () => commit({ type: 'coin', amount: -1 }));
  $('coinAllBtn').addEventListener('click', () => {
    if (commit({ type: 'coinAll', amount: 1 })) {
      sfx.earn();
      toast('Toda la flota recibe +1 moneda.');
    }
  });
  function renderSound() {
    const label = soundOn ? 'Sonido activado' : 'Sonido desactivado';
    $('soundBtn').setAttribute('aria-pressed', String(soundOn));
    $('soundBtn').setAttribute('aria-label', label);
    $('soundBtn').title = label;
    $('soundBtn').querySelector('use').setAttribute('href', soundOn ? '#i-sound' : '#i-mute');
  }
  $('soundBtn').addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem(SOUND_KEY, soundOn ? 'si' : 'no'); } catch (_) { /* sin almacenamiento */ }
    renderSound();
    if (soundOn) sfx.coin();
  });
  renderSound();
  $('undoBtn').addEventListener('click', () => {
    if (busy || !history.length) return;
    game = history.pop();
    persist();
    render();
    toast('Última acción deshecha.');
  });
  $('backBtn').addEventListener('click', () => commit({ type: 'move', amount: -1 }));
  $('forwardBtn').addEventListener('click', () => commit({ type: 'move', amount: 1 }));
  $('crewBtn').addEventListener('click', () => open('crewDialog'));
  $('optionsBtn').addEventListener('click', () => open('optionsDialog'));
  $('cinemaPreviewBtn').addEventListener('click', () => showTreasure([selected()]));
  $('helpBtn').addEventListener('click', () => open('helpDialog'));
  $('timerOpenBtn').addEventListener('click', () => open('timerDialog'));
  $('timerBadge').addEventListener('click', () => open('timerDialog'));
  $('treasureBtn').addEventListener('click', () => showTreasure(active().filter(atTreasure)));
  $('fullscreenBtn').addEventListener('click', async () => {
    const activate = !document.body.classList.contains('is-projecting');
    setProjection(activate);
    try {
      if (activate) await document.documentElement.requestFullscreen?.();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch (_) {
      // La vista de proyección ocupa toda la ventana aunque el navegador bloquee la API.
    }
  });
  document.addEventListener('fullscreenchange', () => setProjection(Boolean(document.fullscreenElement)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.fullscreenElement && !document.querySelector('dialog[open]')) {
      setProjection(false);
    }
  });

  $('settingsBtn').addEventListener('click', () => loadSettings());
  $('editNamesBtn').addEventListener('click', () => loadSettings('name' + game.selected));
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
  function requestRestart() {
    if (busy) return;
    confirm(
      '¿Reiniciar la aventura?',
      'Todos los barcos volverán al puerto. Se restablecerán los nombres, las 25 casillas, las 3 monedas iniciales y el reloj. Descarga un respaldo si quieres conservar esta partida.',
      () => {
        window.TreasureCinema.close();
        document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
        game = C.initial();
        history = [];
        timer = initialTimer();
        $('timerMinutes').value = timer.minutes;
        persist();
        render();
        renderTimer();
        toast('Nueva aventura preparada.');
      }
    );
  }
  $('resetBtn').addEventListener('click', requestRestart);
  $('cinemaRestartBtn').addEventListener('click', requestRestart);

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
  if (C.SHOP_ERROR) {
    $('shopWarning').textContent = C.SHOP_ERROR;
    $('shopWarning').hidden = false;
    console.warn(C.SHOP_ERROR);
  }
  if (loadWarning) {
    $('saveStatus').textContent = 'Revisa el guardado antes de continuar';
    toast(loadWarning);
  }
})();
