// ════════════════════════════════════════════════════════════════
//  CDC CRM · PARCHE DE INTEGRACIÓN GOOGLE SHEETS
//  Grupo Nuwek · v1.0 · Junio 2026
//
//  INSTRUCCIONES DE USO:
//  1. Abre tu index.html del portal CDC
//  2. Localiza la línea: function setText(id, v) {
//  3. Pega TODO este bloque ANTES de esa línea
//  4. Reemplaza TU_URL_EXEC con tu URL de Apps Script
//  5. Busca DOMContentLoaded y reemplaza las llamadas a render*()
//     por las versiones async que están al final de este archivo
//
//  PATRÓN CORS-FREE (del PDF Grupo Nuwek):
//  POST con URLSearchParams → x-www-form-urlencoded → sin preflight
// ════════════════════════════════════════════════════════════════

// ── 0. URL del Apps Script (ÚNICO lugar donde se configura) ──────
var GS_URL = 'https://script.google.com/macros/s/AKfycbx7mVTsCw2caBW7iipOjZGJwCtdNZcxGW_TXXKQinQaZfKKE5AHQMdku4uuzWe_r4II4Q/exec';

// ── 1. Helper universal de conexión ─────────────────────────────
//     Sin headers → sin preflight → sin error CORS
async function gs(action, data) {
  try {
    var res = await fetch(GS_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: action,
        data: JSON.stringify(data || {})
      })
      // ← SIN objeto headers. Crítico para evitar preflight.
    });
    return await res.json();
  } catch (err) {
    console.error('[CDC GS] Error en acción ' + action + ':', err);
    return { ok: false, error: err.toString() };
  }
}

// ── 2. Estado global (reemplaza los arrays demo) ─────────────────
var CDC = {
  leads:      [],   // desde Sheets → Leads
  clientes:   [],   // desde Sheets → Clientes (con .sesiones anidadas)
  actividades:[],   // desde Sheets → Actividades
  egresos:    [],   // desde Sheets → Egresos
  pagosFijos: [],   // desde Sheets → PagosFijos
  facturas:   [],   // desde Sheets → Facturas
  cargando:   false
};

// ── 3. Loader visual (muestra mientras carga Sheets) ─────────────
function mostrarLoader(visible) {
  var lo = document.getElementById('gs-loader');
  if (lo) lo.style.display = visible ? 'flex' : 'none';
}

function mostrarError(msg) {
  var el = document.getElementById('gs-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// ── 4. Carga inicial de todos los módulos ────────────────────────
async function cargarTodo() {
  mostrarLoader(true);
  try {
    var [rLeads, rClientes, rActs, rEg, rPF, rFact] = await Promise.all([
      gs('getLeads'),
      gs('getClientes'),
      gs('getActividades'),
      gs('getEgresos'),
      gs('getPagosFijos'),
      gs('getFacturas')
    ]);

    if (rLeads.ok)    CDC.leads = rLeads.data.map(function(l){
      // historial llega como JSON string desde Sheets → parsear a array
      if (typeof l.historial === 'string') {
        try { l.historial = JSON.parse(l.historial); } catch(_){ l.historial = []; }
      }
      if (!Array.isArray(l.historial)) l.historial = [];
      // temperatura en Sheets puede llamarse 'temperatura' pero app.js usa 'temp'
      if (l.temperatura !== undefined && l.temp === undefined) l.temp = l.temperatura;
      // celular → cel
      if (l.celular !== undefined && l.cel === undefined) l.cel = l.celular;
      // sigActTipo → sigAct, sigActFecha → sigFecha, sigActHora → sigHora
      if (l.sigActTipo !== undefined && l.sigAct === undefined) l.sigAct = l.sigActTipo;
      if (l.sigActFecha !== undefined && l.sigFecha === undefined) l.sigFecha = l.sigActFecha;
      if (l.sigActHora !== undefined && l.sigHora === undefined) l.sigHora = l.sigActHora;
      return l;
    });
    if (rClientes.ok) {
      CDC.clientes = rClientes.data.map(function(c){
        c.monto     = Number(c.monto)     || 0;
        c.cobrado   = Number(c.cobrado)   || 0;
        c.porCobrar = Number(c.porCobrar) || 0;
        c.numSes    = Number(c.numSes)    || 0;
        c.precioSes = Number(c.precioSes) || 0;
        if (c.celular !== undefined && c.cel === undefined) c.cel = c.celular;
        if (!Array.isArray(c.sesiones)) c.sesiones = [];
        if (!c.onboarding) c.onboarding = {contrato:false,anticipo:false,consent:false,neurometria:false,expediente:false,protocolo:false,calendario:false};
        return c;
      });
      clientesData = CDC.clientes;
    }
    if (rActs.ok) {
      CDC.actividades = rActs.data;
      actividadesData = rActs.data.map(function(a){
        return {
          id:       a.id,
          prospecto:a.prospecto || '',
          refTipo:  a.refTipo   || 'lead',
          refId:    a.refId     || '',
          tipo:     a.tipo      || '',
          fecha:    a.fecha     || '',
          hora:     a.hora      || '',
          grupo:    a.grupo     || 'hoy',
          done:     (a.done === 'Sí' || a.done === true),
          urgente:  (a.urgente === 'Sí' || a.urgente === true),
          contexto: a.contexto  || ''
        };
      });
    }
    if (rEg.ok) {
      // Separar egresos por tipo para los arrays del portal
      CDC.egresos = rEg.data;
      historialEgresos = rEg.data.filter(function(e){ return e.tipo==='historial' || !e.tipo; }).map(function(e){
        return {id:e.id, nombre:e.nombre, monto:Number(e.monto)||0, fecha:e.fecha, metodo:e.metodo, cat:e.cat, cuenta:e.cuenta, deducible:e.deducible, conciliado:(e.conciliado==='Sí'||e.conciliado===true)};
      });
      porPagarData = rEg.data.filter(function(e){ return e.tipo==='porpagar'; }).map(function(e){
        return {id:e.id, nombre:e.nombre, monto:Number(e.monto)||0, cat:e.cat, limite:e.limite||'', metodo:e.metodo||'Transferencia'};
      });
      pagosFijos = rEg.data.filter(function(e){ return e.tipo==='fijo'; }).map(function(e){
        return {id:e.id, nombre:e.nombre, monto:Number(e.monto)||0, dia:Number(e.dia)||1, cat:e.cat, cuenta:e.cuenta||''};
      });
    }
    if (rPF.ok)       CDC.pagosFijos  = rPF.data;
    if (rFact.ok) {
      CDC.facturas = rFact.data;
      facturasData = rFact.data.map(function(f){
        return {
          id:f.id, cliente:f.clienteNombre||f.cliente||'', sesion:f.sesionN||f.sesion||'',
          monto:Number(f.monto)||0, fecha:f.fecha, estado:f.estatus||f.estado||'Por crear',
          folio:f.folio||'', rfc:f.rfcFiscal||f.rfc||'',
          razonSocial:f.razonSocial||'', usoCFDI:f.usoCFDI||''
        };
      });
    }

    // Sincronizar con variables legacy del portal (compatibilidad)
    if (typeof leadsData      !== 'undefined') leadsData      = CDC.leads;
    if (typeof clientesData   !== 'undefined') clientesData   = CDC.clientes;
    if (typeof actividades    !== 'undefined') actividades    = CDC.actividades;
    if (typeof egresosData    !== 'undefined') egresosData    = CDC.egresos;
    if (typeof pagosFijos     !== 'undefined') pagosFijos     = CDC.pagosFijos;
    if (typeof facturasData   !== 'undefined') facturasData   = CDC.facturas;

    // Re-render de todos los módulos
    renderLeads();
    renderActividades(actFiltro);
    renderHoyKpis();
    renderClientes();
    renderEgresos();
    renderFacturas();
    renderNav();

  } catch (err) {
    mostrarError('Error de conexión con Google Sheets: ' + err.toString());
    console.error('[CDC GS] cargarTodo falló:', err);
  }
  mostrarLoader(false);
}

// ════════════════════════════════════════════════════════════════
//  WRAPPERS — reemplazan las funciones de guardado del portal
//  Cada uno: guarda en Sheets → actualiza CDC[] → re-renderiza
// ════════════════════════════════════════════════════════════════

// ── LEADS ────────────────────────────────────────────────────────

async function gs_guardarLead(leadData) {
  var res = await gs('saveLead', leadData);
  if (res.ok) {
    await _recargarLeads();
  } else {
    console.error('[CDC GS] saveLead:', res.error);
  }
  return res;
}

async function gs_actualizarLead(leadData) {
  // leadData debe incluir .id
  var res = await gs('updateLead', leadData);
  if (res.ok) {
    await _recargarLeads();
    // R1: si etapa = Ganado → activar onboarding
    if (leadData.etapa === 'Ganado' && typeof abrirOnboarding !== 'undefined') {
      setTimeout(function() { abrirOnboarding(leadData.nombre); }, 300);
    }
  }
  return res;
}

async function _recargarLeads() {
  var r = await gs('getLeads');
  if (r.ok) {
    CDC.leads = r.data;
    if (typeof leadsData !== 'undefined') leadsData = CDC.leads;
    if (typeof renderPipeline !== 'undefined') renderPipeline();
    if (typeof renderLeads    !== 'undefined') renderLeads(CDC.leads);
  }
}

// ── CLIENTES ─────────────────────────────────────────────────────

async function gs_guardarCliente(clienteData) {
  var res = await gs('saveCliente', clienteData);
  if (res.ok) await _recargarClientes();
  return res;
}

async function gs_actualizarCliente(clienteData) {
  var res = await gs('updateCliente', clienteData);
  if (res.ok) await _recargarClientes();
  return res;
}

async function _recargarClientes() {
  var r = await gs('getClientes');
  if (r.ok) {
    CDC.clientes = r.data;
    if (typeof clientesData !== 'undefined') clientesData = CDC.clientes;
    if (typeof renderClientes !== 'undefined') renderClientes();
  }
}

// ── SESIONES + COBROS ────────────────────────────────────────────

async function gs_actualizarSesion(sesionData) {
  var res = await gs('updateSesion', sesionData);
  if (res.ok) await _recargarClientes();
  return res;
}

// R4: registrarCobro → saveCobro (combina sesión + cliente + factura)
async function gs_registrarCobro(cobroData) {
  // cobroData: { sesionId, clienteId, clienteNombre, monto, fecha,
  //              metodo, cuenta, facturaRequerida, rfcFiscal,
  //              razonSocial, usoCFDI, nextSesionId, nextSesionFecha,
  //              sesionNum }
  var res = await gs('saveCobro', cobroData);
  if (res.ok) {
    await Promise.all([
      _recargarClientes(),
      _recargarFacturas(),
      _recargarActividades()
    ]);
  }
  return res;
}

// ── ACTIVIDADES ──────────────────────────────────────────────────

async function gs_guardarActividad(actData) {
  var res = await gs('saveActividad', actData);
  if (res.ok) await _recargarActividades();
  return res;
}

async function gs_actualizarActividad(actData) {
  var res = await gs('updateActividad', actData);
  if (res.ok) await _recargarActividades();
  return res;
}

// Marcar actividad como hecha (R: marcarHecha)
async function gs_marcarHecha(id) {
  return gs_actualizarActividad({ id: id, done: 'Sí', grupo: 'completadas' });
}

// Reprogramar actividad
async function gs_reprogramarActividad(id, nuevaFecha, hora, nota) {
  return gs_actualizarActividad({
    id: id,
    fecha: nuevaFecha,
    hora: hora || '',
    nota: nota || '',
    grupo: _calcularGrupo(nuevaFecha)
  });
}

function _calcularGrupo(fechaStr) {
  if (!fechaStr) return 'hoy';
  var hoy  = new Date(); hoy.setHours(0,0,0,0);
  var man  = new Date(hoy); man.setDate(man.getDate() + 1);
  var fecha = new Date(fechaStr + 'T00:00:00');
  if (fecha < hoy)  return 'urgente';
  if (fecha.getTime() === hoy.getTime()) return 'hoy';
  if (fecha.getTime() === man.getTime()) return 'manana';
  return 'manana';
}

async function _recargarActividades() {
  var r = await gs('getActividades');
  if (r.ok) {
    CDC.actividades = r.data;
    if (typeof actividades !== 'undefined') actividades = CDC.actividades;
    if (typeof renderActividades !== 'undefined') renderActividades('todas');
  }
}

// ── EGRESOS ──────────────────────────────────────────────────────

async function gs_guardarEgreso(egresoData) {
  var res = await gs('saveEgreso', egresoData);
  if (res.ok) await _recargarEgresos();
  return res;
}

async function gs_actualizarEgreso(egresoData) {
  var res = await gs('updateEgreso', egresoData);
  if (res.ok) await _recargarEgresos();
  return res;
}

async function gs_guardarPagoFijo(pfData) {
  var res = await gs('savePagoFijo', pfData);
  if (res.ok) await _recargarEgresos();
  return res;
}

async function gs_eliminarPagoFijo(id) {
  var res = await gs('deletePagoFijo', { id: id });
  if (res.ok) await _recargarEgresos();
  return res;
}

async function _recargarEgresos() {
  var [rEg, rPF] = await Promise.all([
    gs('getEgresos'),
    gs('getPagosFijos')
  ]);
  if (rEg.ok) {
    CDC.egresos = rEg.data;
    if (typeof egresosData !== 'undefined') egresosData = CDC.egresos;
  }
  if (rPF.ok) {
    CDC.pagosFijos = rPF.data;
    if (typeof pagosFijos !== 'undefined') pagosFijos = CDC.pagosFijos;
  }
  if (typeof renderEgresos !== 'undefined') renderEgresos();
}

// ── FACTURAS ─────────────────────────────────────────────────────

// agregarFacturaPendiente — llamada desde registrarCobro (R4)
async function gs_agregarFacturaPendiente(clienteNombre, sesionNum, monto, fecha) {
  var cliente = CDC.clientes.find(function(c) { return c.nombre === clienteNombre; });
  return gs('saveFactura', {
    clienteId:      cliente ? cliente.id : '',
    clienteNombre:  clienteNombre,
    sesionNum:      sesionNum,
    monto:          monto,
    fecha:          fecha,
    estatus:        'Por crear',
    rfcFiscal:      cliente ? (cliente.rfcFiscal || '') : '',
    razonSocial:    cliente ? (cliente.razonSocial || '') : '',
    usoCFDI:        cliente ? (cliente.usoCFDI || '') : ''
  });
}

// Avanzar estatus de factura (R10: solo progresa, requiere folio)
async function gs_avanzarFactura(facturaId, nuevoEstatus, folio) {
  var res = await gs('updateFactura', {
    id:       facturaId,
    estatus:  nuevoEstatus,
    folio:    folio || ''
  });
  if (res.ok) await _recargarFacturas();
  else alert(res.error || 'No se pudo actualizar la factura');
  return res;
}

async function _recargarFacturas() {
  var r = await gs('getFacturas');
  if (r.ok) {
    CDC.facturas = r.data;
    if (typeof facturasData !== 'undefined') facturasData = CDC.facturas;
    if (typeof renderFacturas !== 'undefined') renderFacturas();
  }
}

// ════════════════════════════════════════════════════════════════
//  FRAGMENTO HTML — pega dentro del <body> del portal
//  (loader + banner de error + botón de reconexión)
// ════════════════════════════════════════════════════════════════

/*
<!-- PEGAR JUSTO DESPUÉS DEL <body> -->
<div id="gs-loader" style="
  display:none; position:fixed; inset:0; background:rgba(26,26,46,.85);
  z-index:9999; align-items:center; justify-content:center; flex-direction:column; gap:16px;">
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
    style="animation:spin 1s linear infinite;">
    <circle cx="24" cy="24" r="20" stroke="#4A6CF7" stroke-width="4" stroke-dasharray="80 40"/>
  </svg>
  <span style="color:#fff; font-family:Arial,sans-serif; font-size:14px; letter-spacing:.5px;">
    Sincronizando con Google Sheets…
  </span>
</div>

<div id="gs-error" style="
  display:none; position:fixed; top:16px; right:16px; background:#B71C1C;
  color:#fff; padding:12px 20px; border-radius:8px; font-family:Arial,sans-serif;
  font-size:13px; z-index:9998; max-width:320px; cursor:pointer;"
  onclick="this.style.display='none'">
</div>

<style>
@keyframes spin { to { transform: rotate(360deg); } }
</style>
-->
*/

// ════════════════════════════════════════════════════════════════
//  REEMPLAZO DEL DOMContentLoaded
//
//  En tu HTML, localiza:
//    window.addEventListener('DOMContentLoaded', function(){ ... });
//
//  Reemplaza TODA esa función por esto:
// ════════════════════════════════════════════════════════════════

/*
window.addEventListener('DOMContentLoaded', async function() {

  // --- Init UI igual que antes ---
  changeUser('drwilly'); // o tu función de init de usuario
  nav('hoy');            // pantalla inicial

  // --- Cargar datos desde Google Sheets ---
  await cargarTodo();

});
*/

// ════════════════════════════════════════════════════════════════
//  TABLA DE REEMPLAZOS
//  Qué función del portal original llama a qué wrapper de GS
// ════════════════════════════════════════════════════════════════

/*
  FUNCIÓN ORIGINAL EN EL PORTAL    →  WRAPPER GS QUE LA REEMPLAZA
  ─────────────────────────────────────────────────────────────────
  guardarPipe()                     →  gs_actualizarLead(leadData)
  onDrop(ev, etapa) al soltar       →  gs_actualizarLead({id, etapa:'Ganado'})
  marcarHecha(id)                   →  gs_marcarHecha(id)
  confirmarReprog()                 →  gs_reprogramarActividad(id, fecha, hora, nota)
  activarCliente()                  →  gs_guardarCliente(data) o gs_actualizarCliente()
  registrarCobro()                  →  gs_registrarCobro(cobroData)
  agregarFacturaPendiente(...)      →  gs_agregarFacturaPendiente(...)
  avanzarFactura(id, estatus)       →  gs_avanzarFactura(id, estatus, folio)
  saveEgreso() / guardarEgreso()    →  gs_guardarEgreso(data)
  savePagoFijo()                    →  gs_guardarPagoFijo(data)
*/











/* ============================================================
   CLÍNICA DEL CEREBRO · CRM/ERP
   Bloque 1 — Helpers, formateadores, datos demo y estado
   ============================================================ */

/* ---------- Helpers DOM (SIEMPRE primero) ---------- */
function setText(id, v){ var e = document.getElementById(id); if(e) e.textContent = v; }
function setHtml(id, v){ var e = document.getElementById(id); if(e) e.innerHTML = v; }
function $(id){ return document.getElementById(id); }
function esc(s){ if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function money(n){ n = Number(n)||0; return '$' + n.toLocaleString('es-MX'); }
function show(id){ var e=$(id); if(e) e.classList.add('open'); }

function openModal(id){ var e=$(id); if(e) e.classList.add('open'); }
function closeModal(id){ var e=$(id); if(e) e.classList.remove('open'); }

var _toastTimer = null;
function toast(msg){
  setText('toast-msg', msg);
  var t = $('toast'); if(!t) return;
  t.classList.add('show');
  if(_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 2600);
}

/* ---------- Iconos SVG inline ---------- */
var ICONS = {
  llamada:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  whatsapp:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>',
  cotizacion:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  cita:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  cobro:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  reloj:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  brain:'<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/>',
  seguimiento:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
};
function ico(name, sw){
  sw = sw || 2;
  var p = ICONS[name] || ICONS.reloj;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';
}
function tipoIcon(tipo){
  var t = (tipo||'').toLowerCase();
  if(t.indexOf('llam')>=0) return 'llamada';
  if(t.indexOf('whats')>=0 || t.indexOf('mensaje')>=0) return 'whatsapp';
  if(t.indexOf('cotiz')>=0) return 'cotizacion';
  if(t.indexOf('cita')>=0 || t.indexOf('agend')>=0) return 'cita';
  if(t.indexOf('doc')>=0) return 'doc';
  if(t.indexOf('cobr')>=0) return 'cobro';
  if(t.indexOf('segui')>=0) return 'seguimiento';
  return 'reloj';
}
function initials(nombre){
  var p = (nombre||'').trim().split(/\s+/);
  return ((p[0]||'')[0]||'') + ((p[1]||'')[0]||'');
}
function fechaLarga(iso){
  if(!iso) return '—';
  var d = new Date(iso+'T00:00:00');
  if(isNaN(d)) return iso;
  var meses=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return d.getDate()+' '+meses[d.getMonth()]+' '+d.getFullYear();
}
function horaTxt(h){
  if(!h) return '';
  var p=String(h).split(':'); var H=parseInt(p[0],10); var M=(p[1]||'00');
  if(isNaN(H)) return '';
  var ap = H<12 ? 'a.m.' : 'p.m.'; var h12 = H%12; if(h12===0) h12=12;
  return h12+':'+M+' '+ap;
}
function fechaHoraTxt(iso, h){
  var f = fechaLarga(iso);
  return h ? (f+' · '+horaTxt(h)) : f;
}
function actKey(a){ return (a.fecha||'9999-12-31')+'T'+(a.hora||'23:59'); }
function ordenarActs(list){ return list.slice().sort(function(a,b){ var ka=actKey(a),kb=actKey(b); return ka<kb?-1:(ka>kb?1:0); }); }

/* ---------- Constantes de negocio ---------- */
var HOY = '2025-05-25';

var BANCOS = ['BBVA 4521','HSBC 7832','Santander 1180','Banorte 3492'];
var cuentasPorMetodo = {
  'Efectivo': ['Efectivo caja'],
  'Tarjeta': ['BBVA 4521','HSBC 7832','Santander 1180'],
  'Transferencia': ['HSBC 7832','Banorte 3492'],
  'Cheque': ['BBVA 4521','HSBC 7832']
};

var ETAPAS = ['Nuevo','Contactado','Diagnóstico','Cotizado','Ganado','Perdido','No clasifica'];
var ETAPA_COLOR = { 'Nuevo':'gray','Contactado':'blue','Diagnóstico':'amber','Cotizado':'violet','Ganado':'green','Perdido':'red','No clasifica':'gray' };
var ETAPA_DESC = {
  'Nuevo':'Prospectos sin contactar aún',
  'Contactado':'Primer contacto hecho; calificando',
  'Diagnóstico':'En evaluación / neurometría',
  'Cotizado':'Cotización enviada; dando seguimiento',
  'Ganado':'Aceptó; pasa a onboarding',
  'Perdido':'Cotizó pero no se cerró el trato',
  'No clasifica':'No contestan, desaparecieron o sin perfil'
};
var ETAPA_DOT = {
  'Nuevo':'#9AA3A0','Contactado':'#5B9BD8','Diagnóstico':'#E0A53B',
  'Cotizado':'#7B52C9','Ganado':'#1F8A4C','Perdido':'#C2553F','No clasifica':'#8A9199'
};
var ETAPA_ACT_DEFAULT = {
  'Nuevo':'Llamada','Contactado':'Llamada','Diagnóstico':'Agendar cita',
  'Cotizado':'Seguimiento cotización','Perdido':'','No clasifica':''
};
var ETAPAS_OPCIONALES = ['Perdido','No clasifica'];
var ACT_TIPOS = ['Llamada','Mensaje WhatsApp','Enviar cotización','Agendar cita','Seguimiento cotización','Enviar documento'];
var PADECIMIENTOS = ['TDAH','Ansiedad','Depresión','Estrés crónico','Dislexia','Migraña','Cognitivo'];
var CANALES = ['Instagram','Facebook','WhatsApp','Google','Referido','Otro'];

var ESTADO_CLI = {
  'En onboarding': {cls:'st-onboarding', badge:'b-amber', label:'En onboarding'},
  'Activo':        {cls:'st-activo',     badge:'b-green', label:'Activo'},
  'Pausado':       {cls:'st-pausado',    badge:'b-violet',label:'Pausado'},
  'Reagendado':    {cls:'st-reagendado', badge:'b-blue',  label:'Reagendado'},
  'Cancelado':     {cls:'st-cancelado',  badge:'b-red',   label:'Cancelado'},
  'Completado':    {cls:'st-completado', badge:'b-emerald',label:'Completado'}
};

var RAZONES_CANCEL = ['Costo / presupuesto','Distancia / traslado','Decidió otra clínica','Mejoría sin tratamiento','Falta de tiempo','Problemas de salud','Cambio de ciudad','Sin respuesta del paciente','Insatisfacción con resultados','Otro'];

var ONB_CHECKS = [
  {fase:1, key:'contrato',   t:'Contrato firmado',                d:'Acuerdo de servicio aceptado'},
  {fase:1, key:'anticipo',   t:'Anticipo recibido',              d:'Primer pago confirmado'},
  {fase:1, key:'consent',    t:'Consentimiento informado',       d:'Documento clínico firmado'},
  {fase:2, key:'neurometria',t:'Neurometría inicial agendada',   d:'Evaluación basal programada'},
  {fase:2, key:'expediente', t:'Expediente clínico creado',      d:'Historia clínica registrada'},
  {fase:2, key:'protocolo',  t:'Protocolo EMT definido',         d:'Parámetros de estimulación'},
  {fase:2, key:'calendario', t:'Calendario de sesiones compartido', d:'Agenda enviada al paciente'}
];

/* ---------- Estado de la app ---------- */
var usuarioActual = 'willy';
var pantallaActual = 'hoy';
var clienteAbiertoId = null;   // acordeón abierto
var pipeActualId = null;       // lead en modal pipe
var sesionCtx = null;          // {clienteId, n}
var onbCtx = null;             // {clienteId, checks:{}}
var reprogCtx = null;          // actividad id
var facturaCtx = null;         // factura id
var egresoCtx = null;          // {tipo, id}

var _uidSeq = 1000;
function uid(p){ _uidSeq++; return (p||'id')+'-'+_uidSeq; }

/* ---------- Datos demo ---------- */
// Datos cargados desde Google Sheets al arrancar (cargarTodo)
var leadsData = [];

function mkSesiones(num, doneCount, precio, fechaPrimera, pausadoDesde){
  // estados: done / next / scheduled / pending
  var arr = [];
  var base = new Date((fechaPrimera||HOY)+'T00:00:00');
  for(var i=1;i<=num;i++){
    var d = new Date(base.getTime());
    d.setDate(base.getDate() + (i-1)*3);
    var iso = d.toISOString().slice(0,10);
    var estado;
    if(i <= doneCount) estado = 'done';
    else if(i === doneCount+1) estado = (pausadoDesde? 'scheduled' : 'next');
    else if(i === doneCount+2) estado = 'scheduled';
    else estado = 'pending';
    arr.push({n:i, estado:estado, fecha: (i<=doneCount+2? iso : ''), hora: (i<=doneCount+2? '10:00':''), notas: (i<=doneCount? 'Sesión completada sin incidencias.':''), precio:precio});
  }
  return arr;
}

var clientesData    = [];
var actividadesData = [];
var pagosFijos      = [];
var porPagarData    = [];
var historialEgresos= [];
var ingresosData    = [];
var facturasData    = [];

var FACT_SEQ = ['Por crear','Creada','Enviada','Completada'];
var FACT_BADGE = {'Por crear':'b-amber','Creada':'b-blue','Enviada':'b-violet','Completada':'b-green'};

function getCliente(id){ for(var i=0;i<clientesData.length;i++){ if(clientesData[i].id===id) return clientesData[i]; } return null; }
function getLead(id){ for(var i=0;i<leadsData.length;i++){ if(leadsData[i].id===id) return leadsData[i]; } return null; }
function getActividad(id){ for(var i=0;i<actividadesData.length;i++){ if(actividadesData[i].id===id) return actividadesData[i]; } return null; }
function getFactura(id){ for(var i=0;i<facturasData.length;i++){ if(facturasData[i].id===id) return facturasData[i]; } return null; }
/* ============================================================
   Bloque 2 — Navegación, acceso, Hoy y Leads
   ============================================================ */

/* ---------- Navegación lateral ---------- */
var NAV = [
  {key:'hoy',      label:'Hoy',      sub:'Centro de actividades', icon:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>', badge:'urg'},
  {key:'leads',    label:'Leads',    sub:'Pipeline comercial',    icon:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>', badge:'leads'},
  {key:'clientes', label:'Clientes', sub:'Cartera y sesiones',    icon:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'},
  {key:'egresos',  label:'Finanzas', sub:'Ingresos y egresos',     icon:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>', soloWilly:true},
  {key:'facturas', label:'Facturas', sub:'Cola CFDI',             icon:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>', badge:'fact'},
  {key:'tableros', label:'Tableros', sub:'Indicadores ejecutivos',icon:'<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="12" y="6" width="3" height="11"/><rect x="17" y="13" width="3" height="4"/>', soloWilly:true}
];
var PAGE_TITLES = {
  hoy:['Hoy','Centro de actividades'],
  leads:['Leads','Pipeline comercial'],
  clientes:['Clientes','Cartera y sesiones'],
  egresos:['Finanzas','Ingresos y egresos'],
  facturas:['Facturas','Cola de timbrado CFDI'],
  tableros:['Tableros','Indicadores ejecutivos']
};

function navBadge(key){
  if(key==='urg'){ var u=actividadesData.filter(function(a){return !a.done && (a.urgente||a.grupo==='hoy');}).length; return u; }
  if(key==='leads'){ return leadsData.filter(function(l){return l.etapa!=='Ganado';}).length; }
  if(key==='fact'){ return facturasData.filter(function(f){return f.estado!=='Completada';}).length; }
  return 0;
}

function renderNav(){
  var html = '';
  NAV.forEach(function(item){
    var bloqueado = item.soloWilly && usuarioActual!=='willy';
    var cls = 'nav-item' + (item.key===pantallaActual?' active':'') + (bloqueado?' locked':'');
    var badgeHtml = '';
    if(!bloqueado && item.badge){
      var n = navBadge(item.badge);
      if(n>0) badgeHtml = '<span class="badge">'+n+'</span>';
    }
    if(bloqueado){
      badgeHtml = '<span class="lock"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>';
    }
    var onclick = bloqueado ? 'onclick="toast(\'Acceso reservado para el Dr. Willy\')"' : 'onclick="nav(\''+item.key+'\')"';
    html += '<button class="'+cls+'" '+onclick+'>'
         + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+item.icon+'</svg>'
         + '<span>'+item.label+'</span>'+badgeHtml+'</button>';
  });
  setHtml('nav-list', html);
}

function nav(key){
  var item = NAV.filter(function(n){return n.key===key;})[0];
  if(item && item.soloWilly && usuarioActual!=='willy'){ toast('Acceso reservado para el Dr. Willy'); return; }
  pantallaActual = key;
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  var scr = $('screen-'+key); if(scr) scr.classList.add('active');
  var t = PAGE_TITLES[key] || [key,''];
  setText('page-title', t[0]); setText('page-sub', t[1]);
  renderNav();
  if(key==='hoy'){ renderActividades(actFiltro); renderActChips(); }
  if(key==='leads') renderLeads();
  if(key==='clientes') renderClientes();
  if(key==='egresos') renderFinanzas();
  if(key==='facturas') renderFacturas();
  if(key==='tableros') renderTableros();
}

/* ---------- Control de acceso (R8) ---------- */
function changeUser(val){
  usuarioActual = val;
  if(val==='willy'){
    setText('user-name','Dr. Willy'); setText('user-role','Acceso total'); setText('user-av','DW');
    $('user-av').style.background = 'linear-gradient(135deg,#1AA398,#0E6E66)';
  } else {
    setText('user-name','Sra. Vicky'); setText('user-role','Operativo'); setText('user-av','SV');
    $('user-av').style.background = 'linear-gradient(135deg,#D9742A,#C2820B)';
  }
  // Si Vicky está en una pantalla restringida, redirigir a Hoy
  if(val!=='willy' && (pantallaActual==='egresos' || pantallaActual==='tableros')){
    nav('hoy');
  } else {
    renderNav();
    if(pantallaActual==='tableros') renderTableros();
  }
  toast(val==='willy' ? 'Sesión: Dr. Willy · Acceso total' : 'Sesión: Sra. Vicky · Operativo');
}

/* ============================================================
   MÓDULO HOY — Centro de actividades
   ============================================================ */
var actFiltro = 'todas';
var GRUPOS = [
  {key:'vencido', label:'Vencidas'},
  {key:'hoy',     label:'Hoy'},
  {key:'manana',  label:'Mañana'},
  {key:'semana',  label:'Esta semana'}
];

function renderHoyKpis(){
  var pend = actividadesData.filter(function(a){return !a.done;});
  setText('kpi-urg', pend.filter(function(a){return a.urgente;}).length);
  setText('kpi-hoy', pend.filter(function(a){return a.grupo==='hoy';}).length);
  setText('kpi-man', pend.filter(function(a){return a.grupo==='manana';}).length);
  setText('kpi-done', actividadesData.filter(function(a){return a.done;}).length);
}

function renderActChips(){
  var counts = {
    todas: actividadesData.filter(function(a){return !a.done;}).length,
    vencido: actividadesData.filter(function(a){return !a.done && a.grupo==='vencido';}).length,
    hoy: actividadesData.filter(function(a){return !a.done && a.grupo==='hoy';}).length,
    manana: actividadesData.filter(function(a){return !a.done && a.grupo==='manana';}).length,
    semana: actividadesData.filter(function(a){return !a.done && a.grupo==='semana';}).length,
    done: actividadesData.filter(function(a){return a.done;}).length
  };
  var chips = [['todas','Todas'],['vencido','Vencidas'],['hoy','Hoy'],['manana','Mañana'],['semana','Esta semana'],['done','Completadas']];
  var html = '';
  chips.forEach(function(c){
    html += '<button class="chip'+(actFiltro===c[0]?' active':'')+'" onclick="filtrarActs(\''+c[0]+'\')">'+c[1]+'<span class="n">'+(counts[c[0]]||0)+'</span></button>';
  });
  setHtml('act-chips', html);
}

function filtrarActs(f){ actFiltro = f; renderActividades(f); renderActChips(); }

function actCardHtml(a){
  var ig = tipoIcon(a.tipo);
  var cls = 'act-card' + (a.urgente && !a.done?' is-urg':'') + (a.done?' is-done':'');
  var fechaTxt = a.done ? 'Completada' : fechaHoraTxt(a.fecha, a.hora);
  var actionsHtml = a.done ? '' :
      '<button class="icon-btn" title="Reprogramar" onclick="event.stopPropagation();reprog(\''+a.id+'\')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></button>';
  return '<div class="'+cls+'" onclick="abrirActDetalle(\''+a.id+'\')">'
    + '<div class="act-check'+(a.done?' on':'')+'" title="Marcar como hecha" onclick="event.stopPropagation();marcarHecha(\''+a.id+'\')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>'
    + '<div class="act-ico">'+ico(ig)+'</div>'
    + '<div class="act-main"><b>'+esc(a.tipo)+' · '+esc(a.prospecto)+'</b><div class="meta">'+esc(a.contexto.slice(0,72))+(a.contexto.length>72?'…':'')+'</div></div>'
    + '<div class="act-actions"><span class="meta" style="align-self:center;margin-right:4px">'+fechaTxt+'</span>'+actionsHtml+'</div>'
    + '</div>';
}

function renderActividades(filtro){
  filtro = filtro || actFiltro;
  renderHoyKpis();
  var cont = $('acts-container'); if(!cont) return;
  var list;
  if(filtro==='done') list = actividadesData.filter(function(a){return a.done;});
  else if(filtro==='todas') list = actividadesData.filter(function(a){return !a.done;});
  else list = actividadesData.filter(function(a){return !a.done && a.grupo===filtro;});

  if(list.length===0){
    cont.innerHTML = '<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><div>Sin actividades en este filtro.</div></div>';
    return;
  }
  var html = '';
  if(filtro==='todas'){
    GRUPOS.forEach(function(g){
      var sub = ordenarActs(list.filter(function(a){return a.grupo===g.key;}));
      if(sub.length===0) return;
      html += '<div class="act-group-title">'+g.label+' · '+sub.length+'</div>';
      sub.forEach(function(a){ html += actCardHtml(a); });
    });
  } else {
    ordenarActs(list).forEach(function(a){ html += actCardHtml(a); });
  }
  cont.innerHTML = html;
}

function marcarHecha(id){
  var a = getActividad(id); if(!a) return;
  a.done = !a.done;
  a.grupo = a.done ? 'completadas' : clasificarGrupo(a.fecha);
  renderActividades(actFiltro); renderActChips(); renderNav();
  toast(a.done ? 'Actividad completada ✓' : 'Actividad reabierta');
  gs('updateCita', {id:id, done:(a.done?'Sí':'No'), grupo:a.grupo, actualizadoEn:new Date().toISOString()})
    .catch(function(e){ console.error('[CDC GS] updateCita marcarHecha:',e); });
}

function reprog(id){
  reprogCtx = id;
  var a = getActividad(id); if(!a) return;
  setText('reprog-info', a.tipo+' · '+a.prospecto);
  $('reprog-fecha').value = a.fecha;
  $('reprog-hora').value = a.hora || '10:00';
  $('reprog-nota').value = '';
  openModal('m-reprog');
}
function confirmarReprog(){
  var a = getActividad(reprogCtx); if(!a){ closeModal('m-reprog'); return; }
  var nueva = $('reprog-fecha').value;
  if(!nueva){ toast('Selecciona una fecha'); return; }
  a.fecha = nueva;
  a.hora = $('reprog-hora').value || '10:00';
  a.grupo = clasificarGrupo(nueva);
  closeModal('m-reprog');
  renderActividades(actFiltro); renderActChips(); renderHoyKpis(); renderNav();
  toast('Actividad reprogramada · '+fechaHoraTxt(nueva, a.hora));
  gs('updateCita', {id:reprogCtx, fecha:a.fecha, hora:a.hora, grupo:a.grupo, actualizadoEn:new Date().toISOString()})
    .catch(function(e){ console.error('[CDC GS] updateCita reprog:',e); });
}
function clasificarGrupo(iso){
  var hoy = new Date(HOY+'T00:00:00'), d = new Date(iso+'T00:00:00');
  var diff = Math.round((d-hoy)/86400000);
  if(diff<0) return 'vencido';
  if(diff===0) return 'hoy';
  if(diff===1) return 'manana';
  return 'semana';
}

function abrirActDetalle(id){
  var a = getActividad(id); if(!a) return;
  actDetCtx = id;
  setText('ad-titulo', a.tipo+' · '+a.prospecto);
  setText('ad-tipo', a.tipo);
  setText('ad-fecha', a.done?'Completada':fechaHoraTxt(a.fecha, a.hora));
  var ic = $('ad-ic'); if(ic) ic.innerHTML = ico(tipoIcon(a.tipo));
  var badgeCls = a.done?'b-green':(a.grupo==='vencido'?'b-red':(a.grupo==='hoy'?'b-amber':'b-blue'));
  var badgeTxt = a.done?'Completada':(a.grupo==='vencido'?'Vencida':(a.grupo==='hoy'?'Para hoy':(a.grupo==='manana'?'Mañana':'Esta semana')));
  setHtml('ad-estado-badge', '<span class="badge '+badgeCls+'">'+badgeTxt+'</span>'+(a.urgente?' <span class="badge b-red">Urgente</span>':''));
  setHtml('ad-contexto', '<div class="field"><label>Contexto</label><div style="font-size:13.5px;color:var(--ink-2);line-height:1.6">'+esc(a.contexto)+'</div></div>');
  var foot = '';
  if(!a.done){
    foot += '<button class="btn btn-ghost" onclick="reprog(\''+a.id+'\');closeModal(\'m-act-detalle\')">Reprogramar</button>';
    if(a.refTipo==='lead') foot += '<button class="btn btn-soft" onclick="closeModal(\'m-act-detalle\');nav(\'leads\');openPipeDetalle(\''+a.refId+'\',false)">Ver lead</button>';
    foot += '<button class="btn btn-primary" onclick="marcarHecha(\''+a.id+'\');closeModal(\'m-act-detalle\')">Marcar hecha</button>';
  } else {
    foot += '<button class="btn btn-ghost" onclick="marcarHecha(\''+a.id+'\');closeModal(\'m-act-detalle\')">Reabrir</button>';
    foot += '<button class="btn btn-primary" onclick="closeModal(\'m-act-detalle\')">Cerrar</button>';
  }
  setHtml('ad-acciones', foot);
  openModal('m-act-detalle');
}
var actDetCtx = null;

/* ============================================================
   MÓDULO LEADS — Pipeline (kanban + lista) + drag/drop
   ============================================================ */
function tempBadge(t){
  var cls = t==='Caliente'?'b-red':(t==='Tibio'?'b-amber':'b-blue');
  return '<span class="badge '+cls+'"><span class="temp-dot t-'+(t==='Frío'?'Frio':t)+'"></span>'+esc(t)+'</span>';
}

function renderLeadsKpis(){
  var pipeline = leadsData.filter(function(l){return l.etapa!=='Ganado';});
  setText('kpi-total', pipeline.length);
  setText('kpi-hot', leadsData.filter(function(l){return l.temp==='Caliente' && l.etapa!=='Ganado';}).length);
  var ganados = leadsData.filter(function(l){return l.etapa==='Ganado';}).length;
  var conv = leadsData.length? Math.round(ganados/leadsData.length*100):0;
  setText('kpi-conv', conv+'%');
  // canal principal
  var canalCount = {};
  leadsData.forEach(function(l){ canalCount[l.canal]=(canalCount[l.canal]||0)+1; });
  var top='—', max=0;
  for(var k in canalCount){ if(canalCount[k]>max){max=canalCount[k];top=k;} }
  setText('kpi-canal', top);
}

function renderPipeline(){
  ETAPAS.forEach(function(et){
    var body = document.querySelector('#col-'+CSS.escape(et)+' .kcol-body');
    var col = $('col-'+et);
    var leads = leadsData.filter(function(l){return l.etapa===et;});
    setText('cnt-'+et, leads.length);
    if(!body) return;
    if(leads.length===0){ body.innerHTML = '<div style="text-align:center;color:var(--ink-3);font-size:12px;padding:14px 0;opacity:.7">—</div>'; return; }
    var html = '';
    leads.forEach(function(l){
      html += '<div class="lead-card" draggable="true" data-id="'+l.id+'" ondragstart="onDragStart(event,\''+l.id+'\')" ondragend="onDragEnd(event)" onclick="openPipeDetalle(\''+l.id+'\',false)">'
        + '<div class="lc-name">'+esc(l.nombre)+'</div>'
        + '<div class="lc-pac">'+esc(l.paciente)+' · '+esc(l.padecimiento)+'</div>'
        + '<div class="lc-foot">'+tempBadge(l.temp)+'<span style="margin-left:auto">'+esc(l.canal)+'</span></div>'
        + '</div>';
    });
    body.innerHTML = html;
  });
}

function renderLeadsTabla(){
  var tb = $('leads-tbody'); if(!tb) return;
  var html = '';
  leadsData.forEach(function(l){
    var etCls = 'b-'+(ETAPA_COLOR[l.etapa]||'gray');
    html += '<tr onclick="openPipeDetalle(\''+l.id+'\',false)">'
      + '<td><b>'+esc(l.nombre)+'</b></td>'
      + '<td>'+esc(l.paciente)+'</td>'
      + '<td>'+esc(l.padecimiento)+'</td>'
      + '<td><span class="badge '+etCls+'">'+esc(l.etapa)+'</span></td>'
      + '<td>'+esc(l.canal)+'</td>'
      + '<td>'+tempBadge(l.temp)+'</td>'
      + '</tr>';
  });
  tb.innerHTML = html;
}

function renderLeads(){ renderLeadsKpis(); renderPipeline(); renderLeadsTabla(); }

/* ----- Drag & drop ----- */
var dragId = null;
function onDragStart(e, id){ dragId = id; e.dataTransfer.effectAllowed='move'; var c=e.currentTarget; if(c) c.classList.add('dragging'); }
function onDragEnd(e){ var c=e.currentTarget; if(c) c.classList.remove('dragging'); }
function onDragOver(e){ e.preventDefault(); e.dataTransfer.dropEffect='move'; var col=e.currentTarget; if(col) col.classList.add('drag-over'); }
function onDragLeave(e){ var col=e.currentTarget; if(col) col.classList.remove('drag-over'); }
function onDrop(e, etapa){
  e.preventDefault();
  var col = e.currentTarget; if(col) col.classList.remove('drag-over');
  if(!dragId) return;
  var id = dragId; dragId = null;
  var l = getLead(id); if(!l) return;
  if(l.etapa===etapa) return;
  cambiarEtapaLead(id, etapa, true);
}

/* ----- Detalle de lead (R9) ----- */
function openPipeDetalle(id, fromDrag){
  var l = getLead(id); if(!l) return;
  pipeActualId = id;
  setText('pd-nombre', l.nombre);
  var sub = l.paciente || '—';
  var extras = [];
  if(l.edad!=null && l.edad!=='') extras.push(l.edad+'a');
  if(l.genero) extras.push(l.genero);
  if(extras.length) sub += ' (' + extras.join(', ') + ')';
  sub += ' · ' + l.padecimiento;
  setText('pd-pac', sub);
  // R9: fromDrag => etapa fija (badge); manual => dropdown
  var fixed = $('pd-etapa-fixed'), sel = $('pd-etapa-select');
  if(fromDrag){
    fixed.style.display=''; sel.style.display='none';
    fixed.innerHTML = '<span class="badge b-'+(ETAPA_COLOR[l.etapa]||'gray')+'">'+esc(l.etapa)+'</span>';
  } else {
    fixed.style.display='none'; sel.style.display='';
    sel.value = l.etapa;
  }
  $('pd-correo').value = l.correo||'';
  $('pd-cel').value = l.cel||'';
  $('pd-paciente').value = (l.paciente && l.paciente!=='—') ? l.paciente : '';
  $('pd-edad').value = (l.edad!=null && l.edad!=='') ? l.edad : '';
  $('pd-genero').value = l.genero||'';
  $('pd-padecimiento').value = l.padecimiento||'';
  $('pd-temp').value = l.temp||'Tibio';
  $('pd-canal').value = l.canal||'';
  $('pd-sigact').value = l.sigAct||'';
  $('pd-sigfecha').value = l.sigFecha||'';
  if($('pd-sighora')) $('pd-sighora').value = l.sigHora||'';
  $('pd-nota').value = l.nota||'';
  var tl = (l.historial||[]).map(function(h){ return '<div class="tl-item"><div class="tl-t">'+esc(h.t)+'</div><div class="tl-x">'+esc(h.x)+'</div></div>'; }).join('');
  setHtml('pd-historial', tl || '<div class="tl-item"><div class="tl-x">Sin historial</div></div>');
  // Vista compacta para leads ganados: solo contacto (tel), paciente (nombre/edad/padecimiento), nota e historial
  var ganado = (l.etapa==='Ganado');
  ['pd-etapa-wrap','pd-div-1','pd-correo-field','pd-genero-field','pd-temp-field','pd-row-canal','pd-row-sigfecha'].forEach(function(eid){
    var el=$(eid); if(el) el.style.display = ganado ? 'none' : '';
  });
  openModal('m-pipe-detalle');
}

function guardarPipe(){
  var l = getLead(pipeActualId); if(!l){ closeModal('m-pipe-detalle'); return; }
  var sel = $('pd-etapa-select');
  var nuevaEtapa = (sel.style.display!=='none') ? sel.value : l.etapa;
  var cambioEtapa = nuevaEtapa!==l.etapa;
  l.correo = $('pd-correo').value.trim();
  l.cel = $('pd-cel').value.trim();
  l.paciente = $('pd-paciente').value.trim() || '—';
  var edadRaw = $('pd-edad').value.trim();
  l.edad = edadRaw ? parseInt(edadRaw,10) : null;
  l.genero = $('pd-genero').value;
  l.padecimiento = $('pd-padecimiento').value;
  l.temp = $('pd-temp').value;
  l.canal = $('pd-canal').value;
  l.sigAct = $('pd-sigact').value;
  l.sigFecha = $('pd-sigfecha').value;
  if($('pd-sighora')) l.sigHora = $('pd-sighora').value;
  l.nota = $('pd-nota').value;
  closeModal('m-pipe-detalle');
  if(cambioEtapa){
    cambiarEtapaLead(l.id, nuevaEtapa, false);
  } else {
    renderLeads(); renderNav();
    toast('Lead actualizado');
  }
  // Guardar cambios en Google Sheets
  gs('updateLead', {
    id:           l.id,
    nombre:       l.nombre,
    correo:       l.correo,
    celular:      l.cel,
    paciente:     l.paciente,
    edad:         l.edad,
    genero:       l.genero,
    padecimiento: l.padecimiento,
    temperatura:  l.temp,
    canal:        l.canal,
    etapa:        l.etapa,
    nota:         l.nota,
    historial:    JSON.stringify(l.historial||[]),
    sigActTipo:   l.sigAct  || '',
    sigActFecha:  l.sigFecha|| '',
    sigActHora:   l.sigHora || '',
    actualizadoEn: new Date().toISOString()
  }).then(function(res){
    if(!res.ok) console.error('[CDC GS] updateLead:', res.error);
  }).catch(function(err){ console.error('[CDC GS] updateLead error:', err); });
}

/* ----- Convertir lead Ganado en cliente + abrir onboarding (R1) ----- */
function ganarLead(id, prevEtapa){
  var l = getLead(id); if(!l) return;
  var nuevoId = 'c-'+l.id;
  if(!getCliente(nuevoId)){
    var nc = {
      id:nuevoId, nombre:l.nombre, correo:l.correo||'', cel:l.cel||'',
      paciente:l.paciente, edad:l.edad!=null?l.edad:null, genero:l.genero||'',
      padecimiento:l.padecimiento, servicio:'', estado:'En onboarding',
      monto:0, cobrado:0, porCobrar:0, numSes:0, precioSes:0,
      rfc:'', razonSocial:l.nombre, usoCFDI:'D01 · Honorarios médicos', sesiones:[], notas:l.nota||'',
      onboarding:{contrato:false,anticipo:false,consent:false,neurometria:false,expediente:false,protocolo:false,calendario:false}
    };
    clientesData.push(nc);
    // Guardar en Sheets
    var ahora = new Date().toISOString();
    gs('createCliente', {
      id:nuevoId, nombre:nc.nombre, correo:nc.correo, cel:nc.cel,
      paciente:nc.paciente, edad:nc.edad, genero:nc.genero,
      padecimiento:nc.padecimiento, servicio:'', estado:'En onboarding',
      razonPausa:'', monto:0, cobrado:0, porCobrar:0, numSes:0, precioSes:0,
      rfc:'', razonSocial:nc.nombre, usoCFDI:'D01 · Honorarios médicos',
      notas:nc.notas, creadoEn:ahora, actualizadoEn:ahora
    }).then(function(r){ if(!r.ok) console.error('[CDC GS] createCliente:',r.error); })
      .catch(function(e){ console.error('[CDC GS] createCliente error:',e); });
  }
  toast('¡'+l.nombre+' ganado! Iniciando onboarding…');
  abrirOnboarding(nuevoId, true, prevEtapa||'Cotizado', id);
}

/* ----- Actividad automática al cambiar de etapa ----- */
var etapaActCtx = null;
function cambiarEtapaLead(id, nuevaEtapa, fromDrag){
  var l = getLead(id); if(!l) return;
  var prev = l.etapa;
  if(prev===nuevaEtapa) return;
  l.etapa = nuevaEtapa;
  l.historial = l.historial || [];
  l.historial.unshift({t:fechaLarga(HOY), x:'Etapa: '+prev+' → '+nuevaEtapa});
  renderLeads(); renderNav();
  if(nuevaEtapa==='Ganado'){
    setTimeout(function(){ ganarLead(id, prev); }, 300);   // R1: arranca onboarding
  } else {
    abrirEtapaActividad(id, prev, nuevaEtapa);
  }
}
function setLeadActividad(l, tipo, fecha, hora, nota){
  // reemplaza la actividad abierta previa de este lead
  actividadesData = actividadesData.filter(function(a){ return !(a.refTipo==='lead' && a.refId===l.id && !a.done); });
  l.sigAct = tipo; l.sigFecha = fecha; l.sigHora = hora;
  actividadesData.push({
    id:uid('a'), prospecto:l.nombre, refTipo:'lead', refId:l.id, tipo:tipo, fecha:fecha, hora:hora,
    grupo:clasificarGrupo(fecha), done:false, urgente:(clasificarGrupo(fecha)==='vencido'),
    contexto: (nota && nota.trim()) ? nota.trim() : (l.padecimiento+' · '+tipo+' tras pasar a '+l.etapa+'.')
  });
}
function abrirEtapaActividad(id, prev, etapa){
  var l = getLead(id); if(!l) return;
  etapaActCtx = {id:id, etapa:etapa};
  var opcional = (ETAPAS_OPCIONALES.indexOf(etapa)>=0);
  setText('ea-nombre', l.nombre);
  setText('ea-sub', prev+' → '+etapa);
  setText('ea-desc', ETAPA_DESC[etapa]||'');
  var prop = ETAPA_ACT_DEFAULT[etapa];
  if(prop===undefined) prop='Llamada';
  var optsBase = opcional ? '<option value="">— Sin actividad —</option>' : '';
  setHtml('ea-tipo', optsBase + ACT_TIPOS.map(function(t){ return '<option'+(t===prop?' selected':'')+'>'+esc(t)+'</option>'; }).join(''));
  if(opcional && !prop) $('ea-tipo').value='';
  $('ea-fecha').value = HOY;
  $('ea-hora').value = '10:00';
  $('ea-nota').value = '';
  setText('ea-reglatxt', opcional
    ? 'En esta etapa la actividad es opcional.'
    : 'Define una actividad de seguimiento con fecha y hora (obligatoria).');
  openModal('m-etapa-actividad');
}
function guardarEtapaActividad(){
  if(!etapaActCtx){ closeModal('m-etapa-actividad'); return; }
  var l = getLead(etapaActCtx.id); if(!l){ closeModal('m-etapa-actividad'); return; }
  var opcional = (ETAPAS_OPCIONALES.indexOf(etapaActCtx.etapa)>=0);
  var tipo = $('ea-tipo').value;
  var fecha = $('ea-fecha').value || HOY;
  var hora = $('ea-hora').value || '10:00';
  var nota = $('ea-nota').value;
  if(!opcional && !tipo){ toast('Define una actividad de seguimiento'); return; }
  if(nota && nota.trim()){ l.historial = l.historial||[]; l.historial.unshift({t:fechaLarga(HOY), x:nota.trim()}); }
  if(tipo){
    setLeadActividad(l, tipo, fecha, hora, nota);
    toast('Actividad “'+tipo+'” agendada · '+fechaHoraTxt(fecha,hora));
  } else {
    l.sigAct=''; l.sigFecha=''; l.sigHora='';
    actividadesData = actividadesData.filter(function(a){ return !(a.refTipo==='lead' && a.refId===l.id && !a.done); });
    toast(l.nombre+' → '+etapaActCtx.etapa);
  }
  closeModal('m-etapa-actividad');
  renderLeads(); renderNav();
  if(pantallaActual==='hoy'){ renderActividades(actFiltro); renderActChips(); }
}

/* ----- Nuevo lead ----- */
function openNuevoLead(){
  $('nl-nombre').value=''; $('nl-paciente').value='';
  $('nl-correo').value=''; $('nl-cel').value='';
  $('nl-edad').value=''; $('nl-genero').value='';
  $('nl-notas').value='';
  $('nl-padecimiento').value='TDAH'; $('nl-temp').value='Tibio';
  $('nl-canal').value='Instagram'; $('nl-etapa').value='Nuevo';
  openModal('m-nuevo-lead');
}
function guardarNuevoLead(){
  var nombre = $('nl-nombre').value.trim();
  if(!nombre){ toast('El nombre del contacto es obligatorio'); return; }
  var edadRaw = $('nl-edad').value.trim();
  var l = {
    id: uid('l'), nombre:nombre,
    correo:$('nl-correo').value.trim(), cel:$('nl-cel').value.trim(),
    paciente:$('nl-paciente').value.trim()||'—',
    edad: edadRaw ? parseInt(edadRaw,10) : null,
    genero:$('nl-genero').value,
    padecimiento:$('nl-padecimiento').value, temp:$('nl-temp').value, canal:$('nl-canal').value, etapa:$('nl-etapa').value,
    sigAct:'', sigFecha:'', nota:$('nl-notas').value.trim(),
    historial:[{t:fechaLarga(HOY), x:'Lead creado manualmente'}]
  };
  // Guardar en memoria local inmediatamente (UI responsiva)
  leadsData.push(l);
  closeModal('m-nuevo-lead');
  renderLeads(); renderNav();
  toast('Lead "'+nombre+'" agregado al pipeline');
  // Guardar en Google Sheets (campos exactos del Sheet)
  var ahora = new Date().toISOString();
  gs('createLead', {
    id:           l.id,
    nombre:       l.nombre,
    correo:       l.correo,
    celular:      l.cel,
    paciente:     l.paciente,
    edad:         l.edad,
    genero:       l.genero,
    padecimiento: l.padecimiento,
    temperatura:  l.temp,
    canal:        l.canal,
    etapa:        l.etapa,
    nota:         l.nota,
    historial:    JSON.stringify(l.historial),
    sigActTipo:   l.sigAct  || '',
    sigActFecha:  l.sigFecha|| '',
    sigActHora:   l.sigHora || '',
    creadoEn:     ahora,
    actualizadoEn:ahora
  }).then(function(res){
    if(!res.ok) console.error('[CDC GS] createLead:', res.error);
    else console.info('[CDC GS] Lead guardado en Sheets:', l.nombre);
  }).catch(function(err){ console.error('[CDC GS] createLead error:', err); });
}
/* ============================================================
   Bloque 3 — MÓDULO CLIENTES
   Acordeones · sesiones · cobros · onboarding · activación
   ============================================================ */

function recomputeCliente(c){
  if(!c.sesiones) return;
  var done = c.sesiones.filter(function(s){return s.estado==='done';}).length;
  c.cobrado = done * c.precioSes;
  c.porCobrar = (c.sesiones.length - done) * c.precioSes;
  if(c.sesiones.length>0 && done===c.sesiones.length && c.estado!=='Cancelado' && c.estado!=='Pausado'){
    c.estado = 'Completado';
  }
}

function renderClientesKpis(){
  var activos=0, ses=0, cob=0, por=0;
  clientesData.forEach(function(c){
    recomputeCliente(c);
    if(c.estado==='Activo') activos++;
    if(c.sesiones) ses += c.sesiones.filter(function(s){return s.estado==='done';}).length;
    cob += c.cobrado||0; por += c.porCobrar||0;
  });
  setText('ck-activos', activos);
  setText('ck-sesiones', ses);
  setText('ck-cobrado', money(cob));
  setText('ck-porcobrar', money(por));
}

function dotClass(estado){
  return estado==='done'?'sd-done':(estado==='next'?'sd-next':(estado==='scheduled'?'sd-scheduled':'sd-pending'));
}
function dotLabel(estado){
  return estado==='done'?'Impartida y cobrada':(estado==='next'?'Impartida · por cobrar':(estado==='scheduled'?'Agendada · por confirmar':'Por agendar'));
}

function sesTrackHtml(c){
  if(!c.sesiones || c.sesiones.length===0){
    return '<div style="font-size:12.5px;color:var(--ink-3);padding:6px 0">Aún sin sesiones. Completa el onboarding para activar el tratamiento.</div>';
  }
  var dots = c.sesiones.map(function(s){
    return '<div class="ses-dot '+dotClass(s.estado)+'" title="Sesión '+s.n+' · '+dotLabel(s.estado)+'" onclick="clickDot(\''+c.id+'\','+s.n+')">'+s.n+'</div>';
  }).join('');
  var leg = '<div class="ses-legend">'
    + '<span><i style="background:var(--green)"></i>Cobrada</span>'
    + '<span><i style="background:var(--blue)"></i>Por cobrar</span>'
    + '<span><i style="background:var(--orange-bg);border:1px solid #EBC79B"></i>Por confirmar</span>'
    + '<span><i style="background:var(--gray-bg)"></i>Por agendar</span></div>';
  return '<div class="ses-track">'+dots+'</div>'+leg;
}

function estadoControlHtml(c){
  var opts = Object.keys(ESTADO_CLI).map(function(e){
    return '<option'+(c.estado===e?' selected':'')+'>'+e+'</option>';
  }).join('');
  var html = '<div class="field" style="max-width:260px;margin-bottom:0"><label>Estado del cliente</label>'
    + '<select onchange="cambiarEstadoCliente(\''+c.id+'\',this.value)">'+opts+'</select></div>';
  if(c.estado==='Cancelado'){
    var rz = RAZONES_CANCEL.map(function(r){ return '<option'+(c.razonCancel===r?' selected':'')+'>'+r+'</option>'; }).join('');
    html += '<div class="field" style="max-width:320px;margin-top:12px;margin-bottom:0"><label>Razón de cancelación</label>'
      + '<select onchange="setRazonCancel(\''+c.id+'\',this.value)"><option value="">— Selecciona —</option>'+rz+'</select>';
    if(c.razonCancel==='Otro'){
      html += '<input type="text" style="margin-top:8px" placeholder="Especifica el motivo…" value="'+esc(c.razonOtro||'')+'" oninput="setRazonOtro(\''+c.id+'\',this.value)">';
    }
    html += '</div>';
  }
  if(c.estado==='Pausado' && c.razonPausa){
    html += '<div class="hint" style="margin-top:10px">Motivo de pausa: '+esc(c.razonPausa)+'</div>';
  }
  return html;
}

function accClienteHtml(c, open){
  var st = ESTADO_CLI[c.estado] || ESTADO_CLI['Activo'];
  var doneN = c.sesiones? c.sesiones.filter(function(s){return s.estado==='done';}).length : 0;
  var totalN = c.sesiones? c.sesiones.length : (c.numSes||0);
  var progPct = totalN? Math.round(doneN/totalN*100):0;

  var head = '<div class="acc-head" onclick="openAccordion(\''+c.id+'\')">'
    + '<div class="acc-stripe"></div>'
    + '<div class="acc-av">'+esc(initials(c.nombre))+'</div>'
    + '<div class="acc-id"><div class="nm">'+esc(c.nombre)+'</div><div class="sb">'+esc(c.paciente)+' · '+esc(c.servicio||c.padecimiento)+'</div></div>'
    + '<div class="acc-right">'
      + '<span class="badge '+st.badge+'">'+esc(st.label)+'</span>'
      + '<div class="acc-mini"><div class="v">'+(totalN?doneN+'/'+totalN:'—')+'</div><div class="l">Sesiones</div></div>'
      + '<svg class="acc-chev" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>'
    + '</div></div>';

  if(!open) return '<div class="acc '+st.cls+'">'+head+'</div>';

  // cuerpo (con IDs cd-* únicos porque solo hay un acordeón abierto)
  var body = '<div class="acc-body">';

  // onboarding pendiente
  if(c.estado==='En onboarding'){
    body += '<div class="panel panel-amber"><div class="panel-title">'+ico('reloj')+'Onboarding en proceso</div>'
      + '<div style="font-size:13px;color:var(--ink-2);margin-bottom:12px">Este cliente aún no tiene un tratamiento activo. Completa el cierre comercial y el setup clínico para activarlo.</div>'
      + '<button class="btn btn-primary btn-sm" id="cd-onboarding-btn" onclick="abrirOnboarding(\''+c.id+'\')">Continuar onboarding</button></div>';
  }

  // substats
  body += '<div class="subgrid">'
    + '<div class="substat"><div class="l">Paquete</div><div class="v" id="cd-monto">'+money(c.monto)+'</div></div>'
    + '<div class="substat"><div class="l">Cobrado</div><div class="v" id="cd-cobrado" style="color:var(--green)">'+money(c.cobrado)+'</div></div>'
    + '<div class="substat"><div class="l">Por cobrar</div><div class="v" id="cd-porcobrar" style="color:var(--amber)">'+money(c.porCobrar)+'</div></div>'
    + '<div class="substat"><div class="l">Avance</div><div class="v" id="cd-ses-kpi">'+progPct+'%</div></div>'
    + '</div>';

  // sesiones
  if(c.estado!=='En onboarding'){
    body += '<div class="panel-title" style="margin-top:4px">Sesiones</div>'+sesTrackHtml(c);
    body += '<div class="divider"></div>';
  }

  // estado / fiscal
  body += '<div style="display:flex;gap:30px;flex-wrap:wrap"><div>'+estadoControlHtml(c)+'</div>';
  body += '<div style="flex:1;min-width:220px"><div class="panel-title">Datos fiscales</div>'
    + '<div style="font-size:13px;color:var(--ink-2);line-height:1.9">'
    + '<div><b>RFC:</b> '+(esc(c.rfc)||'—')+'</div>'
    + '<div><b>Razón social:</b> '+(esc(c.razonSocial)||'—')+'</div>'
    + '<div><b>Uso CFDI:</b> '+(esc(c.usoCFDI)||'—')+'</div>'
    + '</div></div></div>';

  body += '</div>';
  return '<div class="acc '+st.cls+' open" id="acc-'+c.id+'">'+head+body+'</div>';
}

function renderClientes(){
  renderClientesKpis();
  var cont = $('clientes-acordeones'); if(!cont) return;
  setText('cli-count', clientesData.length+' clientes');
  var html = '';
  clientesData.forEach(function(c){ html += accClienteHtml(c, c.id===clienteAbiertoId); });
  cont.innerHTML = html;
}

function openAccordion(id){
  clienteAbiertoId = (clienteAbiertoId===id) ? null : id;
  renderClientes();
}

function cambiarEstadoCliente(id, estado){
  var c = getCliente(id); if(!c) return;
  c.estado = estado;
  if(estado!=='Cancelado'){ c.razonCancel=null; c.razonOtro=null; }
  renderClientes();
  toast(c.nombre+' → '+estado);
  gs('updateCliente', {id:id, estado:estado, actualizadoEn:new Date().toISOString()})
    .catch(function(e){ console.error('[CDC GS] updateCliente estado:',e); });
}
function setRazonCancel(id, r){ var c=getCliente(id); if(!c) return; c.razonCancel=r; if(r==='Otro') renderClientes(); }
function setRazonOtro(id, v){ var c=getCliente(id); if(c) c.razonOtro=v; }

/* ============================================================
   SESIONES — editor y flujo
   ============================================================ */
function clickDot(clienteId, n){
  var c = getCliente(clienteId); if(!c) return;
  var s = c.sesiones[n-1]; if(!s) return;
  sesionCtx = {clienteId:clienteId, n:n};

  setText('ses-ed-title', 'Sesión '+n+' · '+c.nombre);
  setText('ses-ed-sub', dotLabel(s.estado));
  $('ses-ed-fecha').value = s.fecha||'';
  $('ses-ed-hora').value = s.hora||'';
  $('ses-ed-notas').value = s.notas||'';

  // R5: clic en sesión 'next' (impartida, por cobrar) genera actividad de cobro en Hoy si no existe
  if(s.estado==='next'){
    var actId = 'cobro-'+clienteId+'-'+n;
    if(!getActividad(actId)){
      actividadesData.push({id:actId, prospecto:c.nombre, refTipo:'cliente', refId:clienteId, tipo:'Cobrar sesión '+n, fecha:HOY, grupo:'hoy', done:false, urgente:true,
        contexto:'Sesión '+n+' impartida, pendiente de cobro ('+money(s.precio)+'). Registrar el pago para mantener la cartera al día.'});
      renderNav();
    }
  }

  // badge de estado
  var bcls = s.estado==='done'?'b-green':(s.estado==='next'?'b-blue':(s.estado==='scheduled'?'b-orange':'b-gray'));
  // R6: panel 'next' siempre arranca en "Por confirmar"
  var badgeTxt = s.estado==='next' ? 'Por confirmar cobro' : dotLabel(s.estado);
  setHtml('ses-ed-statusrow', '<span class="badge '+bcls+'">'+badgeTxt+'</span>');

  // panel de cobro y footer según estado
  var foot = '<button class="btn btn-ghost" onclick="closeModal(\'m-ses-editar\')">Cerrar</button>';
  var cobroPanel = '';
  if(s.estado==='pending'){
    foot += '<button class="btn btn-primary" onclick="agendarSesion()">Agendar sesión</button>';
  } else if(s.estado==='scheduled'){
    foot += '<button class="btn btn-soft" onclick="guardarSesion()">Guardar</button>';
    foot += '<button class="btn btn-primary" onclick="marcarImpartida()">Marcar impartida</button>';
  } else if(s.estado==='next'){
    cobroPanel = '<div class="panel panel-blue"><div class="panel-title">'+ico('cobro')+'Cobro pendiente</div>'
      + '<div style="font-size:13px;color:var(--ink-2)">Sesión impartida. Registra el cobro de <b>'+money(s.precio)+'</b> para completarla.</div></div>';
    foot += '<button class="btn btn-primary" onclick="closeModal(\'m-ses-editar\');openCobro(\''+clienteId+'\','+n+')">Registrar cobro</button>';
  } else { // done
    cobroPanel = '<div class="panel" style="background:var(--green-bg);border-color:var(--green-bd)"><div class="panel-title" style="color:var(--green)">'+ico('cobro')+'Sesión completada</div>'
      + '<div style="font-size:13px;color:var(--ink-2)">Impartida y cobrada ('+money(s.precio)+').</div></div>';
    foot += '<button class="btn btn-primary" onclick="guardarSesion()">Guardar notas</button>';
  }
  setHtml('ses-ed-cobro-panel', cobroPanel);
  setHtml('ses-ed-foot', foot);
  openModal('m-ses-editar');
}

function _curSes(){ if(!sesionCtx) return null; var c=getCliente(sesionCtx.clienteId); if(!c) return null; return {c:c, s:c.sesiones[sesionCtx.n-1]}; }

function agendarSesion(){
  var x=_curSes(); if(!x){closeModal('m-ses-editar');return;}
  var f=$('ses-ed-fecha').value;
  if(!f){ toast('Selecciona una fecha para agendar'); return; }
  x.s.fecha=f; x.s.hora=$('ses-ed-hora').value||'10:00'; x.s.notas=$('ses-ed-notas').value;
  x.s.estado='scheduled';
  closeModal('m-ses-editar'); renderClientes();
  toast('Sesión '+sesionCtx.n+' agendada para el '+fechaLarga(f));
  gs('updateSesion', {id:'s-'+sesionCtx.clienteId+'-'+sesionCtx.n,
    estado:'scheduled', fecha:f, hora:x.s.hora, actualizadoEn:new Date().toISOString()
  }).catch(function(e){ console.error('[CDC GS] updateSesion error:',e); });
}
function guardarSesion(){
  var x=_curSes(); if(!x){closeModal('m-ses-editar');return;}
  x.s.fecha=$('ses-ed-fecha').value; x.s.hora=$('ses-ed-hora').value; x.s.notas=$('ses-ed-notas').value;
  closeModal('m-ses-editar'); renderClientes();
  toast('Sesión actualizada');
}
function marcarImpartida(){
  var x=_curSes(); if(!x){closeModal('m-ses-editar');return;}
  x.s.notas=$('ses-ed-notas').value;
  x.s.estado='next';
  closeModal('m-ses-editar'); renderClientes();
  toast('Sesión '+sesionCtx.n+' marcada como impartida · pendiente de cobro');
  gs('updateSesion', {id:'s-'+sesionCtx.clienteId+'-'+sesionCtx.n,
    estado:'next', notas:x.s.notas, actualizadoEn:new Date().toISOString()
  }).catch(function(e){ console.error('[CDC GS] updateSesion error:',e); });
}

/* ----- Cobro (R4) ----- */
function cbActualizarCuenta(){
  var metodo = $('cb-metodo').value;
  var cuentas = cuentasPorMetodo[metodo] || [];
  setHtml('cb-cuenta', cuentas.map(function(c){return '<option>'+esc(c)+'</option>';}).join(''));
}
function openCobro(clienteId, n){
  var c = getCliente(clienteId); if(!c) return;
  var s = c.sesiones[n-1]; if(!s) return;
  sesionCtx = {clienteId:clienteId, n:n};
  setText('cb-sub', c.nombre+' · Sesión '+n);
  $('cb-monto').value = s.precio||c.precioSes||0;
  $('cb-fecha').value = HOY;
  $('cb-metodo').value = 'Transferencia';
  cbActualizarCuenta();
  $('cb-factura').value = 'No';
  openModal('m-cobro');
}
function registrarCobro(){
  var x=_curSes(); if(!x){closeModal('m-cobro');return;}
  var monto = Number($('cb-monto').value)||0;
  var fecha = $('cb-fecha').value || HOY;
  var metodo = $('cb-metodo').value;
  var cuenta = $('cb-cuenta').value || (cuentasPorMetodo[metodo]||[''])[0];
  var requiereFactura = $('cb-factura').value==='Sí';
  x.s.estado='done';
  x.s.fecha = x.s.fecha || fecha;
  x.s.precio = monto;
  var actId = 'cobro-'+sesionCtx.clienteId+'-'+sesionCtx.n;
  var act = getActividad(actId); if(act) act.done=true;
  ingresosData.push({id:uid('in'), cliente:x.c.nombre, concepto:'Sesión '+sesionCtx.n+' · EMT', monto:monto, fecha:fecha, metodo:metodo, cuenta:cuenta, factura:(requiereFactura?'Sí':'No'), conciliado:false});
  if(requiereFactura){ agregarFacturaPendiente(x.c, sesionCtx.n, monto, fecha); }
  closeModal('m-cobro');
  recomputeCliente(x.c);
  renderClientes(); renderNav();
  toast('Cobro de '+money(monto)+' registrado'+(requiereFactura?' · factura en cola':''));
  // Guardar en Sheets
  var ahora = new Date().toISOString();
  var sesId = 's-'+sesionCtx.clienteId+'-'+sesionCtx.n;
  gs('updateSesion', {id:sesId, estado:'done', fecha:x.s.fecha,
    precio:monto, cobrada:'Sí', facturaRequerida:(requiereFactura?'Sí':'No'),
    actualizadoEn:ahora
  }).catch(function(e){ console.error('[CDC GS] updateSesion cobro:',e); });
  gs('createCobro', {
    id:uid('co'), clienteId:x.c.id, sesionId:sesId,
    sesionN:sesionCtx.n, monto:monto, fecha:fecha,
    metodo:metodo, cuenta:cuenta,
    facturaRequerida:(requiereFactura?'Sí':'No'), creadoEn:ahora
  }).catch(function(e){ console.error('[CDC GS] createCobro:',e); });
  gs('updateCliente', {id:x.c.id,
    cobrado:x.c.cobrado, porCobrar:x.c.porCobrar, actualizadoEn:ahora
  }).catch(function(e){ console.error('[CDC GS] updateCliente cobro:',e); });
  if(requiereFactura){
    gs('createFactura', {
      id:uid('f'), clienteId:x.c.id, clienteNombre:x.c.nombre,
      sesionId:sesId, sesionN:sesionCtx.n, monto:monto, fecha:fecha,
      estatus:'Por crear', folio:'',
      rfc:x.c.rfc||'', razonSocial:x.c.razonSocial||'', usoCFDI:x.c.usoCFDI||'',
      creadoEn:ahora, actualizadoEn:ahora
    }).catch(function(e){ console.error('[CDC GS] createFactura:',e); });
  }
}

/* ============================================================
   ONBOARDING — checks, recálculo (R2), activación (R3)
   ============================================================ */
function abrirOnboarding(clienteId, fresh, prevEtapa, leadId){
  var c = getCliente(clienteId); if(!c) return;
  onbCtx = {clienteId:clienteId, fresh:!!fresh, prevEtapa:prevEtapa||null, leadId:leadId||null};
  c.onboarding = c.onboarding || {};
  setText('ob-nombre', c.nombre);
  renderObChecks(c);
  // datos de tratamiento
  $('ob-num-sesiones').value = c.numSes || '';
  $('ob-fecha-primera').value = c.fechaPrimera || '';
  $('ob-monto-total').value = c.monto || '';
  $('ob-servicio').value = c.servicio || '';
  var cb = $('ob-cancelar-btn'); if(cb) cb.style.display = fresh ? '' : 'none';
  obTab(1);
  obRecalc();
  openModal('m-onboarding');
}
function cancelarOnboarding(){
  if(!onbCtx){ closeModal('m-onboarding'); return; }
  if(onbCtx.fresh){
    var cid = onbCtx.clienteId, lid = onbCtx.leadId, prev = onbCtx.prevEtapa||'Cotizado';
    // eliminar el cliente recién creado
    clientesData = clientesData.filter(function(c){ return c.id!==cid; });
    // regresar el lead a su etapa previa
    var l = lid ? getLead(lid) : null;
    if(l){
      l.etapa = prev;
      l.historial = l.historial||[];
      l.historial.unshift({t:fechaLarga(HOY), x:'Onboarding cancelado · regresó a '+prev});
    }
    closeModal('m-onboarding');
    nav('leads'); renderLeads(); renderNav();
    toast('Onboarding cancelado · '+(l?l.nombre:'lead')+' regresó a '+prev);
  } else {
    closeModal('m-onboarding');
  }
}

function renderObChecks(c){
  var f1='', f2='';
  ONB_CHECKS.forEach(function(ch){
    var on = c.onboarding[ch.key];
    var row = '<label class="checkrow'+(on?' on':'')+'" onclick="toggleObCheck(\''+ch.key+'\')">'
      + '<span class="cbox"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>'
      + '<span><span class="ct">'+ch.t+'</span><br><span class="cd">'+ch.d+'</span></span></label>';
    if(ch.fase===1) f1+=row; else f2+=row;
  });
  setHtml('ob-checks-1', f1);
  setHtml('ob-checks-2', f2);
}

function toggleObCheck(key){
  var c = getCliente(onbCtx.clienteId); if(!c) return;
  c.onboarding[key] = !c.onboarding[key];
  renderObChecks(c);
  obRecalc();
}

function obTab(n){
  $('obtab-1').classList.toggle('active', n===1);
  $('obtab-2').classList.toggle('active', n===2);
  $('obpane-1').classList.toggle('active', n===1);
  $('obpane-2').classList.toggle('active', n===2);
}

function obRecalc(){
  if(!onbCtx) return;
  var c = getCliente(onbCtx.clienteId); if(!c) return;
  // progreso de checks
  var total = ONB_CHECKS.length;
  var hechos = ONB_CHECKS.filter(function(ch){return c.onboarding[ch.key];}).length;
  var pct = Math.round(hechos/total*100);
  $('ob-progress-bar').style.width = pct+'%';
  setText('ob-progress-txt', pct+'%');
  var checksDone = (hechos===total);
  // R2: requiere # sesiones + fecha + monto + servicio
  var ns = $('ob-num-sesiones').value, fp = $('ob-fecha-primera').value, mt = $('ob-monto-total').value, sv = $('ob-servicio').value;
  var fieldsOk = ns && Number(ns)>0 && fp && mt && Number(mt)>0 && sv;
  var listo = checksDone && fieldsOk;
  var btn = $('ob-activar-btn');
  if(btn) btn.disabled = !listo;
  var falta = total - hechos;
  var hint;
  if(listo) hint = 'Todo completo · listo para activar';
  else if(!checksDone && !fieldsOk) hint = 'Faltan '+falta+' punto(s) de onboarding y los datos de tratamiento';
  else if(!checksDone) hint = 'Faltan '+falta+' punto(s) de onboarding por marcar';
  else hint = 'Completa los 4 datos de tratamiento (*)';
  setText('ob-hint', hint);
}

/* R3: activar cliente */
function activarCliente(){
  var c = getCliente(onbCtx.clienteId); if(!c){ closeModal('m-onboarding'); return; }
  var ns = Number($('ob-num-sesiones').value)||0;
  var fp = $('ob-fecha-primera').value;
  var mt = Number($('ob-monto-total').value)||0;
  var sv = $('ob-servicio').value;
  var todos = ONB_CHECKS.every(function(ch){return c.onboarding[ch.key];});
  if(!todos){ toast('Marca los '+ONB_CHECKS.length+' puntos de onboarding antes de activar'); return; }
  if(!(ns>0 && fp && mt>0 && sv)){ toast('Faltan datos de tratamiento'); return; }
  c.numSes = ns; c.fechaPrimera = fp; c.monto = mt; c.servicio = sv;
  c.precioSes = Math.round(mt/ns);
  c.sesiones = mkSesiones(ns, 0, c.precioSes, fp, false);
  c.estado = 'Activo';
  recomputeCliente(c);
  closeModal('m-onboarding');
  clienteAbiertoId = c.id;
  nav('clientes');
  toast(c.nombre+' activado · tratamiento iniciado');
  // Actualizar cliente en Sheets
  var ahora = new Date().toISOString();
  gs('updateCliente', {
    id:c.id, servicio:sv, estado:'Activo',
    numSes:ns, precioSes:c.precioSes, monto:mt,
    cobrado:0, porCobrar:mt, actualizadoEn:ahora
  }).then(function(r){ if(!r.ok) console.error('[CDC GS] updateCliente activar:',r.error); })
    .catch(function(e){ console.error('[CDC GS] updateCliente error:',e); });
  // Crear sesiones en Sheets
  c.sesiones.forEach(function(s){
    gs('createSesion', {
      id:'s-'+c.id+'-'+s.n, clienteId:c.id,
      n:s.n, estado:s.estado, fecha:s.fecha||'',
      hora:s.hora||'', notas:'', precio:s.precio,
      cobrada:'No', facturaRequerida:'No', folioCFDI:'',
      creadoEn:ahora, actualizadoEn:ahora
    }).catch(function(e){ console.error('[CDC GS] createSesion error:',e); });
  });
}
/* ============================================================
   Bloque 4 — MÓDULOS EGRESOS y FACTURAS
   ============================================================ */

/* ===================== EGRESOS ===================== */
function finKpiCard(cls, iconName, val, lbl){
  return '<div class="kpi '+cls+'"><div class="ic">'+ico(iconName)+'</div><div class="val">'+val+'</div><div class="lbl">'+lbl+'</div></div>';
}
function renderFinKpis(which){
  var cont = $('fin-kpis'); if(!cont) return;
  var html='';
  if(which==='ingresos'){
    var mesIn = ingresosData.filter(function(i){return (i.fecha||'').slice(0,7)==='2025-05';});
    var totalIn = mesIn.reduce(function(s,i){return s+(i.monto||0);},0);
    var sinConc = ingresosData.filter(function(i){return !i.conciliado;}).length;
    var fact = ingresosData.filter(function(i){return i.factura==='Sí';}).reduce(function(s,i){return s+(i.monto||0);},0);
    html += finKpiCard('x-green','cobro', money(totalIn), 'Ingresos del mes');
    html += finKpiCard('x-blue','cita', mesIn.length, 'Cobros del mes');
    html += finKpiCard('x-violet','doc', sinConc, 'Sin conciliar');
    html += finKpiCard('x-primary','doc', money(fact), 'Facturados');
  } else {
    var mes = historialEgresos.filter(function(e){return (e.fecha||'').slice(0,7)==='2025-05';}).reduce(function(s,e){return s+(e.monto||0);},0);
    var _mesAct = HOY.slice(0,7);
    var fijosMes = pagosFijos.filter(function(p){return (p.pagadoMes||'')!==_mesAct;}).reduce(function(s,p){return s+(p.monto||0);},0);
    var ded = historialEgresos.filter(function(e){return e.deducible==='Sí';}).reduce(function(s,e){return s+(e.monto||0);},0);
    html += finKpiCard('x-red','cobro', money(mes+fijosMes), 'Egresos del mes');
    html += finKpiCard('x-amber','reloj', porPagarData.length, 'Por pagar');
    html += finKpiCard('x-violet','doc', historialEgresos.filter(function(e){return !e.conciliado;}).length, 'Sin conciliar');
    html += finKpiCard('x-green','doc', money(ded), 'Deducibles');
  }
  cont.innerHTML = html;
}

function egSection(titulo, sub, count, bodyRows, btn){
  return '<div class="card" style="margin-bottom:16px;overflow:hidden">'
    + '<div class="acc-head" style="cursor:default;background:var(--surface-2)">'
      + '<div class="acc-id"><div class="nm" style="font-size:14px">'+titulo+'</div><div class="sb">'+sub+'</div></div>'
      + '<div class="acc-right"><span class="badge b-gray">'+count+'</span>'+(btn||'')+'</div>'
    + '</div>'
    + '<div style="padding:6px 18px 10px">'+bodyRows+'</div></div>';
}

function renderEgresos(){
  var cont = $('egresos-acordeones'); if(!cont) return;
  var html = '';

  // Pagos fijos (solo los que faltan por cubrir este mes)
  var mesActual = HOY.slice(0,7);
  var fijosPend = pagosFijos.filter(function(p){ return (p.pagadoMes||'') !== mesActual; });
  var fijosCubiertos = pagosFijos.length - fijosPend.length;
  var pfRows = fijosPend.length? fijosPend.map(function(p){
    return '<div class="histrow" style="cursor:pointer" onclick="openPagoDetalle(\''+p.id+'\')">'
      + '<div class="act-ico" style="width:34px;height:34px;background:var(--blue-bg);color:var(--blue)">'+ico('cita')+'</div>'
      + '<div style="flex:1"><b style="font-weight:650">'+esc(p.nombre)+'</b><div class="meta" style="font-size:12px;color:var(--ink-3)">Cada día '+p.dia+' · '+esc(p.cat)+' · '+esc(p.cuenta)+'</div></div>'
      + '<div style="font-weight:700">'+money(p.monto)+'</div></div>';
  }).join('') : '<div class="empty" style="padding:18px">Todos los pagos fijos de este mes están cubiertos ✓<div style="font-size:12px;color:var(--ink-3);margin-top:4px">Reaparecerán el próximo mes.</div></div>';
  if(fijosPend.length && fijosCubiertos>0){
    pfRows += '<div style="padding:8px 4px 2px;font-size:12px;color:var(--ink-3)">'+fijosCubiertos+' ya cubierto'+(fijosCubiertos>1?'s':'')+' este mes (en el historial).</div>';
  }
  var pfBtn = '<button class="btn btn-soft btn-sm" onclick="event.stopPropagation();openPagoFijo()">+ Pago fijo</button>';
  html += egSection('Pagos fijos', 'Egresos recurrentes mensuales', fijosPend.length, pfRows, pfBtn);

  // Por pagar
  var ppRows = porPagarData.length? porPagarData.map(function(p){
    var venc = p.limite < HOY;
    return '<div class="histrow" style="cursor:pointer" onclick="openPagoDetalle(\''+p.id+'\')">'
      + '<div class="act-ico" style="width:34px;height:34px;background:'+(venc?'var(--red-bg)':'var(--amber-bg)')+';color:'+(venc?'var(--red)':'var(--amber)')+'">'+ico('reloj')+'</div>'
      + '<div style="flex:1"><b style="font-weight:650">'+esc(p.nombre)+'</b><div class="meta" style="font-size:12px;color:var(--ink-3)">Límite '+fechaLarga(p.limite)+' · '+esc(p.cat)+(venc?' · <span style="color:var(--red);font-weight:600">Vencido</span>':'')+'</div></div>'
      + '<div style="font-weight:700;margin-right:10px">'+money(p.monto)+'</div>'
      + '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openPagoDetalle(\''+p.id+'\')">Pagar</button></div>';
  }).join('') : '<div class="empty" style="padding:18px">Nada por pagar 🎉</div>';
  html += egSection('Por pagar', 'Egresos programados pendientes', porPagarData.length, ppRows, '');

  // Historial
  var heRows = historialEgresos.length? historialEgresos.slice().sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');}).map(function(e){
    return '<div class="histrow" style="cursor:pointer" onclick="openEgresoDetalle(\''+e.id+'\')">'
      + '<div class="act-ico" style="width:34px;height:34px;background:var(--gray-bg);color:var(--ink-2)">'+ico('cobro')+'</div>'
      + '<div style="flex:1"><b style="font-weight:650">'+esc(e.nombre)+'</b><div class="meta" style="font-size:12px;color:var(--ink-3)">'+fechaLarga(e.fecha)+' · '+esc(e.metodo)+' · '+esc(e.cuenta||'—')+' · '+esc(e.cat)+'</div></div>'
      + (e.deducible==='Sí'?'<span class="badge b-green" style="margin-right:8px">Deducible</span>':'')
      + '<div style="font-weight:700;margin-right:10px">'+money(e.monto)+'</div>'
      + concBtn('egreso', e.id, e.conciliado)+'</div>';
  }).join('') : '<div class="empty" style="padding:18px">Sin egresos registrados</div>';
  html += egSection('Historial de egresos', 'Pagos ya realizados', historialEgresos.length, heRows, '');

  cont.innerHTML = html;
  renderFinKpis(finTabActual);
}

function concBtn(tipo, id, conc){
  var fn = tipo==='ingreso' ? 'toggleConciliarIngreso' : 'toggleConciliarEgreso';
  if(conc){
    return '<button class="btn btn-sm" style="background:var(--green-bg);color:var(--green);border-color:transparent" onclick="event.stopPropagation();'+fn+'(\''+id+'\')">✓ Conciliado</button>';
  }
  return '<button class="btn btn-soft btn-sm" onclick="event.stopPropagation();'+fn+'(\''+id+'\')">Conciliar</button>';
}
function toggleConciliarEgreso(id){
  var e=getEgreso(id); if(!e) return;
  e.conciliado=!e.conciliado;
  renderEgresos(); renderFinKpis(finTabActual);
  toast(e.conciliado?'Egreso conciliado con banco':'Egreso marcado como pendiente de conciliar');
  gs('updateEgreso', {id:id, conciliado:(e.conciliado?'Sí':'No'), actualizadoEn:new Date().toISOString()})
    .catch(function(err){ console.error('[CDC GS] updateEgreso conciliar:',err); });
}
function toggleConciliarIngreso(id){
  var i=getIngreso(id); if(!i) return;
  i.conciliado=!i.conciliado;
  renderIngresos(); renderFinKpis(finTabActual);
  toast(i.conciliado?'Ingreso conciliado con banco':'Ingreso marcado como pendiente de conciliar');
}
function renderIngresos(){
  var cont = $('ingresos-acordeones'); if(!cont) return;
  var rows = ingresosData.length? ingresosData.slice().sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');}).map(function(i){
    return '<div class="histrow">'
      + '<div class="act-ico" style="width:34px;height:34px;background:var(--green-bg);color:var(--green)">'+ico('cobro')+'</div>'
      + '<div style="flex:1"><b style="font-weight:650">'+esc(i.cliente)+'</b><div class="meta" style="font-size:12px;color:var(--ink-3)">'+fechaLarga(i.fecha)+' · '+esc(i.concepto)+' · '+esc(i.metodo)+' · '+esc(i.cuenta||'—')+'</div></div>'
      + (i.factura==='Sí'?'<span class="badge b-blue" style="margin-right:8px">Facturado</span>':'')
      + '<div style="font-weight:700;color:var(--green);margin-right:10px">'+money(i.monto)+'</div>'
      + concBtn('ingreso', i.id, i.conciliado)+'</div>';
  }).join('') : '<div class="empty" style="padding:18px">Sin ingresos registrados</div>';
  var html = egSection('Historial de ingresos', 'Cobros recibidos de clientes', ingresosData.length, rows, '');
  cont.innerHTML = html;
}
var finTabActual = 'egresos';
function finTab(which){
  finTabActual = which;
  ['egresos','ingresos'].forEach(function(t){
    var tab=$('fintab-'+t); if(tab) tab.classList.toggle('active', t===which);
  });
  var egC=$('egresos-acordeones'), inC=$('ingresos-acordeones');
  if(egC) egC.style.display = which==='egresos'?'':'none';
  if(inC) inC.style.display = which==='ingresos'?'':'none';
  setText('fin-head', which==='ingresos'?'Ingresos':'Egresos');
  var btn=$('fin-nuevo-btn'); if(btn) btn.style.display = which==='ingresos'?'none':'';
  renderFinKpis(which);
}
function renderFinanzas(){
  renderEgresos();
  renderIngresos();
  finTab(finTabActual);
}

/* ----- Nuevo egreso ----- */
var neTabActual = 'ya';
function openNuevoEgreso(){
  $('ne-nombre').value=''; $('ne-monto').value=''; $('ne-cat').value='Renta';
  $('ne-fecha').value=HOY; $('ne-metodo').value='Transferencia'; $('ne-deducible').value='Sí';
  $('ne-limite').value=''; $('ne-dia').value=''; $('ne-rec-metodo').value='Transferencia';
  var cr=$('ne-conciliado-row'); if(cr) cr.classList.remove('on');
  neActualizarCuenta();
  neTab('ya');
  openModal('m-nuevo-egreso');
}
function neTab(t){
  neTabActual = t;
  ['ya','prog','rec'].forEach(function(k){
    var tab=$('netab-'+k), pane=$('nepane-'+k);
    if(tab) tab.classList.toggle('active', k===t);
    if(pane) pane.classList.toggle('active', k===t);
  });
}
/* R7: cuenta según método */
function neActualizarCuenta(){
  var metodo = $('ne-metodo').value;
  var cuentas = cuentasPorMetodo[metodo] || [];
  setHtml('ne-cuenta', cuentas.map(function(c){return '<option>'+esc(c)+'</option>';}).join(''));
}
function guardarNuevoEgreso(){
  var nombre = $('ne-nombre').value.trim();
  var monto = Number($('ne-monto').value)||0;
  if(!nombre){ toast('Captura el concepto'); return; }
  if(monto<=0){ toast('Captura un monto válido'); return; }
  var cat = $('ne-cat').value;
  var ahora = new Date().toISOString();
  if(neTabActual==='ya'){
    var eg = {id:uid('he'), nombre:nombre, monto:monto, fecha:$('ne-fecha').value||HOY, metodo:$('ne-metodo').value, cat:cat, cuenta:$('ne-cuenta').value||'', deducible:$('ne-deducible').value, conciliado:$('ne-conciliado-row').classList.contains('on')};
    historialEgresos.push(eg);
    gs('createEgreso', {id:eg.id, nombre:eg.nombre, monto:eg.monto, cat:eg.cat, fecha:eg.fecha, metodo:eg.metodo, cuenta:eg.cuenta, deducible:eg.deducible, conciliado:(eg.conciliado?'Sí':'No'), tipo:'historial', limite:'', creadoEn:ahora, actualizadoEn:ahora})
      .catch(function(e){ console.error('[CDC GS] createEgreso:',e); });
    toast('Egreso registrado en historial');
  } else if(neTabActual==='prog'){
    var pp = {id:uid('pp'), nombre:nombre, monto:monto, cat:cat, limite:$('ne-limite').value||HOY, metodo:'Transferencia'};
    porPagarData.push(pp);
    gs('createEgreso', {id:pp.id, nombre:pp.nombre, monto:pp.monto, cat:pp.cat, fecha:'', metodo:pp.metodo, cuenta:'', deducible:'Sí', conciliado:'No', tipo:'porpagar', limite:pp.limite, creadoEn:ahora, actualizadoEn:ahora})
      .catch(function(e){ console.error('[CDC GS] createEgreso prog:',e); });
    toast('Egreso programado en "Por pagar"');
  } else {
    var pf = {id:uid('pf'), nombre:nombre, monto:monto, dia:Number($('ne-dia').value)||1, cat:cat, cuenta:(cuentasPorMetodo[$('ne-rec-metodo').value]||['BBVA 4521'])[0]};
    pagosFijos.push(pf);
    gs('createEgreso', {id:pf.id, nombre:pf.nombre, monto:pf.monto, cat:pf.cat, fecha:'', metodo:'', cuenta:pf.cuenta, deducible:'Sí', conciliado:'No', tipo:'fijo', limite:'', creadoEn:ahora, actualizadoEn:ahora})
      .catch(function(e){ console.error('[CDC GS] createEgreso fijo:',e); });
    toast('Pago fijo recurrente creado');
  }
  closeModal('m-nuevo-egreso');
  renderEgresos();
}

/* ----- Pago fijo (alta rápida) ----- */
function openPagoFijo(){
  $('pf-nombre').value=''; $('pf-monto').value=''; $('pf-dia').value=''; $('pf-cat').value='Renta'; $('pf-cuenta').value='BBVA 4521';
  openModal('m-pago-fijo');
}
function guardarPagoFijo(){
  var nombre=$('pf-nombre').value.trim(); var monto=Number($('pf-monto').value)||0;
  if(!nombre || monto<=0){ toast('Completa concepto y monto'); return; }
  var pfn = {id:uid('pf'), nombre:nombre, monto:monto, dia:Number($('pf-dia').value)||1, cat:$('pf-cat').value, cuenta:$('pf-cuenta').value};
  pagosFijos.push(pfn);
  var ahora = new Date().toISOString();
  gs('createEgreso', {id:pfn.id, nombre:pfn.nombre, monto:pfn.monto, cat:pfn.cat, fecha:'', metodo:'', cuenta:pfn.cuenta, deducible:'Sí', conciliado:'No', tipo:'fijo', limite:'', creadoEn:ahora, actualizadoEn:ahora})
    .catch(function(e){ console.error('[CDC GS] createEgreso pagoFijo:',e); });
  closeModal('m-pago-fijo'); renderEgresos();
  toast('Pago fijo "'+nombre+'" creado');
}

/* ----- Detalle pago (fijo o por pagar) ----- */
function getPagoFijo(id){ for(var i=0;i<pagosFijos.length;i++){if(pagosFijos[i].id===id)return pagosFijos[i];} return null; }
function getPorPagar(id){ for(var i=0;i<porPagarData.length;i++){if(porPagarData[i].id===id)return porPagarData[i];} return null; }
function getEgreso(id){ for(var i=0;i<historialEgresos.length;i++){if(historialEgresos[i].id===id)return historialEgresos[i];} return null; }
function getIngreso(id){ for(var i=0;i<ingresosData.length;i++){if(ingresosData[i].id===id)return ingresosData[i];} return null; }

var EG_CATS = ['Renta','Nómina','Servicios','Insumos','Equipo','Software','Marketing','Otro'];
var EG_METODOS = ['Transferencia','Tarjeta','Efectivo','Cheque'];
function optionsHtml(arr, sel){
  return arr.map(function(o){ return '<option'+(o===sel?' selected':'')+'>'+esc(o)+'</option>'; }).join('');
}
function metodoDeCuenta(cuenta){
  for(var m in cuentasPorMetodo){ if(cuentasPorMetodo[m].indexOf(cuenta)>=0) return m; }
  return 'Transferencia';
}
function pgdActualizarCuenta(){
  var metodo = $('pgd-metodo').value;
  var cuentas = cuentasPorMetodo[metodo] || [];
  setHtml('pgd-cuenta', cuentas.map(function(c){return '<option>'+esc(c)+'</option>';}).join(''));
}
function openPagoDetalle(id){
  var pf=getPagoFijo(id), pp=getPorPagar(id);
  var p = pf||pp; if(!p) return;
  egresoCtx = {tipo: pf?'fijo':'pendiente', id:id};
  setText('pgd-nombre', p.nombre);
  setText('pgd-sub', pf? ('Pago fijo · cada día '+p.dia) : ('Por pagar · límite '+fechaLarga(p.limite)));
  var metodo = p.metodo || (pf ? metodoDeCuenta(p.cuenta) : 'Transferencia');
  var cuentas = cuentasPorMetodo[metodo] || [];
  var cuentaSel = (p.cuenta && cuentas.indexOf(p.cuenta)>=0) ? p.cuenta : (cuentas[0]||'');
  var body = ''
    + '<div class="field-row">'
      + '<div class="field"><label>Monto</label><input id="pgd-monto" type="number" min="0" value="'+(p.monto||0)+'"></div>'
      + '<div class="field"><label>Fecha de pago</label><input id="pgd-fecha" type="date" value="'+HOY+'"></div>'
    + '</div>'
    + '<div class="field-row">'
      + '<div class="field"><label>Método de pago</label><select id="pgd-metodo" onchange="pgdActualizarCuenta()">'+optionsHtml(EG_METODOS, metodo)+'</select></div>'
      + '<div class="field"><label>Cuenta</label><select id="pgd-cuenta">'+optionsHtml(cuentas, cuentaSel)+'</select></div>'
    + '</div>'
    + '<div class="field-row">'
      + '<div class="field"><label>Categoría</label><select id="pgd-cat">'+optionsHtml(EG_CATS, p.cat)+'</select></div>'
      + '<div class="field"><label>Deducible</label><select id="pgd-deducible"><option>Sí</option><option>No</option></select></div>'
    + '</div>';
  setHtml('pgd-body', body);
  var foot = '<button class="btn btn-ghost" onclick="closeModal(\'m-pago-detalle\')">Cerrar</button>'
    + '<button class="btn btn-primary" onclick="registrarPagoDesdeDetalle()">Registrar pago</button>';
  setHtml('pgd-foot', foot);
  openModal('m-pago-detalle');
}
function registrarPagoDesdeDetalle(){
  if(!egresoCtx) return;
  var monto=Number($('pgd-monto').value)||0;
  if(monto<=0){ toast('Captura un monto válido'); return; }
  var fecha=$('pgd-fecha').value||HOY;
  var metodo=$('pgd-metodo').value;
  var cuenta=$('pgd-cuenta').value||(cuentasPorMetodo[metodo]||[''])[0];
  var cat=$('pgd-cat').value;
  var deducible=$('pgd-deducible').value;
  var ahora = new Date().toISOString();
  if(egresoCtx.tipo==='pendiente'){
    var pp=getPorPagar(egresoCtx.id); var nombre = pp?pp.nombre:'Pago';
    var newId = uid('he');
    historialEgresos.push({id:newId, nombre:nombre, monto:monto, fecha:fecha, metodo:metodo, cat:cat, cuenta:cuenta, deducible:deducible, conciliado:false});
    porPagarData = porPagarData.filter(function(x){return x.id!==egresoCtx.id;});
    gs('createEgreso', {id:newId, nombre:nombre, monto:monto, cat:cat, fecha:fecha, metodo:metodo, cuenta:cuenta, deducible:deducible, conciliado:'No', tipo:'historial', limite:'', creadoEn:ahora, actualizadoEn:ahora})
      .catch(function(e){ console.error('[CDC GS] createEgreso pendiente:',e); });
    gs('updateEgreso', {id:egresoCtx.id, tipo:'pagado', actualizadoEn:ahora})
      .catch(function(e){ console.error('[CDC GS] updateEgreso pendiente:',e); });
    toast('"'+nombre+'" pagado y movido al historial');
  } else {
    var pfijo=getPagoFijo(egresoCtx.id); var nf = pfijo?(pfijo.nombre+' (mes en curso)'):'Pago fijo';
    var newId2 = uid('he');
    historialEgresos.push({id:newId2, nombre:nf, monto:monto, fecha:fecha, metodo:metodo, cat:cat, cuenta:cuenta, deducible:deducible, conciliado:false});
    if(pfijo){ pfijo.pagadoMes = HOY.slice(0,7); }
    gs('createEgreso', {id:newId2, nombre:nf, monto:monto, cat:cat, fecha:fecha, metodo:metodo, cuenta:cuenta, deducible:deducible, conciliado:'No', tipo:'historial', limite:'', creadoEn:ahora, actualizadoEn:ahora})
      .catch(function(e){ console.error('[CDC GS] createEgreso fijoPago:',e); });
    toast('Pago fijo cubierto este mes · reaparecerá el próximo mes');
  }
  closeModal('m-pago-detalle'); renderEgresos(); renderFinKpis(finTabActual);
}
function pagarPendiente(id){
  var p=getPorPagar(id); if(!p) return;
  historialEgresos.push({id:uid('he'), nombre:p.nombre, monto:p.monto, fecha:HOY, metodo:p.metodo||'Transferencia', cat:p.cat, cuenta:(cuentasPorMetodo[p.metodo]||['BBVA 4521'])[0], deducible:'Sí', conciliado:false});
  porPagarData = porPagarData.filter(function(x){return x.id!==id;});
  renderEgresos();
  toast('"'+p.nombre+'" pagado y movido al historial');
}

/* ----- Detalle / edición de egreso del historial ----- */
function egdActualizarCuenta(keep){
  var metodo = $('egd-metodo').value;
  var cuentas = cuentasPorMetodo[metodo] || [];
  setHtml('egd-cuenta', cuentas.map(function(c){return '<option>'+esc(c)+'</option>';}).join(''));
  if(keep && cuentas.indexOf(keep)>=0) $('egd-cuenta').value = keep;
}
function openEgresoDetalle(id){
  var e=getEgreso(id); if(!e) return;
  egresoCtx = {tipo:'historial', id:id};
  setText('egd-nombre', e.nombre); setText('egd-sub', fechaLarga(e.fecha)+' · '+e.cat);
  $('egd-monto').value=e.monto; $('egd-fecha').value=e.fecha; $('egd-metodo').value=e.metodo; $('egd-deducible').value=e.deducible;
  egdActualizarCuenta(e.cuenta);
  var cr=$('egd-conciliado'); if(cr) cr.classList.toggle('on', !!e.conciliado);
  openModal('m-egreso-detalle');
}
function guardarEgresoDetalle(){
  if(!egresoCtx) { closeModal('m-egreso-detalle'); return; }
  var e=getEgreso(egresoCtx.id); if(!e){ closeModal('m-egreso-detalle'); return; }
  e.monto=Number($('egd-monto').value)||0; e.fecha=$('egd-fecha').value; e.metodo=$('egd-metodo').value;
  e.cuenta=$('egd-cuenta').value;
  e.deducible=$('egd-deducible').value; e.conciliado=$('egd-conciliado').classList.contains('on');
  closeModal('m-egreso-detalle'); renderEgresos(); renderFinKpis(finTabActual);
  toast('Egreso actualizado');
  gs('updateEgreso', {id:egresoCtx.id, monto:e.monto, fecha:e.fecha, metodo:e.metodo, cuenta:e.cuenta, deducible:e.deducible, conciliado:(e.conciliado?'Sí':'No'), actualizadoEn:new Date().toISOString()})
    .catch(function(e){ console.error('[CDC GS] updateEgreso detalle:',e); });
}

/* ===================== FACTURAS ===================== */
function renderFacturasKpis(){
  setText('fk-por-crear', facturasData.filter(function(f){return f.estado==='Por crear';}).length);
  setText('fk-por-enviar', facturasData.filter(function(f){return f.estado==='Creada';}).length);
  setText('fk-enviadas', facturasData.filter(function(f){return f.estado==='Enviada';}).length);
  var cola = facturasData.filter(function(f){return f.estado!=='Completada';}).reduce(function(s,f){return s+(f.monto||0);},0);
  setText('fk-monto', money(cola));
}
function renderFacturas(){
  renderFacturasKpis();
  var cont=$('facturas-list'); if(!cont) return;
  if(facturasData.length===0){ cont.innerHTML='<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><div>Sin facturas en cola. Se generan automáticamente al registrar un cobro con factura.</div></div>'; return; }
  var orden = {'Por crear':0,'Creada':1,'Enviada':2,'Completada':3};
  var html='';
  facturasData.slice().sort(function(a,b){return orden[a.estado]-orden[b.estado];}).forEach(function(f){
    html += '<div class="acc" style="cursor:pointer;margin-bottom:11px" onclick="abrirFacturaDetalle(\''+f.id+'\')"><div class="acc-head">'
      + '<div class="acc-stripe" style="background:var(--'+(FACT_BADGE[f.estado]||'b-gray').replace('b-','')+')"></div>'
      + '<div class="acc-av" style="background:linear-gradient(135deg,#1AA398,#0E6E66)">'+ico('doc')+'</div>'
      + '<div class="acc-id"><div class="nm">'+esc(f.cliente)+'</div><div class="sb">Sesión '+f.sesion+' · '+money(f.monto)+(f.folio?' · '+esc(f.folio):'')+'</div></div>'
      + '<div class="acc-right"><span class="badge '+(FACT_BADGE[f.estado]||'b-gray')+'">'+esc(f.estado)+'</span></div>'
      + '</div></div>';
  });
  cont.innerHTML = html;
}

/* R4: generar factura pendiente desde cobro */
function agregarFacturaPendiente(cliente, sesionNum, monto, fecha){
  facturasData.push({id:uid('f'), cliente:cliente.nombre, sesion:sesionNum, monto:monto, fecha:fecha||HOY, estado:'Por crear', folio:'', rfc:cliente.rfc||'', razonSocial:cliente.razonSocial||cliente.nombre, usoCFDI:cliente.usoCFDI||'D01 · Honorarios médicos'});
  renderNav();
}

function abrirFacturaDetalle(id){
  var f=getFactura(id); if(!f) return;
  facturaCtx = id;
  setText('fd-titulo', 'Factura · '+f.cliente);
  setText('fd-sub', 'Sesión '+f.sesion+' · '+money(f.monto));
  setHtml('fd-estado-badge', '<span class="badge '+(FACT_BADGE[f.estado]||'b-gray')+'">'+esc(f.estado)+'</span>');
  setHtml('fd-datos-cobro', '<div style="font-size:13px;color:var(--ink-2);line-height:1.9">'
    + '<div><b>Cliente:</b> '+esc(f.cliente)+'</div>'
    + '<div><b>Concepto:</b> Sesión EMT #'+f.sesion+'</div>'
    + '<div><b>Monto:</b> '+money(f.monto)+'</div>'
    + '<div><b>Fecha de cobro:</b> '+fechaLarga(f.fecha)+'</div></div>');
  setHtml('fd-datos-fiscales', '<div style="font-size:13px;color:var(--ink-2);line-height:1.9">'
    + '<div><b>RFC:</b> '+(esc(f.rfc)||'—')+'</div>'
    + '<div><b>Razón social:</b> '+(esc(f.razonSocial)||'—')+'</div>'
    + '<div><b>Uso CFDI:</b> '+(esc(f.usoCFDI)||'—')+'</div>'
    + (f.folio?'<div><b>Folio CFDI:</b> '+esc(f.folio)+'</div>':'')+'</div>');

  // panel de acciones: si el siguiente paso es "Creada", pedir folio
  var idx = FACT_SEQ.indexOf(f.estado);
  var accion = '';
  if(f.estado==='Por crear'){
    accion = '<div class="divider"></div><div class="field"><label>Folio CFDI <span class="req">*</span></label><input id="fd-folio-input" type="text" placeholder="Ej. A-1044" value="'+esc(f.folio)+'"></div><div class="hint">Requerido para timbrar y avanzar a "Creada".</div>';
  }
  setHtml('fd-acciones-panel', accion);

  var foot = '<button class="btn btn-ghost" onclick="closeModal(\'m-factura-detalle\')">Cerrar</button>';
  if(idx < FACT_SEQ.length-1){
    var sig = FACT_SEQ[idx+1];
    var lbl = f.estado==='Por crear'?'Timbrar (Creada)':(f.estado==='Creada'?'Marcar enviada':'Marcar completada');
    foot += '<button class="btn btn-primary" onclick="avanzarFactura(\''+f.id+'\')">'+lbl+'</button>';
  } else {
    foot += '<button class="btn btn-soft" disabled>Ciclo completado</button>';
  }
  setHtml('fd-footer', foot);
  openModal('m-factura-detalle');
}

/* R10: avanzar en secuencia; "Creada" requiere folio */
function avanzarFactura(id){
  var f=getFactura(id); if(!f) return;
  var idx = FACT_SEQ.indexOf(f.estado);
  if(idx>=FACT_SEQ.length-1) return;
  var sig = FACT_SEQ[idx+1];
  if(sig==='Creada'){
    var inp = $('fd-folio-input');
    var folio = inp? inp.value.trim() : f.folio;
    if(!folio){ toast('Captura el folio CFDI para timbrar'); return; }
    f.folio = folio;
  }
  f.estado = sig;
  renderFacturas(); renderNav();
  abrirFacturaDetalle(id);
  toast('Factura de '+f.cliente+' → '+sig);
  gs('updateFactura', {id:id, estatus:sig, folio:f.folio||'', actualizadoEn:new Date().toISOString()})
    .catch(function(e){ console.error('[CDC GS] updateFactura:',e); });
}
/* ============================================================
   Bloque 5 — MÓDULO TABLEROS (Chart.js) + INIT
   ============================================================ */

var CL = {
  primary:'#0E6E66', primaryL:'#1AA398', accent:'#D98C3A',
  amber:'#C2820B', green:'#1F8A4C', violet:'#7B52C9', blue:'#2C6FD6',
  red:'#C43D3D', emerald:'#0E8F73', orange:'#D9742A', gray:'#9AA3A0',
  grid:'#E7E3D8', ink3:'#7C8784'
};
var Chart_defaults_applied = false;
function applyChartDefaults(){
  if(typeof Chart==='undefined' || Chart_defaults_applied) return;
  Chart.defaults.font.family = "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = CL.ink3;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.padding = 14;
  Chart_defaults_applied = true;
}

function safeChart(id, cfg){
  var el = $(id);
  if(!el || typeof Chart==='undefined') return;
  var ex = Chart.getChart(el);
  if(ex) ex.destroy();
  applyChartDefaults();
  return new Chart(el, cfg);
}

function chartCard(titulo, sub, canvasId, tall){
  return '<div class="chart-card"><h3>'+titulo+'</h3><div class="ch-sub">'+sub+'</div>'
    + '<div class="chart-wrap'+(tall?' tall':'')+'"><canvas id="'+canvasId+'"></canvas></div></div>';
}

/* ---------- Layout de cada pestaña ---------- */
function buildDashPanes(){
  setHtml('dash-general',
    '<div class="dash-grid cols-2">'
    + chartCard('Embudo de pipeline','Leads por etapa comercial','ch-pipeline')
    + chartCard('Ingresos vs egresos','Mes en curso (mayo 2025)','ch-ing-egr')
    + '</div>');
  setHtml('dash-leads',
    '<div class="dash-grid cols-2">'
    + chartCard('Leads por canal','Origen de los prospectos','ch-canales')
    + chartCard('Leads por temperatura','Calificación de interés','ch-temp')
    + '</div>');
  setHtml('dash-clientes',
    '<div class="dash-grid cols-2">'
    + chartCard('Cartera por estado','Distribución de clientes','ch-cartera')
    + chartCard('Sesiones impartidas','Por cliente activo','ch-sesiones')
    + '</div>');
  setHtml('dash-sesiones',
    '<div class="dash-grid">'
    + chartCard('Estado de las sesiones','Total agregado de la cartera','ch-ses-estado', true)
    + '</div>');
  setHtml('dash-financiero',
    '<div class="dash-grid">'
    + chartCard('Egresos por categoría','Pagos fijos + historial del mes','ch-eg-cat', true)
    + '</div>');
}

/* ---------- Datos para gráficas ---------- */
function dataPipeline(){
  return ETAPAS.map(function(e){ return leadsData.filter(function(l){return l.etapa===e;}).length; });
}
function dataCanales(){
  var m={}; leadsData.forEach(function(l){ m[l.canal]=(m[l.canal]||0)+1; });
  return m;
}
function dataTemp(){
  return ['Caliente','Tibio','Frío'].map(function(t){ return leadsData.filter(function(l){return l.temp===t;}).length; });
}
function dataCartera(){
  var estados=['Activo','En onboarding','Pausado','Completado','Cancelado'];
  return estados.map(function(e){ return clientesData.filter(function(c){return c.estado===e;}).length; });
}
function dataSesionesPorCliente(){
  var act = clientesData.filter(function(c){return c.sesiones && c.sesiones.length>0;});
  return {labels: act.map(function(c){return c.nombre.split(' ')[0];}), data: act.map(function(c){return c.sesiones.filter(function(s){return s.estado==='done';}).length;})};
}
function dataSesEstado(){
  var t={done:0,next:0,scheduled:0,pending:0};
  clientesData.forEach(function(c){ (c.sesiones||[]).forEach(function(s){ t[s.estado]=(t[s.estado]||0)+1; }); });
  return t;
}
function dataEgCat(){
  var m={};
  historialEgresos.forEach(function(e){ m[e.cat]=(m[e.cat]||0)+(e.monto||0); });
  pagosFijos.forEach(function(p){ m[p.cat]=(m[p.cat]||0)+(p.monto||0); });
  return m;
}

/* ---------- Construcción de gráficas por pestaña ---------- */
function buildCharts(tab){
  var gridCfg = { grid:{color:CL.grid}, ticks:{color:CL.ink3}, border:{display:false} };
  if(tab==='general'){
    safeChart('ch-pipeline', {type:'bar', data:{labels:ETAPAS, datasets:[{label:'Leads', data:dataPipeline(), backgroundColor:[CL.gray,CL.blue,CL.amber,CL.violet,CL.green], borderRadius:8, maxBarThickness:54}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0,color:CL.ink3},grid:{color:CL.grid},border:{display:false}},x:{grid:{display:false},ticks:{color:CL.ink3},border:{display:false}}}}});
    var ingresos = clientesData.reduce(function(s,c){return s+(c.cobrado||0);},0);
    var egresos = historialEgresos.reduce(function(s,e){return s+(e.monto||0);},0) + pagosFijos.reduce(function(s,p){return s+(p.monto||0);},0);
    safeChart('ch-ing-egr', {type:'bar', data:{labels:['Ingresos','Egresos','Utilidad'], datasets:[{data:[ingresos, egresos, ingresos-egresos], backgroundColor:[CL.green, CL.red, CL.primary], borderRadius:8, maxBarThickness:70}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ' $'+Number(ctx.raw).toLocaleString('es-MX');}}}},scales:{y:{beginAtZero:true,ticks:{color:CL.ink3,callback:function(v){return '$'+(v/1000)+'k';}},grid:{color:CL.grid},border:{display:false}},x:{grid:{display:false},ticks:{color:CL.ink3},border:{display:false}}}}});
  }
  else if(tab==='leads'){
    var canales = dataCanales();
    safeChart('ch-canales', {type:'doughnut', data:{labels:Object.keys(canales), datasets:[{data:Object.values(canales), backgroundColor:[CL.primary,CL.accent,CL.blue,CL.violet,CL.green,CL.amber,CL.gray], borderWidth:2, borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right'}}}});
    safeChart('ch-temp', {type:'bar', data:{labels:['Caliente','Tibio','Frío'], datasets:[{data:dataTemp(), backgroundColor:[CL.red,CL.amber,CL.blue], borderRadius:8, maxBarThickness:60}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0,color:CL.ink3},grid:{color:CL.grid},border:{display:false}},y:{grid:{display:false},ticks:{color:CL.ink3},border:{display:false}}}}});
  }
  else if(tab==='clientes'){
    safeChart('ch-cartera', {type:'doughnut', data:{labels:['Activo','En onboarding','Pausado','Completado','Cancelado'], datasets:[{data:dataCartera(), backgroundColor:[CL.green,CL.amber,CL.violet,CL.emerald,CL.red], borderWidth:2, borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right'}}}});
    var spc = dataSesionesPorCliente();
    safeChart('ch-sesiones', {type:'bar', data:{labels:spc.labels, datasets:[{label:'Impartidas', data:spc.data, backgroundColor:CL.primary, borderRadius:8, maxBarThickness:48}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0,color:CL.ink3},grid:{color:CL.grid},border:{display:false}},x:{grid:{display:false},ticks:{color:CL.ink3},border:{display:false}}}}});
  }
  else if(tab==='sesiones'){
    var se = dataSesEstado();
    safeChart('ch-ses-estado', {type:'bar', data:{labels:['Impartidas y cobradas','Por cobrar','Por confirmar','Por agendar'], datasets:[{data:[se.done,se.next,se.scheduled,se.pending], backgroundColor:[CL.green,CL.blue,CL.orange,CL.gray], borderRadius:8, maxBarThickness:70}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0,color:CL.ink3},grid:{color:CL.grid},border:{display:false}},x:{grid:{display:false},ticks:{color:CL.ink3},border:{display:false}}}}});
  }
  else if(tab==='financiero'){
    var eg = dataEgCat();
    safeChart('ch-eg-cat', {type:'doughnut', data:{labels:Object.keys(eg), datasets:[{data:Object.values(eg), backgroundColor:[CL.primary,CL.accent,CL.blue,CL.violet,CL.green,CL.amber,CL.red,CL.gray], borderWidth:2, borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:{legend:{position:'right'},tooltip:{callbacks:{label:function(ctx){return ' '+ctx.label+': $'+Number(ctx.raw).toLocaleString('es-MX');}}}}}});
  }
}

/* ---------- Pestañas de tableros ---------- */
var DASH_TABS = [['general','General'],['leads','Leads'],['clientes','Clientes'],['sesiones','Sesiones'],['financiero','Financiero']];
var dashTabActual = 'general';

function renderDashTabs(){
  var html = DASH_TABS.map(function(t){
    return '<button class="dash-tab'+(dashTabActual===t[0]?' active':'')+'" onclick="dashTab(\''+t[0]+'\')">'+t[1]+'</button>';
  }).join('');
  setHtml('dash-tabs', html);
}
function dashTab(key){
  dashTabActual = key;
  document.querySelectorAll('.dashpane').forEach(function(p){ p.classList.remove('active'); });
  var pane = $('dash-'+key); if(pane) pane.classList.add('active');
  renderDashTabs();
  buildCharts(key);
}

function renderTableros(){
  if(usuarioActual!=='willy'){
    $('tableros-lock').style.display='';
    $('tableros-content').style.display='none';
    return;
  }
  $('tableros-lock').style.display='none';
  $('tableros-content').style.display='';
  buildDashPanes();
  renderDashTabs();
  buildCharts(dashTabActual);
}

/* ============================================================
   INIT — único punto de arranque
   ============================================================ */
window.addEventListener('DOMContentLoaded', async function(){
  // usuario inicial (sin toast)
  usuarioActual = 'willy';
  setText('user-name','Dr. Willy'); setText('user-role','Acceso total'); setText('user-av','DW');
  renderNav();
  renderActChips();
  nav('hoy');
  // Cargar todos los datos desde Google Sheets
  await cargarTodo();
});