/* =====================================================================
   Prueba automática de Nébula
   ---------------------------------------------------------------------
   Abre el juego en varios dispositivos emulados y comprueba que:
     - no hay errores de JavaScript
     - el árbol de la escena no crece sin control (memoria)
     - arrastrar el dedo mueve la nave
     - aparece el jefe y su barra de vida (oleada 5)
     - el juego se pausa al ocultar la página
     - el récord se guarda al recargar
     - la primera vez pide crear un piloto
     - el hangar: comprar una mejora cambia la partida
     - exportar e importar el progreso
   Uso:  npm install   y luego   npm test
   ===================================================================== */
const { chromium, devices } = require("playwright");
const path = require("path");

const URL = "file://" + path.resolve(__dirname, "../index.html").replace(/\\/g, "/");

function comprobar(condicion, texto) {
  console.log((condicion ? "  ✔ " : "  ✘ ") + texto);
  if (!condicion) process.exitCode = 1;
}

const contarNodos = () => { let n = 0; motor.escena.recorrer(() => n++); return n; };

// Un piloto ya creado, para no tener que rellenar el formulario en cada prueba
const PILOTO = { id: "prueba", nombre: "Prueba", creditos: 0 };
async function contextoConPiloto(navegador, opciones) {
  const ctx = await navegador.newContext(opciones);
  await ctx.addInitScript((p) => {
    if (!localStorage.getItem("nebula:pilotos")) {
      localStorage.setItem("nebula:pilotos", JSON.stringify([p]));
      localStorage.setItem("nebula:pilotoActivo", JSON.stringify(p.id));
    }
  }, PILOTO);
  return ctx;
}

(async () => {
  const navegador = await chromium.launch();

  for (const nombre of ["iPhone 14", "Pixel 7", "iPhone 14 landscape", "iPad Mini"]) {
    console.log("\n" + nombre);
    const ctx = await contextoConPiloto(navegador, { ...devices[nombre] });
    const pagina = await ctx.newPage();
    const errores = [];
    pagina.on("pageerror", (e) => errores.push(e.message));
    await pagina.goto(URL);
    await pagina.waitForTimeout(800);
    await pagina.tap("#botonJugar");
    await pagina.waitForTimeout(300);

    // Arrastrar el dedo mueve la nave
    const antes = await pagina.evaluate(() => motor.escena.nave.x);
    const vista = pagina.viewportSize();
    const cliente = await ctx.newCDPSession(pagina);
    const toque = (type, x, y) => cliente.send("Input.dispatchTouchEvent", {
      type, touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
    await toque("touchStart", vista.width / 2, vista.height * 0.7);
    for (let i = 1; i <= 10; i++) await toque("touchMove", vista.width / 2 + i * 6, vista.height * 0.7);
    await toque("touchEnd");
    await pagina.waitForTimeout(100);
    const despues = await pagina.evaluate(() => motor.escena.nave.x);
    comprobar(despues > antes + 20, `arrastrar mueve la nave (${antes.toFixed(0)} → ${despues.toFixed(0)})`);

    // Partida larga con la nave invencible: memoria estable
    await pagina.evaluate(() => { motor.escena.nave.inmortal = true; });
    let maxNodos = 0;
    for (let i = 0; i < 10; i++) {
      await pagina.waitForTimeout(1000);
      maxNodos = Math.max(maxNodos, await pagina.evaluate(contarNodos));
    }
    comprobar(maxNodos < 400, `el árbol de la escena se mantiene acotado (máx. ${maxNodos} nodos)`);

    // Saltar a la oleada del jefe
    await pagina.evaluate(() => {
      const e = motor.escena;
      e.oleada = 4; e.cola = []; e.enemigos.hijos.forEach((x) => x.destruir()); e.esperaOleada = 0;
    });
    await pagina.waitForTimeout(3500);
    comprobar(await pagina.evaluate(() => !!motor.escena.jefe && !document.querySelector("#barraJefe").hidden),
      "aparece el Acorazado con su barra de vida");

    // Pausa automática al cambiar de app
    await pagina.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await pagina.waitForTimeout(300);
    comprobar(await pagina.evaluate(() => motor.pausado && document.querySelector("#modalPausa").open),
      "se pausa al cambiar de app");

    comprobar(errores.length === 0, "sin errores de JavaScript" + (errores.length ? ": " + errores.join(" | ") : ""));
    await ctx.close();
  }

  // Los tres jefes y los sectores
  console.log("\nJefes y sectores");
  {
    const ctx = await contextoConPiloto(navegador, { ...devices["iPhone 14"] });
    const pagina = await ctx.newPage();
    const errores = [];
    pagina.on("pageerror", (e) => errores.push(e.message));
    await pagina.goto(URL);
    await pagina.waitForTimeout(1000);
    await pagina.tap("#botonJugar");
    await pagina.waitForTimeout(300);
    const saltarA = (oleada) => pagina.evaluate((o) => {
      const e = motor.escena;
      e.nave.inmortal = true;
      e.oleada = o; e.cola = []; e.enemigos.hijos.forEach((x) => x.destruir()); e.esperaOleada = 0;
    }, oleada);
    const jefe = () => pagina.evaluate(() => {
      const j = motor.escena.jefe;
      return j && { nombre: j.nombreJefe, hijos: j.hijos.length };
    });

    await saltarA(9);
    await pagina.waitForTimeout(3000);
    let j = await jefe();
    comprobar(j && j.nombre === "Enjambre" && j.hijos === 6, "oleada 10: el Enjambre con 6 placas de escudo (nodos hijos)");
    comprobar(await pagina.evaluate(() => {
      const e = motor.escena.jefe; const v = e.vida;
      e.recibirDano(50);
      return e.vida === v;
    }), "el Enjambre es invulnerable mientras tiene placas");

    await saltarA(14);
    await pagina.waitForTimeout(3000);
    j = await jefe();
    comprobar(j && j.nombre === "Leviatán" && j.hijos === 9, "oleada 15: el Leviatán con 9 segmentos (nodos hijos)");

    await saltarA(10);
    await pagina.waitForTimeout(800);
    comprobar(await pagina.evaluate(() => motor.escena.fondo.sector === 2 && motor.escena.partida.sector === 3),
      "oleada 11: cambia al sector 3 (Cinturón Esmeralda)");
    comprobar(errores.length === 0, "sin errores de JavaScript" + (errores.length ? ": " + errores.join(" | ") : ""));
    await ctx.close();
  }

  // Primera vez: pide crear un piloto
  console.log("\nPrimera vez");
  {
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
    const pagina = await ctx.newPage();
    await pagina.goto(URL);
    await pagina.waitForTimeout(1200);
    const pide = await pagina.evaluate(() => !!document.querySelector("df-modal[open] df-input"));
    comprobar(pide, "pide el nombre del piloto");
    await pagina.evaluate(() => {
      const modal = [...document.querySelectorAll("df-modal")].find((m) => m.open && m.querySelector("df-input"));
      modal.querySelector("df-input").value = "Nova";
      modal.confirm();
    });
    await pagina.waitForTimeout(500);
    comprobar(await pagina.evaluate(() => progreso.activo?.nombre === "Nova" && document.querySelector("#nombrePiloto").textContent === "Nova"),
      "crea el piloto y lo muestra en el menú");
    await ctx.close();
  }

  // Progreso: récord, créditos, hangar y copia de seguridad
  console.log("\nProgreso");
  const ctx = await contextoConPiloto(navegador, { viewport: { width: 1280, height: 720 } });
  const pagina = await ctx.newPage();
  await pagina.goto(URL);
  await pagina.waitForTimeout(1000);
  await pagina.click("#botonJugar");
  await pagina.waitForTimeout(6000);
  await pagina.evaluate(() => {
    const n = motor.escena.nave;
    motor.escena.puntos += 4000;
    n.vida = 1; n.invulnerable = 0; n.tiempoEscudo = 0;
    n.recibirDano();
  });
  await pagina.waitForTimeout(3000);
  const puntos = await pagina.evaluate(() => Number(document.querySelector("#finPuntos").value));
  const creditos = await pagina.evaluate(() => progreso.activo.creditos);
  comprobar(creditos >= Math.floor(puntos / 20), `la partida da créditos (${creditos} ⭐ por ${puntos} puntos)`);
  comprobar(await pagina.evaluate(() => !!progreso.activo.logros.primer_vuelo), "desbloquea el logro «Primer vuelo»");

  await pagina.reload();
  await pagina.waitForFunction(() => document.querySelector("#menu") && !document.querySelector("#menu").hidden);
  await pagina.waitForTimeout(300);
  const record = await pagina.evaluate(() => Number(document.querySelector("#tarjetaRecord").value));
  comprobar(record === puntos, `el récord (${record} puntos) se conserva al recargar`);

  // Hangar: comprar "Casco reforzado" hace que la nave despegue con 4 de casco
  await pagina.evaluate(() => { progreso.activo.creditos += 1000; progreso.guardar(); });
  await pagina.click("#botonHangar");
  await pagina.waitForTimeout(400);
  await pagina.evaluate(() => document.querySelector("#listaMejoras df-button").click());
  await pagina.waitForTimeout(200);
  comprobar(await pagina.evaluate(() => progreso.nivel("casco") === 1), "se compra una mejora en el hangar");
  await pagina.keyboard.press("Escape");
  await pagina.waitForTimeout(300);
  await pagina.click("#botonJugar");
  await pagina.waitForTimeout(300);
  comprobar(await pagina.evaluate(() => motor.escena.nave.vida === 4), "la mejora se aplica en la partida (casco 4)");

  // Copia de seguridad: exportar, borrar e importar
  const copia = await pagina.evaluate(() => progreso.exportar());
  await pagina.evaluate(() => { progreso.borrarPiloto(progreso.idActivo); });
  const restaurados = await pagina.evaluate((texto) => progreso.importar(texto), copia);
  comprobar(restaurados === 1 && await pagina.evaluate(() => progreso.nivel("casco") === 1),
    "exportar e importar recupera el piloto con sus mejoras");
  const rechaza = await pagina.evaluate(() => { try { progreso.importar("{}"); return false; } catch (e) { return true; } });
  comprobar(rechaza, "rechaza un archivo que no es una copia de Nébula");
  await ctx.close();

  await navegador.close();
})();
