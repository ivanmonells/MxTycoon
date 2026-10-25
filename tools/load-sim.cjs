/* Loads the simulation sources into a Node VM context (no DOM, no WebGL). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');
const SIM_FILES = [
  'core/util.js', 'data/constants.js', 'data/catalog.js',
  'sim/world.js', 'sim/terrain.js', 'sim/track.js', 'sim/physics.js', 'sim/pathing.js', 'sim/economy.js',
  'sim/agents.js', 'sim/progression.js', 'sim/ambient.js', 'sim/competition.js', 'sim/game.js'
];
function loadSim(extra) {
  const ctx = { console, Math, Date, JSON, setTimeout, clearTimeout, Buffer, performance };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of SIM_FILES.concat(extra || [])) {
    const code = fs.readFileSync(path.join(SRC, f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  return ctx.MX;
}
module.exports = { loadSim, SIM_FILES };
