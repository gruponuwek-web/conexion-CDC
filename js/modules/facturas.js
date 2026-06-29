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
    if (typeof facturasData !== 'undefined') facturasData = CDC.facturas;
    if (typeof renderFacturas !== 'undefined') renderFacturas();
  }
}

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
  abrirFacturaDetalle(id);
  toast('Factura de '+f.cliente+' → '+sig);
  gs('updateFactura', {id:id, estatus:sig, folio:f.folio||'', actualizadoEn:new Date().toISOString()})
    .catch(function(e){ console.error('[CDC GS] updateFactura:',e); });
}

