# La ruta del tesoro

Tablero para acompañar la narrativa pirata de la mañana del taller de gamificación de Nicolás Espinoza. Pensado para un computador con proyector o una tablet.

## Qué incluye

- Seis o siete barcos, con nombres editables y una ruta común de 24 casillas.
- Dado para la tripulación seleccionada o una tirada independiente para cada barco en una ronda completa.
- Tres escenas narrativas: partida, travesía y tesoro.
- Monedas por equipo y cuatro canjes: pista extra, ejemplo, consulta y viento a favor.
- Reloj opcional de 1 a 60 minutos. Solo avisa: las tiradas las decide el relator.
- Deshacer, bitácora, pantalla completa, guardado local y respaldo JSON exportable/importable.
- Llegada sin tirada exacta; todos pueden alcanzar la isla y abrir el tesoro juntos.

## Usar durante el taller

1. Abre **Preparar**, elige seis o siete equipos y escribe sus nombres.
2. Usa **Narrativa** para presentar la partida o cambiar la etapa que acompaña el tablero.
3. Cuando decidas hacer una pausa, lanza para un equipo o usa **Ronda completa**.
4. El botón **+** junto al saldo entrega una moneda. **Canjear monedas** registra ayudas del equipo seleccionado.
5. Descarga un respaldo antes de cambiar de equipo o cerrar la jornada. Se conserva el saldo para seguir usando las mismas fichas durante la tarde.

El tablero se maneja desde el computador del relator. El guardado pertenece a ese navegador; no sincroniza datos entre dispositivos ni entre participantes. Si no puedes usar almacenamiento local, el tablero lo indica y puedes descargar un respaldo. Evita operar una misma partida desde dos pestañas a la vez.

## Sin conexión

Descarga el repositorio como ZIP, extrae su contenido y abre `dist/index.html`. Los tres archivos de código y los estilos deben permanecer juntos. No utiliza fuentes, bibliotecas ni imágenes externas.

## Publicación

En **Settings → Pages**, elige **Deploy from a branch**, rama **main** y carpeta **/ (root)**. La portada abre el tablero de `dist/`. Los cambios en `main` se publican mediante el proceso de Pages que administra GitHub.

## Comprobar la lógica

Con Node.js: `node --test tests/core.test.cjs`. Las pruebas cubren rondas, límite del recorrido, modo de seis equipos, monedas y validación de respaldos.

Consulta [PREPARACION.md](PREPARACION.md) para el resto de los materiales del taller.
