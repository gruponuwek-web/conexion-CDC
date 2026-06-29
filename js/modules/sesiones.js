/* ============================================================
   CLÍNICA DEL CEREBRO · MÓDULO Sesiones · Editor y flujo
   Extraído de app.js (estructura modular V3.1).
   Funciones globales — depende de las constantes/estado/helpers
   definidos en app.js, que se carga ANTES que este archivo.
   ============================================================ */

async function gs_actualizarSesion(sesionData) {
  var res = await gs('updateSesion', sesionData);
  if (res.ok) await _recargarClientes();
  return res;
}

function clickDot(clienteId, n){
  var c = getCliente(clienteId); if(!c) return;
  var s = c.sesiones[n-1]; if(!s) return;
  sesionCtx = {clienteId:clienteId, n:n};

  setText('ses-ed-title', 'Sesión '+n+' · '+c.nombre);
  setText('ses-ed-sub', dotLabel(s.estado));
  $('ses-ed-fecha').value = s.fecha||'';
  $('ses-ed-hora').value = s.hora||'';
  $('ses-ed-notas').value = s.notas||'';

  // badge de estado
  var cobradaYaBadge = (s.cobrada==='Sí'||s.cobrada===true||s.cobrada==='Si');
  var bcls = s.estado==='done'?(cobradaYaBadge?'b-green':'b-blue'):(s.estado==='next'?'b-orange':(s.estado==='scheduled'?'b-orange':'b-gray'));
  // R6: panel 'next' siempre arranca en "Por confirmar"
  var badgeTxt = dotLabel(s.estado, s.cobrada);
  setHtml('ses-ed-statusrow', '<span class="badge '+bcls+'">'+badgeTxt+'</span>');

  // panel de cobro y footer según estado
  var foot = '<button class="btn btn-ghost" onclick="closeModal(\'m-ses-editar\')">Cerrar</button>';
  var cobroPanel = '';
  if(s.estado==='pending'){
    foot += '<button class="btn btn-primary" onclick="agendarSesion()">Agendar sesión</button>';

  } else if(s.estado==='scheduled'){
    foot += '<button class="btn btn-soft" onclick="guardarSesion()">Guardar</button>';
    foot += '<button class="btn btn-primary" onclick="marcarImpartida()">Confirmar sesión</button>';

  } else if(s.estado==='next'){
    cobroPanel = '<div class="panel panel-blue"><div class="panel-title">'+ico('cobro')+'Sesión impartida · Paso 3</div>'
      + '<div style="font-size:13px;color:var(--ink-2)">Confirma que la sesión fue realizada. El cobro se registrará en el paso siguiente.</div></div>';
    foot += '<button class="btn btn-primary" onclick="sesionRealizada(\''+clienteId+'\','+n+')">Sesión realizada</button>';

  } else if(s.estado==='done'){
    var cobradaYa = (s.cobrada === 'Sí' || s.cobrada === true || s.cobrada === 'Si');
    if(cobradaYa){
      cobroPanel = '<div class="panel" style="background:var(--green-bg);border-color:var(--green-bd)"><div class="panel-title" style="color:var(--green)">'+ico('cobro')+'Sesión completada y cobrada</div>'
        + '<div style="font-size:13px;color:var(--ink-2)">Cobro registrado por <b>'+money(s.precio)+'</b>.</div></div>';
      foot += '<button class="btn btn-primary" onclick="guardarSesion()">Guardar notas</button>';
    } else {
      cobroPanel = '<div class="panel panel-blue"><div class="panel-title">'+ico('cobro')+'Paso 4 · Registrar cobro</div>'
        + '<div style="font-size:13px;color:var(--ink-2)">Sesión realizada ✓ Registra el pago de <b>'+money(s.precio)+'</b> para completar el ciclo.</div></div>';
      foot += '<button class="btn btn-soft" onclick="guardarSesion()">Guardar notas</button>';
      foot += '<button class="btn btn-primary" onclick="closeModal(\'m-ses-editar\');openCobro(\''+clienteId+'\','+n+')">Registrar cobro</button>';
    }
  }
  setHtml('ses-ed-foot', foot);
  openModal('m-ses-editar');
}

function nextCuentaUpdate(){
  var metodo = document.getElementById('next-cb-metodo');
  var cuenta  = document.getElementById('next-cb-cuenta');
  if(!metodo || !cuenta) return;
  var cuentas = cuentasPorMetodo[metodo.value] || [];
  cuenta.innerHTML = cuentas.map(function(c){ return '<option>'+c+'</option>'; }).join('');
}

function registrarCobroNext(clienteId, n){
  var monto   = Number(document.getElementById('next-cb-monto').value)  || 0;
  var fecha   = document.getElementById('next-cb-fecha').value           || new Date().toISOString().slice(0,10);
  var metodo  = document.getElementById('next-cb-metodo').value          || 'Transferencia';
  var cuenta  = document.getElementById('next-cb-cuenta').value          || '';
  var factura = document.getElementById('next-cb-factura').value         || 'No';
  if(monto <= 0){ toast('Captura un monto válido'); return; }
  sesionCtx = { clienteId: clienteId, n: n };
  var x = _curSes(); if(!x){ closeModal('m-ses-editar'); return; }
  var requiereFactura = (factura === 'Sí');
  x.s.estado = 'done';
  x.s.fecha  = fecha;
  x.s.precio = monto;
  x.s.cobrada = 'Sí';
  var actId = 'cobro-'+clienteId+'-'+n;
  var act = getActividad(actId); if(act) act.done = true;
  ingresosData.push({id:uid('in'), cliente:x.c.nombre, concepto:'Sesión '+n+' · EMT', monto:monto, fecha:fecha, metodo:metodo, cuenta:cuenta, factura:(requiereFactura?'Sí':'No'), conciliado:false});
  if(requiereFactura){ agregarFacturaPendiente(x.c, n, monto, fecha); }
  closeModal('m-ses-editar');
  recomputeCliente(x.c);
  renderClientes(); renderNav();
  toast('Cobro de '+money(monto)+' registrado'+(requiereFactura?' · factura en cola':''));
  var ahora = new Date().toISOString();
  var sesId = 's-'+clienteId+'-'+n;
  gs('updateSesion', {id:sesId, estado:'done', fecha:fecha, precio:monto,
    cobrada:'Sí', facturaRequerida:(requiereFactura?'Sí':'No'), actualizadoEn:ahora
  }).catch(function(e){ console.error('[CDC GS] updateSesion next:',e); });
  gs('createCobro', {
    id:uid('co'), clienteId:x.c.id, sesionId:sesId,
    sesionN:n, monto:monto, fecha:fecha, metodo:metodo, cuenta:cuenta,
    facturaRequerida:(requiereFactura?'Sí':'No'), creadoEn:ahora
  }).catch(function(e){ console.error('[CDC GS] createCobro next:',e); });
  gs('updateCliente', {id:x.c.id, cobrado:x.c.cobrado, porCobrar:x.c.porCobrar, actualizadoEn:ahora
  }).catch(function(e){ console.error('[CDC GS] updateCliente next:',e); });
  if(requiereFactura){
    gs('createFactura', {
      id:uid('f'), clienteId:x.c.id, clienteNombre:x.c.nombre,
      sesionId:sesId, sesionN:n, monto:monto, fecha:fecha,
      estatus:'Por crear', folio:'',
      rfc:x.c.rfc||'', razonSocial:x.c.razonSocial||'', usoCFDI:x.c.usoCFDI||'',
      creadoEn:ahora, actualizadoEn:ahora
    }).catch(function(e){ console.error('[CDC GS] createFactura next:',e); });
  }
}

function editarCobroDone(){
  var x = _curSes(); if(!x){ closeModal('m-ses-editar'); return; }
  var nuevoMonto = Number(document.getElementById('edit-cb-monto').value) || 0;
  var nuevaFecha = document.getElementById('edit-cb-fecha').value || x.s.fecha;
  if(nuevoMonto <= 0){ toast('Captura un monto válido'); return; }
  var diff = nuevoMonto - x.s.precio;
  x.s.precio = nuevoMonto;
  x.s.fecha  = nuevaFecha;
  // Actualizar montos del cliente
  x.c.cobrado   = (x.c.cobrado   || 0) + diff;
  x.c.porCobrar = Math.max(0, (x.c.porCobrar || 0) - diff);
  closeModal('m-ses-editar');
  recomputeCliente(x.c);
  renderClientes(); renderNav();
  toast('Cobro actualizado a ' + money(nuevoMonto));
  // Guardar en Sheets
  var ahora = new Date().toISOString();
  var sesId = 's-' + sesionCtx.clienteId + '-' + sesionCtx.n;
  gs('updateSesion', { id: sesId, precio: nuevoMonto, fecha: nuevaFecha, actualizadoEn: ahora })
    .catch(function(e){ console.error('[CDC GS] updateSesion editarCobro:', e); });
  gs('updateCliente', { id: x.c.id, cobrado: x.c.cobrado, porCobrar: x.c.porCobrar, actualizadoEn: ahora })
    .catch(function(e){ console.error('[CDC GS] updateCliente editarCobro:', e); });
}

function reprogramarSesion(){
  var x = _curSes(); if(!x){ return; }
  reprogSesCtx = { clienteId: sesionCtx.clienteId, n: sesionCtx.n };
  // Poblar modal con verificación
  setText('rses-titulo', 'Sesión '+sesionCtx.n+' · '+x.c.nombre);
  var rfecha = $('rses-fecha'); if(rfecha) rfecha.value = x.s.fecha || '';
  var rhora  = $('rses-hora');  if(rhora)  rhora.value  = x.s.hora  || '10:00';
  var rmot   = $('rses-motivo'); if(rmot)  rmot.value   = '';
  var rsel   = $('rses-motivo-sel'); if(rsel) rsel.value = '';
  closeModal('m-ses-editar');
  openModal('m-rses');
}

function confirmarReprogSesion(){
  if(!reprogSesCtx) return;
  var nueva  = document.getElementById('rses-fecha').value;
  var hora   = document.getElementById('rses-hora').value || '10:00';
  var motivo = document.getElementById('rses-motivo').value.trim();
  if(!nueva){ toast('Selecciona una nueva fecha'); return; }

  var c = getCliente(reprogSesCtx.clienteId);
  if(!c) return;
  var s = c.sesiones[reprogSesCtx.n - 1];
  if(!s) return;

  var prev = s.fecha;
  s.fecha = nueva;
  s.hora  = hora;
  s.estado = 'scheduled';

  // Agregar nota al historial del cliente si hay motivo
  if(motivo){
    if(!c.notas) c.notas = '';
    c.notas += '\n['+nueva+'] Sesi\u00f3n '+reprogSesCtx.n+' reprogramada: '+motivo;
  }

  closeModal('m-rses');
  renderClientes();
  toast('Sesi\u00f3n '+reprogSesCtx.n+' reprogramada para '+fechaLarga(nueva)+(motivo?' · '+motivo:''));

  // Crear actividad de seguimiento por cancelación
  if(motivo){
    var ahora = new Date().toISOString();
    var hoy   = ahora.slice(0,10);
    var actId = 'reprg-'+reprogSesCtx.clienteId+'-'+reprogSesCtx.n+'-'+Date.now();
    var activa = {
      id:actId, prospecto:c.nombre,
      refTipo:'cliente', refId:reprogSesCtx.clienteId,
      tipo:'Seguimiento reprogramaci\u00f3n sesi\u00f3n '+reprogSesCtx.n,
      fecha:nueva, hora:'10:00',
      grupo:clasificarGrupo(nueva),
      done:false, urgente:false,
      contexto:'Sesi\u00f3n '+reprogSesCtx.n+' reprogramada de '+fechaLarga(prev)+' a '+fechaLarga(nueva)+'. Motivo: '+motivo+'.'
    };
    actividadesData.push(activa);
    gs('createCita', {
      id:actId, prospecto:c.nombre,
      refTipo:'cliente', refId:reprogSesCtx.clienteId,
      tipo:activa.tipo, fecha:nueva, hora:'10:00',
      grupo:activa.grupo, done:'No', urgente:'No',
      contexto:activa.contexto,
      creadoEn:ahora, actualizadoEn:ahora
    }).catch(function(e){ console.error('[CDC GS] createCita reprg:',e); });
    renderActChips(); renderNav();
  }

  // Actualizar en Sheets
  var ahora2 = new Date().toISOString();
  gs('updateSesion', {
    id:'s-'+reprogSesCtx.clienteId+'-'+reprogSesCtx.n,
    estado:'scheduled', fecha:nueva, hora:hora,
    actualizadoEn:ahora2
  }).catch(function(e){ console.error('[CDC GS] updateSesion reprg:',e); });
}

function sesionRealizada(clienteId, n){
  sesionCtx = { clienteId: clienteId, n: n };
  var x = _curSes(); if(!x){ closeModal('m-ses-editar'); return; }
  x.s.notas  = $('ses-ed-notas').value;
  x.s.estado = 'done';
  x.s.cobrada = 'No';
  closeModal('m-ses-editar');
  renderClientes(); renderNav();
  toast('Sesi\u00f3n '+n+' realizada \u2713 Genera el recordatorio de cobro en Agenda');

  var ahora = new Date().toISOString();
  var hoy   = ahora.slice(0,10);

  // ── Recordatorio de cobro (se crea aquí, al confirmar sesión realizada) ──
  var idCobro = 'cobro-'+clienteId+'-'+n;
  if(!getActividad(idCobro)){
    var actCobro = {
      id: idCobro,
      prospecto: x.c.nombre,
      refTipo: 'cliente', refId: clienteId,
      tipo: 'Registrar cobro sesi\u00f3n '+n,
      fecha: hoy, hora: '10:00',
      grupo: 'hoy', done: false, urgente: true,
      contexto: 'Sesi\u00f3n '+n+' realizada. Cobro pendiente de '+money(x.s.precio||x.c.precioSes||0)+'. Registrar el pago.'
    };
    actividadesData.push(actCobro);
    gs('createCita', {
      id:idCobro, prospecto:x.c.nombre,
      refTipo:'cliente', refId:clienteId,
      tipo:'Registrar cobro sesi\u00f3n '+n,
      fecha:hoy, hora:'10:00', grupo:'hoy',
      done:'No', urgente:'S\u00ed',
      contexto:actCobro.contexto,
      creadoEn:ahora, actualizadoEn:ahora
    }).catch(function(e){ console.error('[CDC GS] createCita cobro:',e); });
    renderActChips(); renderNav();
    if(pantallaActual==='hoy') renderActividades(actFiltro);
  }

  // Actividad: agendar la siguiente sesión
  var sigN2 = n + 1;
  var sigSes2 = x.c.sesiones ? x.c.sesiones[sigN2-1] : null;
  if(sigSes2 && sigSes2.estado !== 'done'){
    var idSig2 = 'sig-ses-'+clienteId+'-'+sigN2;
    if(!getActividad(idSig2)){
      var fechaSig2 = new Date(hoy+'T00:00:00');
      fechaSig2.setDate(fechaSig2.getDate()+3);
      var fechaSigStr2 = fechaSig2.toISOString().slice(0,10);
      var actSig2 = {
        id: idSig2, prospecto: x.c.nombre,
        refTipo: 'cliente', refId: clienteId,
        tipo: 'Agendar sesión '+sigN2,
        fecha: fechaSigStr2, hora: '10:00',
        grupo: clasificarGrupo(fechaSigStr2),
        done: false, urgente: false,
        contexto: 'Sesión '+n+' realizada. Agendar sesión '+sigN2+' de '+x.c.sesiones.length+' para '+esc(x.c.nombre)+'.'
      };
      actividadesData.push(actSig2);
      gs('createCita', {
        id:idSig2, prospecto:x.c.nombre,
        refTipo:'cliente', refId:clienteId,
        tipo:'Agendar sesión '+sigN2,
        fecha:fechaSigStr2, hora:'10:00',
        grupo:actSig2.grupo, done:'No', urgente:'No',
        contexto:actSig2.contexto,
        creadoEn:ahora, actualizadoEn:ahora
      }).catch(function(e){ console.error('[CDC GS] createCita sig:',e); });
      renderActChips(); renderNav();
      if(pantallaActual==='hoy') renderActividades(actFiltro);
    }
  }

  gs('updateSesion', {
    id: 's-'+clienteId+'-'+n,
    estado: 'done', cobrada: 'No',
    notas: x.s.notas,
    actualizadoEn: ahora
  }).catch(function(e){ console.error('[CDC GS] updateSesion sesionRealizada:',e); });
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

  // Actividad: confirmar asistencia a la sesión agendada
  var ahora = new Date().toISOString();
  var idConf = 'conf-ses-'+sesionCtx.clienteId+'-'+sesionCtx.n;
  if(!getActividad(idConf)){
    var actConf = {
      id: idConf, prospecto: x.c.nombre,
      refTipo: 'cliente', refId: sesionCtx.clienteId,
      tipo: 'Confirmar sesión '+sesionCtx.n,
      fecha: f, hora: x.s.hora||'10:00',
      grupo: clasificarGrupo(f),
      done: false, urgente: false,
      contexto: 'Sesión '+sesionCtx.n+' agendada para el '+fechaLarga(f)+'. Confirmar asistencia del paciente.'
    };
    actividadesData.push(actConf);
    gs('createCita', {
      id:idConf, prospecto:x.c.nombre,
      refTipo:'cliente', refId:sesionCtx.clienteId,
      tipo:actConf.tipo, fecha:f, hora:actConf.hora,
      grupo:actConf.grupo, done:'No', urgente:'No',
      contexto:actConf.contexto,
      creadoEn:ahora, actualizadoEn:ahora
    }).catch(function(e){ console.error('[CDC GS] createCita conf:',e); });
    renderActChips(); renderNav();
    if(pantallaActual==='hoy') renderActividades(actFiltro);
  }

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
  toast('Sesi\u00f3n '+sesionCtx.n+' marcada como impartida · pendiente de cobro');

  var ahora = new Date().toISOString();

  renderNav(); renderActChips();
  if(pantallaActual==='hoy') renderActividades(actFiltro);

  gs('updateSesion', {id:'s-'+sesionCtx.clienteId+'-'+sesionCtx.n,
    estado:'next', notas:x.s.notas, actualizadoEn:ahora
  }).catch(function(e){ console.error('[CDC GS] updateSesion error:',e); });
}

