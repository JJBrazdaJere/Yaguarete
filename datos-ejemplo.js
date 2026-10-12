/* GastaMejor - Datos de ejemplo
   ------------------------------------------------------------
   La historia de "Ana": 12 meses (2026) de progreso real, desde
   un perfil Gastador (60/30/10) hasta Equilibrado (50/30/20),
   con el ahorro creciendo mes a mes.

   Estos datos se cargan en el navegador (localStorage) para ver
   el calendario del Historial lleno y la evolucion del ahorro.

   No forma parte de la app: lo usan tutorial.html y pruebas.html.
   ------------------------------------------------------------ */
"use strict";

(function () {
  var ANIO = 2026;

  var CLAVES = {
    config: "gastamejor.config.v1",
    cotizacion: "gastamejor.cotizacion.v1",
    historial: "gastamejor.historial.v1",
  };

  function redondear2(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  /* Reparte el ingreso del mes en 9 categorias a partir de los tres
     porcentajes por grupo. Los montos suman exactamente el ingreso,
     y los subtotales por grupo coinciden con el porcentaje pedido. */
  function construirMes(monto, pctN, pctD, pctA) {
    var N = redondear2((monto * pctN) / 100);
    var D = redondear2((monto * pctD) / 100);
    var A = redondear2(monto - N - D); // el ahorro absorbe el redondeo

    // Necesidades: alquiler alto, comida y transporte.
    var vivienda = redondear2(N * 0.55);
    var comida = redondear2(N * 0.27);
    var transporte = redondear2(N - vivienda - comida);

    // Deseos: ocio, delivery y compras.
    var ocio = redondear2(D * 0.4);
    var delivery = redondear2(D * 0.3);
    var compras = redondear2(D - ocio - delivery);

    // Ahorro: mitad en dolares, el resto repartido.
    var enDolares = redondear2(A * 0.5);
    var ahorro = redondear2(A * 0.3);
    var emergencia = redondear2(A - enDolares - ahorro);

    return {
      grupos: { necesidad: N, deseo: D, ahorro: A },
      categorias: [
        { nombre: "Vivienda / alquiler", grupo: "necesidad", monto: vivienda },
        { nombre: "Comida y super", grupo: "necesidad", monto: comida },
        { nombre: "Transporte (colectivo, auto)", grupo: "necesidad", monto: transporte },
        { nombre: "Ocio y planes", grupo: "deseo", monto: ocio },
        { nombre: "Delivery y cafés", grupo: "deseo", monto: delivery },
        { nombre: "Compras personales", grupo: "deseo", monto: compras },
        { nombre: "Ahorro en dólares (US$)", grupo: "ahorro", monto: enDolares },
        { nombre: "Ahorro", grupo: "ahorro", monto: ahorro },
        { nombre: "Fondo de emergencia", grupo: "ahorro", monto: emergencia },
      ],
    };
  }

  /* Mes a mes: el ingreso sube por paritarias y el ahorro mejora. */
  var MESES = [
    { m: 1,  monto: 1000000, nes: 60, des: 30, aho: 10, perfil: "gastador" },
    { m: 2,  monto: 1050000, nes: 59, des: 30, aho: 11, perfil: "gastador" },
    { m: 3,  monto: 1100000, nes: 58, des: 30, aho: 12, perfil: "gastador" },
    { m: 4,  monto: 1150000, nes: 56, des: 30, aho: 14, perfil: "gastador" },
    { m: 5,  monto: 1200000, nes: 56, des: 29, aho: 15, perfil: "gastador" },
    { m: 6,  monto: 1250000, nes: 55, des: 29, aho: 16, perfil: "equilibrado" },
    { m: 7,  monto: 1320000, nes: 54, des: 29, aho: 17, perfil: "equilibrado" },
    { m: 8,  monto: 1380000, nes: 53, des: 28, aho: 19, perfil: "equilibrado" },
    { m: 9,  monto: 1450000, nes: 52, des: 28, aho: 20, perfil: "equilibrado" },
    { m: 10, monto: 1520000, nes: 51, des: 29, aho: 20, perfil: "equilibrado" },
    { m: 11, monto: 1600000, nes: 50, des: 30, aho: 20, perfil: "equilibrado" },
    { m: 12, monto: 1700000, nes: 50, des: 30, aho: 20, perfil: "equilibrado" },
  ];

  var PROGRESO = MESES.map(function (item) {
    var mes = construirMes(item.monto, item.nes, item.des, item.aho);
    return {
      mes: ANIO + "-" + String(item.m).padStart(2, "0"),
      guardado: new Date(Date.UTC(ANIO, item.m - 1, 28, 12, 0, 0)).toISOString(),
      moneda: "ARS",
      monto: item.monto,
      grupos: mes.grupos,
      pctGrupos: {
        necesidad: redondear2((mes.grupos.necesidad / item.monto) * 100),
        deseo: redondear2((mes.grupos.deseo / item.monto) * 100),
        ahorro: redondear2((mes.grupos.ahorro / item.monto) * 100),
      },
      categorias: mes.categorias,
      perfil: item.perfil,
    };
  });

  /* Configuracion de la app que acompana al ejemplo (estado final: Diciembre).
     Los porcentajes nominales reproducen 50/30/20 por grupo. */
  var CONFIG = {
    version: 3,
    moneda: "ARS",
    dolarTipo: "bolsa",
    objetivo: "equilibrado",
    planBase: null,
    planPaso: 0,
    categorias: [
      { id: "ej_vivienda",   nombre: "Vivienda / alquiler",         grupo: "necesidad", modo: "porcentaje", porcentaje: 27.5, monto: 0, monedaMonto: "ARS" },
      { id: "ej_comida",     nombre: "Comida y super",              grupo: "necesidad", modo: "porcentaje", porcentaje: 13.5, monto: 0, monedaMonto: "ARS" },
      { id: "ej_transporte", nombre: "Transporte (colectivo, auto)", grupo: "necesidad", modo: "porcentaje", porcentaje: 9,    monto: 0, monedaMonto: "ARS" },
      { id: "ej_ocio",       nombre: "Ocio y planes",               grupo: "deseo",     modo: "porcentaje", porcentaje: 12,   monto: 0, monedaMonto: "ARS" },
      { id: "ej_delivery",   nombre: "Delivery y cafés",            grupo: "deseo",     modo: "porcentaje", porcentaje: 9,    monto: 0, monedaMonto: "ARS" },
      { id: "ej_compras",    nombre: "Compras personales",          grupo: "deseo",     modo: "porcentaje", porcentaje: 9,    monto: 0, monedaMonto: "ARS" },
      { id: "ej_usd",        nombre: "Ahorro en dólares (US$)",     grupo: "ahorro",    modo: "porcentaje", porcentaje: 10,   monto: 0, monedaMonto: "ARS" },
      { id: "ej_ahorro",     nombre: "Ahorro",                      grupo: "ahorro",    modo: "porcentaje", porcentaje: 6,    monto: 0, monedaMonto: "ARS" },
      { id: "ej_emergencia", nombre: "Fondo de emergencia",         grupo: "ahorro",    modo: "porcentaje", porcentaje: 4,    monto: 0, monedaMonto: "ARS" },
    ],
  };

  /* Carga el ejemplo en este navegador (pisa el historial actual). */
  function cargarEjemplo() {
    try {
      localStorage.setItem(CLAVES.historial, JSON.stringify(PROGRESO));
      localStorage.setItem(CLAVES.config, JSON.stringify(CONFIG));
      localStorage.setItem(
        CLAVES.cotizacion,
        JSON.stringify({ bolsa: { valor: 1250, fecha: new Date().toISOString(), fuente: "manual" } })
      );
    } catch (_) {
      /* sin persistencia: no pasa nada */
    }
    return PROGRESO.length;
  }

  /* Borra el ejemplo cargado. */
  function borrarEjemplo() {
    try {
      Object.keys(CLAVES).forEach(function (k) {
        localStorage.removeItem(CLAVES[k]);
      });
    } catch (_) {
      /* sin persistencia */
    }
  }

  window.EJEMPLO_PROGRESO = PROGRESO;
  window.EJEMPLO_CONFIG = CONFIG;
  window.EJEMPLO_CLAVES = CLAVES;
  window.cargarEjemplo = cargarEjemplo;
  window.borrarEjemplo = borrarEjemplo;
})();
