/* MX Tycoon - game content catalog: buildings, track features, surfaces, staff,
   competitions, research, objectives, marketing, sponsors, names and thoughts. */
(function (MX) {
  'use strict';

  const buildings = {
    /* --- Riders --- */
    paddock: {
      name: 'Paddock', cat: 'riders', w: 3, h: 3, cost: 12000, upkeep: 130, height: 3.2,
      access: 'road', capacity: 18,
      desc: 'Base de los pilotos. Aparcan sus furgonetas y preparan las motos. Necesita acceso por carretera.'
    },
    boxes: {
      name: 'Boxes profesionales', cat: 'riders', w: 2, h: 1, cost: 9000, upkeep: 100, height: 3.4,
      access: 'any', capacity: 4, unlock: 'research:boxes',
      desc: 'Garajes cubiertos para pilotos expertos y profesionales. Mejoran su satisfacción y son obligatorios en grandes eventos.'
    },
    workshop: {
      name: 'Taller mecánico', cat: 'riders', w: 2, h: 2, cost: 15000, upkeep: 160, height: 4.2,
      access: 'any', capacity: 3, staff: 'mechanic', price: 70,
      desc: 'Repara motos averiadas o castigadas. Necesita mecánicos. Cada reparación deja dinero.'
    },
    showers: {
      name: 'Duchas', cat: 'riders', w: 1, h: 1, cost: 4500, upkeep: 60, height: 3.2,
      access: 'any', capacity: 3,
      desc: 'Los pilotos quieren ducharse después de rodar. Sin duchas, se quejan.'
    },
    school: {
      name: 'Escuela de motocross', cat: 'riders', w: 2, h: 2, cost: 18000, upkeep: 180, height: 3.6,
      access: 'any', capacity: 6, staff: 'coach', price: 35, unlock: 'research:school',
      desc: 'Clases para principiantes. Atrae nuevos pilotos y mejora su técnica. Necesita monitores.'
    },
    parts: {
      name: 'Tienda de recambios', cat: 'riders', w: 1, h: 1, cost: 9000, upkeep: 90, height: 3.4,
      access: 'any', capacity: 3, price: 30,
      desc: 'Neumáticos, palancas, guantes y gafas. Los pilotos compran aquí después de rodar y sus motos aguantan más.'
    },
    wash: {
      name: 'Lavadero de motos', cat: 'riders', w: 2, h: 1, cost: 7000, upkeep: 70, height: 3.2,
      access: 'any', capacity: 4, price: 6,
      desc: 'Agua a presión para quitar el barro antes de volver a casa. Mucha clientela los días de lluvia.'
    },
    rental: {
      name: 'Alquiler de motos', cat: 'riders', w: 2, h: 2, cost: 20000, upkeep: 200, height: 3.6,
      access: 'any', capacity: 6, price: 45, unlock: 'research:minicross',
      desc: 'Motos y equipación de alquiler: atrae a gente sin moto que quiere probar en las pistas fáciles (minicross o motocross sencillo).'
    },
    /* --- Public --- */
    entrance: {
      name: 'Taquilla y acceso', cat: 'public', w: 2, h: 1, cost: 6000, upkeep: 70, height: 5.0,
      access: 'path',
      desc: 'Punto de entrada de los espectadores, que pagan aquí la entrada. Conéctala con caminos.'
    },
    parking: {
      name: 'Aparcamiento', cat: 'public', w: 3, h: 3, cost: 5000, upkeep: 30, height: 0.6,
      access: 'road', capacity: 12,
      desc: '12 plazas de coche. Debe tocar una carretera. Sin aparcamiento llegan muy pocos espectadores.'
    },
    grandstand: {
      name: 'Grada', cat: 'public', w: 2, h: 1, cost: 7000, upkeep: 50, height: 3.4,
      access: 'path', capacity: 24,
      desc: '24 asientos junto a la pista. Colócala a menos de 20 m del circuito y conéctala a un camino.'
    },
    grandstand_cov: {
      name: 'Grada cubierta', cat: 'public', w: 2, h: 1, cost: 14000, upkeep: 90, height: 5.2,
      access: 'path', capacity: 32, unlock: 'research:covered',
      desc: '32 asientos a cubierto. Los espectadores la prefieren cuando llueve.'
    },
    foodtruck: {
      name: 'Food truck', cat: 'public', w: 1, h: 1, cost: 4000, upkeep: 40, height: 3.0,
      access: 'path', capacity: 2, sells: 'food',
      desc: 'Bocadillos y refrescos. Barato y rápido de montar.'
    },
    restaurant: {
      name: 'Bar-restaurante', cat: 'public', w: 2, h: 2, cost: 16000, upkeep: 180, height: 4.6,
      access: 'path', capacity: 8, sells: 'food', seats: true,
      desc: 'Más capacidad y más caja que un food truck. Los clientes descansan sentados.'
    },
    restaurant_big: {
      name: 'Restaurante con terraza', cat: 'public', w: 3, h: 2, cost: 30000, upkeep: 300, height: 5.2,
      access: 'path', capacity: 16, sells: 'food', seats: true, spend: 1.6, unlock: 'research:hospitality',
      desc: 'Comidas completas y terraza con vistas. Mucha capacidad y cada cliente gasta más que en un bar.'
    },
    shop: {
      name: 'Tienda de merchandising', cat: 'public', w: 1, h: 1, cost: 7000, upkeep: 70, height: 3.6,
      access: 'path', capacity: 3, sells: 'merch',
      desc: 'Camisetas, gorras y réplicas de los pilotos famosos. Vende más con buenos eventos.'
    },
    megastore: {
      name: 'Tienda oficial', cat: 'public', w: 2, h: 2, cost: 24000, upkeep: 220, height: 5.0,
      access: 'path', capacity: 8, sells: 'merch', spend: 1.7, unlock: 'research:hospitality',
      desc: 'Equipación, cascos y réplicas oficiales del complejo. Vende mucho más que un puesto y atrae a los aficionados.'
    },
    playground: {
      name: 'Zona infantil', cat: 'public', w: 2, h: 2, cost: 8000, upkeep: 60, height: 3.0,
      access: 'path', capacity: 10,
      desc: 'Columpios y mini rampas. Los niños se lo pasan en grande y las familias se quedan más tiempo.'
    },
    toilets: {
      name: 'Baños', cat: 'public', w: 1, h: 1, cost: 3500, upkeep: 40, height: 3.0,
      access: 'any', capacity: 3,
      desc: 'Imprescindibles para espectadores y pilotos. Los limpiadores los mantienen decentes.'
    },
    camping: {
      name: 'Zona de acampada', cat: 'public', w: 3, h: 3, cost: 9000, upkeep: 90, height: 2.4,
      access: 'path', capacity: 8, unlock: 'research:camping',
      desc: 'Parcelas para tiendas y caravanas. Ingresos por noche y más público en los eventos.'
    },
    /* --- Services --- */
    office: {
      name: 'Oficina', cat: 'services', w: 2, h: 1, cost: 10000, upkeep: 120, height: 3.6,
      access: 'any',
      desc: 'Gestión del complejo: permite campañas de marketing, patrocinadores y campeonatos oficiales.'
    },
    tower: {
      name: 'Torre de control', cat: 'services', w: 1, h: 1, cost: 22000, upkeep: 160, height: 10.5,
      access: 'any', unlock: 'research:timing',
      desc: 'Dirección de carrera y cronometraje. Obligatoria para campeonatos regionales o superiores.'
    },
    medical: {
      name: 'Puesto médico', cat: 'services', w: 1, h: 1, cost: 9000, upkeep: 90, height: 3.0,
      access: 'any', staff: 'medic',
      desc: 'Base de los sanitarios, que atienden a los pilotos heridos. Obligatorio para competir.'
    },
    depot: {
      name: 'Nave de mantenimiento', cat: 'services', w: 2, h: 2, cost: 12000, upkeep: 100, height: 4.8,
      access: 'any', staff: 'crew',
      desc: 'Guarda la maquinaria. Los operarios salen desde aquí a reparar y regar la pista.'
    },
    screen: {
      name: 'Pantalla gigante', cat: 'services', w: 2, h: 1, cost: 30000, upkeep: 260, height: 8.0,
      access: 'none', unlock: 'research:screen',
      desc: 'Muestra la acción a los espectadores cercanos. Obligatoria en eventos internacionales.'
    },
    podium: {
      name: 'Podio', cat: 'services', w: 1, h: 1, cost: 5000, upkeep: 20, height: 3.0,
      access: 'none', unlock: 'research:podium',
      desc: 'Ceremonia de trofeos. Obligatorio en campeonatos nacionales o superiores.'
    }
  };

  /* Decorations: one per tile, on grass. 'safety' items count for the safety rating. */
  const decor = {
    tree_pine: { name: 'Pino', cost: 300, scenery: 0.6, desc: 'Da sombra y ambiente.' },
    tree_oak: { name: 'Encina', cost: 350, scenery: 0.7, desc: 'Árbol frondoso.' },
    tree_poplar: { name: 'Chopo', cost: 280, scenery: 0.5, desc: 'Alto y esbelto.' },
    tree_fir: { name: 'Abeto', cost: 320, scenery: 0.6, desc: 'Árbol de montaña, alto y oscuro.' },
    tree_palm: { name: 'Palmera datilera', cost: 380, scenery: 0.7, desc: 'Sombra para la playa y el oasis.' },
    tree_cactus: { name: 'Cactus', cost: 160, scenery: 0.4, desc: 'Aguanta el sol del desierto.' },
    bush: { name: 'Arbusto', cost: 120, scenery: 0.3, desc: 'Vegetación baja.' },
    flowers: { name: 'Parterre de flores', cost: 220, scenery: 0.6, desc: 'Color para los caminos.' },
    rock: { name: 'Roca', cost: 150, scenery: 0.2, desc: 'Decoración natural.' },
    flag: { name: 'Bandera', cost: 250, scenery: 0.4, desc: 'Ondea al viento.' },
    banner: { name: 'Pancarta de patrocinio', cost: 600, scenery: 0.3, banner: true, desc: 'Luce el logo de tus patrocinadores. Algunos contratos exigen pancartas.' },
    haybales: { name: 'Balas de paja', cost: 300, safety: 1, desc: 'Protección junto a saltos y curvas. Mejora la seguridad.' },
    tires: { name: 'Muro de neumáticos', cost: 400, safety: 1.2, desc: 'Barrera de neumáticos. Mejora la seguridad.' },
    safetyfence: { name: 'Valla de seguridad', cost: 350, safety: 0.9, desc: 'Separa al público de la pista. Mejora la seguridad.' },
    statue: { name: 'Estatua del campeón', cost: 8000, scenery: 3, h: 5, desc: 'Homenaje a los grandes. Gusta mucho al público.' },
    arch: { name: 'Arco hinchable', cost: 1500, scenery: 1.2, banner: true, h: 5, desc: 'Arco de patrocinador para ambientar.' },
    /* themed packs (decorThemes): a few of one theme together make a themed zone */
    mm_wreck: { theme: 'madmax', name: 'Coche desguazado', cost: 900, scenery: 0.8, h: 2, desc: 'Chatarra oxidada con pinchos en el capó.' },
    mm_barrels: { theme: 'madmax', name: 'Bidones en llamas', cost: 600, scenery: 0.7, h: 2.2, desc: 'Fuego para los fríos del páramo.' },
    mm_spikes: { theme: 'madmax', name: 'Barricada de pinchos', cost: 500, scenery: 0.5, h: 1.8, desc: 'Que nadie se acerque a tu chatarra.' },
    mm_tower: { theme: 'madmax', name: 'Torre vigía de chatarra', cost: 1800, scenery: 1.3, h: 6, desc: 'Chapas, cadenas y una bandera hecha jirones.' },
    mm_skull: { theme: 'madmax', name: 'Tótem de calavera', cost: 700, scenery: 0.8, h: 3.6, desc: 'Calavera con cuernos sobre un poste.' },
    mm_rig: { theme: 'madmax', name: 'Camión de guerra', cost: 2500, scenery: 1.6, h: 3.4, desc: 'Cabina blindada con rejilla de pinchos y escapes al cielo.' },
    ds_saguaro: { theme: 'desert', loose: true, name: 'Cactus saguaro', cost: 250, scenery: 0.5, h: 4, desc: 'El cactus gigante de las películas del oeste.' },
    ds_pear: { theme: 'desert', loose: true, name: 'Chumberas', cost: 180, scenery: 0.4, h: 1.6, desc: 'Palas verdes con higos chumbos.' },
    ds_arch: { theme: 'desert', name: 'Arco de roca', cost: 1500, scenery: 1.4, h: 3.6, desc: 'Arenisca tallada por el viento.' },
    ds_skull: { theme: 'desert', loose: true, name: 'Calavera de vaca', cost: 200, scenery: 0.4, h: 1, desc: 'Un recuerdo del último que se perdió.' },
    ds_windpump: { theme: 'desert', name: 'Molino de agua', cost: 1200, scenery: 1.0, h: 6.5, desc: 'Molino de aspas sobre su depósito.' },
    ds_tumble: { theme: 'desert', loose: true, name: 'Planta rodadora', cost: 100, scenery: 0.2, h: 1.2, desc: 'Rueda con el viento.' },
    sf_palm: { theme: 'surf', loose: true, name: 'Palmera', cost: 400, scenery: 0.8, h: 6, desc: 'Con cocos y todo.' },
    sf_boards: { theme: 'surf', name: 'Tablas de surf', cost: 500, scenery: 0.6, h: 2.4, desc: 'Un soporte con tablas de colores.' },
    sf_umbrella: { theme: 'surf', name: 'Sombrilla y hamacas', cost: 450, scenery: 0.6, h: 2.6, desc: 'Para ver las motos a la sombra.' },
    sf_lifeguard: { theme: 'surf', name: 'Torre de socorrista', cost: 1600, scenery: 1.2, h: 4.6, desc: 'Caseta en alto con bandera roja.' },
    sf_tiki: { theme: 'surf', name: 'Chiringuito tiki', cost: 2200, scenery: 1.4, h: 3.6, desc: 'Barra de bambú con techo de paja.' },
    sf_van: { theme: 'surf', name: 'Furgoneta surfera', cost: 1800, scenery: 1.1, h: 2.8, desc: 'Con las tablas en el techo.' },
    fm_barn: { theme: 'farm', name: 'Granero', cost: 3000, scenery: 1.5, h: 4.4, desc: 'Rojo, con su pajar y su portón.' },
    fm_bales: { theme: 'farm', loose: true, name: 'Pacas redondas', cost: 300, scenery: 0.4, h: 2, desc: 'Paja recién recogida.' },
    fm_tractor: { theme: 'farm', name: 'Tractor antiguo', cost: 1500, scenery: 1.0, h: 2.6, desc: 'Un clásico que aún arranca.' },
    fm_scarecrow: { theme: 'farm', loose: true, name: 'Espantapájaros', cost: 250, scenery: 0.5, h: 2.4, desc: 'Vigila los campos con su sombrero.' },
    fm_cow: { theme: 'farm', loose: true, name: 'Vaca', cost: 600, scenery: 0.7, h: 1.8, desc: 'Mira las motos con mucha calma.' },
    fm_silo: { theme: 'farm', name: 'Silo', cost: 2000, scenery: 1.2, h: 7.5, desc: 'Torre de grano galvanizada.' },
    mx_flags: { theme: 'mxgp', name: 'Banderas de las naciones', cost: 900, scenery: 0.9, h: 5, desc: 'Las banderas de los equipos del mundial.' },
    mx_gantry: { theme: 'mxgp', name: 'Pórtico del Mundial', cost: 3500, scenery: 1.8, h: 5.4, desc: 'Estructura de luces y pantalla para la gran cita.' },
    mx_trophy: { theme: 'mxgp', name: 'Trofeo gigante', cost: 4000, scenery: 2.2, h: 4.4, desc: 'Copa dorada de las naciones.' },
    mx_teamtruck: { theme: 'mxgp', name: 'Camión de equipo oficial', cost: 5000, scenery: 1.6, h: 3.4, desc: 'Hospitalidad de un equipo de fábrica.' },
    mx_camera: { theme: 'mxgp', name: 'Torre de televisión', cost: 2500, scenery: 1.2, h: 5, desc: 'Cámara y operador para la retransmisión.' },
    mx_inflatable: { theme: 'mxgp', name: 'Moto hinchable gigante', cost: 3000, scenery: 1.8, h: 3.6, desc: 'Una moto de cross de casi cuatro metros.' },
    fs_stage: { theme: 'festival', name: 'Escenario de conciertos', cost: 6000, scenery: 2.2, h: 4.6, desc: 'Música en directo entre carrera y carrera.' },
    fs_lights: { theme: 'festival', name: 'Guirnalda de luces', cost: 400, scenery: 0.6, h: 3.6, desc: 'Bombillas de colores entre dos postes.' },
    fs_balloons: { theme: 'festival', loose: true, name: 'Racimo de globos', cost: 200, scenery: 0.4, h: 3.4, desc: 'Globos de colores para la fiesta.' },
    fs_ferris: { theme: 'festival', name: 'Noria', cost: 8000, scenery: 2.8, h: 5, desc: 'Pequeña noria con vistas al circuito.' },
    fs_tent: { theme: 'festival', name: 'Carpa de feria', cost: 1200, scenery: 1.0, h: 4.2, desc: 'Carpa de rayas con banderín.' }
  };
  /* starting environments, from the flattest to the most mountainous (relief 1 to 5) */
  const environments = [
    { id: 'playa', name: 'Playa', relief: 1, desc: 'Costa llana con playa, dunas y palmeras. El mar entra por el norte del terreno.' },
    { id: 'campo', name: 'Campo', relief: 2, desc: 'Lomas suaves entre prados, campos de cultivo, encinas y estanques.' },
    { id: 'desierto', name: 'Desierto', relief: 3, desc: 'Dunas, mesetas de roca, cactus y un oasis. Arena por todas partes.' },
    { id: 'colinas', name: 'Colinas', relief: 4, desc: 'Colinas verdes con bosques y lagos: subidas y bajadas de verdad.' },
    { id: 'montana', name: 'Montaña', relief: 5, desc: 'Una ladera que sube hacia picos nevados. Mucho desnivel y más obras.' }
  ];
  /* the packs of the decoration window, in order */
  const decorThemes = [
    { id: 'basic', name: 'Básicos', desc: 'Naturaleza, seguridad y patrocinio.' },
    { id: 'madmax', name: 'Mad Max', desc: 'Un páramo postapocalíptico: chatarra, fuego y pinchos. Luce más sobre tierra o hierba seca (Terreno > Pintar suelo).' },
    { id: 'desert', name: 'Desierto', desc: 'Cactus, rocas y molinos del oeste. Pinta el suelo de arena en Terreno para completar el paisaje.' },
    { id: 'surf', name: 'Surf', desc: 'Playa, palmeras y chiringuito. Con arena alrededor y junto a un estanque parece la costa.' },
    { id: 'farm', name: 'Granja', desc: 'Granero, tractor y animales, ideal para un circuito de campo entre árboles.' },
    { id: 'mxgp', name: 'Mundial MX', desc: 'Ambiente de gran premio y de motocross de las naciones. Junto a la recta de meta y las gradas luce más.' },
    { id: 'festival', name: 'Festival', desc: 'Música, luces y atracciones para los caminos con más público.' }
  ];

  const paths = {
    1: { id: 'path_gravel', name: 'Camino de grava', cost: 25, comfort: 0 },
    2: { id: 'path_paved', name: 'Camino adoquinado', cost: 60, comfort: 1 },
    3: { id: 'road', name: 'Carretera', cost: 90, comfort: 0 }
  };
  const addons = {
    bench: { name: 'Banco', cost: 300, desc: 'Los espectadores descansan sentados.' },
    bin: { name: 'Papelera', cost: 150, desc: 'Reduce la basura en los caminos.' },
    lamp: { name: 'Farola', cost: 200, desc: 'Decoración para los caminos.' }
  };

  /* Track surfaces. cost is € per metre for an 8 m wide track. */
  const surfaces = {
    dirt: { name: 'Tierra seca', grip: 0.92, drag: 1.0, dust: 1.0, wear: 1.0, maint: 1.0, diff: 0, cost: 45, stamina: 1.0, wet: 0.34, color: '#9a6a3c' },
    sand: { name: 'Arena', grip: 0.7, drag: 1.38, dust: 0.25, wear: 1.5, maint: 0.8, diff: 1.3, cost: 70, stamina: 1.7, wet: 0.08, color: '#d9b77a', unlock: 'research:sand' },
    mud: { name: 'Barro', grip: 0.58, drag: 1.26, dust: 0, wear: 1.9, maint: 1.25, diff: 1.6, cost: 55, stamina: 1.4, wet: 0.12, color: '#5a3d26', unlock: 'research:mud' },
    hardpack: { name: 'Hardpack', grip: 1.02, drag: 0.9, dust: 0.6, wear: 0.6, maint: 0.75, diff: -0.2, cost: 85, stamina: 0.9, wet: 0.28, color: '#8b7766', unlock: 'research:hardpack' },
    clay: { name: 'Arcilla', grip: 0.8, drag: 0.94, dust: 0.75, wear: 0.7, maint: 0.85, diff: 0.4, cost: 60, stamina: 1.0, wet: 0.45, color: '#b5643a' },
    loam: { name: 'Tierra de monte', grip: 0.86, drag: 1.1, dust: 0.45, wear: 1.1, maint: 0.4, diff: 0.7, cost: 22, stamina: 1.3, wet: 0.2, color: '#5d4630' },
    gravel: { name: 'Grava y tierra', grip: 0.74, drag: 1.04, dust: 1.4, wear: 0.8, maint: 0.8, diff: 0.5, cost: 50, stamina: 1.0, wet: 0.1, color: '#9b9283' }
  };
  const surfaceOrder = ['dirt', 'sand', 'mud', 'hardpack', 'clay', 'loam', 'gravel'];

  /* Circuit disciplines. Each one has its own vehicles, customers, pieces, look
     (edge: stakes, kids, sxwall, rails, tape, tyres; start: gate, line, lights, crono)
     and competitions. Slopes and banks list the classes the constructor offers. */
  const trackTypes = {
    kids: {
      name: 'Minicross', short: 'Mini', color: '#29b6f6', vehicle: 'mini', unlock: 'research:minicross',
      desc: 'Pista corta y segura para niños y principiantes con motos pequeñas. Las familias se quedan a mirar.',
      riders: 'niños y principiantes', widths: [4, 5, 6], width: 5, surfaces: ['dirt', 'hardpack'], surface: 'dirt',
      slopes: [-1, 0, 1], banks: [0, 1], len: [120, 700], skill: [6, 38], fee: 0.6, demand: 0.8, crowd: 0.7, cap: 18,
      edge: 'kids', start: 'gate', jumps: true,
      specials: ['finish', 'minijump', 'tabletop_s', 'rollers'], features: ['start', 'finish', 'minijump', 'tabletop_s', 'rollers', 'berm']
    },
    mx: {
      name: 'Motocross', short: 'MX', color: '#ff6a13', vehicle: 'mx',
      desc: 'El clásico: saltos, peraltes y secciones rítmicas. Atrae pilotos de todos los niveles y es la base de los grandes campeonatos.',
      riders: 'pilotos de motocross de todos los niveles', widths: [6, 7, 8, 10, 12], width: 8, surfaces: ['dirt', 'sand', 'mud', 'hardpack'], surface: 'dirt',
      slopes: [-2, -1, 0, 1, 2], banks: [0, 1, 2], len: [250, 2600], skill: [12, 96], fee: 1, demand: 1, crowd: 1, cap: 24,
      edge: 'stakes', start: 'gate', jumps: true,
      specials: ['finish', 'tabletop_s', 'tabletop_m', 'tabletop_l', 'double_s', 'double_l', 'triple', 'stepup', 'plateau', 'whoops', 'rollers', 'dubbies', 'rhythm'],
      features: ['start', 'finish', 'tabletop_s', 'tabletop_m', 'tabletop_l', 'double_s', 'double_l', 'triple', 'stepup', 'plateau', 'whoops', 'rollers', 'dubbies', 'rhythm', 'berm', 'berm_big']
    },
    sx: {
      name: 'Supercross', short: 'SX', color: '#7e57c2', vehicle: 'mx', unlock: 'research:supercross',
      desc: 'Estadio: trazado corto y muy técnico, con saltos enormes, whoops y curvas cerradas. Solo para expertos y profesionales, y el mejor espectáculo para el público.',
      riders: 'expertos y profesionales', widths: [6, 7, 8], width: 7, surfaces: ['hardpack', 'dirt'], surface: 'hardpack',
      slopes: [-2, -1, 0, 1, 2], banks: [0, 1, 2], len: [220, 900], skill: [58, 99], fee: 1.6, demand: 0.4, crowd: 1.7, cap: 20,
      edge: 'sxwall', start: 'gate', jumps: true,
      specials: ['finish', 'tabletop_m', 'tabletop_l', 'double_s', 'double_l', 'triple', 'stepup', 'whoops', 'dubbies', 'rhythm'],
      features: ['start', 'finish', 'tabletop_m', 'tabletop_l', 'double_s', 'double_l', 'triple', 'stepup', 'whoops', 'dubbies', 'rhythm', 'berm', 'berm_big']
    },
    flat: {
      name: 'Dirt track', short: 'Óvalo', color: '#e53935', vehicle: 'flat', unlock: 'research:flattrack',
      desc: 'Óvalo de arcilla completamente llano: rectas a fondo y curvas derrapando, sin saltos. Carreras muy igualadas que encantan al público.',
      riders: 'pilotos de flat track y motos clásicas', widths: [8, 10, 12], width: 10, surfaces: ['clay', 'hardpack'], surface: 'clay',
      slopes: [0], banks: [0], len: [160, 900], skill: [18, 96], fee: 0.9, demand: 0.55, crowd: 1.25, cap: 30,
      edge: 'rails', start: 'line', jumps: false,
      specials: ['finish'], features: ['start', 'finish']
    },
    enduro: {
      name: 'Crono de enduro', short: 'Enduro', color: '#43a047', vehicle: 'enduro', unlock: 'research:enduro',
      desc: 'Especial cronometrada por el monte: estrecha, larga y con troncos, pedreras y vadeos. Los pilotos salen de uno en uno contra el reloj y les encanta rodar entre árboles.',
      riders: 'pilotos de enduro y trail', widths: [3, 4, 5], width: 4, surfaces: ['loam', 'dirt', 'mud', 'sand'], surface: 'loam',
      slopes: [-2, -1, 0, 1, 2], banks: [0], len: [300, 2600], skill: [16, 94], fee: 1.3, demand: 0.7, crowd: 0.45, cap: 60,
      edge: 'tape', start: 'crono', jumps: false,
      specials: ['finish', 'logs', 'rocks', 'ford', 'rollers'], features: ['start', 'finish', 'logs', 'rocks', 'ford', 'rollers']
    },
    carcross: {
      name: 'Car cross', short: 'Car', color: '#fdd835', vehicle: 'car', unlock: 'research:carcross',
      desc: 'Buggies monoplaza sobre grava y tierra: pista ancha, derrapes y mucho contacto. Pilotos de coches que pagan bien y un público que disfruta de lo lindo.',
      riders: 'pilotos de car cross', widths: [10, 12, 14], width: 12, surfaces: ['gravel', 'dirt', 'hardpack'], surface: 'gravel',
      slopes: [-1, 0, 1], banks: [0, 1], len: [250, 1600], skill: [14, 95], fee: 2.2, demand: 0.45, crowd: 1.35, cap: 32,
      edge: 'tyres', start: 'lights', jumps: false,
      specials: ['finish', 'crest', 'splash', 'rollers'], features: ['start', 'finish', 'crest', 'splash', 'rollers', 'berm']
    }
  };
  const trackTypeOrder = ['kids', 'mx', 'sx', 'flat', 'enduro', 'carcross'];

  /* Track features. Lengths in metres along the track, heights in metres. */
  const features = {
    start: { name: 'Parrilla de salida', group: 'basic', kind: 'start', len: 4, cost: 6000, desc: 'Puerta de salida para las carreras y acceso de los pilotos a la pista. Colócala en una recta.' },
    finish: { name: 'Línea de meta', group: 'basic', kind: 'finish', len: 3, cost: 1500, desc: 'Cronometraje de vueltas. Obligatoria para abrir el circuito.' },
    tabletop_s: { name: 'Tabletop pequeño', group: 'jump', kind: 'table', H: 1.3, face: 4.0, top: 5.0, land: 5.5, cost: 2500, desc: 'Salto con meseta: si te quedas corto aterrizas arriba. Ideal para principiantes.' },
    tabletop_m: { name: 'Tabletop mediano', group: 'jump', kind: 'table', H: 2.1, face: 5.0, top: 8.0, land: 7.0, cost: 4200, desc: 'El salto clásico de cualquier circuito.' },
    tabletop_l: { name: 'Tabletop grande', group: 'jump', kind: 'table', H: 3.1, face: 6.5, top: 12.0, land: 8.5, cost: 7000, desc: 'Mucho vuelo. Exige velocidad.' },
    double_s: { name: 'Doble pequeño', group: 'jump', kind: 'double', H: 1.7, face: 4.2, back: 2.6, gap: 4.5, landUp: 1.6, land: 6.0, cost: 4500, unlock: 'research:doubles', desc: 'Dos lomas con hueco. Los principiantes lo pasan rodando.' },
    double_l: { name: 'Doble grande', group: 'jump', kind: 'double', H: 2.5, face: 5.2, back: 3.0, gap: 8.0, landUp: 2.0, land: 7.5, cost: 7500, unlock: 'research:doubles', desc: 'Si caes corto, castigo seguro. Espectacular.' },
    triple: { name: 'Triple', group: 'jump', kind: 'triple', H: 2.6, face: 5.5, back: 2.6, gap: 6.0, mid: 4.0, gap2: 6.0, landUp: 2.0, land: 8.0, cost: 13000, unlock: 'research:triples', desc: 'Tres lomas en línea. Solo para expertos.' },
    stepup: { name: 'Escalón (step-up)', group: 'jump', kind: 'stepup', H: 2.2, face: 3.8, top: 9.0, down: 11.0, cost: 5000, unlock: 'research:plateaus', desc: 'Salto hacia arriba a una plataforma.' },
    plateau: { name: 'Meseta', group: 'jump', kind: 'table', H: 2.3, face: 5.5, top: 20.0, land: 7.5, cost: 8000, unlock: 'research:plateaus', desc: 'Tabletop extralargo: cambia el ritmo de la vuelta.' },
    whoops: { name: 'Whoops', group: 'rhythm', kind: 'bumps', n: 8, H: 0.65, pitch: 2.2, vb: 4.5, vs: 10.5, cost: 3200, desc: 'Baches rítmicos: los buenos los pasan rozando, los demás sufren.' },
    rollers: { name: 'Rollers', group: 'rhythm', kind: 'bumps', n: 5, H: 1.15, pitch: 6.0, vb: 8.0, vs: 8.5, cost: 2800, desc: 'Lomas suaves y redondeadas.' },
    dubbies: { name: 'Dubbies', group: 'rhythm', kind: 'bumps', n: 4, H: 1.05, pitch: 4.4, vb: 6.5, vs: 8.5, cost: 2600, unlock: 'research:rhythm', desc: 'Lomitas cortas que se pueden doblar.' },
    rhythm: { name: 'Sección rítmica', group: 'rhythm', kind: 'rhythm', heights: [1.6, 1.5, 1.7, 1.4, 1.6, 1.5], spacing: [6.2, 6.8, 6.0, 7.2, 6.4], cost: 7500, unlock: 'research:rhythm', desc: 'Combinación de lomas para dobles y triples encadenados.' },
    berm: { name: 'Peralte', group: 'corner', kind: 'berm', H: 1.1, cost: 1600, desc: 'Curva peraltada: se toma mucho más rápido. Haz clic en una curva.' },
    berm_big: { name: 'Peralte grande', group: 'corner', kind: 'berm', H: 1.8, cost: 2600, unlock: 'research:berms', desc: 'Peralte alto para curvas muy rápidas.' },
    minijump: { name: 'Saltito', group: 'jump', kind: 'table', H: 0.6, face: 2.6, top: 2.6, land: 3.2, cost: 1200, desc: 'Mesa diminuta para que los peques despeguen las ruedas sin riesgo.' },
    crest: { name: 'Cambio de rasante', group: 'jump', kind: 'table', H: 0.9, face: 7.0, top: 3.0, land: 8.0, cost: 2200, desc: 'Loma larga y suave: los coches se aligeran o vuelan un poco.' },
    logs: { name: 'Troncos', group: 'natural', kind: 'logs', n: 3, H: 0.42, pitch: 3.4, vb: 2.8, vs: 5.5, cost: 900, desc: 'Troncos atravesados en la pista: se pasan con técnica y mucho cuidado.' },
    rocks: { name: 'Pedrera', group: 'natural', kind: 'rocks', len: 16, H: 0.34, vb: 3.2, vs: 6.5, cost: 1300, desc: 'Tramo de piedras sueltas: lento, duro y muy técnico.' },
    ford: { name: 'Vadeo', group: 'natural', kind: 'water', len: 12, depth: 0.55, vb: 4.0, vs: 7.0, cost: 1600, desc: 'Paso por agua: frena a los pilotos y deja fotos espectaculares.' },
    splash: { name: 'Charco', group: 'natural', kind: 'water', len: 10, depth: 0.3, vb: 9.0, vs: 9.0, cost: 1200, desc: 'Charco ancho que se pasa a toda velocidad levantando agua.' }
  };
  const featureGroups = [
    { id: 'basic', name: 'Básicos' },
    { id: 'jump', name: 'Saltos' },
    { id: 'rhythm', name: 'Rítmicos' },
    { id: 'natural', name: 'Obstáculos' },
    { id: 'corner', name: 'Curvas' }
  ];

  /* Vehicles by class (mx, mini, flat, enduro, car). The first five keep their order:
     old code and saves index motocross bikes by position. */
  const bikes = [
    { id: 'mini', name: 'Pit bike 125', vehicle: 'mx', stroke: 4, accel: 5.0, top: 22, handling: 1.05, reliability: 0.95, minSkill: 0, maxSkill: 30 },
    { id: 'e125', name: 'MX 125 2T', vehicle: 'mx', stroke: 2, accel: 6.6, top: 29, handling: 1.06, reliability: 0.86, minSkill: 15, maxSkill: 100 },
    { id: 'f250', name: 'MX 250F 4T', vehicle: 'mx', stroke: 4, accel: 7.1, top: 31, handling: 1.0, reliability: 0.92, minSkill: 20, maxSkill: 100 },
    { id: 'e250', name: 'MX 250 2T', vehicle: 'mx', stroke: 2, accel: 7.7, top: 32, handling: 0.97, reliability: 0.84, minSkill: 35, maxSkill: 100 },
    { id: 'f450', name: 'MX 450F 4T', vehicle: 'mx', stroke: 4, accel: 8.6, top: 35, handling: 0.9, reliability: 0.9, minSkill: 45, maxSkill: 100 },
    { id: 'm50', name: 'Mini 50', vehicle: 'mini', stroke: 2, accel: 3.4, top: 14, handling: 1.1, reliability: 0.96, minSkill: 0, maxSkill: 22 },
    { id: 'm65', name: 'Mini 65', vehicle: 'mini', stroke: 2, accel: 4.3, top: 18, handling: 1.08, reliability: 0.94, minSkill: 10, maxSkill: 34 },
    { id: 'm85', name: 'Mini 85', vehicle: 'mini', stroke: 2, accel: 5.0, top: 22, handling: 1.05, reliability: 0.94, minSkill: 20, maxSkill: 100 },
    { id: 'ft450', name: 'Flat track 450', vehicle: 'flat', stroke: 4, accel: 7.4, top: 33, handling: 1.1, reliability: 0.92, minSkill: 0, maxSkill: 100 },
    { id: 'ft750', name: 'Bicilíndrica 750', vehicle: 'flat', stroke: 4, twin: true, accel: 8.8, top: 38, handling: 0.98, reliability: 0.88, minSkill: 55, maxSkill: 100 },
    { id: 'en250', name: 'Enduro 250 4T', vehicle: 'enduro', stroke: 4, accel: 6.2, top: 27, handling: 1.08, reliability: 0.93, minSkill: 0, maxSkill: 100 },
    { id: 'en300', name: 'Enduro 300 2T', vehicle: 'enduro', stroke: 2, accel: 7.0, top: 28, handling: 1.04, reliability: 0.88, minSkill: 35, maxSkill: 100 },
    { id: 'cc600', name: 'Car cross 600', vehicle: 'car', accel: 7.0, top: 29, handling: 1.12, reliability: 0.9, minSkill: 0, maxSkill: 100 },
    { id: 'cc1000', name: 'Car cross 1000', vehicle: 'car', accel: 8.4, top: 33, handling: 1.08, reliability: 0.86, minSkill: 50, maxSkill: 100 }
  ];
  /* Models, scale and size of each vehicle class (half width in metres for traffic). The
     rider's body (sit/stand) and the machine (kind + make) are drawn as two models. */
  const vehicles = {
    mx: { sit: 'rb_sit', stand: 'rb_stand', kind: 'mx', scale: 1, half: 0.75 },
    mini: { sit: 'rb_sit', stand: 'rb_stand', kind: 'mx', scale: 0.7, half: 0.55 },
    flat: { sit: 'rb_flat', stand: 'rb_flat', kind: 'ft', scale: 1, half: 0.75, slide: true },
    enduro: { sit: 'rb_sit_pack', stand: 'rb_stand_pack', kind: 'en', scale: 1, half: 0.75 },
    car: { sit: null, stand: null, kind: 'car', scale: 1, half: 1.15, car: true }
  };
  /* Makes and their factory colours: plastics (main), graphics, number plates (plate,
     side, digit), fenders, seat, frame, rims, fork tubes and guards, clamps and shock
     spring. cls: the vehicle classes each make builds; w: how common it is. */
  const brands = {
    kronos: { name: 'Kronos', cls: ['mx', 'mini', 'enduro'], w: 1.3, main: '#ff6a00', gfx: '#1e1e1e', side: '#ff6a00', plate: '#f3f3f3', digit: '#1e1e1e', seat: '#1e1e1e', frame: '#ff6a00', rim: '#1e1e1e', fork: '#ef7d1a', guard: '#1e1e1e', clamp: '#ff6a00', spring: '#ff6a00', pad: '#ff6a00' },
    hanza: { name: 'Hanza', cls: ['mx', 'mini'], w: 1.2, main: '#e3101b', gfx: '#f4f4f4', side: '#e3101b', plate: '#e3101b', digit: '#f4f4f4', seat: '#1e1e1e', frame: '#c4c8cc', rim: '#1e1e1e', fork: '#d4a017', guard: '#1e1e1e', clamp: '#1e1e1e', spring: '#e3101b', pad: '#e3101b' },
    yamato: { name: 'Yamato', cls: ['mx', 'mini', 'enduro'], w: 1.1, main: '#1f3fbf', gfx: '#f4f4f4', side: '#f4f4f4', plate: '#f4f4f4', digit: '#1e1e1e', rfender: '#f4f4f4', seat: '#1f3fbf', frame: '#9ba7c2', rim: '#2147d6', fork: '#d4a017', guard: '#1e1e1e', clamp: '#1e1e1e', spring: '#1f3fbf', pad: '#1f3fbf' },
    kawara: { name: 'Kawara', cls: ['mx', 'mini'], w: 1.0, main: '#78d21a', gfx: '#1e1e1e', side: '#78d21a', plate: '#78d21a', digit: '#1e1e1e', seat: '#1e1e1e', frame: '#a3a9b0', rim: '#1e1e1e', fork: '#d4a017', guard: '#1e1e1e', clamp: '#1e1e1e', spring: '#78d21a', pad: '#78d21a' },
    huska: { name: 'Huska', cls: ['mx', 'mini', 'enduro'], w: 0.9, main: '#f4f4f4', gfx: '#1b3a8a', side: '#13306b', plate: '#f4f4f4', digit: '#13306b', seat: '#2a2a2a', frame: '#1f4db3', rim: '#1e1e1e', fork: '#2a2a2a', guard: '#f4f4f4', clamp: '#2a2a2a', spring: '#ffd400', pad: '#13306b' },
    suzaki: { name: 'Suzaki', cls: ['mx'], w: 0.7, main: '#ffd400', gfx: '#1f3fbf', side: '#ffd400', plate: '#ffd400', digit: '#1e1e1e', seat: '#1f3fbf', frame: '#c4c8cc', rim: '#1e1e1e', fork: '#d4a017', guard: '#1e1e1e', clamp: '#c4c8cc', spring: '#ffd400', pad: '#1f3fbf' },
    betta: { name: 'Betta', cls: ['enduro'], w: 1.0, main: '#e3101b', gfx: '#f4f4f4', side: '#f4f4f4', plate: '#e3101b', digit: '#1e1e1e', rfender: '#f4f4f4', seat: '#1e1e1e', frame: '#e3101b', rim: '#1e1e1e', fork: '#2a2a2a', guard: '#1e1e1e', clamp: '#1e1e1e', spring: '#f4f4f4', pad: '#e3101b' },
    sherpa: { name: 'Sherpa', cls: ['enduro'], w: 0.8, main: '#2156d6', gfx: '#ffd400', side: '#f4f4f4', plate: '#2156d6', digit: '#1e1e1e', fender: '#f4f4f4', rfender: '#f4f4f4', seat: '#1e2a5a', frame: '#c4c8cc', rim: '#2156d6', fork: '#d4a017', guard: '#2156d6', clamp: '#c4c8cc', spring: '#ffd400', pad: '#2156d6' },
    indus: { name: 'Indus', cls: ['flat'], w: 1.0, main: '#a3121a', gfx: '#f2d38b', side: '#ffd400', plate: '#ffd400', digit: '#1e1e1e', seat: '#1e1e1e', frame: '#1e1e1e', rim: '#1e1e1e', fork: '#2a2a2a', clamp: '#1e1e1e', spring: '#a3121a', pad: '#1e1e1e' },
    harlan: { name: 'Harlan', cls: ['flat'], w: 1.0, main: '#ff7a00', gfx: '#1e1e1e', side: '#f4f4f4', plate: '#f4f4f4', digit: '#1e1e1e', seat: '#1e1e1e', frame: '#1e1e1e', rim: '#1e1e1e', fork: '#2a2a2a', clamp: '#1e1e1e', spring: '#ff7a00', pad: '#1e1e1e' }
  };
  const brandsFor = (cls) => Object.keys(brands).filter(k => brands[k].cls.includes(cls));
  /* library model of a machine: kind, make and engine (two/four stroke, single/twin) */
  function bikeModel(bike, brand) {
    const v = vehicles[bike.vehicle] || vehicles.mx;
    if (v.car) return 'buggy';
    const b = brands[brand] && brands[brand].cls.includes(bike.vehicle) ? brand : brandsFor(bike.vehicle)[0];
    return v.kind + '_' + b + (v.kind === 'ft' ? (bike.twin ? '_twin' : '_single') : bike.stroke === 2 ? '_2t' : '_4t');
  }
  const bikeName = (bike, brand) => (brands[brand] ? brands[brand].name + ' ' : '') + bike.name;

  const staff = {
    mechanic: { name: 'Mecánico', plural: 'Mecánicos', salary: 680, needs: 'workshop', desc: 'Trabaja en el taller reparando motos.' },
    crew: { name: 'Operario de pista', plural: 'Operarios de pista', salary: 610, needs: 'depot', desc: 'Pasa el tractor por la pista para alisar baches y regar.' },
    cleaner: { name: 'Limpiador', plural: 'Limpiadores', salary: 470, needs: null, desc: 'Recoge la basura de los caminos y limpia los baños.' },
    medic: { name: 'Sanitario', plural: 'Sanitarios', salary: 830, needs: 'medical', desc: 'Atiende a los pilotos heridos con el quad sanitario.' },
    marshal: { name: 'Comisario', plural: 'Comisarios', salary: 500, needs: null, desc: 'Vigila la pista con banderas. Reduce caídas en cadena. Exigido en campeonatos.' },
    coach: { name: 'Monitor MX', plural: 'Monitores MX', salary: 650, needs: 'school', unlock: 'research:school', desc: 'Da clases en la escuela de motocross.' }
  };
  const staffOrder = ['mechanic', 'crew', 'cleaner', 'medic', 'marshal', 'coach'];

  /* Competitions. Attendance is the official crowd figure; visible spectators are a sample. */
  const events = {
    training: {
      name: 'Jornada de entrenamiento', tier: 0, rep: 0, cost: 800, riders: 0,
      desc: 'Promoción de un día: el doble de pilotos y tarifa normal. No hay carrera.',
      reqs: { paddock: 1 }
    },
    amateur: {
      track: 'mx', name: 'Carrera amateur', tier: 1, rep: 60, cost: 3000, prize: 1500, riders: 12, entryFee: 40,
      skill: [22, 62], ticket: 10, demand: 260, sponsor: 1200, tv: 0, diff: [1.0, 6.5], minLen: 350, laps: [3, 4],
      repGain: 35, unlock: 'obj:amateur',
      desc: 'Carrera local con pilotos de la zona. El primer paso para hacerse un nombre.',
      reqs: { paddock: 1, toilets: 1, medical: 1, medic: 1 }
    },
    regional: {
      track: 'mx', name: 'Campeonato regional', tier: 2, rep: 280, cost: 12000, prize: 5000, riders: 16, entryFee: 80,
      skill: [42, 76], ticket: 16, demand: 1100, sponsor: 6000, tv: 0, diff: [2.5, 7.5], minLen: 550, laps: [4, 5],
      repGain: 70, unlock: 'obj:regional',
      desc: 'Prueba puntuable con pilotos federados. Exige organización seria.',
      reqs: { paddock: 1, toilets: 2, medical: 1, medic: 1, office: 1, tower: 1, workshop: 1, seats: 48, marshal: 2, foodtruck: 1 }
    },
    national: {
      track: 'mx', name: 'Campeonato nacional', tier: 3, rep: 500, cost: 40000, prize: 15000, riders: 20, entryFee: 150,
      skill: [58, 88], ticket: 24, demand: 4200, sponsor: 15000, tv: 15000, diff: [4.0, 8.5], minLen: 750, laps: [5, 6],
      repGain: 120, unlock: 'obj:national',
      desc: 'Los mejores pilotos del país. Televisión, patrocinadores y mucho público.',
      reqs: { paddock: 2, toilets: 4, medical: 1, medic: 2, office: 1, tower: 1, workshop: 1, seats: 144, marshal: 4, boxes: 2, podium: 1, parking: 2, safety: 0.6 }
    },
    international: {
      track: 'mx', name: 'Evento internacional', tier: 4, rep: 680, cost: 90000, prize: 35000, riders: 24, entryFee: 250,
      skill: [70, 95], ticket: 35, demand: 9500, sponsor: 30000, tv: 45000, diff: [5.0, 9.0], minLen: 900, laps: [5, 7],
      repGain: 170, unlock: 'obj:international',
      desc: 'Equipos de todo el mundo. Tu complejo en el mapa internacional.',
      reqs: { paddock: 2, toilets: 5, medical: 2, medic: 3, office: 1, tower: 1, workshop: 2, seats: 288, marshal: 6, boxes: 4, podium: 1, parking: 3, screen: 1, camping: 1, safety: 0.7 }
    },
    gp: {
      track: 'mx', name: 'Gran Premio', tier: 5, rep: 820, cost: 200000, prize: 80000, riders: 30, entryFee: 400,
      skill: [80, 100], ticket: 50, demand: 22000, sponsor: 80000, tv: 120000, diff: [5.5, 9.5], minLen: 1050, laps: [6, 8],
      repGain: 250, unlock: 'obj:gp',
      desc: 'La élite mundial del motocross. El evento con el que sueña cualquier circuito.',
      reqs: { paddock: 3, toilets: 6, medical: 2, medic: 4, office: 1, tower: 1, workshop: 2, seats: 480, marshal: 8, boxes: 8, podium: 1, parking: 4, screen: 2, camping: 2, safety: 0.8 }
    }
  };
  /* Competitions of the other disciplines. format 'crono': riders start one by one
     and the classification is by time. */
  Object.assign(events, {
    kids_cup: {
      track: 'kids', name: 'Trofeo de minicross', tier: 1, rep: 70, cost: 1500, prize: 600, riders: 12, entryFee: 25,
      skill: [8, 36], ticket: 6, demand: 240, sponsor: 900, tv: 0, diff: [0, 6], minLen: 150, laps: [3, 5],
      repGain: 22, unlock: 'research:minicross',
      desc: 'Carrera para los peques de la comarca. Vienen familias enteras a animar.',
      reqs: { paddock: 1, toilets: 1, medical: 1, medic: 1 }
    },
    flat_race: {
      track: 'flat', name: 'Carrera de dirt track', tier: 2, rep: 180, cost: 6000, prize: 3000, riders: 12, entryFee: 60,
      skill: [35, 92], ticket: 14, demand: 900, sponsor: 4000, tv: 0, diff: [0, 10], minLen: 200, laps: [8, 14],
      repGain: 50, unlock: 'research:flattrack',
      desc: 'Mangas cortas y muy igualadas en el óvalo, derrapando a fondo en cada curva.',
      reqs: { paddock: 1, toilets: 2, medical: 1, medic: 1, seats: 48, foodtruck: 1 }
    },
    enduro_crono: {
      track: 'enduro', format: 'crono', name: 'Enduro cronometrado', tier: 2, rep: 200, cost: 5000, prize: 2500, riders: 18, entryFee: 70,
      skill: [28, 92], ticket: 5, demand: 320, sponsor: 3500, tv: 0, diff: [0, 10], minLen: 300, laps: [1, 3],
      repGain: 45, unlock: 'research:enduro',
      desc: 'Los pilotos salen de uno en uno cada pocos segundos y gana el mejor tiempo en la especial.',
      reqs: { paddock: 1, toilets: 1, medical: 1, medic: 2, marshal: 2 }
    },
    carcross_race: {
      track: 'carcross', name: 'Carrera de car cross', tier: 2, rep: 300, cost: 12000, prize: 6000, riders: 14, entryFee: 150,
      skill: [30, 94], ticket: 16, demand: 1400, sponsor: 7000, tv: 0, diff: [0, 10], minLen: 250, laps: [5, 8],
      repGain: 65, unlock: 'research:carcross',
      desc: 'Buggies rueda con rueda sobre la grava. Mucho contacto y un público entregado.',
      reqs: { paddock: 1, toilets: 2, medical: 1, medic: 2, office: 1, seats: 72, marshal: 2, foodtruck: 1 }
    },
    sx_night: {
      track: 'sx', name: 'Supercross nocturno', tier: 4, rep: 520, cost: 60000, prize: 25000, riders: 20, entryFee: 200,
      skill: [65, 98], ticket: 32, demand: 8000, sponsor: 25000, tv: 30000, diff: [3, 10], minLen: 250, laps: [10, 16],
      repGain: 150, unlock: 'research:supercross',
      desc: 'Estadio lleno, focos y fuegos artificiales. El evento más espectacular del calendario.',
      reqs: { paddock: 2, toilets: 4, medical: 1, medic: 3, office: 1, tower: 1, workshop: 1, seats: 240, marshal: 4, boxes: 2, podium: 1, parking: 2, screen: 1, safety: 0.6 }
    }
  });
  const eventOrder = ['training', 'kids_cup', 'amateur', 'flat_race', 'enduro_crono', 'regional', 'carcross_race', 'national', 'sx_night', 'international', 'gp'];

  const research = [
    { id: 'doubles', name: 'Saltos dobles', cost: 6000, days: 10, desc: 'Desbloquea dobles pequeños y grandes.' },
    { id: 'sand', name: 'Superficie de arena', cost: 4000, days: 7, desc: 'Arena blanda: lenta, técnica y agotadora.' },
    { id: 'mud', name: 'Zonas de barro', cost: 3000, days: 7, desc: 'Barro: poco agarre y mucho espectáculo.' },
    { id: 'hardpack', name: 'Hardpack compactado', cost: 6000, days: 10, desc: 'Superficie dura y rápida que se desgasta poco.' },
    { id: 'plateaus', name: 'Mesetas y escalones', cost: 5000, days: 9, desc: 'Desbloquea la meseta y el step-up.' },
    { id: 'rhythm', name: 'Secciones rítmicas', cost: 8000, days: 12, req: ['doubles'], desc: 'Dubbies y secciones rítmicas encadenadas.' },
    { id: 'triples', name: 'Saltos triples', cost: 12000, days: 16, req: ['doubles'], desc: 'El salto definitivo para profesionales.' },
    { id: 'berms', name: 'Peraltes reforzados', cost: 4500, days: 7, desc: 'Peraltes más altos para curvas rapidísimas.' },
    { id: 'timing', name: 'Cronometraje electrónico', cost: 7000, days: 10, desc: 'Desbloquea la torre de control, imprescindible en campeonatos.' },
    { id: 'watering', name: 'Riego de pista', cost: 8000, days: 12, desc: 'Los operarios riegan: menos polvo y un 25% menos de desgaste.' },
    { id: 'machinery', name: 'Maquinaria pesada', cost: 10000, days: 14, desc: 'Excavadoras propias: modificar el terreno cuesta un 40% menos.' },
    { id: 'covered', name: 'Gradas cubiertas', cost: 9000, days: 12, desc: 'Gradas con techo para los días de lluvia.' },
    { id: 'boxes', name: 'Boxes profesionales', cost: 8000, days: 10, desc: 'Garajes para equipos. Atraen pilotos expertos.' },
    { id: 'school', name: 'Escuela de motocross', cost: 10000, days: 14, desc: 'Escuela y monitores para formar principiantes.' },
    { id: 'camping', name: 'Zona de acampada', cost: 6000, days: 9, desc: 'Parcelas de acampada para eventos de varios días.' },
    { id: 'podium', name: 'Ceremonias de podio', cost: 3000, days: 5, desc: 'Podio para la entrega de trofeos.' },
    { id: 'screen', name: 'Pantalla gigante', cost: 15000, days: 16, req: ['timing'], desc: 'Realización en directo para el público.' },
    { id: 'digital', name: 'Marketing digital', cost: 5000, days: 8, desc: 'Campañas en redes sociales y televisión regional.' },
    { id: 'minicross', name: 'Minicross y alquiler', cost: 3500, days: 6, desc: 'Pistas para niños y principiantes, el Trofeo de minicross y el alquiler de motos.' },
    { id: 'hospitality', name: 'Hostelería y tienda oficial', cost: 7000, days: 9, minRep: 120, desc: 'Restaurante con terraza y tienda oficial: más caja por visitante.' },
    { id: 'flattrack', name: 'Dirt track', cost: 9000, days: 10, minRep: 150, desc: 'Óvalos de arcilla para flat track y su carrera propia.' },
    { id: 'enduro', name: 'Crono de enduro', cost: 10000, days: 12, minRep: 200, desc: 'Especiales cronometradas por el monte con troncos, pedreras y vadeos.' },
    { id: 'carcross', name: 'Car cross', cost: 18000, days: 14, minRep: 300, desc: 'Pistas anchas de grava para buggies y la carrera de car cross.' },
    { id: 'supercross', name: 'Supercross', cost: 32000, days: 18, minRep: 450, req: ['doubles'], desc: 'Estadios de supercross y el Supercross nocturno, el gran espectáculo.' }
  ];

  const marketing = [
    { id: 'posters', name: 'Carteles en la comarca', week: 600, visitors: 0.15, riders: 0.06, desc: 'Barato y local.' },
    { id: 'radio', name: 'Cuña en radio local', week: 1500, visitors: 0.3, riders: 0.1, desc: 'Llega a toda la comarca.' },
    { id: 'magazine', name: 'Anuncio en revista MX', week: 2400, visitors: 0.08, riders: 0.35, experts: 0.4, desc: 'Atrae pilotos con nivel.' },
    { id: 'passes', name: 'Promoción de abonos', week: 900, passes: 0.25, desc: 'Más pilotos se sacan el abono de temporada.' },
    { id: 'social', name: 'Campaña en redes sociales', week: 1800, visitors: 0.22, riders: 0.25, unlock: 'research:digital', desc: 'Pilotos jóvenes y público curioso.' },
    { id: 'tv', name: 'Anuncio en TV regional', week: 6000, visitors: 0.6, riders: 0.15, unlock: 'research:digital', desc: 'Máximo alcance.' }
  ];

  const sponsors = [
    { id: 'pistonrojo', name: 'Pistón Rojo', kind: 'Lubricantes', c1: '#c62828', c2: '#ffffff', minRep: 40, pay: [500, 900] },
    { id: 'turbofuel', name: 'TurboFuel', kind: 'Bebida energética', c1: '#151515', c2: '#c6ff00', minRep: 100, pay: [800, 1500] },
    { id: 'barroco', name: 'Barro & Co.', kind: 'Ropa técnica', c1: '#5d4037', c2: '#ffcc80', minRep: 150, pay: [900, 1800] },
    { id: 'garra', name: 'Garra Tires', kind: 'Neumáticos', c1: '#202020', c2: '#ffb300', minRep: 220, pay: [1300, 2600] },
    { id: 'motomax', name: 'MotoMax', kind: 'Concesionario', c1: '#5e2a84', c2: '#ffffff', minRep: 280, pay: [1600, 3200] },
    { id: 'vertigo', name: 'Cascos Vértigo', kind: 'Cascos', c1: '#1565c0', c2: '#ffffff', minRep: 360, pay: [2200, 4200] },
    { id: 'rayo', name: 'Bebidas Rayo', kind: 'Refrescos', c1: '#ff6f00', c2: '#fff176', minRep: 450, pay: [3200, 6000] },
    { id: 'ruta', name: 'Seguros Ruta', kind: 'Seguros', c1: '#2e7d32', c2: '#ffffff', minRep: 560, pay: [4500, 8000] },
    { id: 'galaxia', name: 'Galaxia TV', kind: 'Televisión', c1: '#0d47a1', c2: '#ffd600', minRep: 700, pay: [8000, 15000] }
  ];

  /* Career chapters. Checks live in sim/progression.js keyed by id. */
  const objectives = [
    { id: 'first_track', name: 'Primeros pasos', desc: 'Construye, valida y abre tu primer circuito.', reward: { money: 10000 } },
    { id: 'first_riders', name: 'Bienvenidos, pilotos', desc: 'Consigue que 25 pilotos rueden en tu complejo y construye un taller mecánico.', reward: { money: 10000, unlock: ['obj:amateur'] } },
    { id: 'atmosphere', name: 'Ambiente de carreras', desc: 'Alcanza 40 visitantes a la vez y 150 de reputación.', reward: { money: 15000, parcels: 1 } },
    { id: 'amateur', name: 'Bandera a cuadros', desc: 'Organiza una carrera amateur con una valoración de al menos 55.', reward: { money: 20000, unlock: ['obj:regional'] } },
    { id: 'profit', name: 'Negocio redondo', desc: 'Cierra un mes con al menos 10.000 € de beneficio.', reward: { money: 15000, parcels: 2 } },
    { id: 'regional', name: 'Referente regional', desc: 'Alcanza 350 de reputación y organiza un campeonato regional (valoración 60+).', reward: { money: 50000, unlock: ['obj:national'] } },
    { id: 'homolog', name: 'Pista homologada', desc: 'Ten un circuito abierto con homologación nacional: 750 m o más, dificultad 4 a 8,5 y seguridad del 60%.', reward: { money: 30000, parcels: 3 } },
    { id: 'national', name: 'Campeón nacional', desc: 'Organiza un campeonato nacional con una valoración de al menos 65.', reward: { money: 100000, unlock: ['obj:international'] } },
    { id: 'world', name: 'Escaparate mundial', desc: 'Alcanza 700 de reputación, 250 visitantes a la vez y organiza un evento internacional.', reward: { money: 150000, unlock: ['obj:gp'] } },
    { id: 'gp', name: 'El Gran Premio', desc: 'Organiza un Gran Premio con una valoración de al menos 70. ¡La cima del motocross!', reward: { money: 250000 } }
  ];

  const weather = {
    sunny: { name: 'Soleado', visitors: 1.1, light: 1.0, rain: 0, dry: 0.06, icon: 'sun' },
    cloudy: { name: 'Nublado', visitors: 1.0, light: 0.86, rain: 0, dry: 0.025, icon: 'cloud' },
    rain: { name: 'Lluvia', visitors: 0.55, light: 0.7, rain: 0.6, dry: -0.12, icon: 'rain' },
    storm: { name: 'Tormenta', visitors: 0.28, light: 0.55, rain: 1.0, dry: -0.25, icon: 'storm' },
    heat: { name: 'Calor', visitors: 0.92, light: 1.08, rain: 0, dry: 0.1, icon: 'heat' }
  };

  const names = {
    first: ['Álex', 'Javi', 'Dani', 'Rubén', 'Iker', 'Pablo', 'Marc', 'Jorge', 'Hugo', 'Sergio', 'Adrián', 'Carlos', 'Víctor', 'Raúl', 'Óscar', 'Lucas', 'Mario', 'Toni', 'Nacho', 'Gonzalo', 'Lucía', 'Marta', 'Laura', 'Sara', 'Paula', 'Nerea', 'Ainhoa', 'Irene', 'Clara', 'Elena', 'Andrea', 'Noa', 'Aitor', 'Unai', 'Pol', 'Bruno', 'Diego', 'Fran', 'Kike', 'Manu', 'Rocío', 'Alba', 'Carla', 'Julia'],
    last: ['García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Ruiz', 'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Serrano', 'Molina', 'Castro', 'Ortega', 'Delgado', 'Marín', 'Iglesias', 'Medina', 'Garrido', 'Cortés', 'Rubio', 'Herrero', 'Moreno', 'Prieto', 'Vidal', 'Cano', 'Pascual', 'Soler', 'Ferrer', 'Roca', 'Arroyo', 'Bravo', 'Lorenzo'],
    intlFirst: ['Jeffrey', 'Tim', 'Romain', 'Jago', 'Tom', 'Kevin', 'Glenn', 'Ken', 'Lucas', 'Max', 'Mattia', 'Andrea', 'Rubén', 'Jorge', 'Simon', 'Liam', 'Hunter', 'Chase', 'Eli', 'Dylan', 'Calvin', 'Thibault', 'Brian', 'Pauls', 'Valentin', 'Ruben', 'Kay', 'Jett'],
    intlLast: ['Herlings', 'Gajser', 'Febvre', 'Geerts', 'Vialle', 'Prado', 'Coldenhoff', 'Seewer', 'Coenen', 'Adamo', 'Guadagnini', 'Fernández', 'Laengenfelder', 'Everts', 'Bogers', 'Renaux', 'Lawrence', 'Sexton', 'Webb', 'Tomac', 'Ferrandis', 'Jonass', 'Lupino', 'Watson', 'Beaton', 'Mewse', 'Benistant', 'Elzinga'],
    nick: ['El Rayo', 'Chispas', 'Turbo', 'El Gato', 'Pistón', 'La Bala', 'Saltamontes', 'El Lobo', 'Gasolina', 'Polvorilla', 'El Halcón', 'Rodillo', 'Trueno', 'El Barro', 'Cohete'],
    parkPrefix: ['Circuito', 'MX Park', 'Motocross', 'Complejo MX'],
    parkName: ['Los Pinares', 'El Barranco', 'Sierra Roja', 'La Cantera', 'Valdetierra', 'El Polvorín', 'Montealto', 'Las Dunas', 'Río Seco', 'La Loma']
  };

  /* Thought bubbles: key -> variants. Positive keys add happiness, negative remove it. */
  const thoughts = {
    hungry: { t: ['Tengo hambre', 'Me comería un bocadillo'], mood: -1 },
    no_food: { t: ['No encuentro dónde comer', '¿No hay nada para comer aquí?'], mood: -2 },
    thirsty: { t: ['Qué sed tengo', 'Necesito algo fresquito'], mood: -1 },
    toilet: { t: ['Necesito ir al baño ya', 'Me hago pis'], mood: -1 },
    no_toilet: { t: ['¿Es que aquí no hay baños?', 'No encuentro los baños'], mood: -3 },
    tired: { t: ['Llevo demasiado rato de pie', 'Me duelen los pies'], mood: -1 },
    no_seats: { t: ['Faltan gradas para ver las motos', 'No hay dónde sentarse'], mood: -2 },
    great_jump: { t: ['¡Qué salto más bestia!', '¡Ese piloto vuela!', '¡Menudo whip!'], mood: 2 },
    crash_seen: { t: ['¡Uff, menuda caída!', '¡Ay! Eso ha tenido que doler'], mood: 1 },
    boring: { t: ['Aquí no pasa nada', 'Este circuito es un poco soso'], mood: -2 },
    no_action: { t: ['No hay ni una moto en pista', '¿Dónde están los pilotos?'], mood: -2 },
    dirty: { t: ['Hay basura por todas partes', 'Esto está sucísimo'], mood: -2 },
    toilet_dirty: { t: ['Los baños están asquerosos'], mood: -2 },
    expensive_ticket: { t: ['La entrada es demasiado cara', '¿Tanto por entrar? Ni loco'], mood: -3 },
    expensive_food: { t: ['¡Qué caro está el bocata!'], mood: -1 },
    good_value: { t: ['La entrada merece la pena', 'Buen precio para lo que ofrece'], mood: 1 },
    dusty: { t: ['Me estoy tragando todo el polvo', 'Cuánto polvo levantan'], mood: -1 },
    rain: { t: ['Me estoy calando', 'Vaya día de perros'], mood: -2 },
    love_race: { t: ['¡Qué carrera tan emocionante!', '¡Vamos, vamos!'], mood: 3 },
    great_view: { t: ['Desde aquí se ve genial', 'Qué buena vista de los saltos'], mood: 1 },
    crowded: { t: ['Hay demasiada gente aquí', 'No veo nada con tanta gente'], mood: -1 },
    bought_merch: { t: ['¡Me he comprado una camiseta!', 'Qué gorra más chula'], mood: 1 },
    nice_park: { t: ['Este sitio es genial', 'Qué bien montado está esto'], mood: 2 },
    lost: { t: ['Me he perdido', 'No sé cómo llegar'], mood: -2 },
    leave_happy: { t: ['Volveré pronto', 'Un día estupendo'], mood: 0 },
    leave_angry: { t: ['No vuelvo más', 'Menuda pérdida de tiempo'], mood: 0 },
    big_screen: { t: ['En la pantalla se ve todo', 'Qué repetición más buena'], mood: 1 },
    /* riders */
    too_easy: { t: ['Este circuito es demasiado fácil para mí', 'Aquí me aburro'], mood: -2 },
    too_hard: { t: ['Esos saltos me dan miedo', 'Este circuito me viene grande'], mood: -2 },
    great_track: { t: ['¡Este circuito es una pasada!', 'Qué trazado más bueno'], mood: 3 },
    bumpy: { t: ['La pista está llena de baches', 'Necesita un buen pase de tractor'], mood: -2 },
    crowded_track: { t: ['Hay demasiados pilotos en pista'], mood: -2 },
    no_shower: { t: ['Necesito una ducha y no hay'], mood: -2 },
    shower_ok: { t: ['Qué gusto, una ducha caliente'], mood: 1 },
    broken_bike: { t: ['Se me ha roto la moto', '¡Gripada!'], mood: -2 },
    no_workshop: { t: ['No hay taller para arreglar la moto'], mood: -3 },
    workshop_ok: { t: ['El taller me ha salvado el día'], mood: 2 },
    injured: { t: ['Me he hecho daño en la caída'], mood: -3 },
    expensive_fee: { t: ['La tarifa de pista es un robo'], mood: -3 },
    nice_jump: { t: ['¡He clavado ese doble!', '¡Qué gozada de salto!'], mood: 2 },
    cased: { t: ['He caído corto en el salto', 'Vaya golpe me he dado'], mood: -1 },
    paddock_full: { t: ['No hay sitio en el paddock'], mood: -3 },
    dusty_track: { t: ['Hay demasiado polvo, no veo nada'], mood: -1 },
    muddy: { t: ['Esto es un barrizal'], mood: -1 },
    school_ok: { t: ['Gracias a la escuela salto mejor'], mood: 2 },
    pass_bought: { t: ['Me he sacado el abono de temporada'], mood: 1 },
    pro_boxes: { t: ['Por fin unos boxes en condiciones'], mood: 1 },
    no_boxes: { t: ['Un piloto de mi nivel merece unos boxes'], mood: -1 },
    race_win: { t: ['¡He ganado!', '¡Victoria!'], mood: 3 },
    washed: { t: ['La moto ha quedado como nueva', 'Por fin sin barro'], mood: 1 },
    parts_ok: { t: ['Me he llevado unos guantes nuevos', 'Neumático nuevo para la próxima'], mood: 1 },
    rental_ok: { t: ['¡Mi primera vez en una moto de cross!', 'Alquilar ha sido una gran idea'], mood: 2 },
    kids_fun: { t: ['¡Los columpios molan!', 'Mamá, ¿podemos volver mañana?'], mood: 2 },
    big_meal: { t: ['Qué bien se come aquí', 'La terraza tiene unas vistas geniales'], mood: 2 },
    trees: { t: ['Rodar entre árboles es lo mejor', 'Qué especial más bonita'], mood: 2 },
    theme_madmax: { t: ['¡Qué ambiente Mad Max!', 'Parece el fin del mundo... ¡y me encanta!'], mood: 2 },
    theme_desert: { t: ['Me siento en el desierto de Arizona', 'Qué paisaje del oeste más chulo'], mood: 2 },
    theme_surf: { t: ['¡Esto huele a playa y a gasolina!', 'Qué rollo surfero tiene esta zona'], mood: 2 },
    theme_farm: { t: ['Qué granja tan bonita', 'Hasta la vaca está viendo la carrera'], mood: 2 },
    theme_mxgp: { t: ['¡Esto parece el Mundial!', 'Ambiente de gran premio de verdad'], mood: 2 },
    theme_festival: { t: ['¡Esto es una fiesta!', 'Música, luces y motos: plan perfecto'], mood: 2 }
  };

  MX.Catalog = {
    buildings, decor, decorThemes, environments, paths, addons, surfaces, surfaceOrder, features, featureGroups, trackTypes, trackTypeOrder,
    bikes, vehicles, brands, brandsFor, bikeModel, bikeName, staff, staffOrder, events, eventOrder, research, marketing, sponsors, objectives,
    weather, names, thoughts,
    buildingCats: [
      { id: 'riders', name: 'Pilotos' },
      { id: 'public', name: 'Público' },
      { id: 'services', name: 'Servicios' }
    ],
    seasonVisitors: [0.6, 0.7, 0.9, 1.0, 1.1, 1.2, 1.25, 1.2, 1.05, 0.95, 0.75, 0.62],
    seasonRain: [0.32, 0.3, 0.26, 0.24, 0.18, 0.1, 0.06, 0.08, 0.16, 0.26, 0.32, 0.34],
    seasonHeat: [0, 0, 0, 0.02, 0.08, 0.2, 0.32, 0.3, 0.12, 0.02, 0, 0]
  };
})(window.MX);
