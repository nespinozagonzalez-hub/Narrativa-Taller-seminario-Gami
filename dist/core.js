(function (root) {
  'use strict';

  const VERSION = 2;
  const OLD_STEPS = 24;
  const STEPS = 25;
  const MIN_STEPS = 6;
  const MAX_STEPS = 40;
  const MAX_NAME = 28;
  const NAMES = ['El Cormorán', 'La Brújula', 'La Sirena', 'El Horizonte', 'La Marea', 'El Albatros', 'La Estrella'];
  const COLORS = ['#f9c66b', '#fb8b7c', '#7bd9d3', '#c9b1ff', '#aed58a', '#8fbff5', '#f1abd1'];
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const DEFAULT_TABLE = [
    { id: 'reroll', nombre: 'Volver a tirar', precio: 2, efecto: 'volver-a-tirar',
      descripcion: 'Repite la última tirada. Vale el nuevo resultado, aunque sea menor.' },
    { id: 'double', nombre: 'Duplicar tirada', precio: 3, efecto: 'duplicar',
      descripcion: 'El valor que salió en el dado se multiplica por dos.' },
    { id: 'wind', nombre: 'Viento a favor', precio: 3, efecto: 'avanzar', casillas: 2,
      descripcion: 'Avanza dos casillas hacia la isla.' },
    { id: 'hint', nombre: 'Pista extra', precio: 1, descripcion: 'Una orientación adicional para la misión.' },
    { id: 'example', nombre: 'Ejemplo de apoyo', precio: 2, descripcion: 'Un ejemplo que puedan adaptar a su propuesta.' },
    { id: 'consult', nombre: 'Consulta breve', precio: 3, descripcion: 'Dos minutos para revisar una idea con el relator.' }
  ];
  const EFFECTS = { 'volver-a-tirar': 'reroll', duplicar: 'double', avanzar: 'steps' };

  // Convierte la tabla de canjes (dist/canjes.js) en el catálogo que usa el juego.
  function buildShop(table) {
    if (!Array.isArray(table) || !table.length || table.length > 30) {
      throw new Error('La tabla de canjes debe tener entre 1 y 30 canjes.');
    }
    const shop = {};
    table.forEach((row, i) => {
      const where = 'Canje ' + (i + 1) + ': ';
      if (!row || typeof row.id !== 'string' || !/^[a-z0-9-]{1,30}$/i.test(row.id) || Object.hasOwn(shop, row.id)) {
        throw new Error(where + 'el id debe ser único y usar solo letras, números o guiones.');
      }
      if (typeof row.nombre !== 'string' || !row.nombre.trim() || row.nombre.length > 40) {
        throw new Error(where + 'escribe un nombre de hasta 40 caracteres.');
      }
      if (!integer(row.precio, 0, 99)) throw new Error(where + 'el precio debe ser un entero entre 0 y 99.');
      if (row.descripcion !== undefined && (typeof row.descripcion !== 'string' || row.descripcion.length > 160)) {
        throw new Error(where + 'la descripción debe tener hasta 160 caracteres.');
      }
      const effect = row.efecto === undefined || row.efecto === '' ? '' : EFFECTS[row.efecto];
      if (effect === undefined) throw new Error(where + 'el efecto "' + row.efecto + '" no existe.');
      if (effect === 'steps' && !integer(row.casillas, 1, 10)) {
        throw new Error(where + 'indica entre 1 y 10 casillas para avanzar.');
      }
      shop[row.id] = Object.freeze({
        name: row.nombre.trim(),
        cost: row.precio,
        description: (row.descripcion || '').trim(),
        effect,
        roll: effect === 'reroll' || effect === 'double',
        steps: effect === 'steps' ? row.casillas : 0
      });
    });
    return Object.freeze(shop);
  }

  let SHOP = buildShop(DEFAULT_TABLE);
  let SHOP_ERROR = '';
  if (root.TABLA_CANJES !== undefined) {
    try {
      SHOP = buildShop(root.TABLA_CANJES);
    } catch (error) {
      SHOP_ERROR = 'La tabla de canjes tiene un error (' + error.message + ') Se usa la tabla de ejemplo.';
    }
  }

  const clone = value => JSON.parse(JSON.stringify(value));
  const teamName = team => team.name || team.shipName;
  const spent = cost => cost ? '−' + cost + (cost === 1 ? ' moneda.' : ' monedas.') : 'sin costo.';
  const rollValue = roll => roll.face * (roll.mode === 'double' ? 2 : 1);

  function initial() {
    return {
      version: VERSION,
      routeLength: STEPS,
      count: 7,
      selected: 1,
      round: 0,
      chapter: 0,
      teams: NAMES.map((name, i) => ({ id: i + 1, name, shipName: '', position: 0, coins: 3, lastRoll: null })),
      log: []
    };
  }

  function namesFor(input, index) {
    if (typeof input?.name !== 'string' || typeof input?.shipName !== 'string' ||
        input.name.length > MAX_NAME || input.shipName.length > MAX_NAME) {
      throw new Error('Escribe nombres de hasta 28 caracteres.');
    }
    const name = input.name.trim();
    const shipName = input.shipName.trim();
    return { name: name || (shipName ? '' : NAMES[index]), shipName };
  }

  function checkedRoll(roll, position, limit) {
    if (roll === null) return null;
    if (!roll || !integer(roll.face, 1, 6) || !['roll', 'reroll', 'double'].includes(roll.mode) ||
        (roll.from !== null && (!integer(roll.from, 0, limit - 1) ||
          Math.min(limit, roll.from + rollValue(roll)) !== position))) {
      throw new Error('El respaldo contiene una tirada que no es válida.');
    }
    return { from: roll.from, face: roll.face, mode: roll.mode };
  }

  function validate(input) {
    if (!input || ![1, VERSION].includes(input.version) || !integer(input.count, 2, 7) ||
        !integer(input.selected, 1, input.count) || !integer(input.round, 0, 10000) ||
        !integer(input.chapter, 0, 2) || !Array.isArray(input.teams) || input.teams.length !== 7) {
      throw new Error('El respaldo no tiene el formato de esta aventura.');
    }
    const old = input.version === 1;
    const routeLength = old ? STEPS : input.routeLength;
    if (!integer(routeLength, MIN_STEPS, MAX_STEPS)) throw new Error('El largo del recorrido no es válido.');
    const limit = old ? OLD_STEPS : routeLength;

    const teams = input.teams.map((team, i) => {
      if (!team || team.id !== i + 1 || !integer(team.position, 0, limit) || !integer(team.coins, 0, 999) ||
          (old && (!integer(team.lastDice, 0, 6) || typeof team.name !== 'string' || !team.name.trim()))) {
        throw new Error('El respaldo contiene datos de tripulación que no son válidos.');
      }
      const position = old && team.position === OLD_STEPS ? routeLength : team.position;
      const lastRoll = old
        ? (team.lastDice ? { from: null, face: team.lastDice, mode: 'roll' } : null)
        : checkedRoll(team.lastRoll, position, routeLength);
      const names = namesFor(old ? { name: team.name, shipName: '' } : team, i);
      return { id: team.id, ...names, position, coins: team.coins, lastRoll };
    });

    if (input.log !== undefined && (!Array.isArray(input.log) || input.log.some(entry => typeof entry !== 'string'))) {
      throw new Error('La bitácora del respaldo no es válida.');
    }
    const log = (input.log || []).slice(0, 40).map(entry => entry.slice(0, 1000));
    return {
      version: VERSION, routeLength, count: input.count, selected: input.selected, round: input.round,
      chapter: input.chapter, teams, log
    };
  }

  function rollProblem(game, team) {
    if (team.position === game.routeLength) return 'La tripulación ya llegó al tesoro.';
    if (!team.lastRoll || team.lastRoll.from === null) return 'Primero lancen el dado.';
    if (team.lastRoll.mode !== 'roll') return 'Ya usaste un canje en esta tirada.';
    return '';
  }

  function buyProblem(game, team, key) {
    const item = Object.hasOwn(SHOP, key) ? SHOP[key] : null;
    if (!team || !item) return 'Elige un canje disponible.';
    if (item.roll) {
      const problem = rollProblem(game, team);
      if (problem) return problem;
    }
    if (item.steps && team.position === game.routeLength) return 'Esta tripulación ya llegó al tesoro.';
    if (team.coins < item.cost) {
      const missing = item.cost - team.coins;
      return (missing === 1 ? 'Falta 1 moneda.' : 'Faltan ' + missing + ' monedas.');
    }
    return '';
  }

  function setPosition(team, position) {
    if (position === team.position) return;
    team.position = position;
    if (team.lastRoll) team.lastRoll.from = null;
  }

  function apply(source, action) {
    const game = validate(source);
    const active = game.teams.slice(0, game.count);
    const team = active.find(ship => ship.id === (action.id ?? game.selected));
    const record = text => {
      game.log.unshift(text);
      game.log.length = Math.min(game.log.length, 40);
    };

    if (action.type === 'roll' || action.type === 'rollAll') {
      const fullRound = action.type === 'rollAll';
      if (!fullRound && !team) throw new Error('Selecciona una tripulación.');
      if (!fullRound && team.position === game.routeLength) throw new Error('Esta tripulación ya llegó al tesoro.');
      const moving = fullRound ? active.filter(ship => ship.position < game.routeLength) : [team];
      if (!moving.length) throw new Error('Todas las tripulaciones ya llegaron.');
      const messages = moving.map(ship => {
        const face = action.dice?.[ship.id];
        if (!integer(face, 1, 6)) throw new Error('La tirada debe ser un número entre 1 y 6.');
        ship.lastRoll = { from: ship.position, face, mode: 'roll' };
        ship.position = Math.min(game.routeLength, ship.position + face);
        return teamName(ship) + ' · dado ' + face + ' · casilla ' + ship.position;
      });
      if (fullRound) game.round++;
      record((fullRound ? 'Ronda ' + game.round + ': ' : '') + messages.join(' / '));
    } else if (action.type === 'coin') {
      if (!team || !integer(action.amount, -999, 999) || !integer(team.coins + action.amount, 0, 999)) {
        throw new Error('El saldo debe quedar entre 0 y 999 monedas.');
      }
      team.coins += action.amount;
      record(teamName(team) + ': ' + (action.amount >= 0 ? '+' : '') + action.amount + (Math.abs(action.amount) === 1 ? ' moneda.' : ' monedas.'));
    } else if (action.type === 'coinAll') {
      if (!integer(action.amount, 1, 99) || active.some(ship => ship.coins + action.amount > 999)) {
        throw new Error('El saldo debe quedar entre 0 y 999 monedas.');
      }
      active.forEach(ship => { ship.coins += action.amount; });
      record('Toda la flota: +' + action.amount + (action.amount === 1 ? ' moneda.' : ' monedas.'));
    } else if (action.type === 'buy') {
      const problem = buyProblem(game, team, action.item);
      if (problem) throw new Error(problem);
      const item = SHOP[action.item];
      if (item.roll) {
        const previousFace = team.lastRoll.face;
        const face = item.effect === 'reroll' ? action.face : previousFace;
        if (!integer(face, 1, 6)) throw new Error('La tirada debe ser un número entre 1 y 6.');
        team.lastRoll = { ...team.lastRoll, face, mode: item.effect };
        const value = rollValue(team.lastRoll);
        team.position = Math.min(game.routeLength, team.lastRoll.from + value);
        record(teamName(team) + ': ' + item.name + ' (' + previousFace + ' a ' + value + ') · casilla ' +
          team.position + ' · ' + spent(item.cost));
      } else {
        if (item.steps) setPosition(team, Math.min(game.routeLength, team.position + item.steps));
        record(teamName(team) + ': ' + item.name + (item.steps ? ' · casilla ' + team.position : '') + ' · ' + spent(item.cost));
      }
      team.coins -= item.cost;
    } else if (action.type === 'move') {
      if (!team || !integer(action.amount, -MAX_STEPS, MAX_STEPS)) throw new Error('Movimiento no válido.');
      const position = Math.max(0, Math.min(game.routeLength, team.position + action.amount));
      setPosition(team, position);
      record(teamName(team) + ': ajuste a la casilla ' + team.position + '.');
    } else if (action.type === 'settings') {
      if (!integer(action.count, 2, 7) || !Array.isArray(action.names) || action.names.length !== 7) {
        throw new Error('Revisa los nombres y el número de tripulaciones.');
      }
      if (!integer(action.routeLength, MIN_STEPS, MAX_STEPS)) {
        throw new Error('El recorrido debe tener entre ' + MIN_STEPS + ' y ' + MAX_STEPS + ' casillas.');
      }
      const previousLength = game.routeLength;
      game.count = action.count;
      game.selected = Math.min(game.selected, game.count);
      game.routeLength = action.routeLength;
      game.teams.forEach((ship, i) => {
        Object.assign(ship, namesFor(action.names[i], i));
        if (previousLength !== game.routeLength) {
          setPosition(ship, Math.min(game.routeLength, ship.position));
          if (ship.lastRoll) ship.lastRoll.from = null;
        }
      });
      record('Expedición preparada: ' + game.count + ' barcos y ' + game.routeLength + ' casillas.');
    } else if (action.type === 'chapter') {
      if (!integer(action.chapter, 0, 2)) throw new Error('Capítulo no válido.');
      game.chapter = action.chapter;
    } else {
      throw new Error('Acción no reconocida.');
    }
    return validate(game);
  }

  function backup(input) {
    if (!input || input.app !== 'ruta-del-tesoro' || ![1, VERSION].includes(input.version)) {
      throw new Error('Selecciona un respaldo de La ruta del tesoro.');
    }
    const game = validate(input.game);
    if (!Array.isArray(input.history) || input.history.length > 30) throw new Error('El historial no es válido.');
    const history = input.history.map(validate);
    let timer = { minutes: 15, remaining: 900000, deadline: 0 };
    if (input.timer) {
      const saved = input.timer;
      if (!integer(saved.minutes, 1, 60) || !Number.isFinite(saved.remaining) || saved.remaining < 0 ||
          saved.remaining > 3600000 || !Number.isFinite(saved.deadline) || saved.deadline < 0) {
        throw new Error('El reloj del respaldo no es válido.');
      }
      timer = { minutes: saved.minutes, remaining: Math.floor(saved.remaining), deadline: saved.deadline };
    }
    return { app: 'ruta-del-tesoro', version: VERSION, game, history, timer };
  }

  const api = {
    VERSION, STEPS, MIN_STEPS, MAX_STEPS, MAX_NAME, NAMES, COLORS, SHOP, SHOP_ERROR, DEFAULT_TABLE, buildShop,
    initial, validate, apply, backup, clone, teamName, rollValue, rollProblem, buyProblem
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Treasure = api;
})(typeof window === 'undefined' ? globalThis : window);
