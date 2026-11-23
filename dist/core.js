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
  const SHOP = Object.freeze({
    reroll: { name: 'Volver a tirar', cost: 2, roll: true },
    double: { name: 'Duplicar tirada', cost: 3, roll: true },
    hint: { name: 'Pista extra', cost: 1 },
    example: { name: 'Ejemplo de apoyo', cost: 2 },
    consult: { name: 'Consulta breve', cost: 3 },
    wind: { name: 'Viento a favor', cost: 3, steps: 2 }
  });

  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const clone = value => JSON.parse(JSON.stringify(value));
  const teamName = team => team.name || team.shipName;
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
    if (!team.lastRoll || team.lastRoll.from === null) return 'Lanza el dado para activar los canjes de tirada.';
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
    if (team.coins < item.cost) return 'Esta tripulación no tiene suficientes monedas.';
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
    } else if (action.type === 'buy') {
      const problem = buyProblem(game, team, action.item);
      if (problem) throw new Error(problem);
      const item = SHOP[action.item];
      if (item.roll) {
        const previousFace = team.lastRoll.face;
        const face = action.item === 'reroll' ? action.face : previousFace;
        if (!integer(face, 1, 6)) throw new Error('La tirada debe ser un número entre 1 y 6.');
        team.lastRoll = { ...team.lastRoll, face, mode: action.item };
        const value = rollValue(team.lastRoll);
        team.position = Math.min(game.routeLength, team.lastRoll.from + value);
        record(teamName(team) + ': ' + item.name + ' (' + previousFace + ' a ' + value + ') · casilla ' +
          team.position + ' · −' + item.cost + ' monedas.');
      } else {
        if (item.steps) setPosition(team, Math.min(game.routeLength, team.position + item.steps));
        record(teamName(team) + ': ' + item.name + ' · −' + item.cost + ' monedas.');
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
    VERSION, STEPS, MIN_STEPS, MAX_STEPS, MAX_NAME, NAMES, COLORS, SHOP,
    initial, validate, apply, backup, clone, teamName, rollValue, rollProblem, buyProblem
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Treasure = api;
})(typeof window === 'undefined' ? globalThis : window);
