/* =====================================================================
   Órbita Zero · progreso del jugador
   ---------------------------------------------------------------------
   Todo lo que hace que quieras volver a jugar, guardado en el
   dispositivo (sin servidor, funciona sin conexión):

     - PILOTOS: varios perfiles en el mismo móvil, cada uno con lo suyo
     - CRÉDITOS: se ganan en cada partida
     - HANGAR: mejoras permanentes y pinturas que se compran con créditos
     - LOGROS: retos con recompensa
     - ESTADÍSTICAS e HISTORIAL de partidas
     - COPIA DE SEGURIDAD: exportar / importar en un archivo .json

   Es lógica pura (no toca el DOM ni el canvas): la interfaz la usa
   desde main.js y la partida recibe su configuración.
   ===================================================================== */
(function () {
  "use strict";

  const VERSION_DATOS = 1;
  const MAX_HISTORIAL = 30;

  /* ===================================================================
     CATÁLOGOS
     =================================================================== */

  /** Mejoras permanentes del hangar. costes[i] = precio del nivel i+1. */
  const MEJORAS = {
    casco:    { nombre: "Casco reforzado",    icono: "🛡️", costes: [800, 2000],        efecto: (n) => `Despegas con ${3 + n} de casco (máx. ${5 + n})` },
    cadencia: { nombre: "Cañones rápidos",    icono: "⚡", costes: [600, 1500, 3200],  efecto: (n) => n ? `Disparas un ${n * 8} % más rápido` : "Cadencia normal" },
    arma:     { nombre: "Arma de serie",      icono: "🔫", costes: [2000, 5000],       efecto: (n) => `Despegas con el arma en nivel ${1 + n}` },
    escudo:   { nombre: "Generador de escudo", icono: "🔵", costes: [900, 2400],       efecto: (n) => n ? `Escudo de ${n * 5} s al despegar` : "Sin escudo inicial" },
    iman:     { nombre: "Imán de mejoras",    icono: "🧲", costes: [700, 1800],        efecto: (n) => n ? `Atrae las mejoras a ${[0, 70, 130][n]} unidades` : "Sin imán" },
  };

  /** Pinturas para la nave (cosméticas). */
  const PINTURAS = {
    clasica:   { nombre: "Clásica",   coste: 0,    cuerpo: "#e9f2ff", alas: "#2a3f8f", borde: "#90a9ff", acento: "#ff9f43", cabina: "#5ce1ff" },
    carmesi:   { nombre: "Carmesí",   coste: 1200, cuerpo: "#ffe3ea", alas: "#8f1f3f", borde: "#ff8fb0", acento: "#ffd36b", cabina: "#ff5c8a" },
    esmeralda: { nombre: "Esmeralda", coste: 1200, cuerpo: "#e6fff4", alas: "#1d6b52", borde: "#7fe0c0", acento: "#5ce1ff", cabina: "#3ddc97" },
    dorada:    { nombre: "Dorada",    coste: 4000, cuerpo: "#fff6d6", alas: "#7a5a12", borde: "#ffd36b", acento: "#ff5ca8", cabina: "#ffe08a" },
  };

  /** Logros. "objetivo" + "valor" permiten mostrar una barra de progreso. */
  const LOGROS = [
    { id: "primer_vuelo", nombre: "Primer vuelo",       descripcion: "Juega tu primera partida",            premio: 50,   objetivo: 1,     valor: (t) => t.partidas },
    { id: "cazador",      nombre: "Cazador",            descripcion: "Derriba 50 enemigos en total",        premio: 150,  objetivo: 50,    valor: (t) => t.derribados },
    { id: "as",           nombre: "As del espacio",     descripcion: "Derriba 500 enemigos en total",       premio: 600,  objetivo: 500,   valor: (t) => t.derribados },
    { id: "jefe",         nombre: "Rompeacorazados",    descripcion: "Derrota a tu primer jefe",            premio: 500,  objetivo: 1,     valor: (t) => t.jefes },
    { id: "jefe3",        nombre: "Pesadilla de la flota", descripcion: "Derrota 3 jefes en total",         premio: 1000, objetivo: 3,     valor: (t) => t.jefes },
    { id: "titanes",      nombre: "Cazatitanes",        descripcion: "Derrota a los 3 jefes: Acorazado, Enjambre y Leviatán", premio: 1500, objetivo: 3, valor: (t) => t.tiposJefe },
    { id: "explorador",   nombre: "Explorador",         descripcion: "Llega al sector 3 (Cinturón Esmeralda)", premio: 700, objetivo: 3,   valor: (t, p) => p.sector },
    { id: "oleada10",     nombre: "Superviviente",      descripcion: "Llega a la oleada 10",                premio: 800,  objetivo: 10,    valor: (t, p) => p.oleada },
    { id: "puntos25k",    nombre: "Récord estelar",     descripcion: "Haz 25.000 puntos en una partida",    premio: 500,  objetivo: 25000, valor: (t, p) => p.puntos },
    { id: "combo5",       nombre: "Imparable",          descripcion: "Llega a un combo x5",                 premio: 300,  objetivo: 5,     valor: (t, p) => p.maxCombo },
    { id: "intocable",    nombre: "Intocable",          descripcion: "Supera 3 oleadas seguidas sin daño",  premio: 400,  objetivo: 3,     valor: (t, p) => p.rachaSinDano },
    { id: "arsenal",      nombre: "Arsenal completo",   descripcion: "Lleva el arma a nivel 4",             premio: 200,  objetivo: 4,     valor: (t, p) => p.armaMax },
    { id: "coleccionista", nombre: "Coleccionista",     descripcion: "Recoge 50 mejoras en total",          premio: 400,  objetivo: 50,    valor: (t) => t.mejoras },
    { id: "mecanico",     nombre: "Mecánico",           descripcion: "Compra 5 mejoras en el hangar",       premio: 300,  objetivo: 5,     valor: (t) => t.compras },
    { id: "veterano",     nombre: "Veterano",           descripcion: "Juega 25 partidas",                   premio: 500,  objetivo: 25,    valor: (t) => t.partidas },
    { id: "rico",         nombre: "Magnate",            descripcion: "Gana 10.000 créditos en total",       premio: 500,  objetivo: 10000, valor: (t) => t.creditosGanados },
  ];

  /** Partida vacía (lo que la escena va rellenando). */
  function partidaVacia() {
    return { puntos: 0, oleada: 0, sector: 1, derribados: 0, jefes: 0, jefesTipos: [], maxCombo: 1, armaMax: 1, mejoras: 0, rachaSinDano: 0, duracion: 0 };
  }

  function estadisticasVacias() {
    return { partidas: 0, derribados: 0, jefes: 0, mejoras: 0, compras: 0, tiempo: 0,
             mejorPuntos: 0, mejorOleada: 0, mejorCombo: 1, mejorSector: 1, creditosGanados: 0, jefesTipos: [] };
  }

  function pilotoNuevo(nombre) {
    return {
      id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nombre,
      creado: new Date().toISOString(),
      creditos: 0,
      hangar: { casco: 0, cadencia: 0, arma: 0, escudo: 0, iman: 0 },
      pinturas: ["clasica"],
      pintura: "clasica",
      logros: {},                 // id → fecha en que se consiguió
      stats: estadisticasVacias(),
      historial: [],
    };
  }

  /* ===================================================================
     CLASE PROGRESO
     =================================================================== */
  class Progreso extends DFE.Emisor {
    constructor(guardado) {
      super();
      this.guardado = guardado;
      this.pilotos = guardado.leer("pilotos", []);
      this.idActivo = guardado.leer("pilotoActivo", null);
      // Por si se guardó con una versión anterior del juego
      this.pilotos.forEach((p) => this._completar(p));
      if (!this.activo && this.pilotos.length) this.idActivo = this.pilotos[0].id;
    }

    get activo() {
      return this.pilotos.find((p) => p.id === this.idActivo) || null;
    }

    guardar() {
      this.guardado.escribir("pilotos", this.pilotos);
      this.guardado.escribir("pilotoActivo", this.idActivo);
      this.emit("cambio", this.activo);
    }

    /* ---------- Pilotos ---------- */

    /** Comprueba un nombre. Devuelve un mensaje de error o "" si vale. */
    validarNombre(nombre, idIgnorar) {
      const n = (nombre || "").trim();
      if (n.length < 2 || n.length > 14) return "Entre 2 y 14 caracteres";
      if (!/^[\p{L}\p{N} _-]+$/u.test(n)) return "Solo letras, números, espacios, - y _";
      if (this.pilotos.some((p) => p.id !== idIgnorar && p.nombre.toLowerCase() === n.toLowerCase())) return "Ya existe un piloto con ese nombre";
      return "";
    }

    crearPiloto(nombre) {
      const error = this.validarNombre(nombre);
      if (error) throw new Error(error);
      const p = pilotoNuevo(nombre.trim());
      this.pilotos.push(p);
      this.idActivo = p.id;
      this.guardar();
      return p;
    }

    elegirPiloto(id) {
      if (this.pilotos.some((p) => p.id === id)) {
        this.idActivo = id;
        this.guardar();
      }
    }

    borrarPiloto(id) {
      this.pilotos = this.pilotos.filter((p) => p.id !== id);
      if (this.idActivo === id) this.idActivo = this.pilotos[0]?.id || null;
      this.guardar();
    }

    /* ---------- Hangar ---------- */

    nivel(mejora) {
      return this.activo ? this.activo.hangar[mejora] || 0 : 0;
    }

    /** Precio del siguiente nivel o null si ya está al máximo. */
    coste(mejora) {
      const costes = MEJORAS[mejora].costes;
      const n = this.nivel(mejora);
      return n < costes.length ? costes[n] : null;
    }

    comprar(mejora) {
      const p = this.activo;
      const precio = this.coste(mejora);
      if (precio === null) return { ok: false, motivo: "Ya está al máximo" };
      if (p.creditos < precio) return { ok: false, motivo: `Te faltan ${precio - p.creditos} créditos` };
      p.creditos -= precio;
      p.hangar[mejora]++;
      p.stats.compras++;
      const nuevos = this.comprobarLogros(partidaVacia());
      this.guardar();
      return { ok: true, nuevos };
    }

    comprarPintura(id) {
      const p = this.activo;
      const pintura = PINTURAS[id];
      if (p.pinturas.includes(id)) { p.pintura = id; this.guardar(); return { ok: true }; }
      if (p.creditos < pintura.coste) return { ok: false, motivo: `Te faltan ${pintura.coste - p.creditos} créditos` };
      p.creditos -= pintura.coste;
      p.pinturas.push(id);
      p.pintura = id;
      p.stats.compras++;
      const nuevos = this.comprobarLogros(partidaVacia());
      this.guardar();
      return { ok: true, nuevos };
    }

    /** Lo que la partida necesita saber de las mejoras compradas. */
    configuracionPartida() {
      const h = this.activo ? this.activo.hangar : { casco: 0, cadencia: 0, arma: 0, escudo: 0, iman: 0 };
      return {
        vidaInicial: 3 + h.casco,
        vidaMax: 5 + h.casco,
        factorCadencia: 1 - h.cadencia * 0.08,
        armaInicial: 1 + h.arma,
        escudoInicial: h.escudo * 5,
        radioIman: [0, 70, 130][h.iman],
        pintura: this.activo ? this.activo.pintura : "clasica",
      };
    }

    /* ---------- Logros ---------- */

    /** Totales del piloto sumando lo que lleva la partida en curso. */
    _totales(partida) {
      const s = this.activo.stats;
      return {
        partidas: s.partidas,
        derribados: s.derribados + partida.derribados,
        jefes: s.jefes + partida.jefes,
        mejoras: s.mejoras + partida.mejoras,
        compras: s.compras,
        creditosGanados: s.creditosGanados,
        // Tipos de jefe distintos derrotados (en total, sumando la partida)
        tiposJefe: new Set([...(s.jefesTipos || []), ...(partida.jefesTipos || [])]).size,
      };
    }

    /** Estado de todos los logros (para la pantalla de logros). */
    estadoLogros() {
      const p = this.activo;
      const t = this._totales(partidaVacia());
      const mejor = { puntos: p.stats.mejorPuntos, oleada: p.stats.mejorOleada, maxCombo: p.stats.mejorCombo, sector: p.stats.mejorSector, rachaSinDano: 0, armaMax: 0 };
      return LOGROS.map((l) => {
        const conseguido = !!p.logros[l.id];
        const valor = conseguido ? l.objetivo : Math.min(l.objetivo, l.valor(t, mejor) || 0);
        return { ...l, conseguido, fecha: p.logros[l.id] || null, valor };
      });
    }

    /** Desbloquea los logros cumplidos. Devuelve los nuevos. */
    comprobarLogros(partida) {
      const p = this.activo;
      if (!p) return [];
      const t = this._totales(partida);
      const nuevos = [];
      for (const l of LOGROS) {
        if (!p.logros[l.id] && l.valor(t, partida) >= l.objetivo) {
          p.logros[l.id] = new Date().toISOString();
          p.creditos += l.premio;
          nuevos.push(l);
        }
      }
      if (nuevos.length) this.guardar();
      return nuevos;
    }

    /* ---------- Fin de partida ---------- */

    static creditosDePartida(partida) {
      return Math.floor(partida.puntos / 20) + partida.jefes * 250;
    }

    /** Guarda el resultado. Devuelve créditos ganados, logros nuevos y si es récord. */
    registrarPartida(partida) {
      const p = this.activo;
      const s = p.stats;
      const creditos = Progreso.creditosDePartida(partida);
      const nuevoRecord = partida.puntos > s.mejorPuntos;

      // Primero los logros de la partida (cuentan los totales de antes + partida)
      s.partidas++;
      const nuevos = this.comprobarLogros(partida);

      s.derribados += partida.derribados;
      s.jefes += partida.jefes;
      s.mejoras += partida.mejoras;
      s.tiempo += partida.duracion;
      s.mejorPuntos = Math.max(s.mejorPuntos, partida.puntos);
      s.mejorOleada = Math.max(s.mejorOleada, partida.oleada);
      s.mejorCombo = Math.max(s.mejorCombo, partida.maxCombo);
      s.mejorSector = Math.max(s.mejorSector || 1, partida.sector || 1);
      s.jefesTipos = [...new Set([...(s.jefesTipos || []), ...(partida.jefesTipos || [])])];
      s.creditosGanados += creditos;
      p.creditos += creditos;

      p.historial.unshift({
        fecha: new Date().toISOString(),
        puntos: partida.puntos, oleada: partida.oleada, derribados: partida.derribados,
        creditos, duracion: Math.round(partida.duracion),
      });
      p.historial = p.historial.slice(0, MAX_HISTORIAL);

      // Logros que dependen de los créditos acumulados
      nuevos.push(...this.comprobarLogros(partidaVacia()));
      this.guardar();
      return { creditos, nuevos, nuevoRecord };
    }

    /* ---------- Copia de seguridad ---------- */

    exportar() {
      return JSON.stringify({
        app: "orbita-zero", version: VERSION_DATOS,
        exportado: new Date().toISOString(),
        pilotos: this.pilotos,
      }, null, 2);
    }

    /** Importa pilotos de un archivo. Los que ya existen (mismo id) se sustituyen. */
    importar(texto) {
      let datos;
      try { datos = JSON.parse(texto); } catch (e) { throw new Error("El archivo no es un JSON válido"); }
      // "nebula" era el nombre provisional del juego: se aceptan sus copias
      if (!datos || !["orbita-zero", "nebula"].includes(datos.app) || !Array.isArray(datos.pilotos)) {
        throw new Error("No es una copia de seguridad de Órbita Zero");
      }
      let cuantos = 0;
      for (const entrante of datos.pilotos) {
        if (!entrante || typeof entrante.id !== "string" || typeof entrante.nombre !== "string") continue;
        const p = this._completar(entrante);
        const i = this.pilotos.findIndex((x) => x.id === p.id);
        if (i >= 0) this.pilotos[i] = p; else this.pilotos.push(p);
        cuantos++;
      }
      if (!cuantos) throw new Error("La copia no contiene pilotos");
      if (!this.activo) this.idActivo = this.pilotos[0].id;
      this.guardar();
      return cuantos;
    }

    /** Rellena los campos que falten y corrige tipos (datos antiguos o importados). */
    _completar(p) {
      const base = pilotoNuevo(p.nombre || "Piloto");
      p.creditos = Math.max(0, Number(p.creditos) || 0);
      p.hangar = Object.assign({}, base.hangar, p.hangar);
      for (const k of Object.keys(MEJORAS)) {
        p.hangar[k] = DFE.util.limitar(Math.floor(Number(p.hangar[k]) || 0), 0, MEJORAS[k].costes.length);
      }
      p.pinturas = Array.isArray(p.pinturas) ? p.pinturas.filter((x) => PINTURAS[x]) : ["clasica"];
      if (!p.pinturas.includes("clasica")) p.pinturas.unshift("clasica");
      if (!p.pinturas.includes(p.pintura)) p.pintura = "clasica";
      p.logros = p.logros && typeof p.logros === "object" ? p.logros : {};
      p.stats = Object.assign(estadisticasVacias(), p.stats);
      if (!Array.isArray(p.stats.jefesTipos)) p.stats.jefesTipos = [];
      p.historial = Array.isArray(p.historial) ? p.historial.slice(0, MAX_HISTORIAL) : [];
      p.creado = p.creado || base.creado;
      return p;
    }
  }

  Progreso.MEJORAS = MEJORAS;
  Progreso.PINTURAS = PINTURAS;
  Progreso.LOGROS = LOGROS;
  Progreso.partidaVacia = partidaVacia;
  window.Progreso = Progreso;
})();
