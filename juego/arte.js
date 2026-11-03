/* =====================================================================
   Órbita Zero · arte
   ---------------------------------------------------------------------
   Todo el arte se dibuja con código, sin archivos de imagen.
   Cada nave, bala y mejora se genera UNA vez como textura (al doble de
   resolución para pantallas de alta densidad) con DFE.Recursos.

   Los brillos de las balas también van "horneados" en la textura:
   usar ctx.shadowBlur en cada fotograma sería muy lento en un móvil.
   ===================================================================== */
(function () {
  "use strict";

  const ARTE = (window.ARTE = {});

  ARTE.colores = {
    jugador: "#e9f2ff",
    cabina: "#5ce1ff",
    acento: "#ff9f43",
    enemigo: "#ff4d8d",
    balaJugador: "#7df9ff",
    balaEnemiga: "#ff5ca8",
  };

  /* ---------- Utilidades de dibujo ---------- */
  function poligono(ctx, puntos, relleno, borde, grosor = 2) {
    ctx.beginPath();
    puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = grosor; ctx.lineJoin = "round"; ctx.stroke(); }
  }
  function brillo(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  /** Dibuja una forma y su reflejo en espejo (las naves son simétricas). */
  function simetrico(ctx, w, mitad, relleno, borde, grosor) {
    const pts = mitad.concat(mitad.slice().reverse().map(([x, y]) => [w - x, y]));
    poligono(ctx, pts, relleno, borde, grosor);
  }

  /* ===================================================================
     NAVES (coordenadas pensadas sobre la textura, ya al doble)
     =================================================================== */

  // Jugador: apunta hacia arriba. Textura 68 × 76.
  // Recibe una "pintura" (colores) para las naves del hangar.
  function pintarJugador(c) {
    return function (ctx, w, h) {
      // Alas
      simetrico(ctx, w, [[34, 22], [6, 58], [4, 66], [24, 60]], c.alas, c.borde, 2);
      simetrico(ctx, w, [[6, 58], [4, 70], [10, 70]], c.acento);
      // Cuerpo
      simetrico(ctx, w, [[34, 2], [26, 30], [22, 62], [28, 70]], c.cuerpo, "rgba(0,0,0,0.25)", 2);
      // Franja
      simetrico(ctx, w, [[34, 40], [28, 48], [28, 56]], c.alas);
      // Cabina
      ctx.beginPath();
      ctx.ellipse(34, 26, 5, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = c.cabina;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.ellipse(32, 22, 1.6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    };
  }

  // Dron: platillo pequeño. Textura 52 × 44.
  function pintarDron(ctx, w, h) {
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.55, w * 0.46, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#6b2bd9";
    ctx.fill();
    ctx.strokeStyle = "#c39bff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.45, w * 0.22, h * 0.28, 0, Math.PI, 0);
    ctx.fillStyle = "#9d6bff";
    ctx.fill();
    // Ojo
    brillo(ctx, w / 2, h * 0.58, 10, "rgba(255,80,140,0.9)");
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(w / 2, h * 0.58, 3.5, 0, Math.PI * 2); ctx.fill();
    // Luces
    ctx.fillStyle = "#ffd36b";
    [0.2, 0.8].forEach((f) => { ctx.beginPath(); ctx.arc(w * f, h * 0.58, 2.5, 0, Math.PI * 2); ctx.fill(); });
  }

  // Caza: apunta hacia abajo. Textura 64 × 60.
  function pintarCaza(ctx, w, h) {
    simetrico(ctx, w, [[32, 58], [24, 34], [2, 10], [6, 4], [22, 14], [26, 4]], "#b01e5c", "#ff7ab0", 2);
    simetrico(ctx, w, [[32, 50], [27, 30], [28, 10]], "#e33b7e");
    ctx.beginPath();
    ctx.ellipse(32, 30, 5, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd36b";
    ctx.fill();
    brillo(ctx, 32, 8, 10, "rgba(255,120,60,0.9)");
  }

  // Kamikaze: punta afilada hacia abajo. Textura 44 × 52.
  function pintarKamikaze(ctx, w, h) {
    simetrico(ctx, w, [[22, 50], [10, 16], [2, 6], [14, 10], [18, 2]], "#ff7a1a", "#ffd08a", 2);
    simetrico(ctx, w, [[22, 40], [16, 16], [20, 10]], "#c24d00");
    brillo(ctx, 22, 24, 9, "rgba(255,240,140,0.95)");
  }

  // Fragata: nave grande y lenta. Textura 120 × 92.
  function pintarFragata(ctx, w, h) {
    simetrico(ctx, w, [[60, 90], [36, 76], [8, 52], [6, 22], [26, 6], [48, 12], [56, 2]], "#2f5d50", "#7fe0c0", 2.5);
    simetrico(ctx, w, [[60, 78], [42, 64], [30, 40], [40, 22], [56, 26]], "#3f7a69");
    // Torretas
    [[24, 40], [96, 40], [60, 52]].forEach(([x, y]) => {
      ctx.fillStyle = "#1e3b33";
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#7fe0c0"; ctx.lineWidth = 2; ctx.stroke();
      brillo(ctx, x, y, 8, "rgba(255,90,170,0.9)");
    });
  }

  // Jefe: el Acorazado. Textura 320 × 200.
  function pintarJefe(ctx, w, h) {
    // Alas exteriores
    simetrico(ctx, w, [[160, 196], [110, 170], [20, 120], [4, 60], [30, 40], [70, 84], [100, 60]], "#5a0f2e", "#ff5ca8", 3);
    // Casco central
    simetrico(ctx, w, [[160, 186], [120, 150], [96, 70], [112, 24], [140, 8], [160, 6]], "#8c1a47", "#ff8cc1", 3);
    simetrico(ctx, w, [[160, 160], [132, 132], [122, 80], [136, 40], [160, 32]], "#b3245f");
    // Placas
    ctx.strokeStyle = "rgba(255,180,210,0.35)";
    ctx.lineWidth = 2;
    for (let y = 50; y < 150; y += 22) { ctx.beginPath(); ctx.moveTo(128, y); ctx.lineTo(192, y); ctx.stroke(); }
    // Núcleo
    brillo(ctx, 160, 110, 34, "rgba(255,230,120,0.95)");
    ctx.fillStyle = "#fff6c8";
    ctx.beginPath(); ctx.arc(160, 110, 10, 0, Math.PI * 2); ctx.fill();
    // Cañones
    [[46, 104], [274, 104], [100, 150], [220, 150]].forEach(([x, y]) => {
      ctx.fillStyle = "#2b0816";
      ctx.fillRect(x - 6, y - 4, 12, 22);
      brillo(ctx, x, y + 18, 9, "rgba(255,90,170,0.95)");
    });
  }

  /* ===================================================================
     BALAS Y EFECTOS (con el brillo incluido)
     =================================================================== */
  function pintarBalaJugador(ctx, w, h) {
    brillo(ctx, w / 2, h / 2, w / 2, "rgba(125,249,255,0.55)");
    ctx.fillStyle = "#e8feff";
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.14, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function pintarBalaEnemiga(ctx, w, h) {
    brillo(ctx, w / 2, h / 2, w / 2, "rgba(255,92,168,0.9)");
    ctx.fillStyle = "#ff8cc4";
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff4fa";
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.18, 0, Math.PI * 2); ctx.fill();
  }
  function pintarLlama(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(120,220,255,0.9)");
    g.addColorStop(1, "rgba(60,80,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, 0);
    ctx.quadraticCurveTo(w / 2, h * 1.1, w * 0.8, 0);
    ctx.fill();
  }
  function pintarEscudo(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(92,225,255,0)");
    g.addColorStop(0.8, "rgba(92,225,255,0.35)");
    g.addColorStop(1, "rgba(180,245,255,0.9)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2); ctx.fill();
  }

  /** Mejoras: cápsula de color con una letra. */
  function pintarMejora(color, letra) {
    return function (ctx, w, h) {
      brillo(ctx, w / 2, h / 2, w / 2, color.replace("1)", "0.5)"));
      ctx.fillStyle = "#101530";
      ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.round(w * 0.36)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letra, w / 2, h / 2 + 1);
    };
  }

  /* ===================================================================
     FONDO: nebulosa (textura alta que se repite en vertical)
     =================================================================== */
  /* ===================================================================
     SECTORES: cada 5 oleadas cambia la nebulosa del fondo
     =================================================================== */
  ARTE.SECTORES = [
    { nombre: "Nebulosa Índigo",    fondo: "#050816",
      manchas: ["rgba(120,40,200,0.20)", "rgba(30,120,200,0.18)", "rgba(200,40,120,0.14)", "rgba(60,40,200,0.18)", "rgba(40,160,200,0.12)"] },
    { nombre: "Nebulosa Carmesí",   fondo: "#12050c",
      manchas: ["rgba(220,40,80,0.22)", "rgba(255,120,60,0.14)", "rgba(160,20,90,0.20)", "rgba(240,80,40,0.14)", "rgba(120,20,60,0.18)"] },
    { nombre: "Cinturón Esmeralda", fondo: "#03110e",
      manchas: ["rgba(30,200,140,0.18)", "rgba(20,140,200,0.16)", "rgba(80,220,120,0.12)", "rgba(10,120,120,0.20)", "rgba(120,240,200,0.10)"] },
    { nombre: "Vacío Dorado",       fondo: "#0f0a03",
      manchas: ["rgba(240,180,40,0.18)", "rgba(160,60,220,0.16)", "rgba(255,120,40,0.12)", "rgba(120,40,180,0.18)", "rgba(255,220,120,0.10)"] },
  ];

  function pintarNebulosa(colores) {
    return function (ctx, w, h) {
      const posiciones = [[0.2, 0.15, 160], [0.8, 0.35, 190], [0.35, 0.6, 210], [0.75, 0.85, 170], [0.1, 0.9, 120]];
      // Se dibuja cada mancha también a los lados, arriba y abajo para que
      // la textura empalme sin cortes al repetirse
      posiciones.forEach(([fx, fy, r], i) => {
        for (const dy of [-h, 0, h]) {
          for (const dx of [-w, 0, w]) brillo(ctx, fx * w + dx, fy * h + dy, r, colores[i]);
        }
      });
    };
  }

  /* ===================================================================
     JEFES 2 y 3
     =================================================================== */

  // Enjambre: nave nodriza hexagonal. Textura 260 × 220.
  function pintarNodriza(ctx, w, h) {
    const cx = w / 2, cy = h / 2;
    const hexagono = (r) => Array.from({ length: 6 }, (_, i) => {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85];
    });
    poligono(ctx, hexagono(118), "#3d4a12", "#d8f05a", 3);
    poligono(ctx, hexagono(86), "#5a6b18");
    // Celdas de la colmena
    ctx.strokeStyle = "rgba(216,240,90,0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 86, cy + Math.sin(a) * 73); ctx.stroke();
    }
    // Hangares laterales (de ahí salen los drones)
    [[-1, 0], [1, 0]].forEach(([lado]) => {
      ctx.fillStyle = "#1c2306";
      ctx.fillRect(cx + lado * 100 - 14, cy - 18, 28, 36);
      brillo(ctx, cx + lado * 100, cy, 18, "rgba(255,210,60,0.8)");
    });
    // Núcleo
    brillo(ctx, cx, cy, 48, "rgba(255,240,120,0.95)");
    ctx.fillStyle = "#fffbe0";
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill();
  }

  // Placa del escudo giratorio del Enjambre. Textura 60 × 60.
  function pintarPlaca(ctx, w, h) {
    poligono(ctx, [[w / 2, 2], [w - 4, h * 0.3], [w - 8, h * 0.8], [w / 2, h - 2], [8, h * 0.8], [4, h * 0.3]], "#2d5d73", "#8ff0ff", 2.5);
    brillo(ctx, w / 2, h / 2, 14, "rgba(140,240,255,0.8)");
  }

  // Leviatán: cabeza de serpiente (apunta hacia abajo). Textura 120 × 108.
  function pintarCabezaLeviatan(ctx, w, h) {
    simetrico(ctx, w, [[60, 106], [40, 92], [18, 60], [4, 22], [22, 4], [44, 14], [60, 8]], "#3b1670", "#c49bff", 3);
    simetrico(ctx, w, [[60, 92], [46, 78], [32, 50], [36, 26], [60, 22]], "#5b25a8");
    // Mandíbulas
    simetrico(ctx, w, [[40, 92], [30, 106], [46, 100]], "#e9d8ff");
    // Ojos
    [[38, 52], [82, 52]].forEach(([x, y]) => {
      brillo(ctx, x, y, 14, "rgba(255,80,160,0.95)");
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    });
  }

  // Leviatán: segmento del cuerpo. Textura 72 × 72.
  function pintarSegmentoLeviatan(ctx, w, h) {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.44, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#3b1670"; ctx.fill();
    ctx.strokeStyle = "#c49bff"; ctx.lineWidth = 2.5; ctx.stroke();
    simetrico(ctx, w, [[36, 8], [16, 20], [10, 36], [20, 30]], "#5b25a8");
    brillo(ctx, w / 2, h / 2, 12, "rgba(255,92,168,0.85)");
    ctx.fillStyle = "#ffe0f0"; ctx.beginPath(); ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2); ctx.fill();
  }

  /** Lista de recursos para DFE.Recursos.cargar(). */
  ARTE.recursos = [
    { nombre: "dron", tipo: "generada", ancho: 52, alto: 44, pintar: pintarDron },
    { nombre: "caza", tipo: "generada", ancho: 64, alto: 60, pintar: pintarCaza },
    { nombre: "kamikaze", tipo: "generada", ancho: 44, alto: 52, pintar: pintarKamikaze },
    { nombre: "fragata", tipo: "generada", ancho: 120, alto: 92, pintar: pintarFragata },
    { nombre: "jefe", tipo: "generada", ancho: 320, alto: 200, pintar: pintarJefe },
    { nombre: "balaJugador", tipo: "generada", ancho: 20, alto: 36, pintar: pintarBalaJugador },
    { nombre: "balaEnemiga", tipo: "generada", ancho: 36, alto: 36, pintar: pintarBalaEnemiga },
    { nombre: "llama", tipo: "generada", ancho: 20, alto: 32, pintar: pintarLlama },
    { nombre: "escudo", tipo: "generada", ancho: 96, alto: 96, pintar: pintarEscudo },
    { nombre: "mejoraArma", tipo: "generada", ancho: 56, alto: 56, pintar: pintarMejora("rgba(255,159,67,1)", "P") },
    { nombre: "mejoraEscudo", tipo: "generada", ancho: 56, alto: 56, pintar: pintarMejora("rgba(92,225,255,1)", "S") },
    { nombre: "mejoraVida", tipo: "generada", ancho: 56, alto: 56, pintar: pintarMejora("rgba(255,92,168,1)", "+") },
    { nombre: "nodriza", tipo: "generada", ancho: 260, alto: 220, pintar: pintarNodriza },
    { nombre: "placaEscudo", tipo: "generada", ancho: 60, alto: 60, pintar: pintarPlaca },
    { nombre: "leviatanCabeza", tipo: "generada", ancho: 120, alto: 108, pintar: pintarCabezaLeviatan },
    { nombre: "leviatanSegmento", tipo: "generada", ancho: 72, alto: 72, pintar: pintarSegmentoLeviatan },
    // Una nebulosa por sector: "nebulosa-0", "nebulosa-1"…
    ...ARTE.SECTORES.map((sector, i) => (
      { nombre: "nebulosa-" + i, tipo: "generada", ancho: 480, alto: 900, pintar: pintarNebulosa(sector.manchas) }
    )),
    // Una textura de nave por cada pintura del hangar: "jugador-clasica", "jugador-carmesi"…
    ...Object.entries(Progreso.PINTURAS).map(([id, colores]) => (
      { nombre: "jugador-" + id, tipo: "generada", ancho: 68, alto: 76, pintar: pintarJugador(colores) }
    )),
  ];

  /** Dibuja la nave de una pintura en un canvas (para el hangar). */
  ARTE.miniaturaNave = function (idPintura, escala = 1) {
    return DFE.Recursos.generar(68 * escala, 76 * escala, (ctx) => {
      ctx.scale(escala, escala);
      pintarJugador(Progreso.PINTURAS[idPintura])(ctx, 68, 76);
    });
  };
})();
