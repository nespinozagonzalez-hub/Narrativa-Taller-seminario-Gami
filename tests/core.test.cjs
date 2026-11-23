const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../dist/core.js');

function settings(game, changes = {}) {
  return C.apply(game, {
    type: 'settings',
    count: game.count,
    routeLength: game.routeLength,
    names: game.teams.map(({ name, shipName }) => ({ name, shipName })),
    ...changes
  });
}

function roll(game, face) {
  return C.apply(game, { type: 'roll', dice: { [game.selected]: face } });
}

test('la ruta empieza con 25 casillas y cada barco recibe su propio dado en una ronda', () => {
  const before = C.initial();
  const dice = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 1 };
  const after = C.apply(before, { type: 'rollAll', dice });
  assert.equal(before.routeLength, 25);
  assert.deepEqual(after.teams.map(team => team.position), [1, 2, 3, 4, 5, 6, 1]);
  assert.deepEqual(before.teams.map(team => team.position), [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(after.round, 1);
});

test('entre dos y siete barcos participan en la ronda y se conserva la flota inactiva', () => {
  const original = C.apply(C.initial(), { type: 'move', id: 7, amount: 12 });
  original.selected = 7;
  for (let count = 2; count <= 7; count++) {
    let game = settings(original, { count });
    const dice = Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, 2]));
    game = C.apply(game, { type: 'rollAll', dice });
    assert.equal(game.count, count);
    assert.equal(game.selected, count);
    assert.deepEqual(game.teams.slice(count), original.teams.slice(count));
    assert.deepEqual(
      game.teams.slice(0, count).map(team => team.position),
      original.teams.slice(0, count).map(team => team.position + 2)
    );
    assert.deepEqual(settings(game, { count: 7 }).teams, game.teams);
  }
  for (const count of [1, 8, 2.5, '2']) {
    assert.throws(() => settings(original, { count }), /tripulaciones/);
    assert.throws(() => C.validate({ ...original, count }), /formato/);
  }
});

test('se puede guardar el nombre de un barco, su tripulación o ambos', () => {
  const game = C.initial();
  const names = game.teams.map(({ name, shipName }) => ({ name, shipName }));
  names[0] = { name: 'Guardianes del Mapa', shipName: 'La Tortuga Dorada' };
  names[1] = { name: '', shipName: 'Nave del Alba' };
  const named = settings(game, { names });
  assert.equal(C.teamName(named.teams[0]), 'Guardianes del Mapa');
  assert.equal(named.teams[0].shipName, 'La Tortuga Dorada');
  assert.equal(C.teamName(named.teams[1]), 'Nave del Alba');
  assert.throws(() => settings(game, { routeLength: 41 }), /entre 6 y 40/);
});

test('acortar la ruta limita todos los barcos y ampliar preserva las casillas recorridas', () => {
  let game = roll(C.apply(C.initial(), { type: 'move', amount: 15 }), 5);
  assert.equal(game.teams[0].position, 20);
  game = settings(game, { routeLength: 18 });
  assert.equal(game.teams[0].position, 18);
  game = settings(game, { routeLength: 30 });
  assert.equal(game.teams[0].position, 18);
  assert.equal(game.teams[0].lastRoll.from, null);
  assert.throws(() => C.apply(game, { type: 'buy', item: 'double' }), /Lanza el dado/);
});

test('la llegada no requiere un número exacto y las demás tripulaciones siguen navegando', () => {
  let game = settings(C.initial(), { routeLength: 22 });
  game = roll(C.apply(game, { type: 'move', amount: 21 }), 6);
  assert.equal(game.teams[0].position, 22);
  game = C.apply(game, { type: 'rollAll', dice: { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 } });
  assert.equal(game.teams[0].lastRoll.face, 6);
  assert.equal(game.teams[6].position, 6);
});

test('volver a tirar reemplaza el resultado aunque sea menor y cobra exactamente dos monedas', () => {
  const before = roll(C.apply(C.initial(), { type: 'move', amount: 4 }), 5);
  const after = C.apply(before, { type: 'buy', item: 'reroll', face: 2 });
  assert.equal(before.teams[0].position, 9);
  assert.equal(before.teams[0].coins, 3);
  assert.equal(after.teams[0].position, 6);
  assert.equal(after.teams[0].coins, 1);
  assert.equal(after.teams[0].lastRoll.mode, 'reroll');
  assert.throws(() => C.apply(after, { type: 'buy', item: 'double' }), /Ya usaste/);
});

test('duplicar aplica el doble desde el punto de partida, hasta la meta y por tres monedas', () => {
  const based = roll(C.apply(C.initial(), { type: 'move', amount: 14 }), 6);
  const doubled = C.apply(based, { type: 'buy', item: 'double' });
  assert.equal(doubled.teams[0].position, 25);
  assert.equal(doubled.teams[0].coins, 0);
  assert.equal(C.rollValue(doubled.teams[0].lastRoll), 12);
});

test('cada barco puede usar un canje por tirada y una tirada nueva permite otro canje', () => {
  let game = C.apply(C.initial(), { type: 'coin', amount: 10 });
  game = roll(game, 4);
  game = C.apply(game, { type: 'buy', item: 'double' });
  assert.equal(game.teams[0].position, 8);
  assert.throws(() => C.apply(game, { type: 'buy', item: 'reroll', face: 6 }), /Ya usaste/);
  assert.throws(() => C.apply(game, { type: 'buy', id: 2, item: 'reroll', face: 6 }), /Lanza el dado/);
  game = roll(game, 2);
  game = C.apply(game, { type: 'buy', item: 'reroll', face: 3 });
  assert.equal(game.teams[0].position, 11);
  assert.equal(game.teams[0].coins, 8);
});

test('un canje con saldo insuficiente no cambia la jugada y los apoyos mantienen su precio', () => {
  let game = C.apply(C.initial(), { type: 'buy', item: 'hint' });
  game = roll(game, 3);
  assert.throws(() => C.apply(game, { type: 'buy', item: 'double' }), /Falta 1 moneda/);
  assert.equal(game.teams[0].coins, 2);
  assert.equal(game.teams[0].position, 3);
  game = C.apply(game, { type: 'buy', item: 'example' });
  assert.equal(game.teams[0].coins, 0);
  assert.throws(() => C.apply(game, { type: 'coin', amount: -1 }), /saldo/);
});

test('los ajustes manuales se limitan al recorrido e invalidan el canje de la tirada anterior', () => {
  let game = C.apply(C.initial(), { type: 'move', amount: -1 });
  assert.equal(game.teams[0].position, 0);
  game = roll(game, 3);
  game = C.apply(game, { type: 'move', amount: 1 });
  assert.equal(game.teams[0].position, 4);
  assert.throws(() => C.apply(game, { type: 'buy', item: 'reroll', face: 6 }), /Lanza el dado/);
  game = C.apply(game, { type: 'move', amount: 40 });
  assert.equal(game.teams[0].position, 25);
});

test('respaldos nuevos conservan ruta, resultado del canje, historial y reloj', () => {
  let game = settings(C.initial(), { count: 2, routeLength: 28 });
  game = C.apply(roll(game, 4), { type: 'buy', item: 'double' });
  const original = {
    app: 'ruta-del-tesoro', version: C.VERSION, game,
    history: [C.initial()], timer: { minutes: 10, remaining: 120000, deadline: 0 }
  };
  assert.deepEqual(C.backup(JSON.parse(JSON.stringify(original))), original);
});

test('respaldos de la versión anterior conservan nombres, monedas, tiradas y llegadas', () => {
  const old = {
    version: 1, count: 6, selected: 2, round: 3, chapter: 1,
    teams: C.NAMES.map((name, i) => ({
      id: i + 1, name, position: i === 0 ? 24 : 2, coins: 7, lastDice: 5
    })),
    log: ['Misión completada']
  };
  const saved = C.backup({ app: 'ruta-del-tesoro', version: 1, game: old, history: [old] });
  assert.equal(saved.version, C.VERSION);
  assert.equal(saved.game.routeLength, 25);
  assert.equal(saved.game.teams[0].position, 25);
  assert.equal(saved.game.teams[1].position, 2);
  assert.equal(saved.history[0].teams[0].coins, 7);
  assert.equal(saved.game.teams[0].name, old.teams[0].name);
  assert.equal(saved.game.teams[0].lastRoll.face, 5);
  assert.equal(saved.game.teams[0].lastRoll.from, null);
});

test('un respaldo de otra aplicación o con datos fuera del rango se rechaza', () => {
  const game = C.initial();
  assert.throws(() => C.backup({ app: 'otra', version: 1 }), /respaldo/);
  const invalid = C.clone(game);
  invalid.teams[0].position = 26;
  assert.throws(() => C.validate(invalid), /datos/);
  const badTimer = {
    app: 'ruta-del-tesoro', version: C.VERSION, game, history: [],
    timer: { minutes: 15, remaining: -1, deadline: 0 }
  };
  assert.throws(() => C.backup(badTimer), /reloj/);
});

test('la tabla de canjes de dist/canjes.js es válida y se puede reemplazar', () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/canjes.js'), 'utf8'), sandbox);
  const shop = C.buildShop(sandbox.window.TABLA_CANJES);
  assert.ok(Object.keys(shop).length > 0);

  const custom = C.buildShop([
    { id: 'comodin', nombre: 'Comodín', precio: 4 },
    { id: 'turbo', nombre: 'Turbo', precio: 1, efecto: 'avanzar', casillas: 3 }
  ]);
  assert.equal(custom.comodin.effect, '');
  assert.equal(custom.turbo.steps, 3);
  assert.throws(() => C.buildShop([{ id: 'x', nombre: 'X', precio: -1 }]), /precio/);
  assert.throws(() => C.buildShop([{ id: 'x', nombre: 'X', precio: 1, efecto: 'volar' }]), /efecto/);
  assert.throws(() => C.buildShop([{ id: 'x', nombre: 'X', precio: 1 }, { id: 'x', nombre: 'Y', precio: 1 }]), /único/);
  assert.throws(() => C.buildShop([{ id: 'x', nombre: 'X', precio: 1, efecto: 'avanzar' }]), /casillas/);
});

test('un canje sin efecto solo descuenta monedas y queda en la bitácora', () => {
  const game = C.apply(C.initial(), { type: 'buy', item: 'hint' });
  assert.equal(game.teams[0].coins, 2);
  assert.equal(game.teams[0].position, 0);
  assert.match(game.log[0], /Pista extra · −1 moneda\./);
});

test('el relator puede dar una moneda a toda la flota activa', () => {
  const game = C.apply(settings(C.initial(), { count: 3 }), { type: 'coinAll', amount: 1 });
  assert.deepEqual(game.teams.map(team => team.coins), [4, 4, 4, 3, 3, 3, 3]);
  assert.throws(() => C.apply(game, { type: 'coinAll', amount: 0 }), /saldo/);
});
