/*
 * ==========================================================================
 *  TABLA DE CANJES · La ruta del tesoro
 * ==========================================================================
 *  Este es el ÚNICO archivo que hay que editar para cambiar lo que las
 *  tripulaciones pueden comprar con sus monedas. El tablero solo permite
 *  GASTAR monedas aquí; las monedas se entregan desde Opciones → Monedas.
 *
 *  Cada canje tiene:
 *    id          Identificador corto, sin espacios ni tildes. No lo repitas.
 *    nombre      Lo que verá la tripulación (máx. 40 caracteres).
 *    precio      Monedas que cuesta (número entero, 0 a 99).
 *    descripcion Una frase breve que explica el canje (opcional).
 *    efecto      Qué hace el tablero al comprarlo (opcional):
 *                  'volver-a-tirar'  repite la última tirada del dado
 *                  'duplicar'        multiplica por dos la última tirada
 *                  'avanzar'         mueve el barco; indica cuántas casillas
 *                                    en "casillas" (por ejemplo casillas: 2)
 *                  (sin efecto)      solo descuenta las monedas y lo anota en
 *                                    la bitácora: pistas, comodines, premios…
 *
 *  Los canjes 'volver-a-tirar' y 'duplicar' se pueden usar una vez por
 *  tirada (solo uno de los dos).
 *
 *  Si este archivo tiene un error, el tablero usa la tabla de ejemplo y
 *  muestra un aviso en Opciones.
 * ==========================================================================
 */
window.TABLA_CANJES = [
  { id: 'reroll',  nombre: 'Volver a tirar',   precio: 2, efecto: 'volver-a-tirar',
    descripcion: 'Repite la última tirada. Vale el nuevo resultado, aunque sea menor.' },
  { id: 'double',  nombre: 'Duplicar tirada',  precio: 3, efecto: 'duplicar',
    descripcion: 'El valor que salió en el dado se multiplica por dos.' },
  { id: 'wind',    nombre: 'Viento a favor',   precio: 3, efecto: 'avanzar', casillas: 2,
    descripcion: 'Avanza dos casillas hacia la isla.' },
  { id: 'hint',    nombre: 'Pista extra',      precio: 1,
    descripcion: 'Una orientación adicional para la misión.' },
  { id: 'example', nombre: 'Ejemplo de apoyo', precio: 2,
    descripcion: 'Un ejemplo que puedan adaptar a su propuesta.' },
  { id: 'consult', nombre: 'Consulta breve',   precio: 3,
    descripcion: 'Dos minutos para revisar una idea con el relator.' }
];
