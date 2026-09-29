/* ==============================================================
   AquaTrip · Água interativa na abertura (hero)
   ==============================================================
   A foto do topo vira superfície de água: o mouse (ou o dedo) abre
   ondas que refratam a imagem e acendem reflexos de luz; de vez em
   quando cai uma gota sozinha, para a água parecer viva.

   Como funciona: um campo de alturas em textura (WebGL2), atualizado
   pela equação da onda em duas texturas que se alternam (ping-pong).
   O quadro final lê a inclinação da água em cada ponto, desloca a
   foto (refração) e soma um brilho especular.

   Sem WebGL2, com "reduzir movimento" ou "economia de dados", nada
   disso roda: fica a foto parada de sempre. Fora da tela ou com a
   aba escondida, a simulação pausa.
   ============================================================== */
(function () {
  "use strict";

  var hero = document.querySelector("[data-hero]");
  var img = document.getElementById("heroImg");
  if (!hero || !img) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (navigator.connection && navigator.connection.saveData) return;

  var canvas = document.createElement("canvas");
  canvas.className = "hero-agua";
  canvas.setAttribute("aria-hidden", "true");
  var gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return;

  /* ---------- Shaders ---------- */
  var VERT = "#version 300 es\nin vec2 a;out vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}";

  // Uma passada da equação da onda: R = altura, G = velocidade.
  var PASSO = "#version 300 es\nprecision highp float;in vec2 v;out vec4 o;uniform sampler2D s;uniform vec2 d;" +
    "void main(){vec4 i=texture(s,v);" +
    "float m=(texture(s,v-vec2(d.x,0.)).r+texture(s,v+vec2(d.x,0.)).r+texture(s,v-vec2(0.,d.y)).r+texture(s,v+vec2(0.,d.y)).r)*.25;" +
    "i.g+=(m-i.r)*2.;i.g*=.992;i.r+=i.g;i.r*=.999;o=i;}";

  // Gota: soma um "sino" de altura em volta do centro (espaço com proporção corrigida).
  var GOTA = "#version 300 es\nprecision highp float;in vec2 v;out vec4 o;uniform sampler2D s;uniform vec2 c;uniform float r;uniform float f;uniform float asp;" +
    "void main(){vec4 i=texture(s,v);vec2 p=(v-c)*vec2(asp,1.);" +
    "float g=max(0.,1.-length(p)/r);g=.5-cos(g*3.14159265)*.5;i.r+=g*f;o=i;}";

  // Quadro final: refração da foto + reflexo. cv = recorte "cover" da foto.
  var TELA = "#version 300 es\nprecision highp float;in vec2 v;out vec4 o;uniform sampler2D s;uniform sampler2D foto;uniform vec2 d;uniform vec4 cv;" +
    "void main(){float h=texture(s,v).r;" +
    "float dx=texture(s,v+vec2(d.x,0.)).r-texture(s,v-vec2(d.x,0.)).r;" +
    "float dy=texture(s,v+vec2(0.,d.y)).r-texture(s,v-vec2(0.,d.y)).r;" +
    "vec3 n=normalize(vec3(-dx*2.5,-dy*2.5,1.));" +
    "vec2 t=vec2(v.x,1.-v.y)+vec2(-dx,dy)*.3;" +
    "vec3 cor=texture(foto,clamp(t*cv.xy+cv.zw,0.,1.)).rgb;" +
    "vec3 l=normalize(vec3(-.35,.55,1.));float e=pow(max(dot(n,normalize(l+vec3(0.,0.,1.))),0.),60.);" +
    "float onda=clamp(length(vec2(dx,dy))*6.,0.,1.);" +
    "cor+=vec3(.8,.96,1.)*e*.6*onda+h*.12;" +
    "o=vec4(cor,1.);}";

  function compilar(tipo, fonte) {
    var sh = gl.createShader(tipo);
    gl.shaderSource(sh, fonte);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  function programa(frag) {
    var p = gl.createProgram();
    gl.attachShader(p, compilar(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compilar(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, "a");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var nome = gl.getActiveUniform(p, i).name; u[nome] = gl.getUniformLocation(p, nome); }
    return { p: p, u: u };
  }

  var progPasso, progGota, progTela;
  try {
    progPasso = programa(PASSO);
    progGota = programa(GOTA);
    progTela = programa(TELA);
  } catch (err) {
    return; // placa sem suporte: fica a foto parada
  }

  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  /* ---------- Texturas da simulação (ping-pong) ---------- */
  var simW = 0, simH = 0, alvos = [], atual = 0;
  function textura(w, h) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { t: t, fb: fb };
  }
  function criarSimulacao() {
    alvos.forEach(function (a) { gl.deleteTexture(a.t); gl.deleteFramebuffer(a.fb); });
    alvos = [textura(simW, simH), textura(simW, simH)];
    atual = 0;
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok;
  }

  // Uma passada: lê da textura atual, escreve na outra e troca.
  function passada(prog, uniformes) {
    var de = alvos[atual], para = alvos[1 - atual];
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, para.fb);
    gl.viewport(0, 0, simW, simH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, de.t);
    gl.uniform1i(prog.u.s, 0);
    uniformes(prog.u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    atual = 1 - atual;
  }

  /* ---------- Foto ---------- */
  var foto = gl.createTexture();
  var fotoW = 0, fotoH = 0;
  function carregarFoto() {
    gl.bindTexture(gl.TEXTURE_2D, foto);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    fotoW = img.naturalWidth; fotoH = img.naturalHeight;
  }

  /* ---------- Tamanho ---------- */
  var cssW = 0, cssH = 0, recorte = [1, 1, 0, 0], aspecto = 1;
  function medir() {
    // O canvas ocupa a mesma caixa da foto (CSS). Sem transformação: a
    // medida não pode herdar o zoom do parallax.
    cssW = canvas.offsetWidth; cssH = canvas.offsetHeight;
    if (!cssW || !cssH) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    aspecto = cssW / cssH;
    // object-fit: cover + object-position: 50% 45% (igual ao CSS da foto)
    var esc = Math.max(cssW / fotoW, cssH / fotoH);
    var dw = fotoW * esc, dh = fotoH * esc;
    recorte = [cssW / dw, cssH / dh, ((dw - cssW) * 0.5) / dw, ((dh - cssH) * 0.45) / dh];
    // Uma célula da simulação a cada ~4px: detalhe bom e custo baixo.
    var novoW = Math.max(64, Math.min(512, Math.round(cssW / 4)));
    var novoH = Math.max(64, Math.min(512, Math.round(cssH / 4)));
    if (novoW !== simW || novoH !== simH) {
      simW = novoW; simH = novoH;
      if (!criarSimulacao()) return false;
    }
    return true;
  }

  /* ---------- Gotas ---------- */
  var fila = [];
  function gota(xCss, yCss, raioPx, forca) {
    fila.push({ x: xCss / cssW, y: 1 - yCss / cssH, r: raioPx / cssH, f: forca });
  }
  var ultimo = null;
  function posicao(e) {
    var r = canvas.getBoundingClientRect();
    // getBoundingClientRect inclui o zoom do parallax: volta para a caixa CSS
    return { x: (e.clientX - r.left) * (cssW / r.width), y: (e.clientY - r.top) * (cssH / r.height) };
  }
  hero.addEventListener("pointermove", function (e) {
    if (!rodando) return;
    var p = posicao(e);
    if (ultimo && Math.hypot(p.x - ultimo.x, p.y - ultimo.y) < 6) return;
    // Rastro: gota menor em movimento lento, um pouco maior quando rápido
    var vel = ultimo ? Math.min(1, Math.hypot(p.x - ultimo.x, p.y - ultimo.y) / 60) : 0.3;
    ultimo = p;
    gota(p.x, p.y, e.pointerType === "touch" ? 30 : 22, 0.08 + vel * 0.14);
  }, { passive: true });
  hero.addEventListener("pointerleave", function () { ultimo = null; }, { passive: true });
  hero.addEventListener("pointerdown", function (e) {
    if (!rodando) return;
    var p = posicao(e);
    gota(p.x, p.y, 34, 0.55);
  }, { passive: true });

  var proximaChuva = 0;
  function chuva(agora) {
    if (agora < proximaChuva) return;
    proximaChuva = agora + 900 + Math.random() * 1600;
    gota(Math.random() * cssW, cssH * (0.15 + Math.random() * 0.55), 14 + Math.random() * 10, 0.1 + Math.random() * 0.08);
  }

  /* ---------- Laço ---------- */
  var rodando = false, visivel = true, raf = 0, pronto = false;
  function quadro(agora) {
    raf = 0;
    if (!rodando) return;
    // O canvas acompanha o zoom/parallax que o GSAP aplica na foto
    canvas.style.transform = img.style.transform;
    chuva(agora);
    while (fila.length) {
      var g = fila.shift();
      passada(progGota, function (u) {
        gl.uniform2f(u.c, g.x, g.y); gl.uniform1f(u.r, g.r); gl.uniform1f(u.f, g.f); gl.uniform1f(u.asp, aspecto);
      });
    }
    for (var i = 0; i < 2; i++) passada(progPasso, function (u) { gl.uniform2f(u.d, 1 / simW, 1 / simH); });

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(progTela.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, alvos[atual].t);
    gl.uniform1i(progTela.u.s, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, foto);
    gl.uniform1i(progTela.u.foto, 1);
    gl.uniform2f(progTela.u.d, 1 / simW, 1 / simH);
    gl.uniform4f(progTela.u.cv, recorte[0], recorte[1], recorte[2], recorte[3]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (!pronto) { pronto = true; hero.classList.add("agua-on"); }
    raf = requestAnimationFrame(quadro);
  }
  function atualizarEstado() {
    var deve = visivel && !document.hidden;
    if (deve && !rodando) { rodando = true; if (!raf) raf = requestAnimationFrame(quadro); }
    else if (!deve) { rodando = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  }

  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    rodando = false;
    hero.classList.remove("agua-on"); // a foto parada volta a aparecer
    canvas.remove();
  });

  function iniciar() {
    img.parentNode.insertBefore(canvas, img.nextSibling);
    carregarFoto();
    if (!medir()) { canvas.remove(); return; }
    new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; atualizarEstado(); }).observe(hero);
    document.addEventListener("visibilitychange", atualizarEstado);
    var espera;
    window.addEventListener("resize", function () {
      clearTimeout(espera);
      espera = setTimeout(medir, 150);
    });
    // Primeira ondulação: a água "acorda" no centro da foto
    gota(cssW * 0.5, cssH * 0.42, 60, 0.45);
    atualizarEstado();
  }

  var carregada = img.complete && img.naturalWidth ? Promise.resolve() : new Promise(function (ok) { img.addEventListener("load", ok, { once: true }); });
  carregada.then(function () { return img.decode ? img.decode().catch(function () {}) : null; }).then(iniciar);
})();
