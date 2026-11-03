/* =====================================================================
   Órbita Zero · entidades
   ---------------------------------------------------------------------
   Los "actores" del juego. Todos son nodos del motor (DFE.Nodo o
   DFE.Sprite) con su lógica en actualizar() y su dibujo en dibujar().

   Coordenadas: el campo de juego mide 360 unidades de ancho (x de 0 a
   360) y tanto de alto como permita la pantalla (y de 0 hacia abajo).
   ===================================================================== */
(function () {
  "use strict";

  const { aleatorio, limitar } = DFE.util;
  const ENT = (window.ENT = {});
  const ANCHO_CAMPO = (ENT.ANCHO_CAMPO = 360);

  /* ===================================================================
     NAVE DEL JUGADOR
     Árbol:  Nave ─┬─ Llama   (fuego del motor)
                   └─ Escudo  (solo visible con la mejora)
     =================================================================== */
  class Nave extends DFE.Sprite {
    /** config: lo que viene de las mejoras del hangar (Progreso.configuracionPartida) */
    constructor(config = {}) {
      super({
        nombre: "Nave",
        imagen: "jugador-" + (config.pintura || "clasica"),
        ancho: 34, alto: 38,
        ancla: { x: 0.5, y: 0.5 },
        margen: 12,            // caja de choque pequeña (10 × 14): más justo
        z: 6,
      });
      // Hijos: se mueven con la nave sin tener que programarlo
      this.llama = this.agregar(new DFE.Sprite({
        nombre: "Llama", imagen: "llama", y: 17, ancho: 10, alto: 16,
        ancla: { x: 0.5, y: 0 }, mezcla: "lighter", z: -1,
      }));
      this.escudo = this.agregar(new DFE.Sprite({
        nombre: "Escudo", imagen: "escudo", ancho: 50, alto: 50,
        ancla: { x: 0.5, y: 0.5 }, mezcla: "lighter", visible: false, z: 1,
      }));

      this.vidaMax = config.vidaMax || 5;
      this.vida = config.vidaInicial || 3;
      this.arma = config.armaInicial || 1;   // nivel del arma: 1 a 4
      this.factorCadencia = config.factorCadencia || 1;
      this.radioIman = config.radioIman || 0;
      this.tiempoEscudo = config.escudoInicial || 0;
      this.invulnerable = 0;
      this.recarga = 0;
      this.automatico = false;     // en el menú se mueve sola
      this.inmortal = false;       // en el menú no recibe daño
      this.t = 0;
      this._arrastre = null;
    }

    actualizar(dt) {
      super.actualizar(dt);
      this.t += dt;
      const escena = this.escena;
      const motor = escena.motor;

      if (this.automatico) {
        this.x = ANCHO_CAMPO / 2 + Math.sin(this.t * 0.9) * 110;
        this.y = escena.alto - 110 + Math.sin(this.t * 1.7) * 12;
      } else {
        this.mover(dt, motor);
      }

      // Disparo automático (en móvil no hace falta un botón de disparo)
      this.recarga -= dt;
      if (this.recarga <= 0) {
        this.disparar();
        this.recarga = (this.arma >= 4 ? 0.1 : 0.13) * this.factorCadencia;
      }

      // Escudo e invulnerabilidad
      this.tiempoEscudo = Math.max(0, this.tiempoEscudo - dt);
      this.escudo.visible = this.tiempoEscudo > 0;
      this.escudo.opacidad = this.tiempoEscudo < 2 ? 0.4 + 0.6 * Math.abs(Math.sin(this.t * 12)) : 1;
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      this.opacidad = this.invulnerable > 0 && Math.floor(this.t * 16) % 2 ? 0.3 : 1;

      // Llama del motor: parpadea
      this.llama.escalaY = 0.8 + Math.random() * 0.5;
    }

    /** Teclado (flechas / WASD) o arrastrar con el dedo o el ratón. */
    mover(dt, motor) {
      const e = motor.entrada;
      const p = e.puntero;
      if (p.pulsado) {
        // Movimiento RELATIVO: la nave se desplaza lo mismo que el dedo,
        // así el dedo no tapa la nave (como en los shooters de móvil)
        if (!this._arrastre) this._arrastre = { px: p.x, py: p.y, nx: this.x, ny: this.y };
        const a = this._arrastre;
        const escala = motor.pantalla.escala;
        this.x = a.nx + ((p.x - a.px) / escala) * 1.2;
        this.y = a.ny + ((p.y - a.py) / escala) * 1.2;
      } else {
        this._arrastre = null;
        const v = 330;
        const dx = (e.estaPulsada("derecha") ? 1 : 0) - (e.estaPulsada("izquierda") ? 1 : 0);
        const dy = (e.estaPulsada("abajo") ? 1 : 0) - (e.estaPulsada("arriba") ? 1 : 0);
        const norma = dx && dy ? Math.SQRT1_2 : 1;  // en diagonal no va más rápido
        this.x += dx * v * norma * dt;
        this.y += dy * v * norma * dt;
      }
      // Que no se salga del campo
      const antesX = this.x, antesY = this.y;
      this.x = limitar(this.x, 16, ANCHO_CAMPO - 16);
      this.y = limitar(this.y, 60, this.escena.alto - 26);
      // Si choca con el borde mientras se arrastra, se corrige el origen
      if (this._arrastre) {
        this._arrastre.nx += this.x - antesX;
        this._arrastre.ny += this.y - antesY;
      }
    }

    disparar() {
      const patrones = {
        1: [[0, 0]],
        2: [[-6, 0], [6, 0]],
        3: [[-9, -0.1], [0, 0], [9, 0.1]],
        4: [[-12, -0.22], [-6, -0.1], [0, 0], [6, 0.1], [12, 0.22]],
      };
      const escena = this.escena;
      for (const [dx, angulo] of patrones[this.arma]) {
        escena.balasJugador.agregar(new BalaJugador(this.x + dx, this.y - 18, angulo));
      }
      escena.motor.audio.reproducir("laser");
    }

    recibirDano() {
      if (this.invulnerable > 0 || this.inmortal) return;
      const escena = this.escena;
      if (this.tiempoEscudo > 0) {
        // El escudo absorbe el golpe
        this.tiempoEscudo = 0;
        this.invulnerable = 0.8;
        escena.motor.audio.reproducir("escudo");
        escena.onda(this.x, this.y, "#5ce1ff", 40);
        return;
      }
      this.vida--;
      this.arma = Math.max(1, this.arma - 1);  // perder un nivel de arma duele
      escena.alRecibirDano();
      this.invulnerable = 1.8;
      this.destello = 1;
      escena.camara.temblar(6, 0.3);
      escena.motor.audio.reproducir("golpe");
      escena.motor.audio.vibrar(60);
      if (this.vida <= 0) escena.perder();
    }
  }

  /* ===================================================================
     BALAS
     =================================================================== */
  class BalaJugador extends DFE.Sprite {
    constructor(x, y, angulo) {
      super({
        nombre: "BalaJugador", imagen: "balaJugador", x, y,
        ancho: 10, alto: 18, ancla: { x: 0.5, y: 0.5 }, margen: 2,
        mezcla: "lighter", etiquetas: ["balaJugador"],
      });
      const v = 760;
      this.velocidadX = Math.sin(angulo) * v;
      this.velocidadY = -Math.cos(angulo) * v;
      this.rotacion = angulo;
      this.dano = 1;
    }
    actualizar(dt) {
      this.x += this.velocidadX * dt;
      this.y += this.velocidadY * dt;
      if (this.y < -30 || this.x < -30 || this.x > ANCHO_CAMPO + 30) this.destruir();
    }
  }

  class BalaEnemiga extends DFE.Sprite {
    constructor(x, y, vx, vy) {
      super({
        nombre: "BalaEnemiga", imagen: "balaEnemiga", x, y,
        ancho: 18, alto: 18, ancla: { x: 0.5, y: 0.5 }, margen: 5,
        mezcla: "lighter", etiquetas: ["balaEnemiga"],
      });
      this.velocidadX = vx;
      this.velocidadY = vy;
    }
    actualizar(dt) {
      this.x += this.velocidadX * dt;
      this.y += this.velocidadY * dt;
      const alto = this.escena.alto;
      if (this.y > alto + 30 || this.y < -60 || this.x < -40 || this.x > ANCHO_CAMPO + 40) this.destruir();
    }
  }

  /* ===================================================================
     ENEMIGOS: clase base + un tipo por comportamiento
     =================================================================== */
  class Enemigo extends DFE.Sprite {
    constructor(opciones) {
      super(Object.assign({ ancla: { x: 0.5, y: 0.5 }, etiquetas: ["enemigo"], z: 4 }, opciones));
      this.vida = opciones.vida || 1;
      this.vidaMax = this.vida;
      this.puntos = opciones.puntos || 100;
      this.probMejora = opciones.probMejora ?? 0.08;
      this.tamanoExplosion = opciones.tamanoExplosion || 1;
      this.t = 0;
    }

    actualizar(dt) {
      super.actualizar(dt);
      this.t += dt;
      this.comportamiento(dt);
      // Fuera del campo: se elimina sin dar puntos (con la posición en el
      // mundo, porque los hijos de un jefe guardan la suya relativa al padre)
      const alto = this.escena.alto;
      const g = this.posicionGlobal();
      if (g.y > alto + 80 || g.x < -120 || g.x > ANCHO_CAMPO + 120 || g.y < -400) this.destruir();
    }

    comportamiento(dt) {}

    recibirDano(cantidad) {
      if (this.destruido) return;
      this.vida -= cantidad;
      this.destello = 1;
      if (this.vida <= 0) this.escena.enemigoDerribado(this);
    }

    /** Dispara hacia el jugador con una dispersión opcional. */
    disparar(cantidad = 1, apertura = 0, velocidad = 170) {
      const escena = this.escena;
      const base = escena.anguloHaciaJugador(this.x, this.y);
      for (let i = 0; i < cantidad; i++) {
        const a = cantidad === 1 ? base : base - apertura / 2 + (apertura * i) / (cantidad - 1);
        escena.disparoEnemigo(this.x, this.y + this.alto * 0.3, a, velocidad);
      }
    }
  }

  /** Dron: baja haciendo eses. */
  class Dron extends Enemigo {
    constructor(x, y, { amplitud = 40, frecuencia = 2, velocidad = 110, fase = 0 } = {}) {
      super({ nombre: "Dron", imagen: "dron", x, y, ancho: 32, alto: 27, margen: 4, vida: 1, puntos: 100 });
      this.x0 = x;
      Object.assign(this, { amplitud, frecuencia, velocidad, fase });
    }
    comportamiento(dt) {
      this.y += this.velocidad * dt;
      this.x = this.x0 + Math.sin(this.t * this.frecuencia + this.fase) * this.amplitud;
    }
  }

  /** Caza: entra, se para, dispara ráfagas apuntadas y se va. */
  class Caza extends Enemigo {
    constructor(x, yObjetivo) {
      super({ nombre: "Caza", imagen: "caza", x, y: -40, ancho: 38, alto: 36, margen: 5, vida: 4, puntos: 250, probMejora: 0.2 });
      this.yObjetivo = yObjetivo;
      this.proximoDisparo = 1.0;
    }
    comportamiento(dt) {
      const escena = this.escena;
      if (this.t < 6) {
        this.y += (this.yObjetivo - this.y) * Math.min(1, dt * 2.5);  // frena al llegar
        this.proximoDisparo -= dt * escena.dif.cadencia;
        if (this.proximoDisparo <= 0) {
          this.disparar(3, 0.35, 180);
          this.proximoDisparo = 1.4;
        }
      } else {
        this.y += 200 * dt; // se marcha
      }
    }
  }

  /** Kamikaze: baja despacio y luego se lanza contra el jugador. */
  class Kamikaze extends Enemigo {
    constructor(x) {
      super({ nombre: "Kamikaze", imagen: "kamikaze", x, y: -30, ancho: 26, alto: 31, margen: 4, vida: 2, puntos: 150 });
      this.vx = 0;
      this.vy = 70;
      this.lanzado = false;
    }
    comportamiento(dt) {
      if (!this.lanzado && this.t > 0.8) {
        // Fija la dirección hacia la nave (una sola vez: se puede esquivar)
        const a = this.escena.anguloHaciaJugador(this.x, this.y);
        this.vx = Math.cos(a);
        this.vy = Math.sin(a);
        this.lanzado = true;
      }
      if (this.lanzado) {
        const velocidad = Math.min(430, 120 + (this.t - 0.8) * 500);
        this.x += this.vx * velocidad * dt;
        this.y += this.vy * velocidad * dt;
        this.rotacion = Math.atan2(this.vy, this.vx) - Math.PI / 2; // apunta hacia donde va
      } else {
        this.y += this.vy * dt;
      }
    }
  }

  /** Fragata: grande y lenta, dispara anillos de balas. */
  class Fragata extends Enemigo {
    constructor(x) {
      super({ nombre: "Fragata", imagen: "fragata", x, y: -50, ancho: 60, alto: 46, margen: 6, vida: 16, puntos: 700, probMejora: 0.7, tamanoExplosion: 2 });
      this.x0 = x;
      this.proximoDisparo = 1.5;
    }
    comportamiento(dt) {
      const escena = this.escena;
      if (this.t < 14) {
        this.y += (110 - this.y) * Math.min(1, dt * 0.9);
        this.x = this.x0 + Math.sin(this.t * 0.6) * 40;
        this.proximoDisparo -= dt * escena.dif.cadencia;
        if (this.proximoDisparo <= 0) {
          const n = 10;
          const giro = this.t * 0.7;
          for (let i = 0; i < n; i++) escena.disparoEnemigo(this.x, this.y, giro + (i / n) * Math.PI * 2, 120);
          this.proximoDisparo = 2.2;
        }
      } else {
        this.y += 90 * dt;
      }
    }
  }

  /* ===================================================================
     JEFES: clase base + tres jefes distintos que se turnan
       oleada 5  → Acorazado   (abanicos, espiral y anillos)
       oleada 10 → Enjambre    (escudo giratorio y fábrica de drones)
       oleada 15 → Leviatán    (serpiente de segmentos)
     y vuelta a empezar, cada vuelta con más vida.
     =================================================================== */
  class Jefe extends Enemigo {
    constructor(opciones) {
      super(Object.assign({ x: ANCHO_CAMPO / 2, y: -120, probMejora: 1, tamanoExplosion: 4 }, opciones));
      this.etiquetas.add("jefe");
      this.nombreJefe = opciones.nombreJefe;
      this.yObjetivo = opciones.yObjetivo || 150;
    }
    /** Fase 1, 2 o 3 según la vida que le queda. */
    get fase() {
      const r = this.vida / this.vidaMax;
      return r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
    }
    /** Baja hasta su posición. Devuelve true mientras está entrando. */
    entrando(dt) {
      if (this.t < 3) {
        this.y += (this.yObjetivo - this.y) * Math.min(1, dt * 1.5);
        return true;
      }
      return false;
    }
    /** Ritmo de ataque: dificultad × fase (cada fase ataca un 25 % más rápido). */
    ritmo(dt) {
      return dt * this.escena.dif.cadencia * (1 + (this.fase - 1) * 0.25);
    }
    recibirDano(cantidad) {
      super.recibirDano(cantidad);
      this.escena.motor.emit("jefe", { vida: Math.max(0, this.vida), max: this.vidaMax });
    }
  }

  /** Jefe 1 · ACORAZADO: tres fases según la vida que le queda. */
  class Acorazado extends Jefe {
    constructor(vida, puntos) {
      super({ nombre: "Acorazado", nombreJefe: "Acorazado", imagen: "jefe", ancho: 160, alto: 100, margen: 18, vida, puntos });
      this.temporizadores = { abanico: 2, espiral: 0, anillo: 1 };
      this.anguloEspiral = 0;
    }
    comportamiento(dt) {
      if (this.entrando(dt)) return;
      const escena = this.escena;
      this.x = ANCHO_CAMPO / 2 + Math.sin((this.t - 3) * (0.5 + this.fase * 0.15)) * 95;
      const k = this.ritmo(dt);
      const tm = this.temporizadores;

      // Fase 1+: abanico de balas apuntadas
      tm.abanico -= k;
      if (tm.abanico <= 0) {
        this.disparar(this.fase === 1 ? 5 : 7, 0.9, 190);
        tm.abanico = 1.3;
      }
      // Fase 2+: espiral desde el núcleo
      if (this.fase >= 2) {
        tm.espiral -= k;
        if (tm.espiral <= 0) {
          this.anguloEspiral += 0.45;
          escena.disparoEnemigo(this.x, this.y + 10, this.anguloEspiral, 140);
          escena.disparoEnemigo(this.x, this.y + 10, this.anguloEspiral + Math.PI, 140);
          tm.espiral = 0.154;
        }
      }
      // Fase 3: anillos desde las alas
      if (this.fase >= 3) {
        tm.anillo -= k;
        if (tm.anillo <= 0) {
          for (const lado of [-1, 1]) {
            for (let i = 0; i < 9; i++) escena.disparoEnemigo(this.x + lado * 57, this.y + 4, (i / 9) * Math.PI * 2 + this.t, 115);
          }
          tm.anillo = 1.6;
        }
      }
    }
  }

  /** Placa del escudo del Enjambre. Es HIJA de la nave nodriza: gira a su alrededor. */
  class PlacaEscudo extends Enemigo {
    constructor(angulo) {
      super({ nombre: "PlacaEscudo", imagen: "placaEscudo", ancho: 28, alto: 28, margen: 3, vida: 10, puntos: 150, probMejora: 0.15 });
      this.angulo = angulo;
    }
    comportamiento(dt) {
      // Posición LOCAL: relativa a la nodriza. El motor suma la del padre.
      const radio = 86;
      this.angulo += dt * (this.padre.fase >= 2 ? 1.4 : 0.9);
      this.x = Math.cos(this.angulo) * radio;
      this.y = Math.sin(this.angulo) * radio * 0.8;
      this.rotacion = this.angulo + Math.PI / 2;
    }
  }

  /** Jefe 2 · ENJAMBRE: nave nodriza con escudo giratorio que fabrica drones. */
  class Enjambre extends Jefe {
    constructor(vida, puntos) {
      super({ nombre: "Enjambre", nombreJefe: "Enjambre", imagen: "nodriza", ancho: 130, alto: 110, margen: 22, vida, puntos, yObjetivo: 170 });
      this.temporizadores = { drones: 2.5, kamikazes: 4, rafaga: 2, escudo: 0 };
      this.crearEscudo();
    }
    get placas() {
      return this.hijos.filter((h) => h instanceof PlacaEscudo && !h.destruido);
    }
    crearEscudo() {
      for (let i = 0; i < 6; i++) this.agregar(new PlacaEscudo((i / 6) * Math.PI * 2));
    }
    recibirDano(cantidad) {
      // Mientras quede alguna placa, el núcleo es invulnerable
      if (this.placas.length) {
        this.escena.chispa(this.x, this.y + 20);
        return;
      }
      super.recibirDano(cantidad);
    }
    comportamiento(dt) {
      if (this.entrando(dt)) return;
      const escena = this.escena;
      this.x = ANCHO_CAMPO / 2 + Math.sin((this.t - 3) * 0.35) * 70;
      const k = this.ritmo(dt);
      const tm = this.temporizadores;

      // Fabrica drones por los hangares laterales
      tm.drones -= k;
      if (tm.drones <= 0) {
        for (const lado of [-1, 1]) {
          escena.enemigos.agregar(new Dron(this.x + lado * 50, this.y, { amplitud: 30, velocidad: 130 }));
        }
        tm.drones = 2.4;
      }
      // Fase 2+: kamikazes
      if (this.fase >= 2) {
        tm.kamikazes -= k;
        if (tm.kamikazes <= 0) {
          escena.enemigos.agregar(new Kamikaze(this.x + DFE.util.aleatorio(-40, 40)));
          tm.kamikazes = 3.2;
        }
      }
      // Ráfaga apuntada desde el núcleo (en fase 3, más balas)
      tm.rafaga -= k;
      if (tm.rafaga <= 0) {
        this.disparar(this.fase >= 3 ? 5 : 3, 0.5, 175);
        tm.rafaga = 1.6;
      }
      // Si le rompes todas las placas, el escudo se regenera a los 9 s
      if (!this.placas.length) {
        tm.escudo += dt;
        if (tm.escudo > 9) {
          tm.escudo = 0;
          this.crearEscudo();
          escena.onda(this.x, this.y, "#8ff0ff", 110);
        }
      } else {
        tm.escudo = 0;
      }
    }
  }

  /** Segmento del Leviatán. Es HIJO de la cabeza; recibir daño también daña a la cabeza. */
  class SegmentoLeviatan extends Enemigo {
    constructor(indice) {
      super({ nombre: "Segmento", imagen: "leviatanSegmento", ancho: 34, alto: 34, margen: 4, vida: 20, puntos: 300, probMejora: 0.25 });
      this.indice = indice;
      this.proximoDisparo = 2 + indice * 0.35;
    }
    comportamiento(dt) {
      const cabeza = this.padre;
      // Sigue el rastro de la cabeza, a 24 unidades del segmento anterior
      const p = cabeza.posicionesSegmentos[this.indice];
      if (p) {
        // De coordenadas del MUNDO a coordenadas LOCALES de la cabeza
        this.x = p.x - cabeza.x;
        this.y = p.y - cabeza.y;
      }
      if (cabeza.t < 3) return;
      this.proximoDisparo -= dt * this.escena.dif.cadencia;
      if (this.proximoDisparo <= 0) {
        const g = this.posicionGlobal();
        const escena = this.escena;
        if (cabeza.fase >= 3) {
          for (let i = 0; i < 4; i++) escena.disparoEnemigo(g.x, g.y, cabeza.t + (i * Math.PI) / 2, 120);
        } else {
          escena.disparoEnemigo(g.x, g.y, escena.anguloHaciaJugador(g.x, g.y), 160);
        }
        this.proximoDisparo = cabeza.fase >= 2 ? 2.4 : 3.4;
      }
    }
    recibirDano(cantidad) {
      super.recibirDano(cantidad);
      if (this.padre) this.padre.recibirDano(cantidad * 0.6);
    }
  }

  /** Jefe 3 · LEVIATÁN: una serpiente espacial que recorre la pantalla. */
  class Leviatan extends Jefe {
    constructor(vida, puntos) {
      super({ nombre: "Leviatan", nombreJefe: "Leviatán", imagen: "leviatanCabeza", ancho: 60, alto: 54, margen: 8, vida, puntos, yObjetivo: 140 });
      this.rastro = [];   // posiciones anteriores de la cabeza (las siguen los segmentos)
      this.posicionesSegmentos = [];
      this.temporizadores = { abanico: 1.5, espiral: 0 };
      this.anguloEspiral = 0;
      for (let i = 0; i < 9; i++) this.agregar(new SegmentoLeviatan(i)).z = -1 - i;
    }
    comportamiento(dt) {
      const escena = this.escena;
      if (!this.entrando(dt)) {
        // Recorrido en forma de "8" (curva de Lissajous)
        const t = (this.t - 3) * (0.55 + this.fase * 0.12);
        this.x = ANCHO_CAMPO / 2 + Math.sin(t) * 125;
        this.y = 170 + Math.sin(t * 2) * 80;
        const k = this.ritmo(dt);
        const tm = this.temporizadores;
        // Fase 2+: abanico desde la boca
        if (this.fase >= 2) {
          tm.abanico -= k;
          if (tm.abanico <= 0) { this.disparar(5, 0.8, 190); tm.abanico = 1.5; }
        }
        // Fase 3: espiral
        if (this.fase >= 3) {
          tm.espiral -= k;
          if (tm.espiral <= 0) {
            this.anguloEspiral += 0.5;
            escena.disparoEnemigo(this.x, this.y, this.anguloEspiral, 130);
            tm.espiral = 0.18;
          }
        }
      }
      // La cabeza mira hacia donde va
      const anterior = this.rastro[0];
      if (anterior && (anterior.x !== this.x || anterior.y !== this.y)) {
        this.rotacion = Math.atan2(this.y - anterior.y, this.x - anterior.x) - Math.PI / 2;
      }
      this.rastro.unshift({ x: this.x, y: this.y });
      if (this.rastro.length > 600) this.rastro.pop();
      this.calcularSegmentos();
    }

    /** Recorre el rastro midiendo la distancia: un segmento cada 24 unidades. */
    calcularSegmentos() {
      const separacion = 24;
      const posiciones = [];
      let recorrido = 0;
      let objetivo = separacion;
      for (let i = 1; i < this.rastro.length && posiciones.length < 9; i++) {
        const a = this.rastro[i - 1], b = this.rastro[i];
        const tramo = Math.hypot(b.x - a.x, b.y - a.y);
        while (tramo > 0 && recorrido + tramo >= objetivo && posiciones.length < 9) {
          const f = (objetivo - recorrido) / tramo;
          posiciones.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
          objetivo += separacion;
        }
        recorrido += tramo;
      }
      // Al principio aún no hay rastro: los segmentos esperan detrás de la cabeza
      while (posiciones.length < 9) posiciones.push({ x: this.x, y: this.y - separacion * (posiciones.length + 1) });
      this.posicionesSegmentos = posiciones;
    }
    // La cabeza recibe el doble de daño: es el punto débil
    recibirDano(cantidad) {
      super.recibirDano(cantidad * 2);
    }
  }

  /** Crea el jefe que toca según su número (1, 2, 3, 4…). */
  const JEFES = [Acorazado, Enjambre, Leviatan];
  function crearJefe(numero, multiplicadorVida) {
    const vuelta = Math.floor((numero - 1) / JEFES.length);  // 0 la primera vez, 1 la segunda…
    const Clase = JEFES[(numero - 1) % JEFES.length];
    const vidaBase = { Acorazado: 380, Enjambre: 300, Leviatan: 520 }[Clase.name];
    const vida = Math.round(vidaBase * (1 + vuelta * 0.6) * multiplicadorVida);
    return new Clase(vida, 5000 * numero);
  }
  function nombreJefe(numero) {
    return ["Acorazado", "Enjambre", "Leviatán"][(numero - 1) % 3];
  }

  /* ===================================================================
     MEJORAS que sueltan los enemigos
     =================================================================== */
  const MEJORAS = {
    arma:   { imagen: "mejoraArma" },
    escudo: { imagen: "mejoraEscudo" },
    vida:   { imagen: "mejoraVida" },
  };

  class Mejora extends DFE.Sprite {
    constructor(tipo, x, y) {
      super({ nombre: "Mejora:" + tipo, imagen: MEJORAS[tipo].imagen, x, y,
              ancho: 28, alto: 28, ancla: { x: 0.5, y: 0.5 }, etiquetas: ["mejora"], z: 3 });
      this.tipo = tipo;
      this.x0 = x;
      this.t = Math.random() * 6;
    }
    actualizar(dt) {
      super.actualizar(dt);
      this.t += dt;
      // Imán del hangar: si la nave está cerca, la mejora va hacia ella
      const nave = this.escena.nave;
      const dx = nave.x - this.x, dy = nave.y - this.y;
      const distancia = Math.hypot(dx, dy);
      if (nave.radioIman && nave.visible && distancia < nave.radioIman) {
        const v = 320 * dt / Math.max(distancia, 1);
        this.x0 += dx * v;
        this.y += dy * v;
      } else {
        this.y += 65 * dt;
      }
      this.x = this.x0 + Math.sin(this.t * 2.2) * 14;
      this.escalaX = this.escalaY = 1 + Math.sin(this.t * 6) * 0.08;  // late
      if (this.y > this.escena.alto + 30) this.destruir();
    }
  }

  /* ===================================================================
     ONDA: anillo que se expande (explosiones, escudo)
     =================================================================== */
  class Onda extends DFE.Nodo {
    constructor(x, y, color, radio) {
      super({ nombre: "Onda", x, y, z: 9 });
      this.color = color;
      this.radio = radio;
      this.vidaTotal = 0.4;
      this.t = 0;
    }
    actualizar(dt) {
      this.t += dt;
      if (this.t >= this.vidaTotal) this.destruir();
    }
    dibujar(ctx) {
      const p = this.t / this.vidaTotal;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3 * (1 - p) + 1;
      ctx.beginPath();
      ctx.arc(0, 0, this.radio * (0.2 + p * 0.8), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /* ===================================================================
     FONDO: estrellas en 3 capas + nebulosa (parallax vertical)
     Se dibuja fijo en la pantalla (parallax 0) y se desplaza solo.
     =================================================================== */
  class Fondo extends DFE.Nodo {
    constructor() {
      super({ nombre: "Fondo", parallax: 0, z: -100 });
      this.capas = [
        { velocidad: 14, tamano: 1, brillo: 0.45, estrellas: [] },
        { velocidad: 38, tamano: 1.5, brillo: 0.7, estrellas: [] },
        { velocidad: 90, tamano: 2.2, brillo: 1, estrellas: [] },
      ];
      this.capas.forEach((c, i) => {
        for (let k = 0; k < 60 - i * 15; k++) c.estrellas.push({ x: Math.random(), y: Math.random() });
      });
      this.desplazamiento = 0;
      this.velocidad = 1;     // se acelera al llegar un jefe
      this.sector = 0;        // índice en ARTE.SECTORES
      this.anterior = null;   // sector anterior (para el fundido)
      this.fundido = 1;       // 0 → 1 mientras cambia de sector
    }

    /** Cambia de sector con un fundido de 2,5 s entre nebulosas. */
    cambiarSector(indice) {
      this.anterior = this.sector;
      this.sector = indice % ARTE.SECTORES.length;
      this.fundido = 0;
    }

    actualizar(dt) {
      this.desplazamiento += dt * this.velocidad;
      if (this.fundido < 1) this.fundido = Math.min(1, this.fundido + dt / 2.5);
    }

    dibujar(ctx) {
      const p = this.escena.motor.pantalla;
      const w = p.anchoVisible, h = p.altoVisible;
      const actual = ARTE.SECTORES[this.sector];
      ctx.fillStyle = actual.fondo;
      ctx.fillRect(0, 0, w, h);
      // Nebulosa: textura alta que se repite; durante el cambio, se mezclan dos
      if (this.fundido < 1 && this.anterior !== null) this.dibujarNebulosa(ctx, this.anterior, 1 - this.fundido, w, h);
      this.dibujarNebulosa(ctx, this.sector, this.fundido, w, h);
      // Estrellas: cuanto más cerca (más grandes), más rápido bajan
      for (const c of this.capas) {
        ctx.fillStyle = `rgba(255,255,255,${c.brillo})`;
        const oy = this.desplazamiento * c.velocidad;
        for (const s of c.estrellas) {
          const y = (s.y * h + oy) % h;
          ctx.fillRect(s.x * w, y, c.tamano, c.tamano * (c.velocidad > 60 ? 3 : 1));
        }
      }
    }

    dibujarNebulosa(ctx, indice, opacidad, w, h) {
      const neb = DFE.Recursos.obtener("nebulosa-" + indice);
      if (!neb || opacidad <= 0) return;
      ctx.globalAlpha = opacidad;
      const oy = (this.desplazamiento * 10) % neb.height;
      for (let x = 0; x < w; x += neb.width) {
        for (let y = oy - neb.height; y < h; y += neb.height) ctx.drawImage(neb, Math.round(x), Math.round(y));
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ===================================================================
     TÍTULO DE SECTOR: rótulo grande que aparece y se desvanece
     =================================================================== */
  class TituloSector extends DFE.Nodo {
    constructor(numero, nombre) {
      super({ nombre: "TituloSector", parallax: 0, z: 60 });
      this.numero = numero;
      this.nombreSector = nombre;
      this.t = 0;
      this.duracion = 3;
    }
    actualizar(dt) {
      this.t += dt;
      if (this.t > this.duracion) this.destruir();
    }
    dibujar(ctx) {
      const p = this.escena.motor.pantalla;
      // Aparece en 0,4 s, se queda y desaparece en 0,6 s
      const a = Math.min(1, this.t / 0.4, (this.duracion - this.t) / 0.6);
      const desliz = (1 - Math.min(1, this.t / 0.4)) * 12;
      ctx.globalAlpha = Math.max(0, a);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const cx = p.anchoVisible / 2, cy = p.altoVisible * 0.38 + desliz;
      ctx.fillStyle = "rgba(92, 225, 255, 0.85)";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText(`S E C T O R   ${this.numero}`, cx, cy - 18);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 26px 'Trebuchet MS', system-ui, sans-serif";
      ctx.fillText(this.nombreSector, cx, cy + 10);
      ctx.globalAlpha = 1;
    }
  }

  /* ===================================================================
     MARCO: oscurece lo que queda fuera del campo de juego
     (en pantallas anchas el campo de 360 unidades queda centrado)
     =================================================================== */
  class Marco extends DFE.Nodo {
    constructor() {
      super({ nombre: "Marco", z: 50 });
    }
    dibujar(ctx) {
      const escena = this.escena;
      const cam = escena.camara;
      const p = escena.motor.pantalla;
      const izq = cam.x, der = cam.x + p.anchoVisible;
      if (izq >= -1) return;  // la pantalla es tan estrecha como el campo
      ctx.fillStyle = "rgba(2, 3, 12, 0.8)";
      ctx.fillRect(izq, 0, -izq, p.altoVisible);
      ctx.fillRect(ANCHO_CAMPO, 0, der - ANCHO_CAMPO, p.altoVisible);
      ctx.fillStyle = "rgba(92, 225, 255, 0.35)";
      ctx.fillRect(-1, 0, 1, p.altoVisible);
      ctx.fillRect(ANCHO_CAMPO, 0, 1, p.altoVisible);
    }
  }

  Object.assign(ENT, { Nave, BalaJugador, BalaEnemiga, Enemigo, Dron, Caza, Kamikaze, Fragata, Jefe, Acorazado, Enjambre, Leviatan,
                       PlacaEscudo, SegmentoLeviatan, crearJefe, nombreJefe, Mejora, Onda, Fondo, Marco, TituloSector });
})();
