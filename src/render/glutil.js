/* MX Tycoon - WebGL2 helpers and small matrix library. */
(function (MX) {
  'use strict';

  const M4 = {
    create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    ortho(out, l, r, b, t, n, f) {
      out.fill(0);
      out[0] = 2 / (r - l); out[5] = 2 / (t - b); out[10] = -2 / (f - n);
      out[12] = -(r + l) / (r - l); out[13] = -(t + b) / (t - b); out[14] = -(f + n) / (f - n); out[15] = 1;
      return out;
    },
    lookAt(out, ex, ey, ez, tx, ty, tz, ux, uy, uz) {
      let fx = tx - ex, fy = ty - ey, fz = tz - ez;
      let l = Math.hypot(fx, fy, fz); fx /= l; fy /= l; fz /= l;
      let rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux;
      l = Math.hypot(rx, ry, rz); rx /= l; ry /= l; rz /= l;
      const vx = ry * fz - rz * fy, vy = rz * fx - rx * fz, vz = rx * fy - ry * fx;
      out[0] = rx; out[1] = vx; out[2] = -fx; out[3] = 0;
      out[4] = ry; out[5] = vy; out[6] = -fy; out[7] = 0;
      out[8] = rz; out[9] = vz; out[10] = -fz; out[11] = 0;
      out[12] = -(rx * ex + ry * ey + rz * ez);
      out[13] = -(vx * ex + vy * ey + vz * ez);
      out[14] = (fx * ex + fy * ey + fz * ez);
      out[15] = 1;
      return out;
    },
    mul(out, a, b) {
      const r = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        r[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
      }
      out.set(r);
      return out;
    },
    invert(out, m) {
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
      const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
      const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
      const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return null;
      det = 1 / det;
      out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
      out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
      out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
      out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
      out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
      out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
      out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
      out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
      out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return out;
    },
    transform(m, x, y, z, out) {
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      out = out || [0, 0, 0];
      out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
      out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
      return out;
    },
    fromYawTranslate(out, yaw, x, y, z, s) {
      const c = Math.cos(yaw) * (s || 1), sn = Math.sin(yaw) * (s || 1);
      out.fill(0);
      out[0] = c; out[2] = sn; out[5] = s || 1; out[8] = -sn; out[10] = c;
      out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
      return out;
    }
  };

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      console.error(log + '\n' + lines);
      throw new Error('Shader: ' + log);
    }
    return sh;
  }
  function program(gl, vs, fs, name) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program ' + name + ': ' + gl.getProgramInfoLog(p));
    const uniforms = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const nm = info.name.replace(/\[0\]$/, '');
      uniforms[nm] = gl.getUniformLocation(p, info.name);
    }
    return { p, u: uniforms, name };
  }

  /* Interleaved static vertex layout used by every mesh:
     pos(3) nor(3) uv(2) mat(1) slot(1) col(4) = 14 floats */
  const STRIDE = 14;
  function makeMeshVAO(gl, data, count, existing) {
    const m = existing || { vao: gl.createVertexArray(), vbo: gl.createBuffer(), count: 0, cap: 0 };
    gl.bindVertexArray(m.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
    if (data.byteLength > m.cap) {
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      m.cap = data.byteLength;
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }
    if (!m.attrsSet) {
      const B = STRIDE * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, B, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, B, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, B, 24);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, B, 32);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, B, 36);
      gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, B, 40);
      m.attrsSet = true;
    }
    gl.bindVertexArray(null);
    m.count = count;
    return m;
  }

  /* Instance layout: pos(3) rot(3) scale(1) flags(1) as floats + 4 colour slots as RGBA8. */
  const INST_FLOATS = 8;
  const INST_BYTES = INST_FLOATS * 4 + 16;
  function attachInstancing(gl, mesh, maxInstances) {
    gl.bindVertexArray(mesh.vao);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    gl.bufferData(gl.ARRAY_BUFFER, maxInstances * INST_BYTES, gl.DYNAMIC_DRAW);
    const B = INST_BYTES;
    gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 3, gl.FLOAT, false, B, 0); gl.vertexAttribDivisor(6, 1);
    gl.enableVertexAttribArray(7); gl.vertexAttribPointer(7, 3, gl.FLOAT, false, B, 12); gl.vertexAttribDivisor(7, 1);
    gl.enableVertexAttribArray(8); gl.vertexAttribPointer(8, 2, gl.FLOAT, false, B, 24); gl.vertexAttribDivisor(8, 1);
    gl.enableVertexAttribArray(9); gl.vertexAttribPointer(9, 4, gl.UNSIGNED_BYTE, true, B, 32); gl.vertexAttribDivisor(9, 1);
    gl.enableVertexAttribArray(10); gl.vertexAttribPointer(10, 4, gl.UNSIGNED_BYTE, true, B, 36); gl.vertexAttribDivisor(10, 1);
    gl.enableVertexAttribArray(11); gl.vertexAttribPointer(11, 4, gl.UNSIGNED_BYTE, true, B, 40); gl.vertexAttribDivisor(11, 1);
    gl.enableVertexAttribArray(12); gl.vertexAttribPointer(12, 4, gl.UNSIGNED_BYTE, true, B, 44); gl.vertexAttribDivisor(12, 1);
    gl.bindVertexArray(null);
    mesh.ibuf = ib;
    mesh.imax = maxInstances;
    mesh.idata = new ArrayBuffer(maxInstances * INST_BYTES);
    mesh.if32 = new Float32Array(mesh.idata);
    mesh.iu8 = new Uint8Array(mesh.idata);
    mesh.icount = 0;
    return mesh;
  }

  function texFromCanvas(gl, canvas, opts) {
    opts = opts || {};
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    const f = opts.linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    const wrap = opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  function makeTarget(gl, w, h, withColor, prev) {
    if (prev) {
      if (prev.color) gl.deleteTexture(prev.color);
      gl.deleteTexture(prev.depth);
      gl.deleteFramebuffer(prev.fb);
    }
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    let color = null;
    if (withColor) {
      color = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, color);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    }
    const depth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depth);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    if (!withColor) { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Framebuffer incompleto: ' + status);
    return { fb, color, depth, w, h };
  }

  MX.GL = { M4, program, makeMeshVAO, attachInstancing, texFromCanvas, makeTarget, STRIDE, INST_FLOATS, INST_BYTES };
})(window.MX);
