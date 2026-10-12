"use strict";

/* ============================================================
   GastaMejor — Capa de datos (storage.js)
   HOY:    guarda en localStorage del dispositivo
           + imagen PNG / enlace compartible + cotización del dólar.
   MAÑANA: para sincronizar entre dispositivos solo hay que
           reemplazar estas funciones (ej. por una API), la
           interfaz (app.js) no cambia.
   ============================================================ */

const CLAVE_CONFIG = "gastamejor.config.v1";
const CLAVE_COTIZACION = "gastamejor.cotizacion.v1";
const CLAVE_HISTORIAL = "gastamejor.historial.v1";
const CLAVE_TOUR = "gastamejor.tour.v1";
const VERSION_CONFIG = 3;
const VERSION_ENLACE = 3;

// Distribución sugerida: 50/30/20 (necesidades/deseos/ahorro).
// Cada categoría puede ser:
//   modo "porcentaje" -> su monto = ingreso * porcentaje / 100
//   modo "fijo"       -> su monto es exacto, no cambia con el ingreso.
//                        Si es del grupo "ahorro" y monedaMonto es "USD",
//                        el monto se escribe en dólares y se convierte a
//                        pesos con la cotización del día.
const CATEGORIAS_POR_DEFECTO = [
  { id: "vivienda",   nombre: "Vivienda / alquiler",             grupo: "necesidad", modo: "porcentaje", porcentaje: 25, monto: 0, monedaMonto: "ARS" },
  { id: "comida",     nombre: "Comida y super",                  grupo: "necesidad", modo: "porcentaje", porcentaje: 15, monto: 0, monedaMonto: "ARS" },
  { id: "transporte", nombre: "Transporte (colectivo, auto)",    grupo: "necesidad", modo: "porcentaje", porcentaje: 10, monto: 0, monedaMonto: "ARS" },
  { id: "ocio",       nombre: "Ocio y planes",                   grupo: "deseo",     modo: "porcentaje", porcentaje: 15, monto: 0, monedaMonto: "ARS" },
  { id: "compras",    nombre: "Compras personales",              grupo: "deseo",     modo: "porcentaje", porcentaje: 15, monto: 0, monedaMonto: "ARS" },
  { id: "ahorro",     nombre: "Ahorro",                          grupo: "ahorro",    modo: "porcentaje", porcentaje: 15, monto: 0, monedaMonto: "ARS" },
  { id: "emergencia", nombre: "Fondo de emergencia",             grupo: "ahorro",    modo: "porcentaje", porcentaje: 5,  monto: 0, monedaMonto: "ARS" },
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
  { nombre: "Ahorro en dólares",                      grupo: "ahorro",    modo: "fijo" },
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

// Tipos de dólar publicados por dolarapi.com (se usan para el ahorro en USD).
const DOLARES = [
  { id: "bolsa",   nombre: "Bolsa (MEP)" },
  { id: "blue",    nombre: "Blue" },
  { id: "oficial", nombre: "Oficial" },
  { id: "cripto",  nombre: "Cripto" },
  { id: "tarjeta", nombre: "Tarjeta" },
];

function nombreDolar(id) {
  const d = DOLARES.filter(function (x) { return x.id === id; })[0];
  return d ? d.nombre : "Dólar";
}

/* Perfiles de reparto: pesos por grupo (necesidades / deseos / ahorro) que
   van del que más gasta al más cauto. La app los usa para repartir los
   porcentajes en un toque y para detectar el perfil actual del usuario. */
const PERFILES = [
  { id: "gastador",    nombre: "Gastador",    emoji: "🎈", grupos: { necesidad: 60, deseo: 30, ahorro: 10 } },
  { id: "equilibrado", nombre: "Equilibrado", emoji: "⚖️", grupos: { necesidad: 50, deseo: 30, ahorro: 20 } },
  { id: "conservador", nombre: "Conservador", emoji: "🛡️", grupos: { necesidad: 45, deseo: 25, ahorro: 30 } },
  { id: "cauto",       nombre: "Cauto",       emoji: "🏦", grupos: { necesidad: 40, deseo: 20, ahorro: 40 } },
];

function configVacia() {
  return {
    version: VERSION_CONFIG,
    moneda: "ARS",
    dolarTipo: "bolsa",
    objetivo: "equilibrado",
    // Plan de evolucion: distribucion de partida y cuantos pasos ya se aplicaron.
    planBase: null,
    planPaso: 0,
    categorias: CATEGORIAS_POR_DEFECTO.map(function (c) {
      return {
        id: c.id,
        nombre: c.nombre,
        grupo: c.grupo,
        modo: c.modo,
        porcentaje: c.porcentaje,
        monto: c.monto,
        monedaMonto: c.monedaMonto || "ARS",
      };
    }),
  };
}

/* Migra configs viejas (sin "modo" / "monedaMonto") a la estructura actual. */
function migrarConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return cfg;
  cfg.version = VERSION_CONFIG;
  if (typeof cfg.moneda !== "string" || !MONEDAS.some(function (m) { return m.codigo === cfg.moneda; })) {
    cfg.moneda = "ARS";
  }
  if (typeof cfg.dolarTipo !== "string" || !DOLARES.some(function (d) { return d.id === cfg.dolarTipo; })) {
    cfg.dolarTipo = "bolsa";
  }
  if (typeof cfg.objetivo !== "string" || !PERFILES.some(function (p) { return p.id === cfg.objetivo; })) {
    cfg.objetivo = "equilibrado";
  }
  // Plan de evolucion: normaliza el punto de partida y el paso aplicado.
  const baseValida = cfg.planBase && typeof cfg.planBase === "object" &&
    ["necesidad", "deseo", "ahorro"].every(function (g) {
      return isFinite(Number(cfg.planBase[g]));
    });
  cfg.planBase = baseValida
    ? {
        necesidad: Number(cfg.planBase.necesidad) || 0,
        deseo: Number(cfg.planBase.deseo) || 0,
        ahorro: Number(cfg.planBase.ahorro) || 0,
      }
    : null;
  const paso = Math.round(Number(cfg.planPaso));
  cfg.planPaso = cfg.planBase && isFinite(paso) && paso > 0 ? paso : 0;
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
      monedaMonto: c.monedaMonto === "USD" ? "USD" : "ARS",
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

/* ---------- Cotizacion del dolar (cache por tipo) ----------
   Guarda la ultima cotizacion vista para cada tipo de dolar, asi
   la app funciona sin conexion con el ultimo valor conocido. */

function cargarCotizaciones() {
  try {
    const crudo = localStorage.getItem(CLAVE_COTIZACION);
    const mapa = crudo ? JSON.parse(crudo) : {};
    return mapa && typeof mapa === "object" ? mapa : {};
  } catch (_) {
    return {};
  }
}

function guardarCotizacion(cot) {
  try {
    const mapa = cargarCotizaciones();
    mapa[cot.tipo] = { valor: cot.valor, fecha: cot.fecha, fuente: cot.fuente };
    localStorage.setItem(CLAVE_COTIZACION, JSON.stringify(mapa));
  } catch (_) {
    /* sin persistencia: la app sigue con el valor en memoria */
  }
}

function cotizacionGuardada(tipo) {
  const entrada = cargarCotizaciones()[tipo];
  if (!entrada || !(Number(entrada.valor) > 0)) return null;
  return { tipo: tipo, valor: Number(entrada.valor), fecha: entrada.fecha || null, fuente: entrada.fuente || null };
}

/* ---------- Historial mensual ----------
   Guarda un registro por mes ("YYYY-MM") con el reparto de ese momento,
   para ver la evolucion y el perfil a lo largo del tiempo. */

function cargarHistorial() {
  try {
    const crudo = localStorage.getItem(CLAVE_HISTORIAL);
    const lista = crudo ? JSON.parse(crudo) : [];
    if (!Array.isArray(lista)) return [];
    return lista.filter(function (r) {
      return r && typeof r.mes === "string" && /^\d{4}-\d{2}$/.test(r.mes);
    });
  } catch (_) {
    return [];
  }
}

function guardarHistorial(lista) {
  try {
    localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(lista));
  } catch (_) {
    /* sin persistencia */
  }
}

/* Guarda (o reemplaza) el registro de un mes y devuelve la lista ordenada. */
function guardarMesHistorial(registro) {
  const lista = cargarHistorial().filter(function (r) { return r.mes !== registro.mes; });
  lista.push(registro);
  lista.sort(function (a, b) { return a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0; });
  guardarHistorial(lista);
  return lista;
}

function borrarMesHistorial(mes) {
  const lista = cargarHistorial().filter(function (r) { return r.mes !== mes; });
  guardarHistorial(lista);
  return lista;
}

/* ---------- Enlace compartible ----------
   Codifica la configuracion en el hash de la URL (#c=...).
   v3: [nombre, grupo, modo, porcentaje, monto, monedaMonto]
   v2 (compat): [nombre, grupo, modo, porcentaje, monto]
   v1 (compat): [nombre, grupo, porcentaje] */

function crearEnlace(cfg) {
  const compacta = cfg.categorias.map(function (c) {
    return [
      c.nombre,
      c.grupo,
      c.modo === "fijo" ? "fijo" : "porcentaje",
      Number(c.porcentaje) || 0,
      Number(c.monto) || 0,
      c.monedaMonto === "USD" ? "USD" : "ARS",
    ];
  });
  const crudo = JSON.stringify({
    v: VERSION_ENLACE,
    m: cfg.moneda,
    d: cfg.dolarTipo || "bolsa",
    c: compacta,
  });
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
    const version = Number(datos.v || 1);

    const categorias = datos.c.map(function (item, i) {
      if (!Array.isArray(item)) return null;
      const grupo = ["necesidad", "deseo", "ahorro"].indexOf(item[1]) !== -1 ? item[1] : "necesidad";
      if (version >= 2 && item.length >= 5) {
        return {
          id: "compartida_" + i,
          nombre: String(item[0]),
          grupo: grupo,
          modo: item[2] === "fijo" ? "fijo" : "porcentaje",
          porcentaje: Number(item[3]) || 0,
          monto: Number(item[4]) || 0,
          monedaMonto: version >= 3 && item[5] === "USD" ? "USD" : "ARS",
        };
      }
      return {
        id: "compartida_" + i,
        nombre: String(item[0]),
        grupo: grupo,
        modo: "porcentaje",
        porcentaje: Number(item[2]) || 0,
        monto: 0,
        monedaMonto: "ARS",
      };
    }).filter(function (c) { return c !== null; });

    const cfg = {
      version: VERSION_CONFIG,
      moneda: MONEDAS.some(function (m) { return m.codigo === datos.m; }) ? datos.m : "ARS",
      dolarTipo: DOLARES.some(function (d) { return d.id === datos.d; }) ? datos.d : "bolsa",
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

/* ---------- Tour guiado de primera vez ----------
   Se muestra una sola vez: mientras el usuario no tenga ningun mes
   guardado en el historial. Se marca como visto al terminar el tour,
   al saltarlo, o al guardar el primer mes. */

function tourVisto() {
  try {
    return localStorage.getItem(CLAVE_TOUR) === "visto";
  } catch (_) {
    return false;
  }
}

function marcarTourVisto() {
  try {
    localStorage.setItem(CLAVE_TOUR, "visto");
  } catch (_) {
    /* sin persistencia */
  }
}

function olvidarTour() {
  try {
    localStorage.removeItem(CLAVE_TOUR);
  } catch (_) {
    /* sin persistencia */
  }
}
