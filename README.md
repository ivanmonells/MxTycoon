# MX Tycoon: Motocross Empire

Juego de gestión y construcción de complejos de motocross para el navegador, en la línea de los tycoon clásicos: vista isométrica 2.5D con estética retro, constructor de circuitos pieza a pieza, pilotos y público autónomos, economía, competiciones y progresión.

No necesita instalación ni servidor: abre `dist/mx-tycoon.html` en un navegador moderno con WebGL2 (Chrome, Edge, Firefox o Safari recientes).

## Cómo se juega

1. **Circuitos > Nuevo circuito**: haz clic en tu terreno para colocar la parrilla de salida (R la gira en pasos de 45 grados).
2. Construye el circuito **pieza a pieza**, como en los tycoon clásicos: elige la dirección (recta corta, media o larga, o curva cerrada, media o abierta a cada lado), la pendiente (bajada fuerte, bajada, llano, subida, subida fuerte), el peralte de las curvas y, si quieres, una **pieza especial** (meta, tabletops, dobles, triples, escalones, mesetas, whoops, rollers, dubbies, secciones rítmicas). La pieza fantasma enseña dónde irá y cuánto cuesta. Vuelve hasta la salida para cerrar el circuito o pulsa **Cerrar automáticamente** (en el móvil, **Cerrar**): el juego busca el camino de vuelta salvando la diferencia de altura y, si el final está encajonado, rehace las últimas piezas. Si llegas a la salida un poco más alto o más bajo, la última pieza ajusta su pendiente sola. Teclado: Intro construye, Retroceso quita la última pieza y las flechas cambian dirección y pendiente.
3. Con el circuito cerrado, en **Elementos** añades más saltos sobre las rectas y en **Superficie** cambias tierra, arena, barro o tierra compacta y la anchura de cada pieza.
4. Construye un **paddock** y un **aparcamiento** tocando la carretera, una **taquilla**, **baños** y comida, y únelos con **caminos**.
5. **Decorar** tiene una pestaña por temática: básicos (árboles, seguridad y patrocinio), **Mad Max**, **Desierto**, **Surf**, **Granja**, **Mundial MX** y **Festival**. Tres o más piezas de una temática junto a un circuito forman una **zona temática**: sube la valoración del circuito y el público que pasea al lado disfruta y la comenta.
6. **Valida**, **prueba** con pilotos de test y **abre al público**. Llegan furgonetas con pilotos y coches con espectadores.
7. Contrata personal, ajusta precios, lanza marketing, investiga mejoras, organiza carreras (de la jornada de entrenamiento al Gran Premio) y cumple los objetivos del modo carrera.

Modos: **Nueva partida** (carrera con objetivos y tutorial interactivo), **Continuar** (última partida guardada) y **Modo sandbox** (dinero y desbloqueos sin límite).

Al empezar eliges el terreno, del más llano al más montañoso, con un mapa de cada uno: **Playa** (relieve 1, con el mar y las dunas), **Campo** (2, lomas, cultivos y estanques), **Desierto** (3, dunas, mesetas de roca y un oasis), **Colinas** (4, bosques y lagos) y **Montaña** (5, una ladera que sube hacia picos nevados). «Otro mapa» genera otro distinto de cada uno. Junto a la carretera el terreno siempre es suave para el aparcamiento, el paddock y la taquilla; tierra adentro, cuanto más relieve, más subidas y bajadas tienen los circuitos (y más valoración), pero más cuesta allanar para construir.

### Controles

| Acción | Ratón y teclado | Táctil |
| --- | --- | --- |
| Mover la cámara | Arrastrar con botón derecho, WASD o flechas | Arrastrar con un dedo |
| Construir circuitos | Intro construye la pieza, Retroceso quita la última, flechas cambian dirección y pendiente | Botones del constructor |
| Zoom | Rueda, + y − | Pellizcar o botones + y − |
| Girar la vista | Q y E | Botón de girar |
| Pausa y velocidad | Espacio, 1 a 4 | Pausa y botón de velocidad (cambia de 1x a 4x) |
| Colocar edificios, decoración y saltos | Clic en el mapa | Toca el mapa para ver la vista previa, arrástrala con el dedo si quieres moverla y pulsa «Colocar» (o toca la vista previa) |
| Girar edificio | R o clic derecho | Botón amarillo junto a «Colocar» |
| Cancelar herramienta | Esc o clic derecho | Cerrar el menú |
| Guardado rápido | Ctrl+S | Menú |

En el móvil los menús son hojas que salen desde abajo (en horizontal, desde la izquierda) y se pliegan solas cuando una herramienta necesita el mapa: toca su barra de título para plegarlas o desplegarlas, o desliza hacia arriba para verlas a pantalla completa. La barra inferior alterna entre **Obras** y **Gestión**, y el tutorial se pliega tocando su título.

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
src/net       modo online de la versión web (Firebase): Google, apodos, nube y ranking
src/main.js   arranque, pantalla de título, bucle principal
```

La simulación avanza a paso fijo (30 Hz) y es independiente del render, lo que permite probarla sin navegador.

## Desarrollo

- `index.html` carga los módulos por separado (útil para depurar).
- `node build.mjs` genera `dist/mx-tycoon.html`, un único archivo autocontenido.
- `node tools/sim-test.cjs` simula un complejo durante varios meses en Node y muestra la economía.
- `node tools/piece-test.cjs` prueba el constructor pieza a pieza: piezas, cierre automático, trazado sugerido, guardado y rodaje.
- `node tools/close-test.cjs` prueba el cierre de circuitos: llegar a la salida a otra altura, cerrar desde lejos, desde muy arriba y con el final encajonado.
- `node tools/theme-test.cjs` prueba las temáticas de decoración: zonas temáticas, valoración, guardado y visitantes.
- `node tools/env-test.cjs` genera los cinco terrenos con varias semillas y comprueba la carretera, las instalaciones junto a ella, el acceso de los pilotos, el relieve y un circuito cerrado con «Cerrar».
- `node tools/terrain-preview.cjs <mapas.png>` dibuja desde arriba los cinco terrenos de varias semillas con sus cifras.
- `node tools/shotpage.mjs "tools/decor.html?theme=all" <captura.png>` dibuja todas las piezas temáticas (o una temática: `theme=madmax`, `desert`, `surf`, `farm`, `mxgp`, `festival`).
- `node tools/qa.mjs index.html tools/scen/career.mjs <carpeta>` juega una partida completa con clics reales en Chromium sin interfaz (Playwright) y guarda capturas.
- `MOBILE=1 node tools/qa.mjs index.html tools/scen/phone.mjs <carpeta> 390 844` repite el recorrido con toques en un móvil simulado (prueba también `844 390` en horizontal).
- `MOBILE=1 node tools/qa.mjs index.html tools/scen/touchplace.mjs <carpeta> 390 844` coloca edificios, decoración, saltos, caminos y terreno solo con toques y arrastres.

## Versión online

Para publicar el juego en Internet con inicio de sesión de Google, partidas en la nube y ranking de circuitos, sigue [ONLINE.md](ONLINE.md).

Todos los gráficos, sonidos y logotipos de patrocinadores se generan por código; las marcas y nombres son ficticios.
