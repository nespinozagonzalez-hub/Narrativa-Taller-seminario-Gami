const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../dist/core.js');

test('cada barco recibe su propia tirada y el estado anterior se conserva para deshacer',()=>{
  const before=C.initial();
  const dice={1:1,2:2,3:3,4:4,5:5,6:6,7:1};
  const after=C.apply(before,{type:'rollAll',dice});
  assert.deepEqual(after.teams.map(t=>t.position),[1,2,3,4,5,6,1]);
  assert.deepEqual(before.teams.map(t=>t.position),[0,0,0,0,0,0,0]);
  assert.equal(after.round,1);
});
test('seis barcos conservan el progreso del séptimo sin incluirlo en una ronda',()=>{
  let g=C.initial();g.teams[6].position=12;
  g=C.apply(g,{type:'settings',count:6,names:C.NAMES});
  g=C.apply(g,{type:'rollAll',dice:{1:2,2:2,3:2,4:2,5:2,6:2}});
  assert.equal(g.teams[6].position,12);
  g=C.apply(g,{type:'settings',count:7,names:C.NAMES});
  assert.equal(g.teams[6].position,12);
});
test('una tirada superior al resto de la ruta llega sin bloquear a los otros barcos',()=>{
  let g=C.initial();g.teams[0].position=23;
  g=C.apply(g,{type:'roll',dice:{1:6}});
  assert.equal(g.teams[0].position,24);
  g=C.apply(g,{type:'rollAll',dice:{2:1,3:2,4:3,5:4,6:5,7:6}});
  assert.equal(g.teams[0].lastDice,6);
  assert.equal(g.teams[6].position,6);
});
test('canjes descuentan el precio correcto, no permiten saldo negativo y el viento llega como máximo a 24',()=>{
  let g=C.initial();g.teams[0].position=23;
  g=C.apply(g,{type:'buy',item:'wind'});
  assert.equal(g.teams[0].position,24);assert.equal(g.teams[0].coins,0);
  assert.throws(()=>C.apply(g,{type:'buy',item:'hint'}),/suficientes/);
  assert.throws(()=>C.apply(g,{type:'coin',amount:-1}),/saldo/);
  g=C.apply(g,{type:'coin',amount:2});
  g=C.apply(g,{type:'buy',item:'example'});assert.equal(g.teams[0].coins,0);
});
test('respaldos válidos conservan datos, historial y reloj',()=>{
  const game=C.apply(C.initial(),{type:'coin',id:3,amount:5});
  const original={app:'ruta-del-tesoro',version:1,game,history:[C.initial()],timer:{minutes:10,remaining:120000,deadline:0}};
  const result=C.backup(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(result,original);
});
test('rechaza un respaldo de otra aplicación o datos imposibles sin modificar la partida actual',()=>{
  const current=C.initial(),saved=C.clone(current);
  assert.throws(()=>C.backup({app:'otra',version:1}),/respaldo/);
  const invalid=C.clone(current);invalid.teams[0].position=25;
  assert.throws(()=>C.validate(invalid),/datos/);
  assert.deepEqual(current,saved);
  const badTimer={app:'ruta-del-tesoro',version:1,game:current,history:[],timer:{minutes:15,remaining:-1,deadline:0}};
  assert.throws(()=>C.backup(badTimer),/reloj/);
});
test('los ajustes de posición están limitados por los extremos del recorrido',()=>{
  let g=C.apply(C.initial(),{type:'move',amount:-1});assert.equal(g.teams[0].position,0);
  g=C.apply(g,{type:'move',amount:24});assert.equal(g.teams[0].position,24);
  g=C.apply(g,{type:'move',amount:1});assert.equal(g.teams[0].position,24);
});
