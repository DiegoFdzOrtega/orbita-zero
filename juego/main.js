/* =====================================================================
   Órbita Zero · arranque e interfaz
   ---------------------------------------------------------------------
   Aquí se juntan las tres partes:
     - el MOTOR (DiegoFo Engine) que mueve el juego en el <canvas>
     - el PROGRESO del jugador (pilotos, créditos, hangar, logros…)
     - la INTERFAZ hecha con diegofo-ui
   ===================================================================== */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const UI = DFE.UI;
  const { DfModal } = window.DiegofoUI;
  const formato = (n) => Math.round(n).toLocaleString("es-ES");

  /* ===================================================================
     1) MOTOR, CONTROLES Y SONIDO
     =================================================================== */
  const motor = new DFE.Motor({
    canvas: "#juego",
    nombre: "orbita-zero",       // prefijo para el guardado
    anchoMinimo: 360,            // el campo de juego mide 360 de ancho...
    altoMinimo: 600,             // ...y al menos 600 de alto (juego vertical)
  });
  window.motor = motor; // accesible desde la consola para depurar

  const entrada = motor.entrada;
  entrada.definir("izquierda", ["ArrowLeft", "KeyA"]);
  entrada.definir("derecha", ["ArrowRight", "KeyD"]);
  entrada.definir("arriba", ["ArrowUp", "KeyW"]);
  entrada.definir("abajo", ["ArrowDown", "KeyS"]);

  const audio = motor.audio;
  audio.definir("laser", (a) => a.tono({ frecuencia: 1400, hasta: 500, duracion: 0.06, tipo: "square", volumen: 0.03 }));
  audio.definir("explosion", (a) => a.ruido({ duracion: 0.25, volumen: 0.35, filtro: 1400 }));
  audio.definir("explosionGrande", (a) => {
    a.ruido({ duracion: 0.6, volumen: 0.55, filtro: 700 });
    a.tono({ frecuencia: 160, hasta: 40, duracion: 0.5, tipo: "sawtooth", volumen: 0.2 });
  });
  audio.definir("golpe", (a) => a.tono({ frecuencia: 300, hasta: 80, duracion: 0.3, tipo: "sawtooth", volumen: 0.25 }));
  audio.definir("escudo", (a) => a.tono({ frecuencia: 600, hasta: 1200, duracion: 0.2, tipo: "sine", volumen: 0.2 }));
  audio.definir("mejora", (a) => {
    [660, 880, 1320].forEach((f, i) => a.tono({ frecuencia: f, duracion: 0.1, tipo: "triangle", volumen: 0.2, retraso: i * 0.06 }));
  });
  audio.definir("alarma", (a) => {
    for (let i = 0; i < 3; i++) a.tono({ frecuencia: 440, hasta: 220, duracion: 0.35, tipo: "square", volumen: 0.12, retraso: i * 0.45 });
  });
  audio.definir("logro", (a) => {
    [523, 659, 784, 1047].forEach((f, i) => a.tono({ frecuencia: f, duracion: 0.12, tipo: "triangle", volumen: 0.18, retraso: i * 0.07 }));
  });
  audio.definir("compra", (a) => {
    a.tono({ frecuencia: 880, duracion: 0.08, tipo: "square", volumen: 0.1 });
    a.tono({ frecuencia: 1760, duracion: 0.16, tipo: "triangle", volumen: 0.15, retraso: 0.07 });
  });

  /* ---------- Música generada (secuenciador del motor) ----------
     Progresión La m – Fa – Do – Sol, 4 compases de 16 semicorcheas. */
  const RAICES = [45, 41, 48, 43];                          // notas MIDI del bajo
  const ACORDES = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
  function generarPista(funcion) {
    const notas = [];
    for (let compas = 0; compas < 4; compas++) for (let paso = 0; paso < 16; paso++) notas.push(funcion(compas, paso));
    return notas;
  }
  const MUSICA_MENU = {
    bpm: 84,
    pistas: [
      { tipo: "triangle", volumen: 0.13, duracion: 7, notas: generarPista((c, p) => (p % 8 === 0 ? RAICES[c] : null)) },
      { tipo: "sine", volumen: 0.05, duracion: 3, notas: generarPista((c, p) => (p % 4 === 2 ? ACORDES[c][(p / 4 | 0) % 3] + 12 : null)) },
    ],
  };
  const MUSICA_BATALLA = {
    bpm: 116,
    pistas: [
      { tipo: "bombo", volumen: 0.28, notas: generarPista((c, p) => (p % 4 === 0 ? 1 : null)) },
      { tipo: "triangle", volumen: 0.15, duracion: 1.6, notas: generarPista((c, p) => (p % 2 === 0 ? RAICES[c] + (p % 8 === 6 ? 12 : 0) : null)) },
      { tipo: "square", volumen: 0.022, duracion: 0.9, notas: generarPista((c, p) => ACORDES[c][[0, 1, 2, 1][p % 4]] + 12) },
    ],
  };
  const MUSICA_JEFE = Object.assign({}, MUSICA_BATALLA, { bpm: 132 });

  let musicaActual = null;
  function musica(cancion) {
    musicaActual = cancion;
    if (audio.ctx) audio.reproducirMusica(cancion);
  }
  // La música solo puede empezar tras el primer toque (norma de los móviles)
  const arrancarMusica = () => { audio.desbloquear(); if (musicaActual) audio.reproducirMusica(musicaActual); };
  window.addEventListener("pointerdown", arrancarMusica, { once: true });
  window.addEventListener("keydown", arrancarMusica, { once: true });

  /* ===================================================================
     2) PROGRESO Y AJUSTES
     =================================================================== */
  const guardado = motor.guardado;
  const progreso = new Progreso(guardado);
  window.progreso = progreso;
  const ajustes = { dificultad: guardado.leer("dificultad", "normal") };

  /* ===================================================================
     3) PIEZAS DE LA INTERFAZ
     =================================================================== */
  const pantallaCarga = $("#carga");
  const barraCarga = $("#barraCarga");
  const menu = $("#menu");
  const hud = $("#hud");
  const barraJefe = $("#barraJefe");
  const modales = {
    pausa: $("#modalPausa"), fin: $("#modalFin"), ajustes: $("#modalAjustes"), ayuda: $("#modalAyuda"),
    pilotos: $("#modalPilotos"), hangar: $("#modalHangar"), logros: $("#modalLogros"), estadisticas: $("#modalEstadisticas"),
  };

  let estado = "carga"; // carga | menu | jugando | pausa | fin
  const mostrar = (capa, visible) => { capa.hidden = !visible; };

  /** Crea un elemento con atributos y contenido de forma cómoda. */
  function el(etiqueta, atributos = {}, ...hijos) {
    const e = document.createElement(etiqueta);
    for (const [k, v] of Object.entries(atributos)) {
      if (k === "texto") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, "");
      else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v);
    }
    hijos.flat().forEach((h) => h && e.append(h));
    return e;
  }

  function notificarLogros(lista) {
    for (const l of lista) {
      audio.reproducir("logro");
      UI.notificar(`🏆 Logro: ${l.nombre} (+${formato(l.premio)} ⭐)`, "success");
    }
  }

  /* ===================================================================
     4) MENÚ PRINCIPAL
     =================================================================== */
  function pintarMenu() {
    const p = progreso.activo;
    if (!p) return;
    $("#avatarPiloto").name = p.nombre;
    UI.texto($("#nombrePiloto"), p.nombre);
    UI.texto($("#creditosPiloto"), formato(p.creditos) + " ⭐");
    const r = $("#tarjetaRecord");
    r.value = String(p.stats.mejorPuntos);
    r.hint = p.stats.partidas ? `Mejor oleada: ${p.stats.mejorOleada} · ${p.stats.partidas} partidas` : "Aún no has despegado";
    const logros = progreso.estadoLogros();
    UI.texto($("#contadorLogros"), `${logros.filter((l) => l.conseguido).length}/${logros.length}`);
  }
  progreso.on("cambio", () => { if (estado === "menu") pintarMenu(); });

  function irAlMenu() {
    estado = "menu";
    mostrar(pantallaCarga, false);
    mostrar(hud, false);
    mostrar(menu, true);
    pintarMenu();
    entrada.bloqueada = true;
    motor.escalaTiempo = 1;
    if (motor.pausado) motor.reanudar();
    motor.iniciar(new EscenaBatalla("menu", "normal", { pintura: progreso.activo?.pintura }));
    musica(MUSICA_MENU);
  }

  /* ===================================================================
     5) PARTIDA
     =================================================================== */
  let ultimoMarcador = {};

  function jugar() {
    estado = "jugando";
    mostrar(menu, false);
    mostrar(hud, true);
    mostrar(barraJefe, false);
    ultimoMarcador = {};
    motor.escalaTiempo = 1;
    if (motor.pausado) motor.reanudar();
    entrada.bloqueada = false;
    motor.iniciar(new EscenaBatalla("juego", ajustes.dificultad, progreso.configuracionPartida()));
    musica(MUSICA_BATALLA);
    avisarSiHorizontal();
  }

  async function pausar() {
    if (estado !== "jugando") return;
    estado = "pausa";
    motor.pausar();
    entrada.bloqueada = true;
    audio.detenerMusica();
    const eleccion = await UI.abrir(modales.pausa);
    if (eleccion === "menu") {
      // Abandonar también cuenta: se guardan los créditos ganados hasta ahí
      const partida = motor.escena.partida;
      if (partida.oleada > 0) progreso.registrarPartida(partida);
      irAlMenu();
    } else {
      estado = "jugando";
      entrada.bloqueada = false;
      motor.reanudar();
      musica(motor.escena.jefe ? MUSICA_JEFE : MUSICA_BATALLA);
    }
  }

  async function terminar(partida) {
    estado = "fin";
    entrada.bloqueada = true;
    musica(MUSICA_MENU);
    const { creditos, nuevos, nuevoRecord } = progreso.registrarPartida(partida);
    if (nuevoRecord) audio.reproducir("logro");

    $("#finPuntos").value = String(partida.puntos);
    $("#finPuntos").variant = nuevoRecord ? "success" : "default";
    $("#finPuntos").hint = nuevoRecord ? "¡Nuevo récord!" : `Récord: ${formato(progreso.activo.stats.mejorPuntos)}`;
    $("#finOleada").value = String(partida.oleada);
    $("#finOleada").label = `Oleada · sector ${partida.sector}`;
    $("#finOleada").hint = `${partida.derribados} derribados · combo x${partida.maxCombo}`;
    $("#finCreditos").value = String(creditos);
    $("#finCreditos").hint = `Total: ${formato(progreso.activo.creditos)} ⭐`;
    modales.fin.heading = nuevoRecord ? "¡Nuevo récord! 🏆" : "Nave destruida";

    const lista = $("#finLogros");
    lista.replaceChildren();
    for (const l of nuevos) {
      lista.append(el("li", {}, el("df-badge", { color: "yellow", texto: `+${formato(l.premio)} ⭐` }), " ", el("strong", { texto: l.nombre }), ` · ${l.descripcion}`));
    }
    mostrar($("#finBloqueLogros"), nuevos.length > 0);

    const eleccion = await UI.abrir(modales.fin);
    if (eleccion === "otra") jugar();
    else if (eleccion === "hangar") { irAlMenu(); abrirHangar(); }
    else irAlMenu();
  }

  /* ---------- Eventos del motor → interfaz ---------- */
  // Solo se toca el DOM cuando un valor cambia (60 veces por segundo sería caro)
  motor.on("marcador", (m) => {
    const u = ultimoMarcador;
    if (m.puntos !== u.puntos) UI.texto($("#marcadorPuntos"), formato(m.puntos));
    if (m.oleada !== u.oleada) UI.texto($("#marcadorOleada"), "Oleada " + m.oleada);
    if (m.arma !== u.arma) UI.texto($("#marcadorArma"), "🔫 " + m.arma);
    if (m.multiplicador !== u.multiplicador) {
      const combo = $("#marcadorCombo");
      combo.hidden = m.multiplicador < 2;
      UI.texto(combo, "x" + m.multiplicador);
    }
    if (m.vida !== u.vida || m.vidaMax !== u.vidaMax) {
      const casco = $("#barraCasco");
      casco.max = m.vidaMax;
      casco.value = m.vida;
      casco.variant = m.vida <= 1 ? "danger" : m.vida === 2 ? "warning" : "success";
    }
    ultimoMarcador = m;
  });

  motor.on("oleada", ({ numero, jefe, nombreJefe }) => {
    if (jefe) { UI.notificar(`⚠️ ¡Se acerca el ${nombreJefe}!`, "danger"); musica(MUSICA_JEFE); }
    else if (numero > 1) UI.notificar(`Oleada ${numero}`, "info");
  });
  motor.on("jefe", ({ vida, max, nuevo, nombre }) => {
    if (nuevo) { mostrar(barraJefe, true); barraJefe.max = max; barraJefe.label = nombre; }
    barraJefe.value = vida;
  });
  motor.on("jefe-fin", ({ puntos, nombre }) => {
    mostrar(barraJefe, false);
    musica(MUSICA_BATALLA);
    audio.reproducir("logro");
    UI.notificar(`💥 ¡${nombre} destruido! +${formato(puntos)}`, "success");
  });
  motor.on("mejora", (texto) => UI.notificar(texto, "info"));
  // Logros durante la partida (una vez por segundo)
  motor.on("estadisticas", (partida) => notificarLogros(progreso.comprobarLogros(partida)));
  motor.on("fin", terminar);
  motor.on("pausa-automatica", () => { if (estado === "jugando") pausar(); });

  let avisoDado = false;
  function avisarSiHorizontal() {
    const p = motor.pantalla;
    if (!p.vertical && p.altoCss < 520 && !avisoDado) {
      avisoDado = true;
      UI.notificar("Consejo: pon el móvil en vertical para ver la nave más grande", "info");
    }
  }
  motor.on("redimensionar", () => { if (estado === "jugando") avisarSiHorizontal(); });

  /* ===================================================================
     6) PILOTOS (perfiles locales)
     =================================================================== */
  async function pedirNombre(titulo, mensaje) {
    while (true) {
      const datos = await DfModal.prompt({
        heading: titulo,
        message: mensaje,
        confirmText: "Guardar",
        fields: [{ name: "nombre", label: "Nombre de piloto", required: true, placeholder: "Por ejemplo: Nova",
                   pattern: "[A-Za-zÀ-ÿ0-9 _\\-]{2,14}" }],
      });
      if (!datos) return null;
      const error = progreso.validarNombre(datos.nombre);
      if (!error) return datos.nombre.trim();
      UI.notificar(error, "warning");
    }
  }

  async function crearPiloto(primeraVez) {
    const nombre = await pedirNombre(
      primeraVez ? "¡Bienvenido a Órbita Zero!" : "Nuevo piloto",
      primeraVez ? "Crea tu piloto. Tu progreso (créditos, hangar, logros) se guarda en este dispositivo."
                 : "Cada piloto tiene sus propios créditos, mejoras y logros (entre 2 y 14 caracteres).");
    if (nombre) {
      progreso.crearPiloto(nombre);
      UI.notificar(`Piloto ${nombre} listo para despegar`, "success");
    } else if (primeraVez) {
      progreso.crearPiloto("Piloto");  // se puede cambiar después
    }
    if (estado === "menu") irAlMenu();  // repinta la nave con su pintura
  }

  function pintarPilotos() {
    const lista = $("#listaPilotos");
    lista.replaceChildren();
    for (const p of progreso.pilotos) {
      const activo = p.id === progreso.idActivo;
      lista.append(el("li", { class: "piloto" + (activo ? " activo" : "") },
        el("df-avatar", { name: p.nombre, size: "md", status: activo ? "online" : "" }),
        el("div", { class: "piloto-datos" },
          el("strong", { texto: p.nombre }),
          el("span", { texto: `${formato(p.stats.mejorPuntos)} pts · ${formato(p.creditos)} ⭐ · ${Object.keys(p.logros).length} logros` })),
        activo ? el("df-badge", { color: "green", variant: "soft", texto: "En uso" })
               : el("df-button", { size: "sm", variant: "secondary", texto: "Elegir", onclick: () => { progreso.elegirPiloto(p.id); pintarPilotos(); irAlMenu(); } }),
        el("df-button", { size: "sm", variant: "ghost", "aria-label": `Borrar a ${p.nombre}`, texto: "🗑", onclick: () => borrarPiloto(p) }),
      ));
    }
  }

  async function borrarPiloto(p) {
    const ok = await DfModal.confirm({
      heading: "Borrar piloto",
      message: `Se borrarán los créditos, mejoras y logros de ${p.nombre}. No se puede deshacer.`,
      confirmText: "Borrar", variant: "danger",
    });
    if (!ok) return;
    progreso.borrarPiloto(p.id);
    if (!progreso.pilotos.length) { modales.pilotos.close(); await crearPiloto(true); }
    pintarPilotos();
    irAlMenu();
  }

  /* ===================================================================
     7) HANGAR (mejoras y pinturas)
     =================================================================== */
  function pintarHangar() {
    const p = progreso.activo;
    UI.texto($("#creditosHangar"), formato(p.creditos) + " ⭐");

    const mejoras = $("#listaMejoras");
    mejoras.replaceChildren();
    for (const [id, m] of Object.entries(Progreso.MEJORAS)) {
      const nivel = progreso.nivel(id);
      const coste = progreso.coste(id);
      const barra = el("df-progress", { size: "sm", value: nivel, max: m.costes.length, label: `Nivel ${nivel}/${m.costes.length}` });
      const boton = coste === null
        ? el("df-button", { size: "sm", variant: "success", disabled: true, texto: "Máximo" })
        : el("df-button", { size: "sm", variant: "primary", disabled: p.creditos < coste, texto: `Mejorar · ${formato(coste)} ⭐`,
                            onclick: () => comprar(() => progreso.comprar(id), m.nombre) });
      mejoras.append(el("li", { class: "tarjeta-hangar" },
        el("div", { class: "icono-hangar", texto: m.icono }),
        el("div", { class: "datos-hangar" },
          el("strong", { texto: m.nombre }),
          el("span", { class: "efecto", texto: m.efecto(nivel) }),
          coste !== null ? el("span", { class: "siguiente", texto: "Siguiente: " + m.efecto(nivel + 1) }) : null,
          barra),
        boton));
    }

    const pinturas = $("#listaPinturas");
    pinturas.replaceChildren();
    for (const [id, pin] of Object.entries(Progreso.PINTURAS)) {
      const tiene = p.pinturas.includes(id);
      const enUso = p.pintura === id;
      const lienzo = ARTE.miniaturaNave(id, 1);
      lienzo.className = "miniatura";
      lienzo.setAttribute("aria-hidden", "true");
      let boton;
      if (enUso) boton = el("df-badge", { color: "green", texto: "En uso" });
      else if (tiene) boton = el("df-button", { size: "sm", variant: "secondary", texto: "Usar", onclick: () => comprar(() => progreso.comprarPintura(id)) });
      else boton = el("df-button", { size: "sm", variant: "primary", disabled: p.creditos < pin.coste, texto: `${formato(pin.coste)} ⭐`,
                                     onclick: () => comprar(() => progreso.comprarPintura(id), "Pintura " + pin.nombre) });
      pinturas.append(el("li", { class: "tarjeta-pintura" + (enUso ? " activa" : "") }, lienzo, el("strong", { texto: pin.nombre }), boton));
    }
  }

  function comprar(accion, nombre) {
    const r = accion();
    if (!r.ok) { UI.notificar(r.motivo, "warning"); return; }
    if (nombre) { audio.reproducir("compra"); UI.notificar(`Comprado: ${nombre}`, "success"); }
    notificarLogros(r.nuevos || []);
    pintarHangar();
    pintarMenu();
    // La nave del menú cambia de pintura al momento
    if (estado === "menu") motor.escena.nave.imagen = "jugador-" + progreso.activo.pintura;
  }

  function abrirHangar() {
    pintarHangar();
    UI.abrir(modales.hangar);
  }

  /* ===================================================================
     8) LOGROS
     =================================================================== */
  function pintarLogros() {
    const estadoLogros = progreso.estadoLogros();
    const hechos = estadoLogros.filter((l) => l.conseguido).length;
    const resumen = $("#resumenLogros");
    resumen.max = estadoLogros.length;
    resumen.value = hechos;
    resumen.label = `${hechos} de ${estadoLogros.length} conseguidos`;

    const lista = $("#listaLogros");
    lista.replaceChildren();
    for (const l of estadoLogros) {
      lista.append(el("li", { class: "logro" + (l.conseguido ? " conseguido" : "") },
        el("div", { class: "icono-logro", "aria-hidden": "true", texto: l.conseguido ? "🏆" : "🔒" }),
        el("div", { class: "datos-logro" },
          el("strong", { texto: l.nombre }),
          el("span", { texto: l.descripcion }),
          l.conseguido
            ? el("span", { class: "fecha", texto: "Conseguido el " + new Date(l.fecha).toLocaleDateString("es-ES") })
            : el("df-progress", { size: "sm", value: l.valor, max: l.objetivo, label: `${formato(l.valor)} / ${formato(l.objetivo)}` })),
        el("df-badge", { color: l.conseguido ? "green" : "yellow", variant: l.conseguido ? "solid" : "soft", texto: `+${formato(l.premio)} ⭐` })));
    }
  }

  /* ===================================================================
     9) ESTADÍSTICAS, HISTORIAL Y COPIA DE SEGURIDAD
     =================================================================== */
  const tablaHistorial = $("#tablaHistorial");
  tablaHistorial.columns = [
    { key: "fecha", label: "Fecha", type: "date", sortable: true },
    { key: "puntos", label: "Puntos", type: "number", align: "right", sortable: true },
    { key: "oleada", label: "Oleada", type: "number", align: "right", sortable: true },
    { key: "derribados", label: "Derribos", type: "number", align: "right", sortable: true },
    { key: "creditos", label: "Créditos", type: "number", align: "right", sortable: true },
    { key: "duracion", label: "Duración", align: "right", sortable: true,
      render: (fila) => `${Math.floor(fila.duracion / 60)}:${String(fila.duracion % 60).padStart(2, "0")}` },
  ];

  function pintarEstadisticas() {
    const p = progreso.activo;
    const s = p.stats;
    const tarjetas = [
      ["Partidas", s.partidas, "default", ""],
      ["Mejor puntuación", s.mejorPuntos, "success", "pts"],
      ["Mejor oleada", s.mejorOleada, "info", ""],
      ["Enemigos derribados", s.derribados, "warning", ""],
      ["Jefes derrotados", s.jefes, "danger", ""],
      ["Mejor sector", s.mejorSector || 1, "success", ""],
      ["Mejor combo", s.mejorCombo, "info", "x"],
      ["Mejoras recogidas", s.mejoras, "default", ""],
      ["Créditos ganados", s.creditosGanados, "warning", "⭐"],
    ];
    const rejilla = $("#rejillaEstadisticas");
    rejilla.replaceChildren(...tarjetas.map(([label, value, variant, unit]) =>
      el("df-stat-card", { label, value: String(value), variant, unit, format: "number" })));
    const min = Math.round(s.tiempo / 60);
    UI.texto($("#tiempoJugado"), `Tiempo de vuelo: ${Math.floor(min / 60)} h ${min % 60} min · Piloto desde el ${new Date(p.creado).toLocaleDateString("es-ES")}`);
    tablaHistorial.setData(p.historial);
  }

  function exportar() {
    const blob = new Blob([progreso.exportar()], { type: "application/json" });
    const enlace = el("a", { href: URL.createObjectURL(blob), download: `orbita-zero-progreso-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
    UI.notificar("Copia de seguridad descargada", "success");
  }

  $("#archivoImportar").addEventListener("change", async (e) => {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    try {
      const n = progreso.importar(await archivo.text());
      UI.notificar(`${n} piloto(s) importado(s)`, "success");
      notificarLogros(progreso.comprobarLogros(Progreso.partidaVacia()));
      pintarEstadisticas();
      irAlMenu();
    } catch (error) {
      UI.notificar(error.message, "danger");
    }
  });

  /* ===================================================================
     10) BOTONES, TECLADO Y AJUSTES
     =================================================================== */
  $("#botonJugar").addEventListener("click", jugar);
  $("#botonPausa").addEventListener("click", pausar);
  $("#botonAyuda").addEventListener("click", () => UI.abrir(modales.ayuda));
  $("#botonAjustes").addEventListener("click", () => UI.abrir(modales.ajustes));
  $("#botonHangar").addEventListener("click", abrirHangar);
  $("#botonLogros").addEventListener("click", () => { pintarLogros(); UI.abrir(modales.logros); });
  $("#botonEstadisticas").addEventListener("click", () => { pintarEstadisticas(); UI.abrir(modales.estadisticas); });
  $("#botonPilotos").addEventListener("click", () => { pintarPilotos(); UI.abrir(modales.pilotos); });
  $("#botonNuevoPiloto").addEventListener("click", async () => { await crearPiloto(false); pintarPilotos(); });
  $("#botonExportar").addEventListener("click", exportar);
  $("#botonImportar").addEventListener("click", () => $("#archivoImportar").click());

  window.addEventListener("keydown", (e) => {
    if ((e.code === "Escape" || e.code === "KeyP") && estado === "jugando") {
      e.preventDefault();
      pausar();
    }
    if ((e.code === "Enter" || e.code === "Space") && estado === "menu" &&
        !document.querySelector("df-modal[open]") && e.target === document.body) {
      e.preventDefault();
      jugar();
    }
  });

  UI.vincularInterruptor($("#ajusteSonido"), audio, "activo", guardado, "sonido");
  UI.vincularInterruptor($("#ajusteMusica"), audio, "musicaActiva", guardado, "musica");
  UI.vincularInterruptor($("#ajusteDepurador"), motor.depurador, "activo", guardado, "depurador");
  if (audio.puedeVibrar) {
    UI.vincularInterruptor($("#ajusteVibracion"), audio, "vibracion", guardado, "vibracion");
  } else {
    // iPhone y la mayoría de ordenadores no pueden vibrar desde la web
    $("#ajusteVibracion").disabled = true;
    $("#ajusteVibracion").label = "Vibración (no disponible en este dispositivo)";
  }
  const selectorDificultad = $("#ajusteDificultad");
  selectorDificultad.value = ajustes.dificultad;
  selectorDificultad.addEventListener("df-change", (e) => {
    ajustes.dificultad = e.detail.value;
    guardado.escribir("dificultad", ajustes.dificultad);
  });

  const botonCompleta = $("#botonPantallaCompleta");
  if (document.fullscreenEnabled) {
    botonCompleta.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
          await screen.orientation?.lock?.("portrait").catch(() => {});  // solo Android
        }
      } catch (e) {
        UI.notificar("No se ha podido activar la pantalla completa", "warning");
      }
    });
  } else {
    botonCompleta.hidden = true; // iPhone no la permite en páginas web
  }

  /* ===================================================================
     11) ARRANQUE: cargar recursos → piloto → menú
     =================================================================== */
  DFE.Recursos.cargar(ARTE.recursos, (hechos, total) => {
    barraCarga.value = Math.round((hechos / total) * 100);
  }).then(async () => {
    await new Promise((ok) => setTimeout(ok, 250));
    irAlMenu();
    if (!progreso.activo) await crearPiloto(true);
    // Por si hay logros cumplidos que aún no se habían dado (p. ej. tras importar)
    notificarLogros(progreso.comprobarLogros(Progreso.partidaVacia()));
  }).catch((error) => {
    barraCarga.variant = "danger";
    barraCarga.label = "Error al cargar: " + error.message;
  });

  // App instalable y sin conexión (solo cuando se sirve por http/https,
  // por ejemplo en GitHub Pages; con doble clic no hace falta)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
