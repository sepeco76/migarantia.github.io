"use strict";
// Mi garantía · v0.2 · Los datos se guardan solo en el móvil (IndexedDB).
const VERSION = "0.2";

// ================= Catálogos =================
const CATEGORIAS = {
  "Electrodomésticos":         { color: "#E1F5EE", emoji: "🧺" },
  "Electrónica e informática": { color: "#EEEDFE", emoji: "📺" },
  "Muebles y hogar":           { color: "#F1EFE8", emoji: "🛋️" },
  "Ocio y deporte":            { color: "#FBEAF0", emoji: "🎿" },
  "Vehículos":                 { color: "#E6F1FB", emoji: "🏍️" },
  "Otros":                     { color: "#F1EFE8", emoji: "📦" }
};
const EMOJIS_TIPO = [
  [/lavadora|secadora/, "🧺"], [/nevera|frigor|congelador/, "🧊"], [/horno|microondas|placa|campana|vitro/, "🍳"],
  [/lavavajillas/, "🍽️"], [/tele|tv|televisor/, "📺"], [/m[oó]vil|tel[eé]fono|smartphone/, "📱"],
  [/port[aá]til|ordenador|pc\b|tablet|monitor/, "💻"], [/impresora/, "🖨️"], [/moto/, "🏍️"], [/coche/, "🚗"],
  [/bici/, "🚲"], [/silla|sof[aá]|mueble|mesa|cama|armario|cocina/, "🛋️"], [/aspirador/, "🧹"], [/esqu[ií]/, "🎿"],
  [/cafetera/, "☕"], [/reloj/, "⌚"], [/auricular|altavoz|barra de sonido/, "🎧"]
];
const CLASES_DOC = ["Ticket o factura", "Garantía", "Manual", "Póliza de seguro", "Otro"];
const MOTIVOS_BAJA = ["Avería sin reparar", "Reparación no compensa", "Sin recambios", "Sustituido por uno mejor", "Otro"];
const DESTINOS_BAJA = ["Punto limpio", "Retirado por la tienda", "Vendido", "Regalado o donado", "Otro"];
const ICONO_TIPO = { garantia: "🛡️", seguro: "☂️", mantenimiento: "🔧", tarea: "📝" };

// ================= Base de datos =================
let db;
function abrirBD() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open("migarantia", 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("productos")) d.createObjectStore("productos", { keyPath: "id" });
      if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs", { keyPath: "id" }).createIndex("pid", "pid");
    };
    r.onsuccess = () => {
      db = r.result;
      // Si otra ventana necesita actualizar la base de datos, esta se cierra y recarga.
      db.onversionchange = () => { db.close(); location.reload(); };
      ok();
    };
    r.onerror = () => mal(r.error);
    r.onblocked = () => {
      app.innerHTML = `<div class="aviso"><b>Hay otra ventana de Mi garantía abierta con una versión anterior.</b><br>
        Cierra las pestañas de migarantia.github.io en el navegador y la app (desde “aplicaciones recientes”), y vuelve a abrirla. Tus datos no se pierden.</div>`;
    };
  });
}
function peticion(r) { return new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); }); }
function almacen(nombre, modo) { return db.transaction(nombre, modo).objectStore(nombre); }
const BD = {
  productos: () => peticion(almacen("productos", "readonly").getAll()),
  producto: (id) => peticion(almacen("productos", "readonly").get(id)),
  guardar: (p) => peticion(almacen("productos", "readwrite").put(p)),
  borrar: (id) => peticion(almacen("productos", "readwrite").delete(id)),
  docs: (pid) => peticion(almacen("docs", "readonly").index("pid").getAll(pid)),
  todosDocs: () => peticion(almacen("docs", "readonly").getAll()),
  doc: (id) => peticion(almacen("docs", "readonly").get(id)),
  guardarDoc: (d) => peticion(almacen("docs", "readwrite").put(d)),
  borrarDoc: (id) => peticion(almacen("docs", "readwrite").delete(id))
};

// ================= Utilidades =================
const $ = (s) => document.querySelector(s);
const app = $("#app");
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function nuevoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function hoy() { const d = new Date(); d.setHours(12, 0, 0, 0); return d; }
function aFecha(s) { return s ? new Date(s + "T12:00:00") : null; }
function aTexto(d) { return d ? d.toISOString().slice(0, 10) : ""; }
function sumarMeses(d, m) { const r = new Date(d); r.setMonth(r.getMonth() + Number(m)); return r; }
function sumarDias(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function dias(d) { return Math.round((d - hoy()) / 86400000); }
function fmt(d) { return d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"; }
function fmtCorta(d) { return d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "–"; }
function nombre(p) { return [p.tipo, p.marca].filter(Boolean).join(" ") + (p.apodo ? " · " + p.apodo : ""); }
function emojiDe(p) { const t = (p.tipo || "").toLowerCase(); for (const [re, e] of EMOJIS_TIPO) if (re.test(t)) return e; return (CATEGORIAS[p.categoria] || CATEGORIAS.Otros).emoji; }
function colorDe(p) { return (CATEGORIAS[p.categoria] || CATEGORIAS.Otros).color; }
function avatar(p, insignia) { return `<div class="avatar" style="background:${colorDe(p)}">${emojiDe(p)}${insignia ? `<span class="insignia">${insignia}</span>` : ""}</div>`; }
function aviso(texto) { const t = document.createElement("div"); t.className = "toast"; t.textContent = texto; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
function telLink(t) { return t ? `<a class="mini" href="tel:${esc(t.replace(/\s/g, ""))}">📞</a>` : ""; }
function descargar(nombreArchivo, contenido, tipo) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  a.download = nombreArchivo; document.body.appendChild(a); a.click(); a.remove();
}

// ================= Reglas de negocio =================
// Garantía legal en España: 3 años desde la entrega (compras desde 1/1/2022); 2 años antes.
function fechaBase(p) { return aFecha(p.entrega || p.compra); }
function finLegal(p) {
  const b = fechaBase(p); if (!b) return null;
  const d = new Date(b); d.setFullYear(d.getFullYear() + (b >= new Date("2022-01-01T00:00:00") ? 3 : 2)); return d;
}
function finExtra(p) {
  const g = p.garantiaExtra; const b = fechaBase(p);
  if (!g || !g.anios || !b) return null;
  return sumarMeses(b, Math.round(Number(g.anios) * 12));
}
function seguroVigente(p) {
  const s = p.seguro; if (!s || s.estado === "esperando") return false;
  const f = aFecha(s.fin); return !f || dias(f) >= 0 || s.renuevaSolo;
}
function estadoGarantia(p) {
  const fl = finLegal(p), fe = finExtra(p);
  if (fl && dias(fl) >= 0) return "completa";
  if (fe && dias(fe) >= 0) return p.garantiaExtra.cubre ? "parcial" : "completa";
  return "sin";
}
function proximoMantenimiento(p, m) {
  const base = aFecha(m.ultimo) || fechaBase(p) || hoy();
  return sumarMeses(base, m.cadaMeses || 12);
}
// Todo lo que tiene fecha o está pendiente para un producto.
function eventos(p) {
  const ev = [];
  const fl = finLegal(p);
  if (fl && dias(fl) >= 0) ev.push({ id: "legal", tipo: "garantia", accion: "Fin de la garantía legal", fecha: fl, quien: p.tienda });
  const fe = finExtra(p);
  if (fe && dias(fe) >= 0) ev.push({ id: "extra", tipo: "garantia", accion: "Fin de la garantía del fabricante" + (p.garantiaExtra.cubre ? " (" + p.garantiaExtra.cubre + ")" : ""), fecha: fe });
  const s = p.seguro;
  if (s) {
    if (s.estado === "esperando") ev.push({ id: "seguro-activar", tipo: "seguro", accion: "Activar seguro o recibir póliza", fecha: sumarDias(aFecha(s.desde) || aFecha(p.compra) || hoy(), 7), accionable: true, esperando: true });
    else if (s.fin) ev.push({ id: "seguro-fin", tipo: "seguro", accion: s.renuevaSolo ? "Se renueva el seguro: decide si das de baja" : "Fin del seguro", fecha: aFecha(s.fin), contacto: s.contacto });
  }
  (p.mantenimientos || []).forEach((m) => ev.push({ id: "m-" + m.id, tipo: "mantenimiento", accion: m.tarea, fecha: proximoMantenimiento(p, m), accionable: true, ref: m.id }));
  (p.tareas || []).filter((t) => !t.hecha).forEach((t) => ev.push({ id: "t-" + t.id, tipo: "tarea", accion: t.texto, fecha: aFecha(t.fecha), accionable: true, ref: t.id, esperando: t.esperando }));
  return ev;
}
function claseUrgencia(ev) {
  if (!ev.fecha) return "";
  const d = dias(ev.fecha);
  if (d < 0) return "vencido";
  if (d <= 30) return "urgente";
  return "";
}
function ordenarEventos(a, b) { return (a.fecha ? a.fecha.getTime() : hoy().getTime() + 1) - (b.fecha ? b.fecha.getTime() : hoy().getTime() + 1); }

// ================= Navegación =================
const pantallas = {};
let rutaActual = "";
function ir(ruta) { if (location.hash === ruta) render(); else location.hash = ruta; }
window.addEventListener("hashchange", render);
$("#volver").onclick = () => history.length > 1 ? history.back() : ir("#/");
$("#ajustes").onclick = () => ir("#/ajustes");
$("#fab").onclick = () => ir("#/nueva");

function marco(titulo, { volver = false, fab = false, nav = true, ajustes = false, seccion = "" } = {}) {
  $("#tituloPantalla").textContent = titulo;
  $("#volver").hidden = !volver;
  $("#ajustes").hidden = !ajustes;
  $("#fab").hidden = !fab;
  $("#nav").hidden = !nav;
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("activo", a.dataset.ruta === seccion));
}

async function render() {
  const partes = (location.hash || "#/").slice(2).split("/");
  const [nombrePantalla, arg] = [partes[0] || "inicio", partes[1]];
  rutaActual = nombrePantalla;
  window.scrollTo(0, 0);
  const f = pantallas[nombrePantalla] || pantallas.inicio;
  try { await f(arg ? decodeURIComponent(arg) : undefined); }
  catch (e) { console.error(e); app.innerHTML = `<div class="aviso">Algo ha fallado: ${esc(e.message)}</div>`; }
}

// ================= Pantalla: Inicio =================
let filtroTexto = "", filtroCategoria = "";
pantallas.inicio = async () => {
  marco("Mi garantía", { fab: true, ajustes: true, seccion: "inicio" });
  const productos = (await BD.productos()).filter((p) => !p.baja);
  productos.forEach((p) => { p._ev = eventos(p).filter((e) => e.fecha).sort(ordenarEventos)[0]; });
  productos.sort((a, b) => (a._ev ? a._ev.fecha : Infinity) - (b._ev ? b._ev.fecha : Infinity));
  const categoriasUsadas = [...new Set(productos.map((p) => p.categoria))];
  const visibles = productos.filter((p) =>
    (!filtroCategoria || p.categoria === filtroCategoria) &&
    (nombre(p) + " " + (p.modelo || "") + " " + (p.tienda || "")).toLowerCase().includes(filtroTexto.toLowerCase()));

  let h = `<input class="buscador" id="buscar" type="search" placeholder="Buscar producto…" value="${esc(filtroTexto)}">`;
  if (categoriasUsadas.length > 1) {
    h += `<div class="chips"><button class="chip ${!filtroCategoria ? "on" : ""}" data-cat="">Todos</button>` +
      categoriasUsadas.map((c) => `<button class="chip ${filtroCategoria === c ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("") + `</div>`;
  }
  if (!productos.length) {
    h += `<div class="vacio"><div class="grande">🧾</div><p><b>Registra tu primera compra</b></p><p>Pulsa “Nueva compra” y guarda sus datos y fotos. Sus garantías quedarán siempre a mano.</p></div>`;
  } else if (!visibles.length) {
    h += `<div class="vacio">No hay productos que coincidan.</div>`;
  } else {
    h += `<div class="lista">` + visibles.map((p) => {
      const ev = p._ev;
      const sub = ev ? `${esc(ev.accion)} · ${fmt(ev.fecha)}` : "–";
      return `<div class="item click" data-id="${p.id}">
        <div class="estado"><span class="punto ${estadoGarantia(p)}"></span><span class="paraguas ${seguroVigente(p) ? "on" : ""}">☂️</span></div>
        ${avatar(p)}
        <div class="texto"><div class="titulo">${esc(nombre(p))}</div><div class="sub ${ev ? claseUrgencia(ev) : ""}">${sub}</div></div>
      </div>`;
    }).join("") + `</div>`;
  }
  h += `<div class="pie">Tus datos se guardan solo en este móvil · v${VERSION}</div>`;
  app.innerHTML = h;
  const b = $("#buscar");
  b.oninput = () => { filtroTexto = b.value; const pos = b.selectionStart; pantallas.inicio().then(() => { const n = $("#buscar"); n.focus(); n.setSelectionRange(pos, pos); }); };
  app.querySelectorAll("[data-cat]").forEach((c) => c.onclick = () => { filtroCategoria = c.dataset.cat; pantallas.inicio(); });
  app.querySelectorAll(".item[data-id]").forEach((el) => el.onclick = () => ir("#/ficha/" + el.dataset.id));
};

// ================= Pantalla: Agenda =================
let filtroTipo = "", filtroProducto = "";
pantallas.agenda = async () => {
  marco("Agenda", { seccion: "agenda" });
  const productos = (await BD.productos()).filter((p) => !p.baja);
  let todos = [];
  productos.forEach((p) => eventos(p).forEach((e) => todos.push({ ...e, p })));
  const lista = todos.filter((e) => (!filtroTipo || e.tipo === filtroTipo) && (!filtroProducto || e.p.id === filtroProducto)).sort(ordenarEventos);
  const grupos = [["atrasado", "Atrasado"], ["mes", "Este mes y sin fecha"], ["tres", "Próximos 3 meses"], ["luego", "Más adelante"]];
  const grupoDe = (e) => { if (!e.fecha) return "mes"; const d = dias(e.fecha); return d < 0 ? "atrasado" : d <= 30 ? "mes" : d <= 90 ? "tres" : "luego"; };
  const tipos = [["", "Todo"], ["seguro", "Seguros"], ["garantia", "Garantías"], ["mantenimiento", "Mantenimiento"], ["tarea", "Tareas"]];
  let h = `<div class="chips">` + tipos.map(([v, t]) => `<button class="chip ${filtroTipo === v ? "on" : ""}" data-tipo="${v}">${t}</button>`).join("") + `</div>`;
  h += `<select id="filtroProducto" style="margin-bottom:6px"><option value="">Producto: todos</option>` +
    productos.map((p) => `<option value="${p.id}" ${filtroProducto === p.id ? "selected" : ""}>${esc(nombre(p))}</option>`).join("") + `</select>`;
  if (!lista.length) h += `<div class="vacio"><div class="grande">📅</div><p>No hay nada pendiente con estos filtros.</p></div>`;
  for (const [g, titulo] of grupos) {
    const items = lista.filter((e) => grupoDe(e) === g);
    if (!items.length) continue;
    h += `<div class="grupo ${g}">${titulo}</div><div class="lista">` + items.map((e) => `
      <div class="item">
        <div class="click" data-ficha="${e.p.id}">${avatar(e.p, ICONO_TIPO[e.tipo])}</div>
        <div class="texto click" data-ficha="${e.p.id}"><div class="titulo">${esc(e.accion)}</div><div class="sub">${esc(nombre(e.p))}</div></div>
        <div class="fecha ${claseUrgencia(e)}">${e.esperando ? "esperando" : e.fecha ? fmtCorta(e.fecha) : "–"}</div>
        ${e.accionable ? `<button class="mini" data-hecho="${e.p.id}|${e.id}" aria-label="Hecho">✓</button>` : ""}
      </div>`).join("") + `</div>`;
  }
  if (todos.some((e) => e.fecha)) h += `<button class="boton" id="ics">📅 Exportar todo al calendario (.ics)</button><div class="pie">Crea avisos 30 días antes de cada vencimiento de garantía o seguro.</div>`;
  app.innerHTML = h;
  app.querySelectorAll("[data-tipo]").forEach((c) => c.onclick = () => { filtroTipo = c.dataset.tipo; pantallas.agenda(); });
  $("#filtroProducto").onchange = (e) => { filtroProducto = e.target.value; pantallas.agenda(); };
  app.querySelectorAll("[data-ficha]").forEach((el) => el.onclick = () => ir("#/ficha/" + el.dataset.ficha));
  app.querySelectorAll("[data-hecho]").forEach((b) => b.onclick = async () => { const [pid, eid] = b.dataset.hecho.split("|"); await marcarHecho(pid, eid); pantallas.agenda(); });
  const ics = $("#ics"); if (ics) ics.onclick = () => exportarICS(todos);
};

async function marcarHecho(pid, eid) {
  const p = await BD.producto(pid);
  if (eid === "seguro-activar") { p.seguro.estado = "activo"; aviso("Seguro marcado como activo. Añade su fecha de fin."); }
  else if (eid.startsWith("m-")) {
    const m = p.mantenimientos.find((x) => "m-" + x.id === eid);
    m.historial = m.historial || []; m.historial.push(aTexto(hoy())); m.ultimo = aTexto(hoy());
    aviso("Hecho. Próxima vez: " + fmt(proximoMantenimiento(p, m)));
  } else if (eid.startsWith("t-")) {
    const t = p.tareas.find((x) => "t-" + x.id === eid); t.hecha = aTexto(hoy()); aviso("Tarea completada");
  }
  await BD.guardar(p);
}

// ================= Calendario =================
function eventoAviso(e) {
  // Garantías y seguros: el aviso se pone 30 días antes. Mantenimientos y tareas: el mismo día.
  const antes = (e.tipo === "garantia" || e.tipo === "seguro") && !e.esperando;
  const dia = antes ? sumarDias(e.fecha, -30) : e.fecha;
  const titulo = antes ? `${e.accion} el ${fmt(e.fecha)}: ${nombre(e.p)}` : `${e.accion}: ${nombre(e.p)}`;
  return { dia, titulo };
}
function enlaceGoogleCalendar(e) {
  const { dia, titulo } = eventoAviso(e);
  const f = (d) => aTexto(d).replace(/-/g, "");
  const det = `Mi garantía · ${nombre(e.p)}${e.contacto ? " · Contacto: " + e.contacto : ""}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${f(dia)}/${f(sumarDias(dia, 1))}&details=${encodeURIComponent(det)}`;
}
function exportarICS(evs) {
  const f = (d) => aTexto(d).replace(/-/g, "");
  const limpiar = (s) => String(s).replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const lineas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mi garantia//ES", "CALSCALE:GREGORIAN"];
  const sello = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  evs.filter((e) => e.fecha).forEach((e) => {
    const { dia, titulo } = eventoAviso(e);
    lineas.push("BEGIN:VEVENT", `UID:${e.p.id}-${e.id}@migarantia.github.io`, `DTSTAMP:${sello}`,
      `DTSTART;VALUE=DATE:${f(dia)}`, `DTEND;VALUE=DATE:${f(sumarDias(dia, 1))}`,
      `SUMMARY:${limpiar(titulo)}`, `DESCRIPTION:${limpiar("Mi garantía · " + nombre(e.p))}`, "END:VEVENT");
  });
  lineas.push("END:VCALENDAR");
  descargar("migarantia-avisos.ics", lineas.join("\r\n"), "text/calendar");
}

// ================= Pantalla: Ficha =================
pantallas.ficha = async (id) => {
  const p = await BD.producto(id);
  if (!p) return ir("#/");
  marco(nombre(p), { volver: true, nav: false });
  const docs = await BD.docs(id);
  const evs = eventos(p).map((e) => ({ ...e, p }));
  const pendientes = evs.filter((e) => e.tipo === "tarea" || e.id === "seguro-activar");
  const fl = finLegal(p), fe = finExtra(p);
  let h = `<div class="item" style="padding:4px 0 12px">${avatar(p)}<div class="texto"><div class="titulo" style="font-size:17px">${esc(nombre(p))}</div>
    <div class="sub">${esc([p.modelo, p.categoria, p.espacio].filter(Boolean).join(" · "))}</div>${p.baja ? `<div class="sub vencido">Dado de baja el ${fmt(aFecha(p.baja.fecha))}</div>` : ""}</div></div>`;

  if (p.baja) {
    const anios = ((aFecha(p.baja.fecha) - fechaBase(p)) / (365.25 * 86400000));
    h += `<div class="seccion"><h2>Conclusión</h2>
      <div class="fila"><span>Duración</span><span class="valor">${isFinite(anios) ? anios.toFixed(1).replace(".", ",") + " años" : "–"}</span></div>
      <div class="fila"><span>Motivo</span><span class="valor">${esc(p.baja.motivo)}</span></div>
      <div class="fila"><span>Destino</span><span class="valor">${esc(p.baja.destino || "–")}</span></div>
      ${(p.averias || []).length ? `<div class="fila"><span>Averías</span><span class="valor">${p.averias.length}</span></div>` : ""}
      ${p.precio && isFinite(anios) && anios > 0 ? `<div class="fila"><span>Coste por año</span><span class="valor">${Math.round((Number(String(p.precio).replace(",", ".")) + (p.averias || []).reduce((s, a) => s + (Number(String(a.coste || 0).replace(",", ".")) || 0), 0)) / anios)} €</span></div>` : ""}
      </div><button class="boton" id="reactivar">Volver a activar</button>`;
  }

  if (!p.baja && pendientes.length) {
    h += `<div class="seccion"><h2>Pendientes</h2>` + pendientes.map((e) => `<div class="fila"><span style="color:var(--text)">${esc(e.accion)}<br><small class="${claseUrgencia(e)}">${e.esperando ? "Esperando" : e.fecha ? fmt(e.fecha) : "Sin fecha"}</small></span><button class="mini" data-hecho="${e.id}">✓ Hecho</button></div>`).join("") + `</div>`;
  }

  if (!p.baja) h += `<button class="primario" id="falla" style="margin:0 0 12px">🔧 Algo falla</button><div id="panelFalla"></div>`;

  h += `<div class="seccion"><h2>Coberturas</h2>
    <div class="fila"><span>Garantía legal</span><span class="valor ${fl && dias(fl) < 0 ? "vencido" : ""}">${fl ? (dias(fl) >= 0 ? "hasta " : "terminó ") + fmt(fl) : "falta la fecha"}</span></div>`;
  if (fe) h += `<div class="fila"><span>Garantía fabricante${p.garantiaExtra.cubre ? "<br><small>" + esc(p.garantiaExtra.cubre) + "</small>" : ""}</span><span class="valor ${dias(fe) < 0 ? "vencido" : ""}">hasta ${fmt(fe)}</span></div>`;
  if (p.seguro) {
    const s = p.seguro;
    h += `<div class="fila"><span>Seguro${s.aseguradora ? "<br><small>" + esc(s.aseguradora) + "</small>" : ""}</span><span class="valor">${s.estado === "esperando" ? "pendiente de activar" : s.fin ? (s.renuevaSolo ? "se renueva el " : "hasta ") + fmt(aFecha(s.fin)) : "activo"}</span></div>`;
    if (s.renuevaSolo && s.coste) h += `<div class="fila"><span>Coste al renovar</span><span class="valor">${esc(s.coste)} €</span></div>`;
    if (s.contacto) h += `<div class="fila"><span>Darse de baja</span><span class="valor">${esc(s.contacto)}</span></div>`;
    if (s.cubre) h += `<div class="fila"><span>Qué cubre</span><span class="valor">${esc(s.cubre)}</span></div>`;
  } else h += `<div class="fila"><span>Seguro</span><span class="valor">No tiene</span></div>`;
  const avisables = evs.filter((e) => e.fecha && (e.tipo === "garantia" || e.tipo === "seguro") && !e.esperando);
  if (!p.baja && avisables.length) h += avisables.map((e) => `<a class="boton" target="_blank" rel="noopener" href="${enlaceGoogleCalendar(e)}">📅 Aviso en Google Calendar: ${esc(e.accion.toLowerCase())}</a>`).join("");
  h += `</div>`;

  if ((p.mantenimientos || []).length) {
    h += `<div class="seccion"><h2>Mantenimiento</h2>` + p.mantenimientos.map((m) => `<div class="fila"><span style="color:var(--text)">${esc(m.tarea)}<br><small style="color:var(--muted)">Cada ${m.cadaMeses} meses · próxima ${fmt(proximoMantenimiento(p, m))}${(m.historial || []).length ? " · hecho " + m.historial.length + " veces" : ""}</small></span>${p.baja ? "" : `<button class="mini" data-hecho="m-${m.id}">✓ Hecho</button>`}</div>`).join("") + `</div>`;
  }

  h += `<div class="seccion"><h2>Documentos</h2>`;
  h += docs.length ? `<div class="docs">` + docs.map((d) => `<div class="doc" data-doc="${d.id}">${d.mime.startsWith("image/") ? `<img data-img="${d.id}" alt="">` : `<span class="pdf">📄</span>${esc(d.nombre)}`}<span class="etq">${esc(d.clase)}</span></div>`).join("") + `</div>` : `<p class="sub">Sin documentos. Añádelos desde “Editar”.</p>`;
  if (!p.baja) h += `<a class="boton" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent([p.marca, p.modelo || p.tipo, "manual instrucciones pdf español"].join(" "))}">🔎 Buscar el manual en internet</a>
    <div class="pie" style="text-align:left">Descarga el PDF y, desde las descargas del móvil, pulsa Compartir → Mi garantía (con la app instalada).</div>`;
  h += `</div>`;

  h += `<div class="seccion"><h2>Averías</h2>`;
  h += (p.averias || []).length ? p.averias.map((a, i) => `<div class="fila"><span style="color:var(--text)">${fmt(aFecha(a.fecha))} · ${esc(a.descripcion)}<br><small style="color:var(--muted)">${a.solucion ? esc(a.solucion) + (a.coste ? " · " + esc(a.coste) + " €" : "") : "Sin resolver"}</small></span>${a.solucion || p.baja ? "" : `<button class="mini" data-solucion="${i}">Resolver</button>`}</div>`).join("") : `<p class="sub">Sin averías registradas.</p>`;
  h += `</div>`;

  const filas = [["Tienda", p.tienda], ["Teléfono tienda", p.tiendaTel], ["Nº de pedido", p.pedido], ["Nº de serie", p.serie],
    ["Compra", p.compra && fmt(aFecha(p.compra))], ["Entrega", p.entrega && fmt(aFecha(p.entrega))], ["Precio", p.precio && p.precio + " €"],
    ["Teléfono fabricante", p.fabricanteTel], ["Notas", p.notas]].filter(([, v]) => v);
  h += `<div class="seccion"><h2>Datos de compra</h2>` + filas.map(([k, v]) => `<div class="fila"><span>${k}</span><span class="valor">${esc(v)}</span></div>`).join("") + `</div>`;

  h += `<div class="dosbotones"><button class="boton" id="editar">✏️ Editar</button>${p.baja ? `<button class="boton peligro" id="eliminar">Eliminar</button>` : `<button class="boton" id="baja">🗄️ Dar de baja</button>`}</div>`;
  app.innerHTML = h;

  // Imágenes de los documentos
  for (const d of docs) {
    const img = app.querySelector(`[data-img="${d.id}"]`);
    if (img) img.src = URL.createObjectURL(d.blob);
  }
  app.querySelectorAll("[data-doc]").forEach((el) => el.onclick = () => abrirDoc(docs.find((d) => d.id === el.dataset.doc)));
  app.querySelectorAll("[data-hecho]").forEach((b) => b.onclick = async () => { await marcarHecho(p.id, b.dataset.hecho); pantallas.ficha(p.id); });
  app.querySelectorAll("[data-solucion]").forEach((b) => b.onclick = async () => {
    const a = p.averias[Number(b.dataset.solucion)];
    const sol = prompt("¿Cómo se resolvió? (quién lo reparó, qué pieza…)"); if (!sol) return;
    a.solucion = sol; a.coste = prompt("Coste en € (vacío si fue gratis)") || "";
    await BD.guardar(p); pantallas.ficha(p.id);
  });
  $("#editar").onclick = () => ir("#/editar/" + p.id);
  if ($("#baja")) $("#baja").onclick = () => ir("#/baja/" + p.id);
  if ($("#reactivar")) $("#reactivar").onclick = async () => { delete p.baja; await BD.guardar(p); pantallas.ficha(p.id); };
  if ($("#eliminar")) $("#eliminar").onclick = () => eliminar(p);
  if ($("#falla")) $("#falla").onclick = () => panelFalla(p);
};

function panelFalla(p) {
  const pasos = [];
  const fl = finLegal(p), fe = finExtra(p);
  if (fl && dias(fl) >= 0) pasos.push(`<b>Garantía legal vigente.</b> Reclama primero a la tienda: <b>${esc(p.tienda || "donde lo compraste")}</b> ${telLink(p.tiendaTel)}`);
  if (fe && dias(fe) >= 0) pasos.push(`<b>Garantía del fabricante</b>${p.garantiaExtra.cubre ? " (" + esc(p.garantiaExtra.cubre) + ")" : ""}: contacta con <b>${esc(p.marca)}</b> ${telLink(p.fabricanteTel)}`);
  if (seguroVigente(p)) pasos.push(`<b>Seguro vigente</b>${p.seguro.aseguradora ? " con " + esc(p.seguro.aseguradora) : ""}. ${p.seguro.cubre ? "Cubre: " + esc(p.seguro.cubre) + "." : ""} ${p.seguro.contacto ? "Contacto: " + esc(p.seguro.contacto) : ""}`);
  if (!pasos.length) pasos.push(`<b>Sin garantía ni seguro.</b> Opciones: servicio técnico oficial de ${esc(p.marca)} ${telLink(p.fabricanteTel)}, un reparador de confianza, o repararlo tú buscando el recambio con el modelo <b>${esc(p.modelo || "–")}</b>. Los fabricantes deben tener recambios disponibles durante años después de dejar de fabricar un producto.`);
  const datos = [["Nº de pedido", p.pedido], ["Nº de serie", p.serie], ["Modelo", p.modelo], ["Fecha de compra", p.compra && fmt(aFecha(p.compra))]].filter(([, v]) => v);
  $("#panelFalla").innerHTML = `<div class="seccion"><h2>A quién llamar</h2>${pasos.map((x) => `<p style="margin:8px 0">${x}</p>`).join("")}
    ${datos.length ? `<h2>Datos que te pedirán</h2>` + datos.map(([k, v]) => `<div class="fila"><span>${k}</span><span class="valor">${esc(v)}<button class="copiar" data-copiar="${esc(v)}">Copiar</button></span></div>`).join("") : ""}
    <button class="boton" id="registrarAveria">📝 Registrar esta avería</button></div>`;
  $("#panelFalla").querySelectorAll("[data-copiar]").forEach((b) => b.onclick = () => navigator.clipboard.writeText(b.dataset.copiar).then(() => aviso("Copiado")));
  $("#registrarAveria").onclick = async () => {
    const d = prompt("¿Qué falla? (descríbelo en pocas palabras)"); if (!d) return;
    p.averias = p.averias || []; p.averias.push({ fecha: aTexto(hoy()), descripcion: d });
    await BD.guardar(p); aviso("Avería registrada"); pantallas.ficha(p.id);
  };
  $("#panelFalla").scrollIntoView({ behavior: "smooth" });
}

function abrirDoc(d) {
  if (!d) return;
  const url = URL.createObjectURL(d.blob);
  if (d.mime.startsWith("image/")) {
    const v = document.createElement("div"); v.className = "visor";
    v.innerHTML = `<button>Cerrar ✕</button><img src="${url}" alt="">`;
    v.onclick = () => v.remove(); document.body.appendChild(v);
  } else {
    const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener";
    if (window.matchMedia("(display-mode: standalone)").matches) a.download = d.nombre || "documento.pdf";
    document.body.appendChild(a); a.click(); a.remove();
  }
}

async function eliminar(p) {
  if (!confirm(`¿Eliminar ${nombre(p)}? Se borrarán la ficha y sus documentos. No se puede deshacer.\n\nSi ya no lo usas, es mejor “Dar de baja” para conservar su historial.`)) return;
  for (const d of await BD.docs(p.id)) await BD.borrarDoc(d.id);
  await BD.borrar(p.id); aviso("Eliminado"); ir("#/");
}

// ================= Pantalla: Dar de baja =================
pantallas.baja = async (id) => {
  const p = await BD.producto(id); if (!p) return ir("#/");
  marco("Dar de baja", { volver: true, nav: false });
  app.innerHTML = `<div class="info">${esc(nombre(p))} pasará a “Inactivos” con todo su historial, y la app calculará cuánto ha durado.</div>
    <form id="form" class="seccion">
      <label>Fecha de baja</label><input type="date" name="fecha" value="${aTexto(hoy())}" required>
      <label>Motivo</label><select name="motivo">${MOTIVOS_BAJA.map((m) => `<option>${m}</option>`).join("")}</select>
      <label>¿Qué has hecho con él?</label><select name="destino">${DESTINOS_BAJA.map((m) => `<option>${m}</option>`).join("")}</select>
      <button class="primario" type="submit">Dar de baja</button></form>`;
  $("#form").onsubmit = async (e) => {
    e.preventDefault(); p.baja = Object.fromEntries(new FormData(e.target)); await BD.guardar(p); aviso("Dado de baja"); ir("#/inactivos");
  };
};

// ================= Pantalla: Inactivos =================
pantallas.inactivos = async () => {
  marco("Inactivos", { seccion: "inactivos" });
  const lista = (await BD.productos()).filter((p) => p.baja).sort((a, b) => (b.baja.fecha || "").localeCompare(a.baja.fecha || ""));
  if (!lista.length) { app.innerHTML = `<div class="vacio"><div class="grande">🗄️</div><p>Aquí aparecerán los productos que des de baja, con cuánto duraron y por qué.</p></div>`; return; }
  app.innerHTML = `<div class="lista">` + lista.map((p) => {
    const anios = (aFecha(p.baja.fecha) - fechaBase(p)) / (365.25 * 86400000);
    return `<div class="item click" data-id="${p.id}">${avatar(p)}<div class="texto"><div class="titulo">${esc(nombre(p))}</div><div class="sub">${isFinite(anios) ? "Duró " + anios.toFixed(1).replace(".", ",") + " años · " : ""}${esc(p.baja.motivo)}</div></div></div>`;
  }).join("") + `</div>`;
  app.querySelectorAll("[data-id]").forEach((el) => el.onclick = () => ir("#/ficha/" + el.dataset.id));
};

// ================= Pantalla: Nueva compra / Editar =================
pantallas.nueva = () => formulario(null);
pantallas.editar = async (id) => formulario(await BD.producto(id));

async function formulario(p) {
  const editando = !!p;
  p = p || { id: nuevoId(), categoria: "Electrodomésticos", espacio: "Hogar", mantenimientos: [], tareas: [] };
  marco(editando ? "Editar" : "Nueva compra", { volver: true, nav: false });
  const activos = (await BD.productos()).filter((x) => !x.baja && x.id !== p.id);
  const docsExistentes = editando ? await BD.docs(p.id) : [];
  const docsNuevos = []; const docsBorrar = new Set();
  const g = p.garantiaExtra || {}; const s = p.seguro || {};
  const opt = (lista, actual) => lista.map((x) => `<option ${x === actual ? "selected" : ""}>${esc(x)}</option>`).join("");
  const v = (x) => esc(x || "");

  app.innerHTML = `<form id="form" novalidate>
  <div class="seccion"><h2>Producto</h2>
    <div class="dos"><div><label>Tipo de producto *</label><input name="tipo" value="${v(p.tipo)}" placeholder="Lavadora" required></div>
    <div><label>Marca *</label><input name="marca" value="${v(p.marca)}" placeholder="Miele" required></div></div>
    <div class="dos"><div><label>Modelo</label><input name="modelo" value="${v(p.modelo)}"></div>
    <div><label>Nº de serie</label><input name="serie" value="${v(p.serie)}"></div></div>
    <div class="dos"><div><label>Categoría</label><select name="categoria">${opt(Object.keys(CATEGORIAS), p.categoria)}</select></div>
    <div><label>Espacio</label><select name="espacio">${opt(["Hogar", "Personal"], p.espacio)}</select></div></div>
    <label>Apodo (solo si tienes dos iguales)</label><input name="apodo" value="${v(p.apodo)}">
  </div>

  <div class="seccion"><h2>Documentos</h2>
    <p class="sub" style="white-space:normal">Ticket, factura, garantía, póliza, manual… Fotos o PDF.</p>
    <div id="listaDocs"></div>
    <label class="anadir" style="display:block;text-align:center;color:var(--link)">📷 Añadir fotos o PDF<input id="archivos" type="file" accept="image/*,application/pdf" multiple hidden></label>
  </div>

  <div class="seccion"><h2>Compra</h2>
    <div class="dos"><div><label>Fecha de compra *</label><input name="compra" type="date" value="${v(p.compra)}" required></div>
    <div><label>Fecha de entrega</label><input name="entrega" type="date" value="${v(p.entrega)}"></div></div>
    <p class="sub" style="white-space:normal">La garantía legal cuenta desde la entrega.</p>
    <div class="dos"><div><label>Tienda</label><input name="tienda" value="${v(p.tienda)}"></div>
    <div><label>Teléfono tienda</label><input name="tiendaTel" type="tel" value="${v(p.tiendaTel)}"></div></div>
    <div class="dos"><div><label>Nº de pedido</label><input name="pedido" value="${v(p.pedido)}"></div>
    <div><label>Precio (€)</label><input name="precio" inputmode="decimal" value="${v(p.precio)}"></div></div>
    <label>Teléfono del fabricante / servicio técnico</label><input name="fabricanteTel" type="tel" value="${v(p.fabricanteTel)}">
  </div>

  <div class="seccion"><h2>Coberturas</h2>
    <p class="sub" style="white-space:normal">La garantía legal (3 años desde la entrega) se calcula sola.</p>
    <label class="check"><input type="checkbox" id="tieneExtra" ${p.garantiaExtra ? "checked" : ""}> Tiene garantía extra del fabricante</label>
    <div id="bloqueExtra" class="${p.garantiaExtra ? "" : "oculto"}">
      <div class="dos"><div><label>Años desde la entrega</label><input name="g_anios" inputmode="decimal" value="${v(g.anios)}" placeholder="25"></div>
      <div><label>Qué cubre (vacío = todo)</label><input name="g_cubre" value="${v(g.cubre)}" placeholder="Motor"></div></div>
    </div>
    <label class="check"><input type="checkbox" id="tieneSeguro" ${p.seguro ? "checked" : ""}> Tiene seguro</label>
    <div id="bloqueSeguro" class="${p.seguro ? "" : "oculto"}">
      <label>Estado</label><select name="s_estado"><option value="activo" ${s.estado !== "esperando" ? "selected" : ""}>Activo</option><option value="esperando" ${s.estado === "esperando" ? "selected" : ""}>Pendiente de activar o de recibir la póliza</option></select>
      <div class="dos"><div><label>Aseguradora</label><input name="s_aseguradora" value="${v(s.aseguradora)}"></div>
      <div><label>Fin o renovación</label><input name="s_fin" type="date" value="${v(s.fin)}"></div></div>
      <label class="check"><input type="checkbox" name="s_renuevaSolo" ${s.renuevaSolo ? "checked" : ""}> Se renueva solo (y se paga)</label>
      <div class="dos"><div><label>Coste al renovar (€)</label><input name="s_coste" inputmode="decimal" value="${v(s.coste)}"></div>
      <div><label>Contacto para darse de baja</label><input name="s_contacto" value="${v(s.contacto)}"></div></div>
      <label>Qué cubre</label><input name="s_cubre" value="${v(s.cubre)}">
    </div>
  </div>

  <div class="seccion"><h2>Mantenimiento</h2><div id="listaMant"></div><button type="button" class="anadir" id="anadirMant">＋ Añadir mantenimiento</button></div>
  <div class="seccion"><h2>Tareas pendientes</h2><p class="sub" style="white-space:normal">Ej.: rellenar la tarjeta de garantía, registrar el producto en la web de la marca.</p><div id="listaTareas"></div><button type="button" class="anadir" id="anadirTarea">＋ Añadir tarea</button></div>

  ${!editando && activos.length ? `<div class="seccion"><h2>¿Sustituye a otro producto?</h2><select name="sustituye"><option value="">No</option>${activos.map((x) => `<option value="${x.id}">${esc(nombre(x))}</option>`).join("")}</select><p class="sub" style="white-space:normal">El antiguo pasará a Inactivos.</p></div>` : ""}
  <div class="seccion"><h2>Notas</h2><textarea name="notas" rows="2">${v(p.notas)}</textarea></div>
  <div id="errores"></div>
  <button class="primario" type="submit">Guardar</button>
  ${editando ? `<button type="button" class="boton peligro" id="eliminar">Eliminar (registrado por error)</button>` : ""}
  </form>`;

  // Mostrar u ocultar bloques
  $("#tieneExtra").onchange = (e) => $("#bloqueExtra").classList.toggle("oculto", !e.target.checked);
  $("#tieneSeguro").onchange = (e) => $("#bloqueSeguro").classList.toggle("oculto", !e.target.checked);

  // Mantenimientos y tareas (listas repetibles)
  const mant = (p.mantenimientos || []).map((m) => ({ ...m }));
  const tareas = (p.tareas || []).filter((t) => !t.hecha).map((t) => ({ ...t }));
  const tareasHechas = (p.tareas || []).filter((t) => t.hecha);
  function pintarMant() {
    $("#listaMant").innerHTML = mant.map((m, i) => `<div class="repetible"><label>Tarea</label><input data-m="${i}" data-k="tarea" value="${v(m.tarea)}" placeholder="Limpiar el filtro">
      <div class="dos"><div><label>Cada (meses)</label><input data-m="${i}" data-k="cadaMeses" inputmode="numeric" value="${v(m.cadaMeses)}" placeholder="6"></div>
      <div><label>Última vez (opcional)</label><input data-m="${i}" data-k="ultimo" type="date" value="${v(m.ultimo)}"></div></div>
      <button type="button" class="quitar" data-quitar-m="${i}">Quitar</button></div>`).join("");
    $("#listaMant").querySelectorAll("[data-m]").forEach((el) => el.oninput = () => { mant[el.dataset.m][el.dataset.k] = el.value; });
    $("#listaMant").querySelectorAll("[data-quitar-m]").forEach((b) => b.onclick = () => { mant.splice(Number(b.dataset.quitarM), 1); pintarMant(); });
  }
  function pintarTareas() {
    $("#listaTareas").innerHTML = tareas.map((t, i) => `<div class="repetible"><label>Tarea</label><input data-t="${i}" data-k="texto" value="${v(t.texto)}" placeholder="Rellenar la tarjeta de garantía">
      <div class="dos"><div><label>Fecha límite (opcional)</label><input data-t="${i}" data-k="fecha" type="date" value="${v(t.fecha)}"></div>
      <div><label class="check" style="margin-top:30px"><input type="checkbox" data-t="${i}" data-k="esperando" ${t.esperando ? "checked" : ""}> Esperando a otros</label></div></div>
      <button type="button" class="quitar" data-quitar-t="${i}">Quitar</button></div>`).join("");
    $("#listaTareas").querySelectorAll("[data-t]").forEach((el) => el.oninput = el.onchange = () => { tareas[el.dataset.t][el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; });
    $("#listaTareas").querySelectorAll("[data-quitar-t]").forEach((b) => b.onclick = () => { tareas.splice(Number(b.dataset.quitarT), 1); pintarTareas(); });
  }
  $("#anadirMant").onclick = () => { mant.push({ id: nuevoId(), tarea: "", cadaMeses: "" }); pintarMant(); };
  $("#anadirTarea").onclick = () => { tareas.push({ id: nuevoId(), texto: "", fecha: "", esperando: false }); pintarTareas(); };
  pintarMant(); pintarTareas();

  // Documentos
  function pintarDocs() {
    const fila = (d, nuevo) => `<div class="docedit">${d.mime.startsWith("image/") ? `<img data-prev="${d.id}" alt="">` : `<span class="pdfmini">📄</span>`}
      <select data-clase="${d.id}" style="flex:1">${opt(CLASES_DOC, d.clase)}</select>
      <button type="button" class="quitar" data-borrar-doc="${d.id}" data-nuevo="${nuevo ? 1 : 0}">Quitar</button></div>`;
    $("#listaDocs").innerHTML = docsExistentes.filter((d) => !docsBorrar.has(d.id)).map((d) => fila(d, false)).join("") + docsNuevos.map((d) => fila(d, true)).join("");
    [...docsExistentes, ...docsNuevos].forEach((d) => { const im = app.querySelector(`[data-prev="${d.id}"]`); if (im) im.src = URL.createObjectURL(d.blob); });
    $("#listaDocs").querySelectorAll("[data-clase]").forEach((s) => s.onchange = () => { const d = [...docsExistentes, ...docsNuevos].find((x) => x.id === s.dataset.clase); d.clase = s.value; d._cambiado = true; });
    $("#listaDocs").querySelectorAll("[data-borrar-doc]").forEach((b) => b.onclick = () => {
      if (b.dataset.nuevo === "1") docsNuevos.splice(docsNuevos.findIndex((d) => d.id === b.dataset.borrarDoc), 1); else docsBorrar.add(b.dataset.borrarDoc);
      pintarDocs();
    });
  }
  $("#archivos").onchange = async (e) => {
    for (const f of e.target.files) {
      const blob = f.type.startsWith("image/") ? await comprimir(f) : f;
      const total = docsExistentes.length - docsBorrar.size + docsNuevos.length;
      docsNuevos.push({ id: nuevoId(), pid: p.id, nombre: f.name, mime: blob.type || f.type, clase: total === 0 ? "Ticket o factura" : f.type === "application/pdf" ? "Manual" : "Otro", blob, fecha: new Date().toISOString() });
    }
    e.target.value = ""; pintarDocs();
  };
  pintarDocs();

  if ($("#eliminar")) $("#eliminar").onclick = () => eliminar(p);

  $("#form").onsubmit = async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target));
    const faltan = [["tipo", "el tipo de producto"], ["marca", "la marca"], ["compra", "la fecha de compra"]].filter(([k]) => !String(datos[k] || "").trim()).map(([, t]) => t);
    if (faltan.length) { $("#errores").innerHTML = `<div class="aviso">Falta ${faltan.join(", ")}.</div>`; return; }
    for (const k of ["tipo", "marca", "modelo", "serie", "categoria", "espacio", "apodo", "compra", "entrega", "tienda", "tiendaTel", "pedido", "precio", "fabricanteTel", "notas"]) p[k] = String(datos[k] || "").trim();
    p.garantiaExtra = $("#tieneExtra").checked ? { anios: datos.g_anios.replace(",", "."), cubre: datos.g_cubre.trim() } : null;
    p.seguro = $("#tieneSeguro").checked ? { estado: datos.s_estado, aseguradora: datos.s_aseguradora.trim(), fin: datos.s_fin, renuevaSolo: !!datos.s_renuevaSolo,
      coste: datos.s_coste.trim(), contacto: datos.s_contacto.trim(), cubre: datos.s_cubre.trim(), desde: (p.seguro && p.seguro.desde) || aTexto(hoy()) } : null;
    p.mantenimientos = mant.filter((m) => String(m.tarea || "").trim()).map((m) => ({ ...m, tarea: m.tarea.trim(), cadaMeses: Number(m.cadaMeses) || 12 }));
    p.tareas = [...tareasHechas, ...tareas.filter((t) => String(t.texto || "").trim())];
    p.creado = p.creado || new Date().toISOString();
    p.modificado = new Date().toISOString();
    await BD.guardar(p);
    for (const id of docsBorrar) await BD.borrarDoc(id);
    for (const d of [...docsNuevos, ...docsExistentes.filter((x) => x._cambiado && !docsBorrar.has(x.id))]) { delete d._cambiado; await BD.guardarDoc(d); }
    if (datos.sustituye) {
      const viejo = await BD.producto(datos.sustituye);
      viejo.baja = { fecha: p.entrega || p.compra, motivo: "Sustituido", destino: "", sustitutoId: p.id };
      await BD.guardar(viejo);
      aviso(nombre(viejo) + " pasa a Inactivos");
    }
    history.replaceState(null, "", "#/ficha/" + p.id); render();
  };
}

// Reduce las fotos para que no ocupen demasiado (máx. 1600 px).
function comprimir(archivo) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      const factor = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * factor); c.height = Math.round(img.height * factor);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => ok(b || archivo), "image/jpeg", 0.82);
    };
    img.onerror = () => ok(archivo);
    img.src = URL.createObjectURL(archivo);
  });
}

// ================= Pantalla: Ajustes (copia de seguridad) =================
pantallas.ajustes = async () => {
  marco("Ajustes", { volver: true, nav: false });
  const n = (await BD.productos()).length, nd = (await BD.todosDocs()).length;
  let espacio = "";
  if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); espacio = `${(e.usage / 1048576).toFixed(1).replace(".", ",")} MB usados`; }
  const persistente = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  app.innerHTML = `<div class="seccion"><h2>Tus datos</h2>
      <div class="fila"><span>Productos</span><span class="valor">${n}</span></div>
      <div class="fila"><span>Documentos</span><span class="valor">${nd}</span></div>
      ${espacio ? `<div class="fila"><span>Espacio</span><span class="valor">${espacio}</span></div>` : ""}
      <div class="fila"><span>Protegidos ante limpiezas</span><span class="valor">${persistente ? "Sí" : "No"}</span></div>
      <p class="sub" style="white-space:normal">Todo se guarda solo en este móvil. Si lo pierdes o borras los datos de Chrome, solo podrás recuperarlo con una copia de seguridad.</p></div>
    <div class="seccion"><h2>Copia de seguridad</h2>
      <button class="boton" id="exportar">⬇️ Descargar copia (con documentos)</button>
      <label class="boton" style="margin-top:8px;color:var(--text)">⬆️ Restaurar desde una copia<input type="file" id="importar" accept="application/json,.json" hidden></label>
      <p class="sub" style="white-space:normal">Guarda la copia en Google Drive o envíatela por correo. Al restaurar se añaden los productos de la copia sin borrar los que ya tienes.</p></div>
    <div class="pie">Mi garantía v${VERSION}</div>`;
  $("#exportar").onclick = exportarCopia;
  $("#importar").onchange = (e) => importarCopia(e.target.files[0]);
};

function blobADataURL(b) { return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); }); }
async function exportarCopia() {
  aviso("Preparando copia…");
  const docs = await BD.todosDocs();
  const docsSerie = [];
  for (const d of docs) { const { blob, ...resto } = d; docsSerie.push({ ...resto, datos: await blobADataURL(blob) }); }
  const copia = { app: "migarantia", formato: 2, version: VERSION, exportado: new Date().toISOString(), productos: await BD.productos(), docs: docsSerie };
  descargar("migarantia-copia-" + aTexto(hoy()) + ".json", JSON.stringify(copia), "application/json");
}
async function importarCopia(archivo) {
  if (!archivo) return;
  try {
    const copia = JSON.parse(await archivo.text());
    if (copia.app !== "migarantia") throw new Error("Este archivo no es una copia de Mi garantía.");
    if (!confirm(`La copia tiene ${copia.productos.length} productos y ${(copia.docs || []).length} documentos. ¿Restaurar?`)) return;
    for (const p of copia.productos) await BD.guardar(p);
    for (const d of copia.docs || []) { const { datos, ...resto } = d; const blob = await (await fetch(datos)).blob(); await BD.guardarDoc({ ...resto, blob }); }
    aviso("Copia restaurada"); ir("#/");
  } catch (e) { alert("No se ha podido restaurar: " + e.message); }
}

// ================= Archivos compartidos desde otras apps (Android) =================
pantallas.compartido = async () => {
  marco("Adjuntar documento", { volver: false, nav: false });
  const cache = await caches.open("migarantia-compartidos");
  const claves = await cache.keys();
  if (!claves.length) return ir("#/");
  const productos = (await BD.productos()).filter((p) => !p.baja).sort((a, b) => nombre(a).localeCompare(nombre(b)));
  app.innerHTML = `<div class="info">Has compartido ${claves.length} archivo(s). ¿A qué producto los adjunto?</div>
    <div class="lista">${productos.map((p) => `<div class="item click" data-id="${p.id}">${avatar(p)}<div class="texto"><div class="titulo">${esc(nombre(p))}</div></div></div>`).join("")}</div>
    <button class="boton" id="cancelar">Cancelar</button>`;
  app.querySelectorAll("[data-id]").forEach((el) => el.onclick = async () => {
    for (const req of claves) {
      const r = await cache.match(req); const blob = await r.blob();
      const nombreArchivo = decodeURIComponent(r.headers.get("X-Nombre") || "documento");
      await BD.guardarDoc({ id: nuevoId(), pid: el.dataset.id, nombre: nombreArchivo, mime: blob.type || "application/pdf", clase: blob.type.startsWith("image/") ? "Otro" : "Manual", blob, fecha: new Date().toISOString() });
      await cache.delete(req);
    }
    aviso("Documento adjuntado"); history.replaceState(null, "", "#/ficha/" + el.dataset.id); render();
  });
  $("#cancelar").onclick = async () => { for (const req of claves) await cache.delete(req); ir("#/"); };
};

// ================= Arranque =================
abrirBD().then(() => {
  if (location.search.includes("compartido")) { history.replaceState(null, "", location.pathname + "#/compartido"); }
  render();
}).catch((e) => { app.innerHTML = `<div class="aviso">No se han podido abrir tus datos: ${esc(e && e.message)}</div>`; });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
