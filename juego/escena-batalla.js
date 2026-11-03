/* =====================================================================
   Órbita Zero · escena de batalla
   ---------------------------------------------------------------------
   Monta el árbol de la escena y contiene las reglas del juego.

   Escena "Batalla"
   ├── Fondo            parallax 0  (estrellas y nebulosa, fijo en pantalla)
   ├── Mundo            parallax 1  (el campo de juego, 360 de ancho)
   │   ├── Mejoras          (grupo)
   │   ├── Enemigos         (grupo: drones, cazas, kamikazes, fragatas y jefes;
   │   │                     los jefes tienen hijos: placas de escudo o segmentos)
   │   ├── BalasJugador     (grupo)
   │   ├── Nave ─┬─ Llama
   │   │         └─ Escudo
   │   ├── BalasEnemigas    (grupo)
   │   ├── Efectos          (ondas de explosión)
   │   └── Particulas
   └── Marco            oscurece lo que queda fuera del campo

   Modos: "menu" (de fondo en el menú) y "juego".
   ===================================================================== */
(function () {
  "use strict";

  const { aleatorio, aleatorioEntero, elegir } = DFE.util;
  const ANCHO = ENT.ANCHO_CAMPO;

  const DIFICULTAD = {
    tranquila: { balas: 0.8, vida: 0.8, cadencia: 0.75 },
    normal:    { balas: 1,   vida: 1,   cadencia: 1 },
    dificil:   { balas: 1.2, vida: 1.25, cadencia: 1.3 },
  };

  const MAX_BALAS_ENEMIGAS = 260;   // límite: memoria y rendimiento en móvil

  class EscenaBatalla extends DFE.Escena {
    /** config: mejoras del hangar (Progreso.configuracionPartida) */
    constructor(modo = "juego", dificultad = "normal", config = {}) {
      super({ nombre: "Batalla", colorFondo: "#050816" });
      this.modo = modo;
      this.dif = DIFICULTAD[dificultad] || DIFICULTAD.normal;
      this.alto = 600;

      // ----- Árbol de la escena -----
      this.fondo = this.agregar(new ENT.Fondo());
      this.mundo = this.agregar(new DFE.Nodo({ nombre: "Mundo", z: 0 }));
      this.mejoras = this.mundo.agregar(new DFE.Nodo({ nombre: "Mejoras", z: 3 }));
      this.enemigos = this.mundo.agregar(new DFE.Nodo({ nombre: "Enemigos", z: 4 }));
      this.balasJugador = this.mundo.agregar(new DFE.Nodo({ nombre: "BalasJugador", z: 5 }));
      this.nave = this.mundo.agregar(new ENT.Nave(config));
      this.balasEnemigas = this.mundo.agregar(new DFE.Nodo({ nombre: "BalasEnemigas", z: 8 }));
      this.efectos = this.mundo.agregar(new DFE.Nodo({ nombre: "Efectos", z: 9 }));
      this.particulas = this.mundo.agregar(new DFE.Particulas({ z: 10, maximo: 260 }));
      this.agregar(new ENT.Marco());

      if (modo === "menu") {
        this.nave.automatico = true;
        this.nave.inmortal = true;
      }

      // ----- Estado de la partida -----
      // "partida" guarda todo lo que luego usan los logros y estadísticas
      this.partida = Progreso.partidaVacia();
      this.partida.armaMax = this.nave.arma;
      this.combo = 0;               // enemigos seguidos sin dejar pasar 1,5 s
      this.relojCombo = 0;
      this.danoEnOleada = false;
      this.racha = 0;               // oleadas seguidas sin recibir daño
      this._relojEstadisticas = 0;
      this.oleada = 0;
      this.cola = [];               // enemigos pendientes de aparecer: { t, crear }
      this.relojOleada = 0;
      this.esperaOleada = 1.2;      // pausa antes de la primera oleada
      this.jefe = null;
      this.terminada = false;
      this.tiempoFin = 0;
      this._colocada = false;
      this._relojMenu = 0;
    }

    /** Centra el campo de 360 unidades en la pantalla y guarda el alto. */
    alRedimensionar(ancho, alto) {
      this.alto = alto;
      this.camara.x = -(ancho - ANCHO) / 2;
      this.camara.y = 0;
      if (!this._colocada) {
        this.nave.x = ANCHO / 2;
        this.nave.y = alto - 90;
        this._colocada = true;
      }
      this.nave.y = Math.min(this.nave.y, alto - 26);
    }

    actualizar(dt) {
      const motor = this.motor;

      if (this.terminada) {
        this.tiempoFin += dt;
        if (this.tiempoFin > 0.6 && motor.escalaTiempo < 1) motor.escalaTiempo = 1;
        if (this.tiempoFin > 1.6 && !this._avisado) {
          this._avisado = true;
          motor.emit("fin", this.partida);
        }
      }

      if (this.modo === "menu") {
        // En el menú: drones que pasan para que la nave tenga a quién disparar
        this._relojMenu -= dt;
        if (this._relojMenu <= 0) {
          this.enemigos.agregar(new ENT.Dron(aleatorio(40, ANCHO - 40), -20, { amplitud: aleatorio(20, 60) }));
          this._relojMenu = 0.9;
        }
      } else if (!this.terminada) {
        this.gestionarOleadas(dt);
      }

      this.comprobarChoques();

      if (this.modo === "juego" && !this.terminada) {
        const p = this.partida;
        p.duracion += dt;
        p.armaMax = Math.max(p.armaMax, this.nave.arma);
        // El combo se pierde si pasa 1,5 s sin derribar a nadie
        this.relojCombo -= dt;
        if (this.relojCombo <= 0) this.combo = 0;

        motor.emit("marcador", {
          puntos: p.puntos, oleada: this.oleada, multiplicador: this.multiplicador,
          vida: this.nave.vida, vidaMax: this.nave.vidaMax, arma: this.nave.arma,
        });
        // Una vez por segundo: para comprobar logros durante la partida
        this._relojEstadisticas -= dt;
        if (this._relojEstadisticas <= 0) {
          this._relojEstadisticas = 1;
          motor.emit("estadisticas", p);
        }
      }
    }

    /** Multiplicador de puntos: sube 1 cada 4 derribos seguidos (máx. x5). */
    get multiplicador() {
      return Math.min(5, 1 + Math.floor(this.combo / 4));
    }

    /** Lo llama la nave al recibir un golpe. */
    alRecibirDano() {
      this.combo = 0;
      this.danoEnOleada = true;
      this.racha = 0;
    }

    // Compatibilidad: los puntos viven en this.partida
    get puntos() { return this.partida.puntos; }
    set puntos(v) { this.partida.puntos = v; }
    get derribados() { return this.partida.derribados; }

    /* ===================================================================
       OLEADAS
       =================================================================== */
    gestionarOleadas(dt) {
      // Aparecen los enemigos programados
      this.relojOleada += dt;
      while (this.cola.length && this.cola[0].t <= this.relojOleada) this.cola.shift().crear();

      // ¿Oleada terminada? (no queda nadie por salir ni vivo)
      if (!this.cola.length && !this.enemigos.hijos.length) {
        this.esperaOleada -= dt;
        if (this.esperaOleada <= 0) this.siguienteOleada();
      }
    }

    siguienteOleada() {
      // ¿La oleada que acaba de terminar fue sin recibir daño?
      if (this.oleada > 0) {
        this.racha = this.danoEnOleada ? 0 : this.racha + 1;
        this.partida.rachaSinDano = Math.max(this.partida.rachaSinDano, this.racha);
      }
      this.danoEnOleada = false;
      this.oleada++;
      this.partida.oleada = this.oleada;
      this.relojOleada = 0;
      this.esperaOleada = 1.4;

      // Cada 5 oleadas se entra en un sector nuevo (cambia la nebulosa)
      if ((this.oleada - 1) % 5 === 0) {
        const indice = (this.oleada - 1) / 5;
        const sector = ARTE.SECTORES[indice % ARTE.SECTORES.length];
        if (indice > 0) this.fondo.cambiarSector(indice);
        this.partida.sector = indice + 1;
        this.agregar(new ENT.TituloSector(indice + 1, sector.nombre));
        this.motor.emit("sector", { numero: indice + 1, nombre: sector.nombre });
      }

      const esJefe = this.oleada % 5 === 0;
      this.motor.emit("oleada", { numero: this.oleada, jefe: esJefe, nombreJefe: esJefe ? ENT.nombreJefe(this.oleada / 5) : null });
      if (esJefe) {
        this.motor.audio.reproducir("alarma");
        this.fondo.velocidad = 2.5;
        this.cola = [{ t: 2.2, crear: () => this.crearJefe() }];
      } else {
        this.cola = this.construirOleada(this.oleada);
      }
    }

    /** Elige formaciones según el número de oleada (cada vez más difíciles). */
    construirOleada(n) {
      const cola = [];
      let t = 0.3;
      const formaciones = ["fila", "uve", "serpiente"];
      if (n >= 2) formaciones.push("cazas", "kamikazes");
      if (n >= 3) formaciones.push("fragata");
      if (n >= 6) formaciones.push("cazas", "kamikazes", "fragata");

      const cantidad = 3 + Math.floor(n / 2);
      for (let i = 0; i < cantidad; i++) {
        const tipo = i === 0 ? "fila" : elegir(formaciones);
        t = this.formacion(tipo, t, cola, n);
        t += aleatorio(1.6, 2.6) - Math.min(1, n * 0.08);
      }
      return cola.sort((a, b) => a.t - b.t);
    }

    formacion(tipo, t, cola, n) {
      const add = (dt, crear) => cola.push({ t: t + dt, crear });
      const velocidad = 105 + n * 6;
      switch (tipo) {
        case "fila": {
          const cuantos = 5 + Math.min(3, Math.floor(n / 3));
          for (let i = 0; i < cuantos; i++) {
            const x = 40 + (i * (ANCHO - 80)) / (cuantos - 1);
            add(i * 0.12, () => this.enemigos.agregar(new ENT.Dron(x, -20, { amplitud: 18, velocidad })));
          }
          return t + cuantos * 0.12;
        }
        case "uve": {
          for (let i = 0; i < 7; i++) {
            const d = i - 3;
            add(Math.abs(d) * 0.22, () => this.enemigos.agregar(new ENT.Dron(ANCHO / 2 + d * 38, -20, { amplitud: 10, velocidad: velocidad + 15 })));
          }
          return t + 0.8;
        }
        case "serpiente": {
          const x = elegir([90, ANCHO / 2, ANCHO - 90]);
          for (let i = 0; i < 8; i++) {
            add(i * 0.22, () => this.enemigos.agregar(new ENT.Dron(x, -20, { amplitud: 70, frecuencia: 2.4, velocidad })));
          }
          return t + 8 * 0.22;
        }
        case "cazas": {
          const pares = n >= 7 ? 2 : 1;
          for (let p = 0; p < pares; p++) {
            add(p * 1.2, () => this.enemigos.agregar(new ENT.Caza(aleatorio(50, 140), aleatorio(90, 170))));
            add(p * 1.2 + 0.2, () => this.enemigos.agregar(new ENT.Caza(aleatorio(ANCHO - 140, ANCHO - 50), aleatorio(90, 170))));
          }
          return t + pares * 1.2;
        }
        case "kamikazes": {
          const cuantos = 3 + Math.min(4, Math.floor(n / 2));
          for (let i = 0; i < cuantos; i++) {
            add(i * 0.45, () => this.enemigos.agregar(new ENT.Kamikaze(aleatorio(30, ANCHO - 30))));
          }
          return t + cuantos * 0.45;
        }
        case "fragata": {
          add(0, () => this.enemigos.agregar(this.ajustarVida(new ENT.Fragata(aleatorio(110, ANCHO - 110)))));
          return t + 3;
        }
      }
      return t;
    }

    ajustarVida(enemigo) {
      enemigo.vida = enemigo.vidaMax = Math.round(enemigo.vida * this.dif.vida);
      return enemigo;
    }

    crearJefe() {
      const numero = this.oleada / 5;
      this.jefe = this.enemigos.agregar(ENT.crearJefe(numero, this.dif.vida));
      this.motor.emit("jefe", { vida: this.jefe.vida, max: this.jefe.vidaMax, nuevo: true, nombre: this.jefe.nombreJefe });
    }

    /* ===================================================================
       DISPAROS ENEMIGOS
       =================================================================== */
    disparoEnemigo(x, y, angulo, velocidad) {
      if (this.balasEnemigas.hijos.length >= MAX_BALAS_ENEMIGAS) return;
      const v = velocidad * this.dif.balas;
      this.balasEnemigas.agregar(new ENT.BalaEnemiga(x, y, Math.cos(angulo) * v, Math.sin(angulo) * v));
    }

    anguloHaciaJugador(x, y) {
      return Math.atan2(this.nave.y - y, this.nave.x - x);
    }

    /* ===================================================================
       COLISIONES
       =================================================================== */
    comprobarChoques() {
      const Fis = DFE.Fisica;
      const nave = this.nave;

      // Balas del jugador contra enemigos. Se buscan por ETIQUETA en todo el
      // árbol: así también se encuentran los hijos de los jefes (placas del
      // escudo, segmentos del Leviatán)
      const objetivos = this.enemigos.buscarPorEtiqueta("enemigo").map((e) => ({ e, c: e.caja() }));
      for (const bala of this.balasJugador.hijos) {
        if (bala.destruido) continue;
        const caja = bala.caja();
        for (const { e: enemigo, c } of objetivos) {
          if (!enemigo.destruido && c.y + c.h > 0 && Fis.solapan(caja, c)) {
            bala.destruir();
            enemigo.recibirDano(bala.dano);
            this.particulas.emitir(bala.x, bala.y, {
              cantidad: 3, colores: ["#7df9ff", "#fff"], velocidad: 90, angulo: Math.PI / 2, apertura: 2, vida: 0.2, tamano: 2, gravedad: 0,
            });
            break;
          }
        }
      }

      if (this.terminada || !nave.visible) return;

      // Balas enemigas y choques contra la nave
      Fis.comprobar(this, nave, "balaEnemiga", (b) => { b.destruir(); nave.recibirDano(); });
      Fis.comprobar(this, nave, "enemigo", (e) => {
        const podiaRecibir = nave.invulnerable <= 0;
        nave.recibirDano();
        // Embestir también daña al enemigo (solo una vez por golpe)
        if (podiaRecibir && !(e instanceof ENT.Jefe)) e.recibirDano(3);
      });
      // Mejoras
      Fis.comprobar(this, nave, "mejora", (m) => { m.destruir(); this.recogerMejora(m.tipo); });
    }

    /* ===================================================================
       PUNTOS, EXPLOSIONES Y MEJORAS
       =================================================================== */
    enemigoDerribado(e) {
      e.destruir();
      // Posición en el MUNDO (los hijos de un jefe guardan la suya relativa al jefe)
      const g = e.posicionGlobal();
      this.explosion(g.x, g.y, e.tamanoExplosion);
      if (this.modo !== "juego") return;

      // Combo: derribos seguidos multiplican los puntos
      this.combo = this.relojCombo > 0 ? this.combo + 1 : 1;
      this.relojCombo = 1.5;
      const mult = this.multiplicador;
      this.partida.maxCombo = Math.max(this.partida.maxCombo, mult);
      this.partida.puntos += e.puntos * mult;
      this.partida.derribados++;

      if (e instanceof ENT.Jefe) {
        this.jefe = null;
        this.partida.jefes++;
        if (!this.partida.jefesTipos.includes(e.nombreJefe)) this.partida.jefesTipos.push(e.nombreJefe);
        this.fondo.velocidad = 1;
        this.motor.emit("jefe-fin", { puntos: e.puntos, nombre: e.nombreJefe });
        // Explosiones en cadena: el jefe y cada uno de sus hijos
        const puntosExplosion = e.hijos.map((h) => h.posicionGlobal());
        for (let i = 1; i <= 5; i++) puntosExplosion.push({ x: g.x + aleatorio(-60, 60), y: g.y + aleatorio(-35, 35) });
        puntosExplosion.forEach((p, i) => setTimeout(() => this.explosion(p.x, p.y, 2), (i + 1) * 110));
        ["arma", "escudo", "vida"].forEach((tipo, i) => this.mejoras.agregar(new ENT.Mejora(tipo, g.x - 40 + i * 40, g.y)));
      } else if (Math.random() < e.probMejora) {
        this.soltarMejora(g.x, g.y);
      }

    }

    soltarMejora(x, y) {
      const opciones = ["arma", "arma", "escudo"];
      if (this.nave.vida < this.nave.vidaMax) opciones.push("vida");
      this.mejoras.agregar(new ENT.Mejora(elegir(opciones), x, y));
    }

    recogerMejora(tipo) {
      const nave = this.nave;
      const motor = this.motor;
      this.partida.mejoras++;
      motor.audio.reproducir("mejora");
      this.onda(nave.x, nave.y, tipo === "arma" ? "#ff9f43" : tipo === "escudo" ? "#5ce1ff" : "#ff5ca8", 36);
      if (tipo === "arma") {
        if (nave.arma < 4) {
          nave.arma++;
          motor.emit("mejora", `🔫 Arma nivel ${nave.arma}`);
        } else {
          this.puntos += 1000;
          motor.emit("mejora", "🔫 Arma al máximo: +1000 puntos");
        }
      } else if (tipo === "escudo") {
        nave.tiempoEscudo = 10;
        motor.emit("mejora", "🛡️ Escudo activado (10 s)");
      } else if (tipo === "vida") {
        nave.vida = Math.min(nave.vidaMax, nave.vida + 1);
        motor.emit("mejora", "❤️ Casco reparado");
      }
    }

    explosion(x, y, tamano = 1) {
      this.particulas.emitir(x, y, {
        cantidad: 10 + tamano * 8, colores: ["#ffd36b", "#ff9f43", "#ff5ca8", "#fff"],
        velocidad: 110 + tamano * 40, apertura: Math.PI * 2, vida: 0.45 + tamano * 0.1, tamano: 2 + tamano * 0.6, gravedad: 0,
      });
      this.onda(x, y, "#ffb35c", 18 + tamano * 16);
      this.motor.audio.reproducir(tamano >= 2 ? "explosionGrande" : "explosion");
      if (tamano >= 2) this.camara.temblar(3 + tamano, 0.25);
    }

    /** Chispas pequeñas (por ejemplo, al dar a un escudo). */
    chispa(x, y) {
      this.particulas.emitir(x, y, { cantidad: 4, colores: ["#8ff0ff", "#fff"], velocidad: 120, apertura: Math.PI * 2, vida: 0.25, tamano: 2, gravedad: 0 });
    }

    onda(x, y, color, radio) {
      this.efectos.agregar(new ENT.Onda(x, y, color, radio));
    }

    perder() {
      const motor = this.motor;
      this.terminada = true;
      this.explosion(this.nave.x, this.nave.y, 3);
      this.nave.visible = false;
      this.nave.activo = false;
      motor.escalaTiempo = 0.35;          // cámara lenta
      motor.audio.vibrar([80, 50, 160]);
      this.camara.temblar(9, 0.5);
    }
  }

  window.EscenaBatalla = EscenaBatalla;
})();
