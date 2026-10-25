/* MX Tycoon - GLSL sources. Banded sun lighting, hard shadows, cloud shadows and
   dithering give the low-resolution "pre-rendered" look. */
(function (MX) {
  'use strict';
  const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
`;
  const LIGHT = `
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uAmb;
uniform mat4 uShadowMat;
uniform sampler2D uShadowTex;
uniform float uShadowOn;
uniform sampler2D uNoise;
uniform float uTime;
uniform float uCloud;
uniform float uCloudThr;
float bayer4(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}
float shadowAt(vec3 wp, vec3 n) {
  if (uShadowOn < 0.5) return 1.0;
  vec4 sp = uShadowMat * vec4(wp + n * 0.1, 1.0);
  vec3 p = sp.xyz * 0.5 + 0.5;
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
  float d = texture(uShadowTex, p.xy).r;
  return (p.z - 0.0009 > d) ? 0.0 : 1.0;
}
float cloudAt(vec3 wp) {
  vec2 q = wp.xz * 0.0045 + vec2(uTime * 0.0025, uTime * 0.0012);
  float n = texture(uNoise, q).r * 0.65 + texture(uNoise, q * 2.7 + 0.31).r * 0.35;
  return step(uCloudThr, n);
}
vec3 shade(vec3 base, vec3 n, vec3 wp) {
  float nd = max(dot(n, uSunDir), 0.0);
  float sh = shadowAt(wp, n);
  float cl = 1.0 - cloudAt(wp) * uCloud;
  float l = nd * sh * cl;
  l = floor(l * 4.0 + 0.5) / 4.0;
  vec3 amb = uAmb * (0.78 + 0.22 * n.y);
  return base * (amb + uSunCol * l);
}
`;
  const MESH_VS = HEAD + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec2 aUv;
layout(location=3) in float aMat;
layout(location=4) in float aSlot;
layout(location=5) in vec4 aCol;
uniform mat4 uViewProj;
out vec3 vWp; out vec3 vN; out vec2 vUv; flat out float vMat; out vec4 vCol;
void main() {
  vWp = aPos; vN = aNor; vUv = aUv; vMat = aMat; vCol = aCol;
  gl_Position = uViewProj * vec4(aPos, 1.0);
}`;
  const MESH_FS = HEAD + LIGHT + `
uniform sampler2DArray uMats;
uniform sampler2D uAtlas;
uniform vec4 uGhost;
uniform float uGhostDither;
in vec3 vWp; in vec3 vN; in vec2 vUv; flat in float vMat; in vec4 vCol;
out vec4 o;
void main() {
  vec4 base;
  if (vMat > -0.5) base = texture(uMats, vec3(vUv, vMat));
  else if (vMat > -1.5) base = texture(uAtlas, vUv);
  else base = vec4(1.0);
  if (base.a < 0.5) discard;
  /* vertex alpha 2 marks glowing parts (flames, bulbs) that ignore the light */
  vec3 c = vCol.a > 1.5 ? base.rgb * vCol.rgb : shade(base.rgb * vCol.rgb, normalize(vN), vWp);
  if (uGhost.a > 0.0) {
    if (bayer4(gl_FragCoord.xy) > uGhostDither) discard;
    c = mix(c, uGhost.rgb, uGhost.a);
  }
  o = vec4(c, 1.0);
}`;
  const TERRAIN_FS = HEAD + LIGHT + `
uniform sampler2DArray uMats;
uniform sampler2D uOwn;
uniform highp usampler2D uGroundTex;
uniform int uTiles;
uniform vec4 uBrush;
uniform vec4 uBrushCol;
uniform float uGrid;
uniform float uShowLand;
uniform float uMapSize;
uniform float uWater;
uniform float uRock;
uniform float uSand;
uniform float uWet;
in vec3 vWp; in vec3 vN; in vec2 vUv; flat in float vMat; in vec4 vCol;
out vec4 o;
void main() {
  vec3 n = normalize(vN);
  float layer = vMat;
  float dith = bayer4(gl_FragCoord.xy);
  if (vMat > -0.5 && n.y > 0.3) {
    /* ground type looked up at a noise-displaced position: organic patch edges */
    vec2 jit = vec2(texture(uNoise, vWp.xz * 0.085).r, texture(uNoise, vWp.zx * 0.085 + 0.37).r) - 0.5;
    vec2 q = (vWp.xz + jit * 3.2) * 0.25;
    ivec2 tq = clamp(ivec2(floor(q)), ivec2(0), ivec2(uTiles - 1));
    layer = float(texelFetch(uGroundTex, tq, 0).r);
  }
  float steep = 1.0 - n.y;
  if (steep > 0.3 + dith * 0.12) layer = uRock;
  if (vWp.y < uWater + 0.25 + dith * 0.2 && layer != uRock) layer = uSand;
  vec3 base = texture(uMats, vec3(vUv, layer)).rgb;
  float big = texture(uNoise, vWp.xz * 0.0035).r;
  base *= 0.9 + big * 0.2;
  base *= 1.0 - uWet * 0.18;
  float own = texture(uOwn, vWp.xz / uMapSize).r;
  if (own < 0.25) {
    float g = dot(base, vec3(0.33));
    base = mix(base, vec3(g), 0.35) * 0.78;
  } else if (own < 0.75 && uShowLand > 0.5) {
    float st = step(0.5, fract((vWp.x + vWp.z) * 0.25));
    base = mix(base, vec3(1.0, 0.85, 0.25), 0.28 + st * 0.22);
  }
  if (uShowLand > 0.5 && own < 0.25) base *= 0.85;
  if (uGrid > 0.5) {
    vec2 f = fract(vWp.xz / 4.0);
    vec2 d = min(f, 1.0 - f) * 4.0;
    vec2 w = fwidth(vWp.xz) * 0.9;
    if (d.x < w.x || d.y < w.y) base *= 0.72;
  }
  if (vWp.x >= uBrush.x && vWp.x <= uBrush.z && vWp.z >= uBrush.y && vWp.z <= uBrush.w) {
    base = mix(base, uBrushCol.rgb, uBrushCol.a * (0.75 + 0.25 * step(0.5, dith)));
  }
  o = vec4(shade(base, n, vWp), 1.0);
}`;
  const INST_VS = HEAD + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec2 aUv;
layout(location=3) in float aMat;
layout(location=4) in float aSlot;
layout(location=5) in vec4 aCol;
layout(location=6) in vec3 iPos;
layout(location=7) in vec3 iRot;
layout(location=8) in vec2 iSF;
layout(location=9) in vec4 iA;
layout(location=10) in vec4 iB;
layout(location=11) in vec4 iC;
layout(location=12) in vec4 iD;
uniform mat4 uViewProj;
uniform float uTime;
out vec3 vWp; out vec3 vN; out vec2 vUv; flat out float vMat; out vec4 vCol;
vec3 rot(vec3 p, vec3 r) {
  float cr = cos(r.z), sr = sin(r.z);
  p = vec3(p.x, p.y * cr - p.z * sr, p.y * sr + p.z * cr);
  float cp = cos(r.y), sp = sin(r.y);
  p = vec3(p.x * cp - p.y * sp, p.x * sp + p.y * cp, p.z);
  float cy = cos(r.x), sy = sin(r.x);
  return vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);
}
void main() {
  vec3 p = aPos * iSF.x;
  if (iSF.y > 0.5 && aSlot > 0.5 && aPos.y > 1.0) {
    /* gentle sway for foliage */
    float s = sin(uTime * 1.3 + iPos.x * 0.37 + iPos.z * 0.23) * 0.04 * aPos.y;
    p.x += s;
  }
  vec3 wp = rot(p, iRot) + iPos;
  vWp = wp; vN = rot(aNor, iRot); vUv = aUv; vMat = aMat;
  vec4 slot = vec4(1.0);
  if (aSlot > 0.5 && aSlot < 1.5) slot = iA;
  else if (aSlot > 1.5 && aSlot < 2.5) slot = iB;
  else if (aSlot > 2.5 && aSlot < 3.5) slot = iC;
  else if (aSlot > 3.5) slot = iD;
  vCol = vec4(aCol.rgb * slot.rgb, 1.0);
  gl_Position = uViewProj * vec4(wp, 1.0);
}`;
  const SHADOW_VS = HEAD + `
layout(location=0) in vec3 aPos;
uniform mat4 uViewProj;
void main() { gl_Position = uViewProj * vec4(aPos, 1.0); }`;
  const SHADOW_INST_VS = HEAD + `
layout(location=0) in vec3 aPos;
layout(location=6) in vec3 iPos;
layout(location=7) in vec3 iRot;
layout(location=8) in vec2 iSF;
uniform mat4 uViewProj;
vec3 rot(vec3 p, vec3 r) {
  float cr = cos(r.z), sr = sin(r.z);
  p = vec3(p.x, p.y * cr - p.z * sr, p.y * sr + p.z * cr);
  float cp = cos(r.y), sp = sin(r.y);
  p = vec3(p.x * cp - p.y * sp, p.x * sp + p.y * cp, p.z);
  float cy = cos(r.x), sy = sin(r.x);
  return vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);
}
void main() { gl_Position = uViewProj * vec4(rot(aPos * iSF.x, iRot) + iPos, 1.0); }`;
  const SHADOW_FS = HEAD + `
out vec4 o;
void main() { o = vec4(1.0); }`;
  const WATER_VS = HEAD + `
layout(location=0) in vec3 aPos;
uniform mat4 uViewProj;
out vec3 vWp;
void main() { vWp = aPos; gl_Position = uViewProj * vec4(aPos, 1.0); }`;
  const WATER_FS = HEAD + LIGHT + `
uniform sampler2D uHeights;
uniform float uMapSize;
uniform float uVerts;
uniform float uWater;
in vec3 vWp;
out vec4 o;
void main() {
  vec2 hv = (vWp.xz / 4.0 + 0.5) / uVerts;
  float th = texture(uHeights, hv).r;
  float depth = uWater - th;
  if (depth < 0.0) discard;
  vec3 shallow = vec3(0.32, 0.62, 0.66), deep = vec3(0.1, 0.3, 0.45);
  vec3 c = mix(shallow, deep, smoothstep(0.0, 2.2, depth));
  vec2 q = floor(vWp.xz * 2.0) / 2.0;
  float r1 = texture(uNoise, q * 0.02 + vec2(uTime * 0.01, 0.0)).r;
  float r2 = texture(uNoise, q * 0.031 - vec2(0.0, uTime * 0.013)).r;
  float rip = step(0.62, r1 * 0.5 + r2 * 0.5);
  c += rip * 0.09;
  float foam = step(depth, 0.22 + 0.08 * sin(uTime * 2.0 + vWp.x * 0.5));
  c = mix(c, vec3(0.9, 0.95, 0.95), foam * 0.75);
  vec3 lit = shade(c, vec3(0.0, 1.0, 0.0), vWp);
  if (bayer4(gl_FragCoord.xy) > 0.82 && foam < 0.5) discard;
  o = vec4(lit, 1.0);
}`;
  const SPRITE_VS = HEAD + `
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 iPos;
layout(location=2) in vec2 iSize;
layout(location=3) in vec4 iCol;
layout(location=4) in vec4 iUv;
layout(location=5) in float iRotA;
uniform mat4 uViewProj;
uniform vec3 uRight;
uniform vec3 uUp;
out vec2 vUv; out vec4 vCol;
void main() {
  float c = cos(iRotA), s = sin(iRotA);
  vec2 k = vec2(aCorner.x * c - aCorner.y * s, aCorner.x * s + aCorner.y * c);
  vec3 wp = iPos + uRight * k.x * iSize.x + uUp * k.y * iSize.y;
  vUv = mix(iUv.xy, iUv.zw, vec2(aCorner.x + 0.5, 0.5 - aCorner.y));
  vCol = iCol;
  gl_Position = uViewProj * vec4(wp, 1.0);
}`;
  const SPRITE_FS = HEAD + `
uniform sampler2D uAtlas;
in vec2 vUv; in vec4 vCol;
out vec4 o;
float bayer4(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}
void main() {
  vec4 t = texture(uAtlas, vUv);
  float a = t.a * vCol.a;
  if (a < bayer4(gl_FragCoord.xy)) discard;
  o = vec4(t.rgb * vCol.rgb, 1.0);
}`;
  const POST_VS = HEAD + `
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
  const POST_FS = HEAD + `
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uOutline;
uniform float uThr;
uniform vec3 uTint;
uniform float uFlash;
in vec2 vUv;
out vec4 o;
float lin(vec2 uv) { return uNear + texture(uDepth, uv).r * (uFar - uNear); }
void main() {
  vec3 c = texture(uColor, vUv).rgb;
  float d = lin(vUv);
  if (uOutline > 0.0) {
    float dl = lin(vUv - vec2(uTexel.x, 0.0)), dr = lin(vUv + vec2(uTexel.x, 0.0));
    float du = lin(vUv + vec2(0.0, uTexel.y)), dd = lin(vUv - vec2(0.0, uTexel.y));
    float lap = max(dl + dr - 2.0 * d, du + dd - 2.0 * d);
    float e = step(uThr, lap);
    c *= mix(1.0, 0.5, e * uOutline);
  }
  c *= uTint;
  c = mix(c, vec3(1.0), uFlash);
  vec2 v = vUv - 0.5;
  c *= 1.0 - dot(v, v) * 0.35;
  o = vec4(c, 1.0);
}`;
  MX.Shaders = { MESH_VS, MESH_FS, TERRAIN_FS, INST_VS, SHADOW_VS, SHADOW_INST_VS, SHADOW_FS, WATER_VS, WATER_FS, SPRITE_VS, SPRITE_FS, POST_VS, POST_FS };
})(window.MX);
