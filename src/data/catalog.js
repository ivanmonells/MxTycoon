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
    shop: {
      name: 'Tienda de merchandising', cat: 'public', w: 1, h: 1, cost: 7000, upkeep: 70, height: 3.6,
      access: 'path', capacity: 3, sells: 'merch',
      desc: 'Camisetas, gorras y réplicas de los pilotos famosos. Vende más con buenos eventos.'
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
    bush: { name: 'Arbusto', cost: 120, scenery: 0.3, desc: 'Vegetación baja.' },
    flowers: { name: 'Parterre de flores', cost: 220, scenery: 0.6, desc: 'Color para los caminos.' },
    rock: { name: 'Roca', cost: 150, scenery: 0.2, desc: 'Decoración natural.' },
    flag: { name: 'Bandera', cost: 250, scenery: 0.4, desc: 'Ondea al viento.' },
    banner: { name: 'Pancarta de patrocinio', cost: 600, scenery: 0.3, banner: true, desc: 'Luce el logo de tus patrocinadores. Algunos contratos exigen pancartas.' },
    haybales: { name: 'Balas de paja', cost: 300, safety: 1, desc: 'Protección junto a saltos y curvas. Mejora la seguridad.' },
    tires: { name: 'Muro de neumáticos', cost: 400, safety: 1.2, desc: 'Barrera de neumáticos. Mejora la seguridad.' },
    safetyfence: { name: 'Valla de seguridad', cost: 350, safety: 0.9, desc: 'Separa al público de la pista. Mejora la seguridad.' },
    statue: { name: 'Estatua del campeón', cost: 8000, scenery: 3, desc: 'Homenaje a los grandes. Gusta mucho al público.' },
    arch: { name: 'Arco hinchable', cost: 1500, scenery: 1.2, banner: true, desc: 'Arco de patrocinador para ambientar.' }
  };

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
    dirt: { name: 'Tierra seca', grip: 0.92, drag: 1.0, dust: 1.0, wear: 1.0, maint: 1.0, diff: 0, cost: 45, stamina: 1.0, color: '#9a6a3c' },
    sand: { name: 'Arena', grip: 0.7, drag: 1.38, dust: 0.25, wear: 1.5, maint: 0.8, diff: 1.3, cost: 70, stamina: 1.7, color: '#d9b77a', unlock: 'research:sand' },
    mud: { name: 'Barro', grip: 0.58, drag: 1.26, dust: 0, wear: 1.9, maint: 1.25, diff: 1.6, cost: 55, stamina: 1.4, color: '#5a3d26', unlock: 'research:mud' },
    hardpack: { name: 'Hardpack', grip: 1.02, drag: 0.9, dust: 0.6, wear: 0.6, maint: 0.75, diff: -0.2, cost: 85, stamina: 0.9, color: '#8b7766', unlock: 'research:hardpack' }
  };
  const surfaceOrder = ['dirt', 'sand', 'mud', 'hardpack'];

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
    berm_big: { name: 'Peralte grande', group: 'corner', kind: 'berm', H: 1.8, cost: 2600, unlock: 'research:berms', desc: 'Peralte alto para curvas muy rápidas.' }
  };
  const featureGroups = [
    { id: 'basic', name: 'Básicos' },
    { id: 'jump', name: 'Saltos' },
    { id: 'rhythm', name: 'Rítmicos' },
    { id: 'corner', name: 'Curvas' }
  ];

  const bikes = [
    { id: 'mini', name: 'Mini 85', accel: 5.0, top: 22, handling: 1.05, reliability: 0.95, minSkill: 0, maxSkill: 30 },
    { id: 'e125', name: '125 2T', accel: 6.6, top: 29, handling: 1.06, reliability: 0.86, minSkill: 15, maxSkill: 100 },
    { id: 'f250', name: '250 4T', accel: 7.1, top: 31, handling: 1.0, reliability: 0.92, minSkill: 20, maxSkill: 100 },
    { id: 'e250', name: '250 2T', accel: 7.7, top: 32, handling: 0.97, reliability: 0.84, minSkill: 35, maxSkill: 100 },
    { id: 'f450', name: '450 4T', accel: 8.6, top: 35, handling: 0.9, reliability: 0.9, minSkill: 45, maxSkill: 100 }
  ];

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
      name: 'Carrera amateur', tier: 1, rep: 60, cost: 3000, prize: 1500, riders: 12, entryFee: 40,
      skill: [22, 62], ticket: 10, demand: 260, sponsor: 1200, tv: 0, diff: [1.0, 6.5], minLen: 350, laps: [3, 4],
      repGain: 35, unlock: 'obj:amateur',
      desc: 'Carrera local con pilotos de la zona. El primer paso para hacerse un nombre.',
      reqs: { paddock: 1, toilets: 1, medical: 1, medic: 1 }
    },
    regional: {
      name: 'Campeonato regional', tier: 2, rep: 280, cost: 12000, prize: 5000, riders: 16, entryFee: 80,
      skill: [42, 76], ticket: 16, demand: 1100, sponsor: 6000, tv: 0, diff: [2.5, 7.5], minLen: 550, laps: [4, 5],
      repGain: 70, unlock: 'obj:regional',
      desc: 'Prueba puntuable con pilotos federados. Exige organización seria.',
      reqs: { paddock: 1, toilets: 2, medical: 1, medic: 1, office: 1, tower: 1, workshop: 1, seats: 48, marshal: 2, foodtruck: 1 }
    },
    national: {
      name: 'Campeonato nacional', tier: 3, rep: 500, cost: 40000, prize: 15000, riders: 20, entryFee: 150,
      skill: [58, 88], ticket: 24, demand: 4200, sponsor: 15000, tv: 15000, diff: [4.0, 8.5], minLen: 750, laps: [5, 6],
      repGain: 120, unlock: 'obj:national',
      desc: 'Los mejores pilotos del país. Televisión, patrocinadores y mucho público.',
      reqs: { paddock: 2, toilets: 4, medical: 1, medic: 2, office: 1, tower: 1, workshop: 1, seats: 144, marshal: 4, boxes: 2, podium: 1, parking: 2, safety: 0.6 }
    },
    international: {
      name: 'Evento internacional', tier: 4, rep: 680, cost: 90000, prize: 35000, riders: 24, entryFee: 250,
      skill: [70, 95], ticket: 35, demand: 9500, sponsor: 30000, tv: 45000, diff: [5.0, 9.0], minLen: 900, laps: [5, 7],
      repGain: 170, unlock: 'obj:international',
      desc: 'Equipos de todo el mundo. Tu complejo en el mapa internacional.',
      reqs: { paddock: 2, toilets: 5, medical: 2, medic: 3, office: 1, tower: 1, workshop: 2, seats: 288, marshal: 6, boxes: 4, podium: 1, parking: 3, screen: 1, camping: 1, safety: 0.7 }
    },
    gp: {
      name: 'Gran Premio', tier: 5, rep: 820, cost: 200000, prize: 80000, riders: 30, entryFee: 400,
      skill: [80, 100], ticket: 50, demand: 22000, sponsor: 80000, tv: 120000, diff: [5.5, 9.5], minLen: 1050, laps: [6, 8],
      repGain: 250, unlock: 'obj:gp',
      desc: 'La élite mundial del motocross. El evento con el que sueña cualquier circuito.',
      reqs: { paddock: 3, toilets: 6, medical: 2, medic: 4, office: 1, tower: 1, workshop: 2, seats: 480, marshal: 8, boxes: 8, podium: 1, parking: 4, screen: 2, camping: 2, safety: 0.8 }
    }
  };
  const eventOrder = ['training', 'amateur', 'regional', 'national', 'international', 'gp'];

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
    { id: 'digital', name: 'Marketing digital', cost: 5000, days: 8, desc: 'Campañas en redes sociales y televisión regional.' }
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
    tired: { t: ['Estoy cansado de estar de pie', 'Me duelen los pies'], mood: -1 },
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
    race_win: { t: ['¡He ganado!', '¡Victoria!'], mood: 3 }
  };

  MX.Catalog = {
    buildings, decor, paths, addons, surfaces, surfaceOrder, features, featureGroups,
    bikes, staff, staffOrder, events, eventOrder, research, marketing, sponsors, objectives,
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
