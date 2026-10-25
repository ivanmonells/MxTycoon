# MX Tycoon online: publicarlo en Internet con login de Google

La versión web pública añade al juego:

- **Entrar con Google** y un **apodo** único para cada jugador.
- **Partidas en la nube**: tres ranuras y un autoguardado por cuenta, para seguir en cualquier dispositivo.
- **Ranking de circuitos**: cualquiera puede publicar un circuito, verlo en el ranking (mejores, más visitados, recientes, por disciplina) y **visitar** el complejo de otro jugador para ver a sus pilotos rodar. Los jugadores con cuenta pueden darle **me gusta**.

Todo funciona sobre Firebase (de Google), cuyo plan gratuito basta para empezar. El archivo HTML suelto y el artefacto de Claude siguen funcionando sin conexión: el modo online solo aparece en la versión web publicada.

## 1. Crear el proyecto de Firebase (una vez, unos 5 minutos)

1. Entra en <https://console.firebase.google.com> con tu cuenta de Google y pulsa **Crear un proyecto**. Nombre, por ejemplo, `mx-tycoon`. Google Analytics no hace falta.
2. **Inicio de sesión con Google**: menú **Compilación > Authentication > Comenzar > Método de inicio de sesión > Google > Habilitar**, elige el correo de asistencia y guarda.
3. **Base de datos**: **Compilación > Firestore Database > Crear base de datos**, en **modo de producción**, con ubicación en Europa (por ejemplo `eur3` o `europe-southwest1`, Madrid). Las reglas de acceso las sube el despliegue.
4. **App web**: **Configuración del proyecto** (la rueda) **> General > Tus apps >** icono `</>`, ponle un nombre y **Registrar app**. Copia el bloque `firebaseConfig` que aparece.
5. Crea `mx-tycoon/online.config.json` copiando `online.config.example.json` y pon ahí esos valores. No son secretos: solo identifican el proyecto y acaban dentro de la página; quién puede leer o escribir lo deciden las reglas de `firestore.rules`.

## 2. Publicar

Elige una de estas formas:

- **Desde tu ordenador** (Node.js 18 o superior): en la carpeta `mx-tycoon`, ejecuta `npx firebase-tools login` (una vez) y después `node tools/deploy.mjs`.
- **Desde GitHub Actions**: crea una clave de cuenta de servicio con el rol **Administrador de Firebase** (Google Cloud > IAM > Cuentas de servicio > Crear cuenta > Claves > Agregar clave JSON) y guárdala como secreto del repositorio `FIREBASE_SERVICE_ACCOUNT` (GitHub > Settings > Secrets and variables > Actions). Luego, en la pestaña **Actions**, ejecuta **MX Tycoon online**.
- **Desde una sesión de Claude Code**: añade esa clave como variable de entorno `FIREBASE_SERVICE_ACCOUNT` en la configuración del entorno (menú del entorno > Editar) y la configuración web como `MX_ONLINE_CONFIG`. En una sesión nueva se puede ejecutar `node tools/deploy.mjs` directamente.

El juego queda en `https://<tu-proyecto>.web.app`. Si más adelante usas un dominio propio, añádelo en **Authentication > Configuración > Dominios autorizados**.

## 3. Comprobarlo

1. Abre la dirección publicada y pulsa **Entrar con Google**: el juego pide un apodo la primera vez.
2. Juega, abre un circuito al público y, en su ventana, pulsa **Publicar en el ranking**.
3. Desde otro navegador o cuenta, abre **Ranking de circuitos**, pulsa **Visitar** y dale **me gusta**.

## Límites y cosas a saber

- Plan gratuito de Firebase (Spark): 50.000 lecturas y 20.000 escrituras al día, 1 GiB de base de datos y 10 GB de tráfico de hosting al mes. Una partida guardada ocupa unos 35 KB.
- Las reglas impiden tocar las partidas, perfiles o circuitos de otro jugador, y los votos y visitas solo suben de uno en uno (cada voto tiene su propio registro).
- La valoración de cada circuito la calcula el juego en el navegador del autor: alguien con conocimientos técnicos podría inflarla. Los votos y las visitas sí los controla el servidor.
- Los apodos no tienen filtro de palabras malsonantes.

## Para desarrolladores

- `node build.mjs` genera `dist/web/index.html` cuando existe `online.config.json` (o `MX_ONLINE_CONFIG`).
- `node build.mjs --emu` genera `dist/web-emu/index.html`, conectado a los emuladores locales de Firebase.
- `npx firebase-tools emulators:exec --only auth,firestore --project demo-mxtycoon "node tools/online-test.mjs <carpeta>"` prueba de punta a punta con dos jugadores: apodos, partidas en la nube, publicar, ranking, visitas, votos y las escrituras que las reglas deben rechazar.
- Estructura de datos en Firestore: comentario al principio de `src/net/online.js`. Reglas: `firestore.rules`. Índices: `firestore.indexes.json`.
