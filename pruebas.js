/* GastaMejor - Pruebas automatizadas
   ------------------------------------------------------------
   Este archivo se inyecta DENTRO de index.html (mismo realm), asi
   puede usar las funciones y variables globales de la app
   (estado, GRUPOS, calcularReparto, PERFILES, etc.).

   Lo ejecuta pruebas.html: carga index.html en un iframe y luego
   inyecta este script. Al terminar llama a
   window.parent.__mostrarResultados(resumen).

   Tambien lo corre tests/correr-tests.ps1 en Edge headless.
   ------------------------------------------------------------ */
(function () {
  "use strict";

  /* ---------- Mini framework ---------- */

  var resultados = [];
  var suiteActual = "General";

  function suite(nombre) {
    suiteActual = nombre;
  }

  function registrar(nombre, ok, detalle) {
    resultados.push({
      suite: suiteActual,
      nombre: String(nombre),
      ok: !!ok,
      detalle: detalle === undefined || detalle === null ? "" : String(detalle),
    });
  }

  function ok(nombre, condicion, detalle) {
    registrar(nombre, condicion, condicion ? "" : detalle);
  }

  function igual(nombre, real, esperado) {
    var okk = real === esperado;
    registrar(nombre, okk, okk ? "" : "esperado " + JSON.stringify(esperado) + ", obtuvo " + JSON.stringify(real));
  }

  function casi(nombre, real, esperado, tol) {
    tol = tol === undefined ? 0.01 : tol;
    var okk = Math.abs(Number(real) - Number(esperado)) <= tol;
    registrar(nombre, okk, okk ? "" : "esperado ~" + esperado + " (+/-" + tol + "), obtuvo " + real);
  }

  function correr(nombreSuite, fn) {
    suite(nombreSuite);
    try {
      fn();
    } catch (e) {
      registrar("Excepcion en la suite", false, String((e && e.stack) || e));
    }
  }

  function q(sel) { return document.querySelector(sel); }
  function qall(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function click(el) { el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); }

  /* ---------- Respaldo de datos del usuario ---------- */

  var CLAVES = ["gastamejor.config.v1", "gastamejor.cotizacion.v1", "gastamejor.historial.v1", "gastamejor.tour.v1"];
  var respaldo = {};
  CLAVES.forEach(function (k) { respaldo[k] = localStorage.getItem(k); });
  var urlOriginal = location.href;

  // El tour de primera vez no debe interferir con las demas pruebas.
  window.__SIN_TOUR__ = true;
  (function () {
    var t = document.getElementById("tour");
    if (t) t.hidden = true;
  })();

  function restaurar() {
    CLAVES.forEach(function (k) {
      try {
        if (respaldo[k] === null) localStorage.removeItem(k);
        else localStorage.setItem(k, respaldo[k]);
      } catch (_) { /* nada */ }
    });
    try { history.replaceState(null, "", urlOriginal); } catch (_) { /* nada */ }
  }

  /* ---------- Estado limpio para cada prueba ---------- */

  function resetEstado(monto) {
    estado.config = configVacia();
    estado.monto = Number(monto) || 0;
    estado.cotizacion = { tipo: "bolsa", valor: 1000, fecha: null, fuente: "manual", estado: "manual" };
    estado.cotizacionManual = false;
    planDeltas = null;
    var s = q("#plan-meses");
    if (s) s.value = "6";
  }

  /* ============================================================
     Suites
     ============================================================ */

  correr("Formato de montos", function () {
    igual("analizarEntrada: coma decimal",
      JSON.stringify(analizarEntrada("1.000.000,50")), JSON.stringify({ entero: "1000000", dec: "50" }));
    igual("analizarEntrada: punto decimal",
      JSON.stringify(analizarEntrada("1234.56")), JSON.stringify({ entero: "1234", dec: "56" }));
    igual("analizarEntrada: miles con un punto",
      JSON.stringify(analizarEntrada("1.000")), JSON.stringify({ entero: "1000", dec: null }));
    igual("analizarEntrada: dos puntos = miles",
      JSON.stringify(analizarEntrada("1.000.000")), JSON.stringify({ entero: "1000000", dec: null }));

    igual("formatearEntradaMonto: entero", formatearEntradaMonto("1000000"), "1.000.000");
    igual("formatearEntradaMonto: con decimal", formatearEntradaMonto("1000,5"), "1.000,5");
    igual("formatearEntradaMonto: vacio", formatearEntradaMonto(""), "");
    igual("formatearEntradaMonto: cero", formatearEntradaMonto("0"), "0");
    igual("formatearEntradaMonto: ceros a la izquierda", formatearEntradaMonto("0005"), "5");

    igual("parsearEntradaMonto: mixto", parsearEntradaMonto("1.000.000,50"), 1000000.5);
    igual("parsearEntradaMonto: vacio", parsearEntradaMonto(""), null);
    igual("parsearEntradaMonto: letras", parsearEntradaMonto("abc"), null);
    igual("parsearEntradaMonto: cero", parsearEntradaMonto("0"), 0);
    igual("parsearEntradaMonto: coma", parsearEntradaMonto("1234,5"), 1234.5);
    igual("parsearEntradaMonto: punto decimal", parsearEntradaMonto("1.5"), 1.5);
    igual("parsearEntradaMonto: dos puntos", parsearEntradaMonto("1.5.0"), 150);

    igual("formatearNumeroMonto: miles y decimales", formatearNumeroMonto(1234567.5, 2), "1.234.567,50");
    igual("formatearNumeroMonto: negativo", formatearNumeroMonto(-500, 2), "-500,00");
    igual("formatearNumeroMonto: sin decimales", formatearNumeroMonto(1000, 0), "1.000");

    // Formato corto del calendario (dineroCorto).
    igual("dineroCorto: 1.2M", dineroCorto(1200000), "1.2M");
    igual("dineroCorto: 1M sin decimales", dineroCorto(1000000), "1M");
    igual("dineroCorto: 12.5M", dineroCorto(12500000), "12.5M");
    igual("dineroCorto: 850K", dineroCorto(850000), "850K");
    igual("dineroCorto: 123K", dineroCorto(123456), "123K");
    igual("dineroCorto: 1.5K", dineroCorto(1500), "1.5K");
    igual("dineroCorto: 850", dineroCorto(850), "850");
    igual("dineroCorto: 999.999 -> 1M", dineroCorto(999999), "1M");
    igual("dineroCorto: cero", dineroCorto(0), "0");
    igual("dineroCorto: negativo", dineroCorto(-1500), "-1.5K");
    igual("dineroCorto: no numerico", dineroCorto("abc"), "—");
  });

  correr("Utilidades", function () {
    igual("esc: escapa etiquetas", esc('<a href="x">&\''), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    ok("dinero: agrupa miles", dinero("ARS", 1000).indexOf("1.000") !== -1, dinero("ARS", 1000));
    igual("fmtPct: 1 decimal", fmtPct(33.333), "33,3%");
    igual("fmtPct: entero", fmtPct(50), "50%");
    igual("fmtPct: nulo", fmtPct(null), "0%");
  });

  correr("Reparto", function () {
    var cfg, r, g;

    cfg = configVacia();
    r = calcularReparto(cfg, 100000);
    casi("sin fijos: asignado = ingreso", r.asignado, 100000);
    casi("sin fijos: restante = 0", r.restante, 0);
    casi("sin fijos: sumaPct = 100", r.sumaPct, 100);
    casi("sin fijos: vivienda 25%", r.montoCategoria[0], 25000);
    casi("sin fijos: comida 15%", r.montoCategoria[1], 15000);
    casi("sin fijos: emergencia 5%", r.montoCategoria[6], 5000);
    casi("sin fijos: pctTotal 100", r.pctTotal, 100);

    cfg = configVacia();
    cfg.categorias.push({ id: "alq", nombre: "Alquiler", grupo: "necesidad", modo: "fijo", porcentaje: 0, monto: 30000, monedaMonto: "ARS" });
    r = calcularReparto(cfg, 100000);
    casi("con fijo: sumaFijos", r.sumaFijos, 30000);
    casi("con fijo: disponible", r.disponible, 70000);
    casi("con fijo: restante 0", r.restante, 0);
    casi("con fijo: vivienda estirada", r.montoCategoria[0], 17500);
    casi("con fijo: alquiler exacto", r.montoCategoria[7], 30000);

    cfg = configVacia();
    cfg.categorias[0] = { id: "v", nombre: "Vivienda", grupo: "necesidad", modo: "fijo", porcentaje: 0, monto: 120000, monedaMonto: "ARS" };
    r = calcularReparto(cfg, 100000);
    ok("fijos > ingreso: disponible negativo", r.disponible < 0, String(r.disponible));
    ok("fijos > ingreso: restante negativo", r.restante < -0.01, String(r.restante));
    casi("fijos > ingreso: pctTotal 120", r.pctTotal, 120);
    casi("fijos > ingreso: porcentuales en 0", r.montoCategoria[1], 0);

    cfg = configVacia();
    cfg.categorias.forEach(function (c) { c.modo = "fijo"; c.monto = 1000; });
    r = calcularReparto(cfg, 100000);
    casi("todo fijo: sumaPct 0", r.sumaPct, 0);
    casi("todo fijo: sumaFijos", r.sumaFijos, 7000);
    casi("todo fijo: restante", r.restante, 93000);

    cfg = configVacia();
    cfg.categorias[5] = { id: "a", nombre: "Ahorro USD", grupo: "ahorro", modo: "fijo", porcentaje: 0, monto: 100, monedaMonto: "USD" };
    r = calcularReparto(cfg, 100000, { valor: 1000 });
    ok("ahorro USD: detecta USD", categoriaEnUSD(cfg, cfg.categorias[5]));
    casi("ahorro USD: convierte con la tasa", r.montoCategoria[5], 100000);
    casi("ahorro USD: entra en sumaFijos", r.sumaFijos, 100000);

    cfg = configVacia();
    r = calcularReparto(cfg, 100000);
    g = calcularSubtotalesGrupo(r, cfg);
    casi("subtotal necesidades 50%", g.necesidad, 50000);
    casi("subtotal deseos 30%", g.deseo, 30000);
    casi("subtotal ahorro 20%", g.ahorro, 20000);
  });

  correr("Perfiles", function () {
    resetEstado(100000);
    ok("buscarPerfil: valido", !!buscarPerfil("gastador"));
    igual("buscarPerfil: invalido", buscarPerfil("nope"), null);
    igual("pesosNominalesGrupo por defecto",
      JSON.stringify(pesosNominalesGrupo(configVacia())), JSON.stringify({ necesidad: 50, deseo: 30, ahorro: 20 }));

    casi("distribucion sin ingreso: necesidad", distribucionActualGrupo(configVacia(), 0).necesidad, 50);
    var d1 = distribucionActualGrupo(configVacia(), 100000);
    casi("distribucion con ingreso: necesidad", d1.necesidad, 50);
    casi("distribucion con ingreso: ahorro", d1.ahorro, 20);
    igual("perfilActual por defecto", (perfilActual(configVacia(), 100000) || {}).id, "equilibrado");

    resetEstado(100000);
    fijarPesosGrupo({ necesidad: 60, deseo: 30, ahorro: 10 });
    var c = estado.config.categorias;
    casi("fijarPesosGrupo: vivienda", c[0].porcentaje, 30);
    casi("fijarPesosGrupo: comida", c[1].porcentaje, 18);
    casi("fijarPesosGrupo: transporte", c[2].porcentaje, 12);
    casi("fijarPesosGrupo: ahorro", c[5].porcentaje, 7.5);
    casi("fijarPesosGrupo: emergencia", c[6].porcentaje, 2.5);

    resetEstado(100000);
    fijarObjetivoReal({ necesidad: 60, deseo: 30, ahorro: 10 }, 100000);
    casi("fijarObjetivoReal sin fijos: vivienda", estado.config.categorias[0].porcentaje, 30);

    resetEstado(100000);
    estado.config.categorias[0] = { id: "v", nombre: "Vivienda", grupo: "necesidad", modo: "fijo", porcentaje: 0, monto: 30000, monedaMonto: "ARS" };
    fijarObjetivoReal({ necesidad: 50, deseo: 30, ahorro: 20 }, 100000);
    var dd = distribucionActualGrupo(estado.config, 100000);
    casi("fijarObjetivoReal con fijo: necesidad real", dd.necesidad, 50, 0.6);
    casi("fijarObjetivoReal con fijo: deseo real", dd.deseo, 30, 0.6);
    casi("fijarObjetivoReal con fijo: ahorro real", dd.ahorro, 20, 0.6);

    resetEstado(0);
    fijarObjetivoReal({ necesidad: 60, deseo: 30, ahorro: 10 }, 0);
    casi("fijarObjetivoReal sin ingreso: vivienda", estado.config.categorias[0].porcentaje, 30);

    resetEstado(100000);
    aplicarPerfil("gastador");
    var dg = distribucionActualGrupo(estado.config, 100000);
    casi("aplicarPerfil gastador: necesidad", dg.necesidad, 60, 0.6);
    casi("aplicarPerfil gastador: ahorro", dg.ahorro, 10, 0.6);
  });

  correr("Plan de evolucion", function () {
    resetEstado(100000);
    var slider = q("#plan-meses");
    slider.value = "6"; igual("mesesPlan: 6", mesesPlan(), 6);
    slider.value = "3"; igual("mesesPlan: 3", mesesPlan(), 3);
    slider.value = "12"; igual("mesesPlan: 12", mesesPlan(), 12);
    slider.value = "20"; igual("mesesPlan: clampa a 12", mesesPlan(), 12);
    slider.value = "1"; igual("mesesPlan: clampa a 3", mesesPlan(), 3);
    slider.value = "6";

    resetEstado(100000);
    var info = planBaseActual(estado.config, 100000, 6);
    igual("planBaseActual: paso inicial 0", info.paso, 0);
    casi("planBaseActual: base = actual", info.base.necesidad, 50);

    estado.config.planBase = { necesidad: 60, deseo: 30, ahorro: 10 };
    estado.config.planPaso = 2;
    info = planBaseActual(estado.config, 100000, 6);
    igual("planBaseActual: respeta la base", info.base.necesidad, 60);
    igual("planBaseActual: respeta el paso", info.paso, 2);

    estado.config.planPaso = 99;
    info = planBaseActual(estado.config, 100000, 6);
    igual("planBaseActual: paso fuera de rango -> 0", info.paso, 0);
    casi("planBaseActual: base invalida -> actual", info.base.necesidad, 50);

    igual("fmtDeltaPt: sube", fmtDeltaPt(5), "+5 pt");
    igual("fmtDeltaPt: baja", fmtDeltaPt(-3), "-3 pt");
    igual("fmtDeltaPt: cero", fmtDeltaPt(0), "");
    igual("fmtDeltaPt: decimal", fmtDeltaPt(2.5), "+2,5 pt");
    igual("fmtDeltaDinero: cero", fmtDeltaDinero("ARS", 0), "");
    igual("fmtDeltaDinero: signo +", fmtDeltaDinero("ARS", 1000).charAt(0), "+");
    igual("fmtDeltaDinero: signo -", fmtDeltaDinero("ARS", -800).charAt(0), "-");

    resetEstado(100000);
    q("#plan-meses").value = "6";
    renderPlan();
    igual("renderPlan: filas = meses + Hoy", qall("#plan-timeline .plan-fila").length, 7);
    igual("renderPlan: valor del slider", q("#plan-meses-valor").textContent, "6");
    ok("renderPlan: hay fila Ideal", !!q("#plan-timeline .plan-fila-ideal"));
    igual("renderPlan: primera fila es Hoy", q("#plan-timeline .plan-fila-hoy .plan-fila-mes").textContent, "Hoy");
  });

  correr("Plan lineal (N toques = ideal)", function () {
    resetEstado(100000);
    q("#plan-meses").value = "6";
    fijarPesosGrupo({ necesidad: 60, deseo: 30, ahorro: 10 });
    reiniciarPlan();
    casi("inicio Gastador: necesidad", distribucionActualGrupo(estado.config, 100000).necesidad, 60, 0.5);

    for (var k = 0; k < 6; k++) aplicarProximoPaso();
    var fin = distribucionActualGrupo(estado.config, 100000);
    casi("tras 6 toques: necesidad = 50", fin.necesidad, 50, 0.6);
    casi("tras 6 toques: deseo = 30", fin.deseo, 30, 0.6);
    casi("tras 6 toques: ahorro = 20", fin.ahorro, 20, 0.6);
    igual("planPaso llega a 6", estado.config.planPaso, 6);

    resetEstado(100000);
    q("#plan-meses").value = "6";
    fijarPesosGrupo({ necesidad: 60, deseo: 30, ahorro: 10 });
    reiniciarPlan();
    aplicarProximoPaso();
    aplicarProximoPaso();
    aplicarProximoPaso();
    var mitad = distribucionActualGrupo(estado.config, 100000);
    casi("lineal: a mitad (3/6) necesidad", mitad.necesidad, 55, 0.6);
    casi("lineal: a mitad (3/6) ahorro", mitad.ahorro, 15, 0.6);
  });

  correr("Deltas del plan (+/-)", function () {
    resetEstado(100000);
    q("#plan-meses").value = "6";
    fijarPesosGrupo({ necesidad: 60, deseo: 30, ahorro: 10 });
    reiniciarPlan();
    aplicarProximoPaso();
    ok("planDeltas existe", !!planDeltas);
    ok("planDeltas tiene entradas", planDeltas && Object.keys(planDeltas).length > 0,
      planDeltas ? String(Object.keys(planDeltas).length) : "null");

    renderResultado();
    ok("Resultado muestra deltas", qall("#resultado-lista .delta").length > 0);
    renderAjustar();
    var deltasAjustar = qall("#ajustar-lista .delta");
    ok("Ajustar muestra deltas", deltasAjustar.length > 0);
    ok("delta en 'pt'", deltasAjustar.some(function (d) { return / pt$/.test(d.textContent); }),
      deltasAjustar.map(function (d) { return d.textContent; }).join(" | "));
    ok("delta en dinero", deltasAjustar.some(function (d) { return /[$]/.test(d.textContent); }),
      deltasAjustar.map(function (d) { return d.textContent; }).join(" | "));

    reiniciarPlan();
    igual("reiniciarPlan limpia planDeltas", planDeltas, null);
    renderAjustar();
    igual("sin deltas tras reiniciar", qall("#ajustar-lista .delta").length, 0);
  });

  correr("Plan: aviso por montos fijos", function () {
    resetEstado(100000);
    estado.config.categorias[0] = { id: "v", nombre: "Vivienda", grupo: "necesidad", modo: "fijo", porcentaje: 0, monto: 60000, monedaMonto: "ARS" };
    renderPlan();
    var aviso = q("#plan-aviso");
    ok("aviso visible con fijos sobre el ideal", !aviso.hidden, aviso.textContent);
    ok("aviso menciona Necesidades", aviso.textContent.indexOf("Necesidades") !== -1, aviso.textContent);
  });

  correr("Consejero", function () {
    igual("normalizarTexto: quita acentos", normalizarTexto("Café"), "cafe");
    ok("accionParaCategoria: alquiler", accionParaCategoria("Alquiler / expensas").indexOf("negociá") !== -1, accionParaCategoria("Alquiler / expensas"));
    ok("accionParaCategoria: delivery", accionParaCategoria("Delivery y cafés").indexOf("domicilio") !== -1, accionParaCategoria("Delivery y cafés"));
    ok("accionParaCategoria: generica", accionParaCategoria("Zzz raro").indexOf("revisá este gasto") !== -1, accionParaCategoria("Zzz raro"));

    resetEstado(0);
    var s0 = consejosConsejero(estado.config, 0);
    igual("consejero sin ingreso: tipo aviso", s0[0].tipo, "aviso");

    resetEstado(100000);
    estado.config.categorias[0] = { id: "v", nombre: "Vivienda", grupo: "necesidad", modo: "fijo", porcentaje: 0, monto: 150000, monedaMonto: "ARS" };
    var s1 = consejosConsejero(estado.config, 100000);
    igual("consejero fijos > ingreso: tipo error", s1[0].tipo, "error");

    resetEstado(100000);
    var sOk = consejosConsejero(estado.config, 100000);
    ok("consejero objetivo cumplido", sOk.some(function (x) { return x.titulo === "¡Objetivo cumplido!"; }),
      sOk.map(function (x) { return x.titulo; }).join(" | "));

    resetEstado(100000);
    fijarPesosGrupo({ necesidad: 60, deseo: 30, ahorro: 10 });
    var sG = consejosConsejero(estado.config, 100000);
    ok("consejero Gastador: recorta Necesidades",
      sG.some(function (x) { return x.tipo === "grupo" && x.titulo.indexOf("Necesidades") === 0; }),
      sG.map(function (x) { return x.titulo; }).join(" | "));
    ok("consejero Gastador: sugiere ahorrar mas", sG.some(function (x) { return x.tipo === "ahorro"; }));
    ok("consejero nunca recorta Ahorro",
      !sG.some(function (x) { return x.tipo === "grupo" && x.titulo.indexOf("Ahorro") === 0; }));

    resetEstado(100000);
    estado.config.objetivo = "cauto";
    var sC = consejosConsejero(estado.config, 100000);
    ok("consejero Cauto: recorta Deseos",
      sC.some(function (x) { return x.tipo === "grupo" && x.titulo.indexOf("Deseos") === 0; }),
      sC.map(function (x) { return x.titulo; }).join(" | "));
  });

  correr("Historial", function () {
    localStorage.removeItem("gastamejor.historial.v1");
    ok("mesActualClave: formato YYYY-MM", /^\d{4}-\d{2}$/.test(mesActualClave()), mesActualClave());

    localStorage.removeItem("gastamejor.historial.v1");
    guardarMesHistorial({ mes: "2026-03", monto: 1 });
    guardarMesHistorial({ mes: "2026-01", monto: 2 });
    guardarMesHistorial({ mes: "2026-03", monto: 3 });
    var lista = cargarHistorial();
    igual("historial: upsert no duplica", lista.length, 2);
    igual("historial: ordena por mes", JSON.stringify(lista.map(function (r) { return r.mes; })), JSON.stringify(["2026-01", "2026-03"]));
    igual("historial: upsert reemplaza el valor", lista[1].monto, 3);
    borrarMesHistorial("2026-01");
    igual("borrarMesHistorial", cargarHistorial().length, 1);

    localStorage.removeItem("gastamejor.historial.v1");
    resetEstado(100000);
    guardarMesActual();
    var reg = cargarHistorial()[0];
    igual("guardarMesActual: moneda", reg.moneda, "ARS");
    igual("guardarMesActual: monto", reg.monto, 100000);
    igual("guardarMesActual: 7 categorias", reg.categorias.length, 7);
    igual("guardarMesActual: perfil", reg.perfil, "equilibrado");
    casi("guardarMesActual: pct ahorro 20", reg.pctGrupos.ahorro, 20);

    localStorage.setItem("gastamejor.historial.v1", JSON.stringify(window.EJEMPLO_PROGRESO));
    histAnio = 2026;
    histMesSel = null;
    renderHistorial();
    igual("calendario: 12 celdas", qall("#hist-calendario .hist-celda").length, 12);
    igual("calendario: 12 meses con datos", qall("#hist-calendario .hist-celda.con-datos").length, 12);
    ok("detalle: muestra la torta", !!q("#hist-detalle .hist-torta-svg"));
    ok("evolucion: tiene svg", !!q("#hist-evolucion svg"));
    ok("tortaSVG: devuelve svg", tortaSVG(window.EJEMPLO_PROGRESO[0]).indexOf("<svg") !== -1);

    // El calendario usa el formato corto y no se desborda.
    var montosCal = qall("#hist-calendario .hist-celda .hist-celda-monto");
    igual("calendario: enero en formato corto (1M)", montosCal[0].textContent, "1M");
    igual("calendario: diciembre en formato corto (1.7M)", montosCal[11].textContent, "1.7M");
    ok("calendario: montos cortos (<=6 caracteres)",
      montosCal.every(function (el) { return el.textContent.length <= 6; }),
      montosCal.map(function (el) { return el.textContent; }).join(" | "));
  });

  correr("Storage y enlace", function () {
    var vacia = configVacia();
    igual("configVacia: version", vacia.version, 3);
    igual("configVacia: moneda", vacia.moneda, "ARS");
    igual("configVacia: objetivo", vacia.objetivo, "equilibrado");
    igual("configVacia: 7 categorias", vacia.categorias.length, 7);
    igual("configVacia: planBase null", vacia.planBase, null);
    igual("configVacia: planPaso 0", vacia.planPaso, 0);

    ok("validarConfig: default valida", validarConfig(configVacia()));
    ok("validarConfig: null invalida", validarConfig(null) === false);
    ok("validarConfig: sin categorias invalida", validarConfig({ categorias: [] }) === false);
    ok("validarConfig: nombre vacio invalida",
      validarConfig({ categorias: [{ nombre: "   ", modo: "porcentaje", porcentaje: 1, monto: 0 }] }) === false);
    igual("sumaPorcentajes: default 100", sumaPorcentajes(configVacia()), 100);

    var v1 = migrarConfig({ moneda: "ARS", categorias: [{ nombre: "Comida", grupo: "necesidad", porcentaje: 10 }] });
    igual("migrarConfig v1: modo", v1.categorias[0].modo, "porcentaje");
    igual("migrarConfig v1: monto 0", v1.categorias[0].monto, 0);
    igual("migrarConfig v1: monedaMonto ARS", v1.categorias[0].monedaMonto, "ARS");
    igual("migrarConfig v1: objetivo", v1.objetivo, "equilibrado");
    igual("migrarConfig v1: planPaso 0", v1.planPaso, 0);
    igual("migrarConfig v1: planBase null", v1.planBase, null);

    var raro = migrarConfig({
      moneda: "XXX", dolarTipo: "nope", objetivo: "nope",
      planBase: { necesidad: "a", deseo: 2, ahorro: 3 }, planPaso: 5,
      categorias: [{ nombre: "X", grupo: "raro", modo: "raro", porcentaje: "5" }],
    });
    igual("migrarConfig: moneda invalida -> ARS", raro.moneda, "ARS");
    igual("migrarConfig: dolar invalido -> bolsa", raro.dolarTipo, "bolsa");
    igual("migrarConfig: objetivo invalido -> equilibrado", raro.objetivo, "equilibrado");
    igual("migrarConfig: planBase invalido -> null", raro.planBase, null);
    igual("migrarConfig: planPaso sin base -> 0", raro.planPaso, 0);
    igual("migrarConfig: grupo invalido -> necesidad", raro.categorias[0].grupo, "necesidad");
    igual("migrarConfig: modo invalido -> porcentaje", raro.categorias[0].modo, "porcentaje");

    var conBase = migrarConfig({
      categorias: [{ nombre: "A", grupo: "ahorro", modo: "fijo", porcentaje: 0, monto: 10 }],
      planBase: { necesidad: 1, deseo: 2, ahorro: 3 }, planPaso: 2,
    });
    ok("migrarConfig: planBase valido conservado", !!(conBase.planBase && conBase.planBase.ahorro === 3));
    igual("migrarConfig: planPaso valido conservado", conBase.planPaso, 2);

    var cfgEnlace = configVacia();
    cfgEnlace.moneda = "EUR";
    cfgEnlace.categorias[0] = { id: "x", nombre: "Alquiler", grupo: "necesidad", modo: "fijo", porcentaje: 0, monto: 12345.67, monedaMonto: "ARS" };
    cfgEnlace.categorias[5].monedaMonto = "USD";
    var enlace = crearEnlace(cfgEnlace);
    ok("crearEnlace: incluye #c=", enlace.indexOf("#c=") !== -1, enlace.slice(0, 48));
    history.replaceState(null, "", enlace);
    var recuperada = configDesdeEnlace();
    ok("configDesdeEnlace: no null", !!recuperada);
    igual("enlace ida y vuelta: moneda", recuperada.moneda, "EUR");
    igual("enlace ida y vuelta: nombre", recuperada.categorias[0].nombre, "Alquiler");
    igual("enlace ida y vuelta: modo", recuperada.categorias[0].modo, "fijo");
    casi("enlace ida y vuelta: monto", recuperada.categorias[0].monto, 12345.67);
    igual("enlace ida y vuelta: moneda USD", recuperada.categorias[5].monedaMonto, "USD");
    igual("enlace: no lleva planBase", recuperada.planBase, undefined);
    limpiarEnlace();
    igual("limpiarEnlace: quita el hash", location.hash, "");

    localStorage.removeItem("gastamejor.cotizacion.v1");
    guardarCotizacion({ tipo: "bolsa", valor: 1234.5, fecha: "2026-01-01T00:00:00.000Z", fuente: "test" });
    var cot = cotizacionGuardada("bolsa");
    igual("cotizacion: guarda y lee", cot.valor, 1234.5);
    igual("cotizacion: otro tipo null", cotizacionGuardada("blue"), null);
  });

  correr("Navegacion y UI", function () {
    resetEstado(100000);
    mostrarPantalla("resultado");
    igual("mostrarPantalla: resultado", pantallaRepartoActual(), "resultado");
    mostrarPantalla("ajustar");
    igual("mostrarPantalla: ajustar", pantallaRepartoActual(), "ajustar");

    mostrarPestana("historial");
    igual("mostrarPestana: data-tab", q("#tablero").getAttribute("data-tab"), "historial");
    igual("mostrarPestana: boton activo", q(".tabbar-btn.activo").dataset.tab, "historial");
    igual("tabbar: 3 botones", qall(".tabbar-btn").length, 3);
    mostrarPestana("reparto");
    mostrarPantalla("ingreso");

    q("#monto").value = "";
    distribuir();
    ok("distribuir invalido: muestra error", q("#error-monto").hidden === false);

    resetEstado(0);
    q("#monto").value = "100000";
    distribuir();
    igual("distribuir valido: setea el monto", estado.monto, 100000);
    igual("distribuir valido: va a resultado", pantallaRepartoActual(), "resultado");
    ok("distribuir valido: oculta el error", q("#error-monto").hidden === true);

    resetEstado(100000);
    mostrarPantalla("ajustar");
    abrirCatalogo();
    ok("catalogo: abre", q("#modal-catalogo").hidden === false);
    igual("catalogo: muestra todas las sugerencias", qall("#catalogo-lista .chip-catalogo").length, CATALOGO.length);

    var chip = q("#catalogo-lista .chip-catalogo");
    var antes = estado.config.categorias.length;
    click(chip);
    var despues = estado.config.categorias.length;
    igual("catalogo: agrega una", despues, antes + 1);
    click(chip);
    igual("catalogo: no duplica", estado.config.categorias.length, despues);
    cerrarCatalogo();
    ok("catalogo: cierra", q("#modal-catalogo").hidden === true);
  });

  correr("Boton de reporte (WhatsApp)", function () {
    var rep = q("#btn-reportar");
    ok("boton reportar existe", !!rep);
    if (!rep) return;
    var href = rep.getAttribute("href") || "";
    ok("reportar: apunta a wa.me/5492920553198", href.indexOf("wa.me/5492920553198") !== -1, href);
    igual("reportar: abre en pestana nueva", rep.getAttribute("target"), "_blank");
    ok("reportar: rel seguro (noopener)", /noopener/.test(rep.getAttribute("rel") || ""));
    ok("reportar: tiene etiqueta accesible", !!rep.getAttribute("aria-label"));
    var m = href.match(/[?&]text=([^&]*)/);
    igual("reportar: mensaje precargado",
      m ? decodeURIComponent(m[1]).trim() : null,
      "Encontre un problema en GastaMejor:");
  });

  correr("Ajustar categorias", function () {
    resetEstado(100000);
    mostrarPantalla("ajustar");
    igual("ajustar: 7 filas", qall("#ajustar-lista .fila-ajuste").length, 7);
    igual("ajustar: 3 bloques de grupo", qall("#ajustar-lista .ajuste-bloque").length, 3);
    igual("ajustar: suma 100%", q("#suma-valor").textContent, "100%");

    var rep = calcularReparto(estado.config, 100000);
    ok("derivado: porcentaje",
      textoDerivadoCategoria(estado.config.categorias[0], 0, "ARS", 100000, rep).indexOf("del ingreso") !== -1);
    ok("derivado: fijo",
      textoDerivadoCategoria({ nombre: "Alq", grupo: "necesidad", modo: "fijo", porcentaje: 0, monto: 20000, monedaMonto: "ARS" }, 0, "ARS", 100000, rep).indexOf("del ingreso") !== -1);
    estado.cotizacion = { tipo: "bolsa", valor: 1000, fecha: null, fuente: "manual", estado: "manual" };
    ok("derivado: USD",
      textoDerivadoCategoria({ nombre: "Ahorro USD", grupo: "ahorro", modo: "fijo", porcentaje: 0, monto: 100, monedaMonto: "USD" }, 5, "ARS", 100000, rep).indexOf("US$") !== -1);

    resetEstado(100000);
    mostrarPantalla("ajustar");
    click(q('#ajustar-lista .fila-ajuste[data-idx="0"] .modo-btn[data-modo="fijo"]'));
    igual("toggle modo: pasa a fijo", estado.config.categorias[0].modo, "fijo");

    resetEstado(100000);
    mostrarPantalla("ajustar");
    var sel = q('#ajustar-lista .fila-ajuste[data-idx="3"] .ajuste-grupo');
    sel.value = "ahorro";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    igual("cambiar grupo", estado.config.categorias[3].grupo, "ahorro");

    resetEstado(100000);
    mostrarPantalla("ajustar");
    var n0 = estado.config.categorias.length;
    click(q("#btn-agregar"));
    igual("btn-agregar: suma una", estado.config.categorias.length, n0 + 1);

    var nd = estado.config.categorias.length;
    click(q('#ajustar-lista .fila-ajuste[data-idx="0"] .btn-borrar'));
    igual("btn-borrar: elimina una", estado.config.categorias.length, nd - 1);
  });

  correr("Datos de ejemplo (12 meses)", function () {
    ok("EJEMPLO_PROGRESO definido", Array.isArray(window.EJEMPLO_PROGRESO), typeof window.EJEMPLO_PROGRESO);
    if (!Array.isArray(window.EJEMPLO_PROGRESO)) return;

    var lista = window.EJEMPLO_PROGRESO;
    igual("12 meses", lista.length, 12);
    ok("meses con formato YYYY-MM", lista.every(function (r) { return /^\d{4}-\d{2}$/.test(r.mes); }));
    var unicos = {};
    lista.forEach(function (r) { unicos[r.mes] = true; });
    igual("meses unicos", Object.keys(unicos).length, 12);
    ok("meses ordenados", lista.every(function (r, i, a) { return i === 0 || a[i - 1].mes < r.mes; }));

    lista.forEach(function (r) {
      var sumaPct = r.pctGrupos.necesidad + r.pctGrupos.deseo + r.pctGrupos.ahorro;
      casi("pctGrupos ~100 (" + r.mes + ")", sumaPct, 100, 2);
      var porGrupo = { necesidad: 0, deseo: 0, ahorro: 0 };
      r.categorias.forEach(function (c) { porGrupo[c.grupo] += c.monto; });
      casi("grupos = suma de categorias (" + r.mes + ")", porGrupo.ahorro, r.grupos.ahorro, 0.05);
      casi("pct ahorro real (" + r.mes + ")", r.pctGrupos.ahorro, (r.grupos.ahorro / r.monto) * 100, 0.5);
      ok("categorias no vacias (" + r.mes + ")", r.categorias.length > 0);
      ok("monto positivo (" + r.mes + ")", r.monto > 0);

      var mejor = null;
      var mejorD = Infinity;
      PERFILES.forEach(function (p) {
        var d = Math.pow(r.pctGrupos.necesidad - p.grupos.necesidad, 2) +
          Math.pow(r.pctGrupos.deseo - p.grupos.deseo, 2) +
          Math.pow(r.pctGrupos.ahorro - p.grupos.ahorro, 2);
        if (d < mejorD) { mejorD = d; mejor = p; }
      });
      igual("perfil coherente (" + r.mes + ")", r.perfil, mejor.id);
    });

    var ahorros = lista.map(function (r) { return r.pctGrupos.ahorro; });
    ok("ahorro no decreciente", ahorros.every(function (v, i) { return i === 0 || v >= ahorros[i - 1] - 0.01; }),
      JSON.stringify(ahorros));
    igual("primer mes Gastador", lista[0].perfil, "gastador");
    igual("ultimo mes Equilibrado", lista[11].perfil, "equilibrado");

    ok("EJEMPLO_CONFIG valido", validarConfig(window.EJEMPLO_CONFIG));
    igual("cargarEjemplo escribe 12", window.cargarEjemplo(), 12);
    igual("cargarEjemplo guarda el historial", cargarHistorial().length, 12);
    window.borrarEjemplo();
    igual("borrarEjemplo limpia el historial", cargarHistorial().length, 0);
  });

  correr("Tour guiado de primera vez", function () {
    var tour = q("#tour");
    ok("overlay #tour existe", !!tour);
    ok("boton para repetir el tour (#btn-tour)", !!q("#btn-tour"));
    ok("enlace al tutorial completo", !!q('a[href="tutorial.html"]'));
    if (!tour) return;

    ok("PASOS_TOUR definido", Array.isArray(PASOS_TOUR));
    PASOS_TOUR.forEach(function (p) {
      ok("paso apunta a " + p.sel, !!q(p.sel));
      ok("paso tiene titulo y texto (" + p.sel + ")", !!(p.titulo && p.texto));
    });

    // Condicion de arranque: sin historial y sin haberlo visto antes.
    olvidarTour();
    localStorage.removeItem("gastamejor.historial.v1");
    ok("disponible: sin historial ni flag", tourDisponible() === true);
    marcarTourVisto();
    ok("no disponible: ya lo vio", tourDisponible() === false);
    olvidarTour();
    guardarHistorial([{ mes: "2026-01", monto: 1000 }]);
    ok("no disponible: ya tiene historial", tourDisponible() === false);
    localStorage.removeItem("gastamejor.historial.v1");

    // Motor de pasos.
    olvidarTour();
    window.__SIN_TOUR__ = false;
    iniciarTour();
    ok("iniciarTour muestra el overlay", q("#tour").hidden === false);
    igual("primer paso: contador", q("#tour-paso").textContent, "1 de " + PASOS_TOUR.length);
    igual("primer paso: titulo", q("#tour-titulo").textContent, PASOS_TOUR[0].titulo);
    ok("primer paso: 'Anterior' deshabilitado", q("#tour-anterior").disabled === true);
    pasoSiguiente();
    igual("avanza al paso 2", q("#tour-paso").textContent, "2 de " + PASOS_TOUR.length);
    ok("paso 2: 'Anterior' habilitado", q("#tour-anterior").disabled === false);
    pasoAnterior();
    igual("retrocede al paso 1", q("#tour-paso").textContent, "1 de " + PASOS_TOUR.length);
    for (var k = 1; k < PASOS_TOUR.length; k++) pasoSiguiente();
    igual("ultimo paso: el boton dice Listo", q("#tour-siguiente").textContent, "Listo");
    pasoSiguiente();
    ok("terminar oculta el overlay", q("#tour").hidden === true);
    ok("terminar lo marca como visto", tourVisto() === true);

    // Saltar.
    olvidarTour();
    iniciarTour();
    ok("reiniciar vuelve a mostrarlo", q("#tour").hidden === false);
    saltarTour();
    ok("saltar oculta el overlay", q("#tour").hidden === true);
    ok("saltar lo marca como visto", tourVisto() === true);

    // Repetir desde el boton de "Tus datos".
    olvidarTour();
    click(q("#btn-tour"));
    ok("el boton 'Ver el tutorial' lo abre", q("#tour").hidden === false);

    // Deja todo cerrado para el resto de las pruebas.
    saltarTour();
    window.__SIN_TOUR__ = true;
    q("#tour").hidden = true;
  });

  /* ---------- Resultado ---------- */

  restaurar();

  var total = resultados.length;
  var ok2 = resultados.filter(function (r) { return r.ok; }).length;
  var fallo = total - ok2;
  var resumen = { resultados: resultados, ok: ok2, fallo: fallo, total: total };
  window.__RESULTADOS_PRUEBAS__ = resumen;

  if (window.parent && window.parent !== window && typeof window.parent.__mostrarResultados === "function") {
    window.parent.__mostrarResultados(resumen);
  }
})();
