# MX Tycoon: Motocross Empire

Juego de gestión y construcción de complejos de motocross para el navegador, en la línea de los tycoon clásicos: vista isométrica 2.5D con estética retro, editor libre de circuitos con el ratón, pilotos y público autónomos, economía, competiciones y progresión.

No necesita instalación ni servidor: abre `dist/mx-tycoon.html` en un navegador moderno con WebGL2 (Chrome, Edge, Firefox o Safari recientes).

## Cómo se juega

1. **Circuitos > Nuevo circuito**: haz clic sobre tu terreno para ir colocando puntos (o mantén pulsado y arrastra). Vuelve al primer punto para cerrar el trazado.
2. En **Elementos** coloca la parrilla de salida, la línea de meta, saltos (tabletops, dobles, triples, mesetas), secciones rítmicas (whoops, rollers, dubbies) y peraltes. En **Superficie** cambias tierra, arena, barro o tierra compacta y la anchura de cada tramo. En **Trazado** editas los puntos y las subidas y bajadas.
3. Construye un **paddock** y un **aparcamiento** tocando la carretera, una **taquilla**, **baños** y comida, y únelos con **caminos**.
4. **Valida**, **prueba** con pilotos de test y **abre al público**. Llegan furgonetas con pilotos y coches con espectadores.
5. Contrata personal, ajusta precios, lanza marketing, investiga mejoras, organiza carreras (de la jornada de entrenamiento al Gran Premio) y cumple los objetivos del modo carrera.

Modos: **Nueva partida** (carrera con objetivos y tutorial interactivo), **Continuar** (última partida guardada) y **Modo sandbox** (dinero y desbloqueos sin límite).

### Controles

| Acción | Ratón y teclado | Táctil |
| --- | --- | --- |
| Mover la cámara | Arrastrar con botón derecho, WASD o flechas | Arrastrar con un dedo |
| Zoom | Rueda, + y − | Pellizcar |
| Girar la vista | Q y E | Botón de girar |
| Pausa y velocidad | Espacio, 1 a 4 | Botones de velocidad |
| Girar edificio | R o clic derecho | Botón derecho del menú de herramienta |
| Cancelar herramienta | Esc o clic derecho | Botón cerrar |
| Guardado rápido | Ctrl+S | Menú |

La partida se guarda automáticamente en el navegador (localStorage) y se puede exportar o importar como código de texto.

## Estructura

```
src/core      utilidades, RNG, formato en español, bus de eventos
src/data      constantes y catálogo de contenido (edificios, elementos, eventos, investigación...)
src/sim       simulación pura sin DOM: mundo, circuitos, física de pilotos, agentes, economía,
              progresión, eventos aleatorios, competiciones y el núcleo Game
src/render    motor WebGL2 propio: cámara ortográfica, sombras, contornos, texturas y modelos
              procedurales (vóxeles), partículas
src/ui        HUD, ventanas, herramientas de construcción, entrada, tutorial
src/audio     efectos y música sintetizados con WebAudio
src/storage   guardado en localStorage con compresión y códigos de exportación
src/main.js   arranque, pantalla de título, bucle principal
```

La simulación avanza a paso fijo (30 Hz) y es independiente del render, lo que permite probarla sin navegador.

## Desarrollo

- `index.html` carga los módulos por separado (útil para depurar).
- `node build.mjs` genera `dist/mx-tycoon.html`, un único archivo autocontenido.
- `node tools/sim-test.cjs` simula un complejo durante varios meses en Node y muestra la economía.
- `node tools/qa.mjs index.html tools/scen/career.mjs <carpeta>` juega una partida completa con clics reales en Chromium sin interfaz (Playwright) y guarda capturas.

Todos los gráficos, sonidos y logotipos de patrocinadores se generan por código; las marcas y nombres son ficticios.
