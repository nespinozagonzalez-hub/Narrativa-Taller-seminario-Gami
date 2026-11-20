(function (root) {
  'use strict';
  const STEPS = 24;
  const NAMES = ['El Cormorán', 'La Brújula', 'La Sirena', 'El Horizonte', 'La Marea', 'El Albatros', 'La Estrella'];
  const COLORS = ['#f9c66b', '#fb8b7c', '#7bd9d3', '#c9b1ff', '#aed58a', '#8fbff5', '#f1abd1'];
  const SHOP = {
    hint: { name: 'Pista extra', cost: 1 },
    example: { name: 'Ejemplo de apoyo', cost: 2 },
    consult: { name: 'Consulta breve', cost: 3 },
    wind: { name: 'Viento a favor', cost: 3, steps: 2 }
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  function initial() {
    return { version: 1, count: 7, selected: 1, round: 0, chapter: 0,
      teams: NAMES.map((name, i) => ({ id: i + 1, name, position: 0, coins: 3, lastDice: 0 })), log: [] };
  }
  function validate(input) {
    if (!input || input.version !== 1 || ![6, 7].includes(input.count) ||
        !integer(input.selected, 1, input.count) || !integer(input.round, 0, 10000) ||
        !integer(input.chapter, 0, 2) || !Array.isArray(input.teams) || input.teams.length !== 7) {
      throw new Error('El respaldo no tiene el formato de esta aventura.');
    }
    const game = initial();
    for (let i = 0; i < 7; i++) {
      const t = input.teams[i];
      if (!t || t.id !== i + 1 || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 28 ||
          !integer(t.position, 0, STEPS) || !integer(t.coins, 0, 999) || !integer(t.lastDice, 0, 6)) {
        throw new Error('El respaldo contiene datos de tripulación que no son válidos.');
      }
      game.teams[i] = { id: i + 1, name: t.name.trim(), position: t.position, coins: t.coins, lastDice: t.lastDice };
    }
    game.count = input.count; game.selected = input.selected; game.round = input.round; game.chapter = input.chapter;
    if (input.log !== undefined && (!Array.isArray(input.log) || input.log.some(x => typeof x !== 'string'))) {
      throw new Error('La bitácora del respaldo no es válida.');
    }
    game.log = (input.log || []).slice(0, 40).map(x => x.slice(0, 1000));
    return game;
  }
  function apply(source, action) {
    const game = validate(source);
    const active = game.teams.slice(0, game.count);
    const t = active.find(x => x.id === (action.id || game.selected));
    const record = text => { game.log.unshift(text); game.log = game.log.slice(0, 40); };
    if (action.type === 'roll' || action.type === 'rollAll') {
      const moving = action.type === 'rollAll' ? active.filter(x => x.position < STEPS) : [t];
      if (!moving.length || !t) throw new Error('Todas las tripulaciones ya llegaron.');
      const messages = [];
      for (const ship of moving) {
        if (ship.position === STEPS) throw new Error('Esta tripulación ya llegó al tesoro.');
        const result = action.dice && action.dice[ship.id];
        if (!integer(result, 1, 6)) throw new Error('La tirada debe ser un número entre 1 y 6.');
        ship.position = Math.min(STEPS, ship.position + result);
        ship.lastDice = result;
        messages.push(ship.name + ' · dado ' + result + ' · casilla ' + ship.position);
      }
      if (action.type === 'rollAll') game.round++;
      record((action.type === 'rollAll' ? 'Ronda ' + game.round + ': ' : '') + messages.join(' / '));
    } else if (action.type === 'coin') {
      if (!t || !integer(action.amount, -999, 999) || !integer(t.coins + action.amount, 0, 999)) {
        throw new Error('El saldo debe quedar entre 0 y 999 monedas.');
      }
      t.coins += action.amount;
      record(t.name + ': ' + (action.amount >= 0 ? '+' : '') + action.amount + ' monedas.');
    } else if (action.type === 'buy') {
      const item = SHOP[action.item];
      if (!t || !item) throw new Error('Elige un canje disponible.');
      if (t.coins < item.cost) throw new Error('Esta tripulación no tiene suficientes monedas.');
      if (item.steps && t.position === STEPS) throw new Error('Esta tripulación ya está en la isla.');
      t.coins -= item.cost;
      if (item.steps) t.position = Math.min(STEPS, t.position + item.steps);
      record(t.name + ': ' + item.name + ' · −' + item.cost + ' monedas.');
    } else if (action.type === 'move') {
      if (!t || !integer(action.amount, -STEPS, STEPS)) throw new Error('Movimiento no válido.');
      t.position = Math.max(0, Math.min(STEPS, t.position + action.amount));
      record(t.name + ': ajuste a la casilla ' + t.position + '.');
    } else if (action.type === 'settings') {
      if (![6, 7].includes(action.count) || !Array.isArray(action.names) || action.names.length !== 7 ||
          action.names.some(x => typeof x !== 'string' || !x.trim() || x.length > 28)) {
        throw new Error('Completa los nombres de las siete tripulaciones, con hasta 28 caracteres.');
      }
      game.count = action.count;
      game.selected = Math.min(game.selected, game.count);
      game.teams.forEach((ship, i) => { ship.name = action.names[i].trim(); });
      record('Tripulaciones actualizadas: ' + game.count + ' barcos en el mapa.');
    } else if (action.type === 'chapter') {
      if (!integer(action.chapter, 0, 2)) throw new Error('Capítulo no válido.');
      game.chapter = action.chapter;
    } else throw new Error('Acción no reconocida.');
    return validate(game);
  }
  function backup(input) {
    if (!input || input.app !== 'ruta-del-tesoro' || input.version !== 1) {
      throw new Error('Selecciona un respaldo de La ruta del tesoro.');
    }
    const game = validate(input.game);
    if (!Array.isArray(input.history) || input.history.length > 30) throw new Error('El historial no es válido.');
    const history = input.history.map(validate);
    let timer = { minutes: 15, remaining: 900000, deadline: 0 };
    if (input.timer) {
      const v = input.timer;
      if (!integer(v.minutes, 1, 60) || !Number.isFinite(v.remaining) || v.remaining < 0 || v.remaining > 3600000 ||
          !Number.isFinite(v.deadline) || v.deadline < 0) throw new Error('El reloj del respaldo no es válido.');
      timer = { minutes: v.minutes, remaining: Math.floor(v.remaining), deadline: v.deadline };
    }
    return { app: 'ruta-del-tesoro', version: 1, game, history, timer };
  }
  const api = { STEPS, NAMES, COLORS, SHOP, initial, validate, apply, backup, clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Treasure = api;
})(typeof window === 'undefined' ? globalThis : window);
