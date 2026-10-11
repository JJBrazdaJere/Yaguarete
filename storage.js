"use strict";

/* ============================================================
   GastaMejor — Capa de datos (storage.js)
   HOY:    guarda en localStorage del dispositivo
           + exportar / importar / enlace compartible.
   MAÑANA: para sincronizar entre dispositivos solo hay que
           reemplazar estas funciones (ej. por una API), la
           interfaz (app.js) no cambia.
   ============================================================ */

const CLAVE_CONFIG = "gastamejor.config.v1";
const VERSION_CONFIG = 2;
const VERSION_ENLACE = 2;

// Distribución sugerida: 50/30/20 (necesidades/deseos/ahorro).
// Cada categoría puede ser:
//   modo "porcentaje" -> su monto = ingreso * porcentaje / 100
//   modo "fijo"       -> su monto es exacto en pesos, no cambia con el ingreso
const CATEGORIAS_POR_DEFECTO = [
  { id: "vivienda",   nombre: "Vivienda / alquiler",             grupo: "necesidad", modo: "porcentaje", porcentaje: 25, monto: 0 },
  { id: "comida",     nombre: "Comida y super",                  grupo: "necesidad", modo: "porcentaje", porcentaje: 15, monto: 0 },
  { id: "transporte", nombre: "Transporte (colectivo, auto)",    grupo: "necesidad", modo: "porcentaje", porcentaje: 10, monto: 0 },
  { id: "ocio",       nombre: "Ocio y planes",                   grupo: "deseo",     modo: "porcentaje", porcentaje: 15, monto: 0 },
  { id: "compras",    nombre: "Compras personales",              grupo: "deseo",     modo: "porcentaje", porcentaje: 15, monto: 0 },
  { id: "ahorro",     nombre: "Ahorro",                          grupo: "ahorro",    modo: "porcentaje", porcentaje: 15, monto: 0 },
  { id: "emergencia", nombre: "Fondo de emergencia",             grupo: "ahorro",    modo: "porcentaje", porcentaje: 5,  monto: 0 },
];

// Catálogo de categorías sugeridas (Argentina) listas para agregar con un toque.
const CATALOGO = [
  { nombre: "Alquiler / expensas",                    grupo: "necesidad", modo: "fijo" },
  { nombre: "Servicios (luz, gas, agua, internet)",   grupo: "necesidad", modo: "fijo" },
  { nombre: "Supermercado y comida",                  grupo: "necesidad", modo: "porcentaje" },
  { nombre: "Transporte: colectivo / SUBE",           grupo: "necesidad", modo: "fijo" },
  { nombre: "Transporte: taxi / remis",               grupo: "necesidad", modo: "fijo" },
  { nombre: "Transporte: tren",                       grupo: "necesidad", modo: "fijo" },
  { nombre: "Combustible del auto",                   grupo: "necesidad", modo: "fijo" },
  { nombre: "Auto: seguro y patente",                 grupo: "necesidad", modo: "fijo" },
  { nombre: "Prepaga / obra social",                  grupo: "necesidad", modo: "fijo" },
  { nombre: "Salud / farmacia",                       grupo: "necesidad", modo: "porcentaje" },
  { nombre: "Educación",                              grupo: "necesidad", modo: "fijo" },
  { nombre: "Deudas / tarjeta",                       grupo: "necesidad", modo: "fijo" },
  { nombre: "Ocio y salidas",                         grupo: "deseo",     modo: "porcentaje" },
  { nombre: "Delivery y cafés",                       grupo: "deseo",     modo: "porcentaje" },
  { nombre: "Ropa y compras",                         grupo: "deseo",     modo: "porcentaje" },
  { nombre: "Suscripciones (streaming)",              grupo: "deseo",     modo: "fijo" },
  { nombre: "Viajes",                                 grupo: "deseo",     modo: "porcentaje" },
  { nombre: "Ahorro / inversión",                     grupo: "ahorro",    modo: "porcentaje" },
  { nombre: "Fondo de emergencia",                    grupo: "ahorro",    modo: "porcentaje" },
];

const MONEDAS = [
  { codigo: "ARS", nombre: "Peso argentino (ARS)", simbolo: "$" },
  { codigo: "MXN", nombre: "Peso mexicano (MXN)", simbolo: "$" },
  { codigo: "USD", nombre: "Dolar estadounidense (USD)", simbolo: "US$" },
  { codigo: "EUR", nombre: "Euro (EUR)", simbolo: "€" },
  { codigo: "CLP", nombre: "Peso chileno (CLP)", simbolo: "$" },
  { codigo: "COP", nombre: "Peso colombiano (COP)", simbolo: "$" },
  { codigo: "PEN", nombre: "Sol peruano (PEN)", simbolo: "S/" },
  { codigo: "UYU", nombre: "Peso uruguayo (UYU)", simbolo: "$" },
  { codigo: "BOB", nombre: "Boliviano (BOB)", simbolo: "Bs" },
  { codigo: "PYG", nombre: "Guarani paraguayo (PYG)", simbolo: "₲" },
  { codigo: "BRL", nombre: "Real brasileno (BRL)", simbolo: "R$" },
  { codigo: "CRC", nombre: "Colon costarricense (CRC)", simbolo: "₡" },
  { codigo: "DOP", nombre: "Peso dominicano (DOP)", simbolo: "RD$" },
];

function configVacia() {
  return {
    version: VERSION_CONFIG,
    moneda: "ARS",
    categorias: CATEGORIAS_POR_DEFECTO.map(function (c) {
      return {
        id: c.id,
        nombre: c.nombre,
        grupo: c.grupo,
        modo: c.modo,
        porcentaje: c.porcentaje,
        monto: c.monto,
      };
    }),
  };
}

/* Migra configs viejas (sin "modo") a la estructura actual. */
function migrarConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return cfg;
  cfg.version = VERSION_CONFIG;
  if (typeof cfg.moneda !== "string" || !MONEDAS.some(function (m) { return m.codigo === cfg.moneda; })) {
    cfg.moneda = "ARS";
  }
  cfg.categorias = (Array.isArray(cfg.categorias) ? cfg.categorias : []).map(function (c) {
    if (!c || typeof c !== "object") return null;
    const modo = c.modo === "fijo" ? "fijo" : "porcentaje";
    return {
      id: typeof c.id === "string" && c.id ? c.id : "cat_" + Math.random().toString(36).slice(2, 10),
      nombre: String(c.nombre || ""),
      grupo: ["necesidad", "deseo", "ahorro"].indexOf(c.grupo) !== -1 ? c.grupo : "necesidad",
      modo: modo,
      porcentaje: Number(c.porcentaje) || 0,
      monto: Number(c.monto) || 0,
    };
  });
  cfg.categorias = cfg.categorias.filter(function (c) { return c !== null; });
  return cfg;
}

function cargarConfig() {
  try {
    const crudo = localStorage.getItem(CLAVE_CONFIG);
    if (!crudo) {
      const inicial = configVacia();
      guardarConfig(inicial);
      return inicial;
    }
    const cfg = migrarConfig(JSON.parse(crudo));
    if (!validarConfig(cfg)) throw new Error("config invalida en localStorage");
    return cfg;
  } catch (_) {
    return configVacia();
  }
}

function guardarConfig(cfg) {
  localStorage.setItem(CLAVE_CONFIG, JSON.stringify(cfg));
}

/* Valida que una configuracion tenga forma correcta. */
function validarConfig(cfg) {
  if (!cfg || typeof cfg !== "object" || !Array.isArray(cfg.categorias)) return false;
  if (cfg.categorias.length === 0) return false;
  return cfg.categorias.every(function (c) {
    return (
      c &&
      typeof c.nombre === "string" &&
      c.nombre.trim() !== "" &&
      (c.modo === "porcentaje" || c.modo === "fijo") &&
      typeof c.porcentaje === "number" &&
      isFinite(c.porcentaje) &&
      c.porcentaje >= 0 &&
      c.porcentaje <= 100 &&
      typeof c.monto === "number" &&
      isFinite(c.monto) &&
      c.monto >= 0
    );
  });
}

function sumaPorcentajes(cfg) {
  return cfg.categorias.reduce(function (acum, c) {
    return acum + (Number(c.porcentaje) || 0);
  }, 0);
}

/* ---------- Exportar / importar ---------- */

function exportarJSON(cfg) {
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "mis-gastos-config.json";
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

async function importarARCHIVO(archivo) {
  const texto = await archivo.text();
  const cfg = migrarConfig(JSON.parse(texto));
  if (!validarConfig(cfg)) {
    throw new Error("El archivo no tiene una configuración válida.");
  }
  return cfg;
}

/* ---------- Enlace compartible ----------
   Codifica la configuracion en el hash de la URL (#c=...).
   v2: [nombre, grupo, modo, porcentaje, monto]
   v1 (compat): [nombre, grupo, porcentaje] */

function crearEnlace(cfg) {
  const compacta = cfg.categorias.map(function (c) {
    return [
      c.nombre,
      c.grupo,
      c.modo === "fijo" ? "fijo" : "porcentaje",
      Number(c.porcentaje) || 0,
      Number(c.monto) || 0,
    ];
  });
  const crudo = JSON.stringify({ v: VERSION_ENLACE, m: cfg.moneda, c: compacta });
  const base64 = btoa(unescape(encodeURIComponent(crudo)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sinHash = location.href.split("#")[0];
  return sinHash + "#c=" + base64;
}

function base64UrlDecodificar(texto) {
  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(base64)));
}

/* Lee (y valida) una configuracion desde el hash de la URL. Devuelve null si no hay. */
function configDesdeEnlace() {
  const coincidencia = location.hash.match(/^#c=(.+)$/);
  if (!coincidencia) return null;
  try {
    const datos = JSON.parse(base64UrlDecodificar(coincidencia[1]));
    if (!Array.isArray(datos.c)) return null;
    const esV2 = Number(datos.v || 1) >= 2;

    const categorias = datos.c.map(function (item, i) {
      if (!Array.isArray(item)) return null;
      const grupo = ["necesidad", "deseo", "ahorro"].indexOf(item[1]) !== -1 ? item[1] : "necesidad";
      if (esV2 && item.length >= 5) {
        return {
          id: "compartida_" + i,
          nombre: String(item[0]),
          grupo: grupo,
          modo: item[2] === "fijo" ? "fijo" : "porcentaje",
          porcentaje: Number(item[3]) || 0,
          monto: Number(item[4]) || 0,
        };
      }
      return {
        id: "compartida_" + i,
        nombre: String(item[0]),
        grupo: grupo,
        modo: "porcentaje",
        porcentaje: Number(item[2]) || 0,
        monto: 0,
      };
    }).filter(function (c) { return c !== null; });

    const cfg = {
      version: VERSION_CONFIG,
      moneda: MONEDAS.some(function (m) { return m.codigo === datos.m; }) ? datos.m : "ARS",
      categorias: categorias,
    };
    if (!validarConfig(cfg)) return null;
    return cfg;
  } catch (_) {
    return null;
  }
}

/* Limpia el hash de la URL (para no volver a ofrecer el enlace). */
function limpiarEnlace() {
  if (location.hash) {
    history.replaceState(null, "", location.href.split("#")[0]);
  }
}