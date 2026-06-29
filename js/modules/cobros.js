/* ============================================================
   CLÍNICA DEL CEREBRO · MÓDULO Cobros
   Extraído de app.js (estructura modular V3.1).
   Funciones globales — depende de las constantes/estado/helpers
   definidos en app.js, que se carga ANTES que este archivo.
   ============================================================ */

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

function inlineCuentaUpdate(){
  var metodo = document.getElementById('inline-cb-metodo');
  var cuenta  = document.getElementById('inline-cb-cuenta');
  if(!metodo || !cuenta) return;
  var cuentas = cuentasPorMetodo[metodo.value] || [];
  cuenta.innerHTML = cuentas.map(function(c){ return '<option>'+c+'</option>'; }).join('');
}

function registrarCobroInline(clienteId, n){
  var monto   = Number(document.getElementById('inline-cb-monto').value)  || 0;
  var fecha   = document.getElementById('inline-cb-fecha').value           || new Date().toISOString().slice(0,10);
  var metodo  = document.getElementById('inline-cb-metodo').value          || 'Transferencia';
  var cuenta  = document.getElementById('inline-cb-cuenta').value          || '';
  var factura = document.getElementById('inline-cb-factura').value         || 'No';
  if(monto <= 0){ toast('Captura un monto válido'); return; }
  // Reutilizar sesionCtx ya establecido por clickDot
  sesionCtx = { clienteId: clienteId, n: n };
  var x = _curSes(); if(!x){ closeModal('m-ses-editar'); return; }
  var requiereFactura = (factura === 'Sí');
  x.s.estado = 'done';
  x.s.fecha  = x.s.fecha || fecha;
  x.s.precio = monto;
  var actId = 'cobro-'+clienteId+'-'+n;
  var act = getActividad(actId); if(act) act.done = true;
  ingresosData.push({id:uid('in'), cliente:x.c.nombre, concepto:'Sesión '+n+' · EMT', monto:monto, fecha:fecha, metodo:metodo, cuenta:cuenta, factura:(requiereFactura?'Sí':'No'), conciliado:false});
  if(requiereFactura){ agregarFacturaPendiente(x.c, n, monto, fecha); }
  closeModal('m-ses-editar');
  recomputeCliente(x.c);
  renderClientes(); renderNav();
  toast('Cobro de '+money(monto)+' registrado'+(requiereFactura?' · factura en cola':''));
  // Guardar en Sheets
  var ahora = new Date().toISOString();
  var sesId = 's-'+clienteId+'-'+n;
  gs('updateSesion', {id:sesId, estado:'done', fecha:x.s.fecha, precio:monto,
    cobrada:'Sí', facturaRequerida:(requiereFactura?'Sí':'No'), actualizadoEn:ahora
  }).catch(function(e){ console.error('[CDC GS] updateSesion cobro inline:',e); });
  gs('createCobro', {
    id:uid('co'), clienteId:x.c.id, sesionId:sesId,
    sesionN:n, monto:monto, fecha:fecha, metodo:metodo, cuenta:cuenta,
    facturaRequerida:(requiereFactura?'Sí':'No'), creadoEn:ahora
  }).catch(function(e){ console.error('[CDC GS] createCobro inline:',e); });
  gs('updateCliente', {id:x.c.id, cobrado:x.c.cobrado, porCobrar:x.c.porCobrar, actualizadoEn:ahora
  }).catch(function(e){ console.error('[CDC GS] updateCliente cobro inline:',e); });
  if(requiereFactura){
    gs('createFactura', {
      id:uid('f'), clienteId:x.c.id, clienteNombre:x.c.nombre,
      sesionId:sesId, sesionN:n, monto:monto, fecha:fecha,
      estatus:'Por crear', folio:'',
      rfc:x.c.rfc||'', razonSocial:x.c.razonSocial||'', usoCFDI:x.c.usoCFDI||'',
      creadoEn:ahora, actualizadoEn:ahora
    }).catch(function(e){ console.error('[CDC GS] createFactura inline:',e); });
  }
}

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
  x.s.cobrada = 'Sí';
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
    id:uid('co'), clienteId:x.c.id,
    sesionId:sesId, sesionN:sesionCtx.n, monto:monto, fecha:fecha,
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

