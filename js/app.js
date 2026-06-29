// ══════════════════════════════════════════════════════════════
//  LISTAS — Catálogos editables del sistema
//  Edita aquí para cambiar opciones de dropdowns sin tocar el resto del código
// ══════════════════════════════════════════════════════════════
var LISTAS = {
  etapas:           ['Nuevo','Contactado','Diagnóstico','Cotizado','Ganado','Perdido','No clasifica'],
  etapasOpcionales: ['Perdido','No clasifica'],
  padecimientos:    ['TDAH','Ansiedad','Depresión','Estrés crónico','Dislexia','Migraña','Cognitivo','Otro'],
  canales:          ['Instagram','Facebook','WhatsApp','Google','Referido','Otro'],
  temperaturas:     ['Caliente','Tibio','Frío'],
  generos:          ['Masculino','Femenino','Otro'],
  tiposActividad:   ['Llamada','Mensaje WhatsApp','Enviar cotización','Agendar cita','Seguimiento cotización','Enviar documento'],
  estadosCliente:   ['En onboarding','Activo','Pausado','Reagendado','Cancelado','Completado'],
  razonesCancel:    ['Costo / presupuesto','Distancia / traslado','Decidió otra clínica','Mejoría sin tratamiento','Falta de tiempo','Problemas de salud','Cambio de ciudad','Sin respuesta del paciente','Insatisfacción con resultados','Otro'],
  catEgresos:       ['Renta','Nómina','Servicios','Insumos','Equipo','Software','Marketing','Otro'],
  metodosPago:      ['Transferencia','Tarjeta','Efectivo','Cheque'],
  cuentasPorMetodo: {
    'Efectivo':      ['Efectivo caja'],
    'Tarjeta':       ['BBVA 4521','HSBC 7832','Santander 1180'],
    'Transferencia': ['HSBC 7832','Banorte 3492'],
    'Cheque':        ['BBVA 4521','HSBC 7832']
  },
  catIngresosExtras: ['Consultoría','Venta de producto','Donativo','Patrocinio','Capacitación','Otro'],
  usosCFDI:          ['D01 · Honorarios médicos','G03 · Gastos en general','S01 · Sin efectos fiscales'],
};

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

// ── LOGIN ────────────────────────────────────────────────────────
// Credenciales cargadas desde auth.js (edita ese archivo para cambiar contraseñas)
var USUARIOS = (typeof CDC_USUARIOS !== 'undefined') ? CDC_USUARIOS : {
  'willy': { pass: 'Willy2026', nombre: 'Dr. Willy',  rol: 'Acceso total', av: 'DW', color: 'linear-gradient(135deg,#1AA398,#0E6E66)' },
  'vicky': { pass: 'Vicky2026', nombre: 'Sra. Vicky', rol: 'Operativo',    av: 'SV', color: 'linear-gradient(135deg,#D9742A,#C2820B)' }
};
var sesionActiva = false;

function loginSubmit(){
  var usr  = document.getElementById('login-user').value;
  var pass = document.getElementById('login-pass').value;
  var err  = document.getElementById('login-error');
  var u = USUARIOS[usr];
  if(!u || u.pass !== pass){
    err.style.display = 'flex';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-pass').focus();
    return;
  }
  err.style.display = 'none';
  sesionActiva = true;
  // Ocultar login, mostrar app
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-root').style.display = '';
  // Iniciar sesión con el usuario correcto
  changeUser(usr);
  nav('hoy');
  cargarTodo();
}

function loginKeydown(e){
  if(e.key === 'Enter') loginSubmit();
}

function cerrarSesion(){
  sesionActiva = false;
  document.getElementById('app-root').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
}
window.loginSubmit   = loginSubmit;
window.loginKeydown  = loginKeydown;
window.cerrarSesion  = cerrarSesion;
window._cerrarSesion = cerrarSesion;
window._loginSubmit  = loginSubmit;
window._loginKeydown = loginKeydown;

// ── 0. URL del Apps Script (ÚNICO lugar donde se configura) ──────
var GS_URL = 'https://script.google.com/macros/s/AKfycbwSIiqSjkppTOgHPLm87gPrmsfhltMktdic6KwZHzVkdIDKOw0z9Y0Y2w0Cl3tRrZVRyw/exec';

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

// ── Filtro Tableros ─────────────────────────────────────────────
var MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
var dashFiltroAnio  = new Date().getFullYear().toString();
var dashFiltroMeses = []; // [] = todos los meses

// ── 4. Carga inicial de todos los módulos ────────────────────────
async function cargarTodo() {
  mostrarLoader(true);
  try {
    var [rLeads, rClientes, rSes, rActs, rEg, rPF, rFact, rCobros, rIngExt] = await Promise.all([
      gs('getLeads'),
      gs('getClientes'),
      gs('getSesiones'),
      gs('getActividades'),
      gs('getEgresos'),
      gs('getPagosFijos'),
      gs('getFacturas'),
      gs('getCobros'),
      gs('getIngresosExtras')
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
    // Preparar sesiones indexadas por clienteId para anidarlas
    var sesionesPorCliente = {};
    if (rSes && rSes.ok && rSes.data) {
      rSes.data.forEach(function(s){
        var cid = s.clienteId;
        if (!sesionesPorCliente[cid]) sesionesPorCliente[cid] = [];
        sesionesPorCliente[cid].push({
          n:       Number(s.n)       || 0,
          estado:  s.estado          || 'pending',
          fecha:   s.fecha           || '',
          hora:    s.hora            || '',
          notas:   s.notas           || '',
          precio:  Number(s.precio)  || 0,
          cobrada: s.cobrada         || 'No',
          id:      s.id              || ''
        });
      });
      // Ordenar sesiones por número
      for (var cid in sesionesPorCliente) {
        sesionesPorCliente[cid].sort(function(a,b){ return a.n - b.n; });
      }
    }

    if (rClientes.ok) {
      CDC.clientes = rClientes.data.map(function(c){
        c.monto     = Number(c.monto)     || 0;
        c.cobrado   = Number(c.cobrado)   || 0;
        c.porCobrar = Number(c.porCobrar) || 0;
        c.numSes    = Number(c.numSes)    || 0;
        c.precioSes = Number(c.precioSes) || 0;
        if (c.celular !== undefined && c.cel === undefined) c.cel = c.celular;
        // Anidar sesiones desde la hoja Sesiones
        c.sesiones = sesionesPorCliente[c.id] || [];
        // Si tiene sesiones pero porCobrar es 0, recalcular
        if (c.sesiones.length > 0 && c.porCobrar === 0 && c.monto > 0) {
          var doneN = c.sesiones.filter(function(s){ return s.estado === 'done'; }).length;
          c.cobrado   = doneN * c.precioSes;
          c.porCobrar = c.monto - c.cobrado;
        }
        if (!c.onboarding) c.onboarding = {contrato:false,anticipo:false,consent:false,neurometria:false,expediente:false,protocolo:false,calendario:false};
        return c;
      });
      clientesData = CDC.clientes;
    }
    if (rActs.ok) {
      CDC.actividades = rActs.data;
      actividadesData = rActs.data.map(function(a){
        var done = (a.done === 'Sí' || a.done === true || a.done === 'true');
        // Recalcular grupo basado en fecha real (no confiar en lo guardado)
        var grupo;
        if (done) {
          grupo = 'completadas';
        } else if (a.fecha) {
          grupo = clasificarGrupo(a.fecha);
        } else {
          grupo = a.grupo || 'hoy';
        }
        return {
          id:       a.id,
          prospecto:a.prospecto || '',
          refTipo:  a.refTipo   || 'lead',
          refId:    a.refId     || '',
          tipo:     a.tipo      || '',
          fecha:    a.fecha     || '',
          hora:     a.hora      || '',
          grupo:    grupo,
          done:     done,
          urgente:  (a.urgente === 'Sí' || a.urgente === true || grupo === 'vencido'),
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

    // Normalizar cobros → ingresosData
    // Construir índice clienteId → nombre para lookup rápido
    if (rCobros && rCobros.ok && rCobros.data) {
      var clienteIdx = {};
      (CDC.clientes || []).forEach(function(c){ clienteIdx[String(c.id)] = c.nombre; });

      // Calcular cobrado real por cliente desde la hoja Cobros
      var cobradoPorCliente = {};
      var cobradoPorSesion  = {};
      rCobros.data.forEach(function(co){
        var cid = String(co.clienteId);
        cobradoPorCliente[cid] = (cobradoPorCliente[cid] || 0) + (Number(co.monto) || 0);
        // índice sesión → monto real cobrado
        var sesKey = cid + '-' + co.sesionN;
        cobradoPorSesion[sesKey] = Number(co.monto) || 0;
      });

      // Actualizar precio real en cada sesión y montos del cliente
      CDC.clientes.forEach(function(c){
        var cid = String(c.id);
        if(c.sesiones){
          c.sesiones.forEach(function(s){
            var key = cid + '-' + s.n;
            if(cobradoPorSesion[key]) s.precio = cobradoPorSesion[key];
          });
        }
        // porCobrar = paquete total - lo ya cobrado (fuente de verdad: hoja Cobros)
        c.cobrado   = cobradoPorCliente[cid] !== undefined ? cobradoPorCliente[cid] : (c.cobrado || 0);
        c.porCobrar = Math.max(0, (c.monto || 0) - c.cobrado);
      });
      clientesData = CDC.clientes;

      ingresosData = rCobros.data.map(function(co){
        var nombreCliente = clienteIdx[String(co.clienteId)] || co.clienteId || '';
        return {
          id:         co.id,
          cliente:    nombreCliente,
          concepto:   'Sesión ' + (co.sesionN || '') + ' · EMT',
          monto:      Number(co.monto) || 0,
          fecha:      co.fecha || '',
          metodo:     co.metodo || '',
          cuenta:     co.cuenta || '',
          factura:    co.facturaRequerida || 'No',
          conciliado: (co.conciliado === 'Sí' || co.conciliado === true)
        };
      });
    }

    // Cargar listas/catálogos desde Sheets (Config)
    await _cargarListasSheets();

    // Ingresos extras desde Sheets
    console.log('[CDC] rIngExt:', JSON.stringify(rIngExt).slice(0,200));
    if(rIngExt && rIngExt.ok && rIngExt.data){
      ingresosExtras = rIngExt.data.map(function(ie){
        return {
          id:         ie.id,
          concepto:   ie.concepto   || '',
          cliente:    ie.cliente    || '—',
          monto:      Number(ie.monto) || 0,
          fecha:      (ie.fecha||'').toString().slice(0,10),
          metodo:     ie.metodo     || '',
          cuenta:     ie.cuenta     || '',
          cat:        ie.cat        || '',
          conciliado: (ie.conciliado==='Sí'||ie.conciliado===true)
        };
      });
      try{ localStorage.removeItem('cdc_ing_extras'); }catch(e){}
    } else {
      _cargarExtrasLocal();
    }

    // Re-render de todos los módulos
    renderLeads();
    renderActividades(actFiltro);
    renderHoyKpis();
    renderClientes();
    renderEgresos();
    renderFacturas();
    renderNav();
    // Inyectar filtros ahora que hay datos
    try {
      var fg = $('fin-filtro-global');
      if(fg && typeof finFiltroHtml === 'function') fg.innerHTML = finFiltroHtml();
      var dg = $('dash-filtro');
      if(dg && typeof dashFiltroHtml === 'function') dg.innerHTML = dashFiltroHtml();
    } catch(e) { console.warn('[CDC] filtros:', e); }
    // Re-renderizar tableros si está activo
    if(pantallaActual==='tableros' && typeof renderTableros==='function') renderTableros();

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




// ── CLIENTES ─────────────────────────────────────────────────────




// ── SESIONES + COBROS ────────────────────────────────────────────


// R4: registrarCobro → saveCobro (combina sesión + cliente + factura)

// ── ACTIVIDADES ──────────────────────────────────────────────────



// Marcar actividad como hecha (R: marcarHecha)

// Reprogramar actividad



// ── EGRESOS ──────────────────────────────────────────────────────






// ── FACTURAS ─────────────────────────────────────────────────────

// agregarFacturaPendiente — llamada desde registrarCobro (R4)

// Avanzar estatus de factura (R10: solo progresa, requiere folio)


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
//    window.addEventListener('DOMContentLoaded', function(){
  _cargarListasLocal(); // restaurar listas guardadas ... });
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
var HOY = new Date().toISOString().slice(0,10);

var BANCOS = ['BBVA 4521','HSBC 7832','Santander 1180','Banorte 3492'];
var cuentasPorMetodo = LISTAS.cuentasPorMetodo;

var ETAPAS = LISTAS.etapas;
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
var ETAPAS_OPCIONALES = LISTAS.etapasOpcionales;
var ACT_TIPOS = LISTAS.tiposActividad;
var PADECIMIENTOS = LISTAS.padecimientos;
var CANALES = LISTAS.canales;

var ESTADO_CLI = {
  'En onboarding': {cls:'st-onboarding', badge:'b-amber', label:'En onboarding'},
  'Activo':        {cls:'st-activo',     badge:'b-green', label:'Activo'},
  'Pausado':       {cls:'st-pausado',    badge:'b-violet',label:'Pausado'},
  'Reagendado':    {cls:'st-reagendado', badge:'b-blue',  label:'Reagendado'},
  'Cancelado':     {cls:'st-cancelado',  badge:'b-red',   label:'Cancelado'},
  'Completado':    {cls:'st-completado', badge:'b-emerald',label:'Completado'}
};

var RAZONES_CANCEL = LISTAS.razonesCancel;

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
var cliFiltroEstado  = 'Todos'; // filtro activo en cartera
var cliFiltroAnio    = '';       // '' = todos los años
var cliFiltroMes     = '';       // '' = todos los meses
var pipeActualId = null;       // lead en modal pipe
var sesionCtx = null;          // {clienteId, n}
var onbCtx = null;             // {clienteId, checks:{}}
var reprogCtx = null;          // actividad id
var facturaCtx = null;         // factura id
var egresoCtx = null;          // {tipo, id}

var _uidSeq = 1000;
function uid(p){ 
  // Usar timestamp + random para evitar colisiones al recargar
  var ts = Date.now();
  var rnd = Math.floor(Math.random() * 1000);
  return (p||'id')+'-'+ts+'-'+rnd; 
}

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
var ingresosExtras  = [];   // ingresos adicionales (no de sesiones)

function _guardarExtrasLocal(){ /* reemplazado por Sheets */ }
function _cargarExtrasLocal(){ /* reemplazado por Sheets */ }
var facturasData    = [];

var FACT_SEQ = ['Por crear','Creada','Enviada','Completada'];
var FACT_BADGE = {'Por crear':'b-amber','Creada':'b-blue','Enviada':'b-violet','Completada':'b-green'};

function getCliente(id){ 
  if(!id) return null;
  var sid = String(id);
  for(var i=0;i<clientesData.length;i++){ 
    if(String(clientesData[i].id)===sid) return clientesData[i]; 
  } 
  return null; 
}
function getLead(id){ 
  if(!id) return null;
  var sid = String(id);
  for(var i=0;i<leadsData.length;i++){ 
    if(String(leadsData[i].id)===sid) return leadsData[i]; 
  } 
  return null; 
}
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
  {key:'tableros', label:'Tableros', sub:'Indicadores ejecutivos',icon:'<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="12" y="6" width="3" height="11"/><rect x="17" y="13" width="3" height="4"/>', soloWilly:true},
  {key:'admin',     label:'Config',   sub:'Listas y catálogos',        icon:'<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>', soloWilly:true}
];
var PAGE_TITLES = {
  hoy:['Hoy','Centro de actividades'],
  leads:['Leads','Pipeline comercial'],
  clientes:['Clientes','Cartera y sesiones'],
  egresos:['Finanzas','Ingresos y egresos'],
  facturas:['Facturas','Cola de timbrado CFDI'],
  tableros:['Tableros','Indicadores ejecutivos'],
  admin:['Configuración','Listas y catálogos del sistema']
};

function navBadge(key){
  if(key==='urg'){ var u=actividadesData.filter(function(a){return !a.done && (a.urgente||a.grupo==='hoy');}).length; return u; }
  if(key==='leads'){ return leadsData.filter(function(l){return l.etapa!=='Ganado';}).length; }
  if(key==='fact'){ return facturasData.filter(function(f){return f.estado!=='Completada';}).length; }
  return 0;
}

// ── Menú inferior móvil ──────────────────────────────────────
function isMobile(){ return window.innerWidth <= 768; }

function renderMobNav(){
  var mobNav = document.getElementById('mob-nav');
  if(!mobNav) return;
  // Mostrar solo en móvil
  mobNav.style.display = isMobile() ? 'flex' : 'none';
  // Marcar activo
  ['hoy','leads','clientes','finanzas','tableros'].forEach(function(k){
    var btn = document.getElementById('mob-'+k);
    var key = k==='finanzas' ? 'egresos' : k;
    if(btn) btn.classList.toggle('active', pantallaActual===key);
  });
  // Badge leads
  var bl = document.getElementById('mob-badge-leads');
  if(bl){
    var n = leadsData.filter(function(l){return l.etapa!=='Ganado';}).length;
    bl.style.display = n>0 ? '' : 'none';
    bl.textContent = n;
  }
}
window.addEventListener('resize', renderMobNav);

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
  renderMobNav();
  if(key==='hoy'){ renderActividades(actFiltro); renderActChips(); }
  if(key==='leads') renderLeads();
  if(key==='clientes') renderClientes();
  if(key==='egresos'){ renderFinanzas(); var fg=$('fin-filtro-global'); if(fg) fg.innerHTML=finFiltroHtml(); }
  if(key==='facturas') renderFacturas();
  if(key==='tableros') renderTableros();
  if(key==='admin') renderAdministracion();
  setTimeout(renderMobNav, 50);
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








var actDetCtx = null;

/* ============================================================
   MÓDULO LEADS — Pipeline (kanban + lista) + drag/drop
   ============================================================ */





/* ----- Drag & drop ----- */
var dragId = null;

/* ----- Detalle de lead (R9) ----- */


/* ----- Convertir lead Ganado en cliente + abrir onboarding (R1) ----- */

/* ----- Actividad automática al cambiar de etapa ----- */
var etapaActCtx = null;

/* ----- Nuevo lead ----- */
/* ============================================================
   Bloque 3 — MÓDULO CLIENTES
   Acordeones · sesiones · cobros · onboarding · activación
   ============================================================ */













/* ============================================================
   SESIONES — editor y flujo
   ============================================================ */




var reprogSesCtx = null; // contexto de reprogramación de sesión



/* ----- Cobro (R4) ----- */



/* ============================================================
   ONBOARDING — checks, recálculo (R2), activación (R3)
   ============================================================ */





/* R3: activar cliente */
/* ============================================================
   Bloque 4 — MÓDULOS EGRESOS y FACTURAS
   ============================================================ */

/* ===================== EGRESOS ===================== */
// ── Filtro mes/año para Finanzas ─────────────────────────────────
// Cerrar dropdowns al hacer clic fuera
document.addEventListener('click', function(e){
  if(!e.target.closest('.fdd')) document.querySelectorAll('.fdd.open').forEach(function(d){ d.classList.remove('open'); });
});

// ── Filtros cruzados ─────────────────────────────────────────
window.setFinFiltroMes = function(v){ finFiltroMes = v; document.querySelectorAll('.fdd.open').forEach(function(d){ d.classList.remove('open'); }); renderFinanzas(); };
window.setFinFiltroAnio = function(v){ finFiltroAnio = v; document.querySelectorAll('.fdd.open').forEach(function(d){ d.classList.remove('open'); }); renderFinanzas(); };
window.limpiarFinFiltro = function(){ finFiltroMes=''; finFiltroAnio=''; renderFinanzas(); };
document.addEventListener('click', function(e){
  if(!e.target.closest || !e.target.closest('.fdd')){
    document.querySelectorAll('.fdd.open').forEach(function(d){ d.classList.remove('open'); });
  }
});






var finTabActual = 'egresos';
var finFiltroMes  = '';   // '' = todos, '01'..'12'
var finFiltroAnio = '';   // '' = todos, '2024','2025','2026'

/* ----- Nuevo egreso ----- */
var neTabActual = 'ya';
/* R7: cuenta según método */

/* ----- Pago fijo (alta rápida) ----- */

/* ----- Detalle pago (fijo o por pagar) ----- */

var EG_CATS = LISTAS.catEgresos;
var EG_METODOS = LISTAS.metodosPago;

/* ----- Detalle / edición de egreso del historial ----- */

/* ===================== FACTURAS ===================== */

/* R4: generar factura pendiente desde cobro */


/* R10: avanzar en secuencia; "Creada" requiere folio */
/* ============================================================
   INGRESOS ADICIONALES — funciones
   ============================================================ */
var IE_CATS = LISTAS.catIngresosExtras;
var ingresoExtraCtx = null;









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



/* ---------- Layout de cada pestaña ---------- */

/* ---------- Datos para gráficas ---------- */

/* ---------- Construcción de gráficas por pestaña ---------- */
/* ---------- Pestañas de tableros ---------- */
var DASH_TABS = [['general','General'],['leads','Leads'],['clientes','Clientes'],['sesiones','Sesiones'],['financiero','Financiero']];
var dashTabActual = 'general';
// Filtros cruzados entre gráficas
var dashCrossFilter = { etapa: null, mes: null, estadoCli: null };




/* ============================================================
   MÓDULO ADMINISTRACIÓN — Gestión de listas/catálogos
   ============================================================ */

// Mapa de listas editables con etiquetas para la UI
var LISTAS_CONFIG = [
  { key:'padecimientos',     label:'Padecimientos',              desc:'Diagnósticos del paciente en el formulario de leads' },
  { key:'canales',           label:'Canales de captación',       desc:'Origen de los prospectos (Instagram, Google, etc.)' },
  { key:'temperaturas',      label:'Temperaturas de lead',       desc:'Calificación de interés del prospecto' },
  { key:'generos',           label:'Géneros',                    desc:'Opciones de género en el formulario' },
  { key:'tiposActividad',    label:'Tipos de actividad',         desc:'Acciones de seguimiento en el pipeline' },
  { key:'estadosCliente',    label:'Estados de cliente',         desc:'Fases del tratamiento del paciente' },
  { key:'razonesCancel',     label:'Razones de cancelación',     desc:'Motivos de baja del paciente' },
  { key:'catEgresos',        label:'Categorías de egresos',      desc:'Clasificación de gastos en Finanzas' },
  { key:'metodosPago',       label:'Métodos de pago',            desc:'Formas de pago disponibles' },
  { key:'catIngresosExtras', label:'Categorías ingresos extras', desc:'Tipos de ingresos adicionales' },
  { key:'usosCFDI',          label:'Usos de CFDI',               desc:'Opciones fiscales para facturas' },
  { key:'etapas',            label:'Etapas del pipeline',        desc:'Columnas del kanban de leads (requiere reload)' },
  { key:'etapasOpcionales',  label:'Etapas sin actividad oblig.',desc:'Etapas donde el seguimiento es opcional' },
];

var adminListaCtx = null; // {key, label}

var SELECT_MAP = {
  'pd-padecimiento': {key:'padecimientos'},
  'nl-padecimiento': {key:'padecimientos'},
  'pd-genero':       {key:'generos',       empty:'— Sin especificar —'},
  'nl-genero':       {key:'generos',       empty:'— Sin especificar —'},
  'pd-temp':         {key:'temperaturas'},
  'nl-temp':         {key:'temperaturas'},
  'pd-canal':        {key:'canales'},
  'nl-canal':        {key:'canales'},
  'pd-sigact':       {key:'tiposActividad', empty:'— Ninguna —'},
  'pd-etapa-select': {key:'etapas'},
  'nl-etapa':        {key:'etapas'},
  'ne-cat':          {key:'catEgresos'},
  'pf-cat':          {key:'catEgresos'},
  'ne-metodo':       {key:'metodosPago'},
  'ne-rec-metodo':   {key:'metodosPago'},
  'cb-metodo':       {key:'metodosPago'},
  'ie-metodo':       {key:'metodosPago'},
  'ied-metodo':      {key:'metodosPago'},
  'pgd-metodo':      {key:'metodosPago'},
  'egd-metodo':      {key:'metodosPago'},
  'ie-cat':          {key:'catIngresosExtras'},
  'ied-cat':         {key:'catIngresosExtras'},
};

function _poblarSelect(id){
  var cfg = SELECT_MAP[id]; if(!cfg) return;
  var el = $(id); if(!el) return;
  var lista = LISTAS[cfg.key] || [];
  var curVal = el.value;
  var opts = cfg.empty ? '<option value="">'+cfg.empty+'</option>' : '';
  opts += lista.map(function(v){ return '<option'+(v===curVal?' selected':'')+'>'+esc(v)+'</option>'; }).join('');
  el.innerHTML = opts;
}

function _poblarTodosLosSelects(){
  for(var id in SELECT_MAP){ _poblarSelect(id); }
}

function renderAdministracion(){
  var cont = $('admin-listas-cont'); if(!cont) return;
  var html = LISTAS_CONFIG.map(function(cfg){
    var items = LISTAS[cfg.key];
    if(!Array.isArray(items)) return '';
    var chips = items.map(function(v){
      return '<span class="admin-chip">'+esc(v)
      +'<button onclick="eliminarItemLista_btn(this)" data-key="'+cfg.key+'" data-val="'+esc(v)+'" title="Eliminar">×</button></span>';
    }).join('');
    return '<div class="admin-lista-card">'
      +'<div class="admin-lista-head">'
        +'<div><div class="admin-lista-label">'+esc(cfg.label)+'</div>'
        +'<div class="admin-lista-desc">'+esc(cfg.desc)+'</div></div>'
      +'<button class="btn btn-soft btn-sm" onclick="abrirAgregarItem_btn(this)" data-key="'+cfg.key+'" data-label="'+esc(cfg.label)+'">&plus; Agregar</button>'
      +'</div>'
      +'<div class="admin-chips">'+chips+'</div>'
      +'</div>';
  }).join('');
  cont.innerHTML = html;
  _poblarTodosLosSelects();
}

// ── Persistencia de LISTAS en localStorage ──────────────────────
function _guardarListasLocal(){
  try{ localStorage.setItem('cdc_listas', JSON.stringify(LISTAS)); } catch(e){}
}
function _cargarListasLocal(){
  try{
    var raw = localStorage.getItem('cdc_listas');
    if(!raw) return;
    var saved = JSON.parse(raw);
    for(var k in saved){
      if(Array.isArray(saved[k]) && Array.isArray(LISTAS[k])){
        LISTAS[k] = saved[k];
      }
    }
  } catch(e){}
}

// Guardar una lista en Google Sheets (hoja Config)
function _guardarListaSheets(key){
  var valor = JSON.stringify(LISTAS[key] || []);
  gs('setConfig', { key: key, valor: valor })
    .catch(function(e){ console.error('[CDC] setConfig error:', e); });
}

// Cargar todas las listas desde Google Sheets al arrancar
async function _cargarListasSheets(){
  try{
    var r = await gs('getConfig');
    if(!r.ok || !r.data) return;
    r.data.forEach(function(row){
      var k = row.key || row['key'];
      var v = row.valor || row['valor'];
      if(k && v && Array.isArray(LISTAS[k])){
        try{ LISTAS[k] = JSON.parse(v); } catch(e){}
      }
    });
    // Actualizar localStorage con lo de Sheets
    _guardarListasLocal();
  } catch(e){ console.warn('[CDC] _cargarListasSheets:', e); }
}

function eliminarItemLista_btn(btn){
  var key = btn.getAttribute('data-key');
  var val = btn.getAttribute('data-val');
  var lista = LISTAS[key];
  if(!Array.isArray(lista)) return;
  var idx = lista.indexOf(val);
  if(idx === -1) return;
  if(!confirm('¿Eliminar "'+val+'" de la lista?')) return;
  lista.splice(idx, 1);
  _guardarListasLocal();
  _guardarListaSheets(key);
  renderAdministracion();
  toast('"'+val+'" eliminado');
}

function abrirAgregarItem_btn(btn){
  var key = btn.getAttribute('data-key');
  var label = btn.getAttribute('data-label');
  abrirAgregarItem(key, label);
}

function abrirAgregarItem(key, label){
  adminListaCtx = {key:key, label:label};
  setText('adm-lista-nombre', label);
  $('adm-nuevo-item').value = '';
  openModal('m-admin-agregar');
  setTimeout(function(){ $('adm-nuevo-item').focus(); }, 150);
}

function guardarNuevoItem(){
  if(!adminListaCtx) return;
  var val = $('adm-nuevo-item').value.trim();
  if(!val){ toast('Escribe un valor'); return; }
  var lista = LISTAS[adminListaCtx.key];
  if(!Array.isArray(lista)){ toast('Lista no editable'); return; }
  if(lista.indexOf(val) !== -1){ toast('Ya existe: '+val); return; }
  lista.push(val);
  _guardarListasLocal();
  _guardarListaSheets(adminListaCtx.key);
  closeModal('m-admin-agregar');
  renderAdministracion();
  toast('"'+val+'" agregado a '+adminListaCtx.label);
}

function eliminarItemLista(key, val){
  var lista = LISTAS[key];
  if(!Array.isArray(lista)) return;
  var idx = lista.indexOf(val);
  if(idx === -1) return;
  if(!confirm('¿Eliminar "'+val+'" de la lista?')) return;
  lista.splice(idx, 1);
  renderAdministracion();
  toast('"'+val+'" eliminado');
}

function adm_keydown(e){ if(e.key==='Enter') guardarNuevoItem(); }

/* ============================================================
   INIT — único punto de arranque
   ============================================================ */
window.addEventListener('DOMContentLoaded', function(){
  // Mostrar pantalla de login, ocultar app
  document.getElementById('app-root').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-user').focus();
});