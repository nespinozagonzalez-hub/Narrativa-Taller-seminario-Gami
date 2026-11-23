# La ruta del tesoro

Tablero para acompañar la narrativa pirata de la mañana del taller de gamificación de Nicolás Espinoza. Pensado para un computador con proyector o una tablet.

## Qué incluye

- Entre dos y siete barcos, con nombres independientes para la tripulación y la embarcación.
- Mapa ilustrado con 25 casillas por defecto, ajustable entre 6 y 40.
- Dado para la tripulación seleccionada o una tirada independiente para cada barco en una ronda completa.
- Tres escenas narrativas: partida, travesía y tesoro.
- Dos canjes para la última tirada de cada equipo. Cuesta 2 monedas volver a tirar y 3 monedas duplicar el valor. Se elige un canje por tirada.
- Monedas por equipo para pistas, ejemplos, consultas y viento a favor.
- Reloj opcional de 1 a 60 minutos. Solo avisa: las tiradas las decide el relator.
- Deshacer, bitácora, pantalla completa, guardado local y respaldo JSON exportable/importable.
- Cinemática de llegada en cuatro escenas con tres ilustraciones nuevas, movimientos de cámara, niebla, partículas y el saludo del Capitán Brújula. Permite pausar, avanzar, retroceder y repetir. Cuando toda la flota alcanza la isla, el capitán propone un cierre para la mañana.
- Botón visible para reiniciar la aventura con confirmación.

## Usar durante el taller

1. En **Opciones → Preparar expedición**, elige entre dos y siete equipos y escribe sus nombres. Usa **+** o **−** junto al largo de la ruta para ajustar las casillas hasta el tesoro.
2. Abre **Opciones → Narrativa** para presentar la partida o cambiar la etapa que acompaña el tablero. Usa el botón de pantalla completa si vas a proyectar el mapa.
3. Elige un barco en el mapa o en **Tripulaciones**. Lanza para ese equipo o usa **Ronda completa**.
4. En **Tripulaciones**, el botón **+** junto al saldo entrega una moneda. Pulsa el saldo en la barra inferior para abrir **Canjes y ayudas**. **Volver a tirar** sustituye el resultado anterior por el nuevo, incluso si sale un número menor. **Duplicar tirada** multiplica por dos el valor que salió.
5. En **Opciones** puedes ajustar la posición del barco seleccionado con **−1** y **+1**, iniciar el reloj o consultar la bitácora.
6. Antes de cambiar de computador o cerrar la jornada, usa **Opciones → Descargar respaldo**. El saldo se conserva para seguir usando las fichas durante la tarde.
7. En **Opciones → Vista previa del final** puedes revisar la cinemática durante la preparación. **Reiniciar** restablece los nombres, los siete barcos, las 25 casillas, las tres monedas por barco y el reloj después de confirmar.

El tablero se maneja desde el computador del relator. El guardado pertenece a ese navegador; no sincroniza datos entre dispositivos ni entre participantes. Si no puedes usar almacenamiento local, el tablero lo indica y puedes descargar un respaldo. Evita operar una misma partida desde dos pestañas a la vez.

## Sin conexión

Descarga el repositorio como ZIP, extrae su contenido y abre `dist/index.html`. Mantén juntos los archivos de la carpeta `dist`, incluidas las ilustraciones de `assets`.

## Publicación

En **Settings → Pages**, elige **Deploy from a branch**, rama **main** y carpeta **/ (root)**. La portada abre el tablero de `dist/`. Los cambios en `main` se publican mediante el proceso de Pages que administra GitHub.

## Comprobar la lógica

Con Node.js ejecuta `node --test tests/core.test.cjs`. Las pruebas cubren rondas de dos a siete equipos, canjes del dado, largo del recorrido y compatibilidad con respaldos anteriores.

Consulta [PREPARACION.md](PREPARACION.md) para el resto de los materiales del taller.
