/* ============================================================
   CLÍNICA DEL CEREBRO · MÓDULO Facturas · Cola CFDI
   Extraído de app.js (estructura modular V3.1).
   Funciones globales — depende de las constantes/estado/helpers
   definidos en app.js, que se carga ANTES que este archivo.
   ============================================================ */

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
    if (typeof facturasData !== 'undefined') facturasData = CDC.facturas.map(function(f){ return {id:f.id, clienteId:f.clienteId||'', cliente:f.clienteNombre||f.cliente||'', sesion:f.sesionN||f.sesion||'', monto:Number(f.monto)||0, fecha:_normFecha(f.fecha), estado:f.estatus||f.estado||'Por crear', folio:f.folio||'', rfc:f.rfcFiscal||f.rfc||'', razonSocial:f.razonSocial||'', usoCFDI:f.usoCFDI||''}; });
    if (typeof renderFacturas !== 'undefined') renderFacturas();
  }
}

// ── Estado de filtro de facturas ─────────────────────────────
var factFiltroMes  = '';
var factFiltroAnio = '';

var FACT_MESES = [
  ['','Todos los meses'],['01','Enero'],['02','Febrero'],['03','Marzo'],
  ['04','Abril'],['05','Mayo'],['06','Junio'],['07','Julio'],
  ['08','Agosto'],['09','Septiembre'],['10','Octubre'],
  ['11','Noviembre'],['12','Diciembre']
];
var FACT_MESES_LABEL = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function factFiltroHtml(){
  var anios = [];
  facturasData.forEach(function(f){
    var a = (f.fecha||'').slice(0,4);
    if(a && anios.indexOf(a)===-1) anios.push(a);
  });
  anios.sort().reverse();
  var hoyAnio = new Date().getFullYear().toString();
  if(anios.indexOf(hoyAnio)===-1) anios.unshift(hoyAnio);

  var activo = factFiltroMes || factFiltroAnio;
  var badgeTxt = '';
  if(factFiltroMes && factFiltroAnio) badgeTxt = FACT_MESES_LABEL[parseInt(factFiltroMes,10)]+' '+factFiltroAnio;
  else if(factFiltroMes) badgeTxt = FACT_MESES[parseInt(factFiltroMes,10)][1];
  else if(factFiltroAnio) badgeTxt = factFiltroAnio;

  var chevSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>';

  var mesItems = FACT_MESES.map(function(m){
    return '<div class="fdd-item'+(factFiltroMes===m[0]?' selected':'')+'" onclick="setFactFiltroMes(\''+m[0]+'\')">'+m[1]+'</div>';
  }).join('');

  var anioItems = '<div class="fdd-item'+(factFiltroAnio===''?' selected':'')+'" onclick="setFactFiltroAnio(\'\')">Todos los años</div>'
    + anios.map(function(a){
        return '<div class="fdd-item'+(factFiltroAnio===a?' selected':'')+'" onclick="setFactFiltroAnio(\''+a+'\')">'+a+'</div>';
      }).join('');

  var mesTxt  = factFiltroMes  ? FACT_MESES[parseInt(factFiltroMes,10)][1] : 'Todos los meses';
  var anioTxt = factFiltroAnio ? factFiltroAnio : 'Todos los años';

  return '<div class="fin-filtro-bar">'
    + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="fin-filtro-ico"><path d="M3 4h18M7 10h10M10 16h4"/></svg>'
    + '<span class="fin-filtro-label">Período</span>'
    + '<div class="fdd" onclick="fddToggle(this)">'
        + '<div class="fdd-val">'+mesTxt+chevSvg+'</div>'
        + '<div class="fdd-list">'+mesItems+'</div>'
    + '</div>'
    + '<div class="fdd" onclick="fddToggle(this)">'
        + '<div class="fdd-val">'+anioTxt+chevSvg+'</div>'
        + '<div class="fdd-list">'+anioItems+'</div>'
    + '</div>'
    + (activo
        ? '<span class="badge b-primary" style="margin-left:4px">'+badgeTxt+'</span>'
          + '<button class="btn btn-ghost btn-sm fin-filtro-clear" onclick="limpiarFactFiltro()">✕ Limpiar</button>'
        : '')
    + '</div>';
}

function setFactFiltroMes(v){ factFiltroMes = v; document.querySelectorAll('.fdd.open').forEach(function(d){ d.classList.remove('open'); }); renderFacturas(); }
function setFactFiltroAnio(v){ factFiltroAnio = v; document.querySelectorAll('.fdd.open').forEach(function(d){ d.classList.remove('open'); }); renderFacturas(); }
function limpiarFactFiltro(){ factFiltroMes=''; factFiltroAnio=''; renderFacturas(); }

function renderFacturasKpis(){
  setText('fk-por-crear', facturasData.filter(function(f){return f.estado==='Por crear';}).length);
  setText('fk-por-enviar', facturasData.filter(function(f){return f.estado==='Creada';}).length);
  setText('fk-enviadas', facturasData.filter(function(f){return f.estado==='Enviada';}).length);
  var cola = facturasData.filter(function(f){return f.estado!=='Completada';}).reduce(function(s,f){return s+(f.monto||0);},0);
  setText('fk-monto', money(cola));
}

function renderFacturas(){
  renderFacturasKpis();
  // Render filtro
  var fg = $('fact-filtro-global');
  if(fg) fg.innerHTML = factFiltroHtml();

  var cont=$('facturas-list'); if(!cont) return;

  // Aplicar filtro de fecha
  var lista = facturasData.filter(function(f){
    if(factFiltroAnio && (f.fecha||'').slice(0,4) !== factFiltroAnio) return false;
    if(factFiltroMes  && (f.fecha||'').slice(5,7) !== factFiltroMes)  return false;
    return true;
  });

  if(lista.length===0){ cont.innerHTML='<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><div>'+(factFiltroMes||factFiltroAnio?'Sin facturas para el período seleccionado.':'Sin facturas en cola. Se generan automáticamente al registrar un cobro con factura.')+'</div></div>'; return; }
  var orden = {'Por crear':0,'Creada':1,'Enviada':2,'Completada':3};
  var html='';
  lista.slice().sort(function(a,b){return orden[a.estado]-orden[b.estado];}).forEach(function(f){
    html += '<div class="acc" style="cursor:pointer;margin-bottom:11px" onclick="abrirFacturaDetalle(\''+f.id+'\')"><div class="acc-head">'
      + '<div class="acc-stripe" style="background:var(--'+(FACT_BADGE[f.estado]||'b-gray').replace('b-','')+')"></div>'
      + '<div class="acc-av" style="background:linear-gradient(135deg,#1AA398,#0E6E66)">'+ico('doc')+'</div>'
      + '<div class="acc-id"><div class="nm">'+esc(f.cliente)+'</div><div class="sb">Sesión '+f.sesion+' · '+money(f.monto)+(f.folio?' · '+esc(f.folio):'')+'</div></div>'
      + '<div class="acc-right"><span class="badge '+(FACT_BADGE[f.estado]||'b-gray')+'">'+esc(f.estado)+'</span></div>'
      + '</div></div>';
  });
  cont.innerHTML = html;
}


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
  if(sig === FACT_SEQ[FACT_SEQ.length-1]){
    closeModal('m-factura-detalle');
    toast('Factura de '+f.cliente+' completada ✓');
  } else {
    abrirFacturaDetalle(id);
    toast('Factura de '+f.cliente+' → '+sig);
  }
  var ahora = new Date().toISOString();
  var hoy = ahora.slice(0,10);
  gs('updateFactura', {id:id, estatus:sig, folio:f.folio||'', actualizadoEn:ahora})
    .catch(function(e){ console.error('[CDC GS] updateFactura:',e); });

  // Marcar actividad anterior como done y crear la siguiente
  if(sig==='Creada'){
    // Marcar "Generar factura" como done
    var idGen = 'fact-'+f.clienteId+'-'+f.sesion;
    var actGen = getActividad(idGen);
    if(actGen && !actGen.done){
      actGen.done = true;
      gs('updateCita', {id:idGen, done:'Sí', actualizadoEn:ahora})
        .catch(function(e){ console.error('[CDC GS] updateCita fact-gen:',e); });
    }
    // Crear actividad "Enviar factura"
    var idEnv = 'fact-env-'+f.id;
    if(!getActividad(idEnv)){
      var actEnv = {
        id:idEnv, prospecto:f.cliente, refTipo:'cliente', refId:f.clienteId||'',
        tipo:'Enviar factura · Sesión '+f.sesion,
        fecha:hoy, hora:'10:00', grupo:'hoy',
        done:false, urgente:false,
        contexto:'Factura de '+f.cliente+' timbrada (folio '+esc(f.folio)+'). Enviar al cliente.'
      };
      actividadesData.push(actEnv);
      gs('createCita', {
        id:idEnv, prospecto:f.cliente, refTipo:'cliente', refId:f.clienteId||'',
        tipo:actEnv.tipo, fecha:hoy, hora:'10:00', grupo:'hoy',
        done:'No', urgente:'No', contexto:actEnv.contexto,
        creadoEn:ahora, actualizadoEn:ahora
      }).catch(function(e){ console.error('[CDC GS] createCita fact-env:',e); });
    }
  } else if(sig==='Enviada'){
    // Marcar "Enviar factura" como done
    var idEnvD = 'fact-env-'+f.id;
    var actEnvD = getActividad(idEnvD);
    if(actEnvD && !actEnvD.done){
      actEnvD.done = true;
      gs('updateCita', {id:idEnvD, done:'Sí', actualizadoEn:ahora})
        .catch(function(e){ console.error('[CDC GS] updateCita fact-env:',e); });
    }
    // Crear actividad "Confirmar recepción" para 3 días después
    var idRec = 'fact-rec-'+f.id;
    if(!getActividad(idRec)){
      var fechaRec = new Date(hoy+'T00:00:00');
      fechaRec.setDate(fechaRec.getDate()+3);
      var fechaRecStr = fechaRec.toISOString().slice(0,10);
      var actRec = {
        id:idRec, prospecto:f.cliente, refTipo:'cliente', refId:f.clienteId||'',
        tipo:'Confirmar recepción factura · Sesión '+f.sesion,
        fecha:fechaRecStr, hora:'10:00', grupo:clasificarGrupo(fechaRecStr),
        done:false, urgente:false,
        contexto:'Factura de '+f.cliente+' enviada. Confirmar que el cliente recibió y acepta el CFDI.'
      };
      actividadesData.push(actRec);
      gs('createCita', {
        id:idRec, prospecto:f.cliente, refTipo:'cliente', refId:f.clienteId||'',
        tipo:actRec.tipo, fecha:fechaRecStr, hora:'10:00', grupo:actRec.grupo,
        done:'No', urgente:'No', contexto:actRec.contexto,
        creadoEn:ahora, actualizadoEn:ahora
      }).catch(function(e){ console.error('[CDC GS] createCita fact-rec:',e); });
    }
  } else if(sig==='Completada'){
    // Marcar todas las actividades de esta factura como done
    ['fact-'+f.clienteId+'-'+f.sesion, 'fact-env-'+f.id, 'fact-rec-'+f.id].forEach(function(aid){
      var act = getActividad(aid);
      if(act && !act.done){
        act.done = true;
        gs('updateCita', {id:aid, done:'Sí', actualizadoEn:ahora})
          .catch(function(e){ console.error('[CDC GS] updateCita fact-complete:',e); });
      }
    });
  }
  renderActChips(); renderNav();
  if(pantallaActual==='hoy') renderActividades(actFiltro);
}

