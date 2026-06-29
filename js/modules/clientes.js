/* ============================================================
   CLÍNICA DEL CEREBRO · MÓDULO Clientes · Cartera, sesiones, onboarding
   Extraído de app.js (estructura modular V3.1).
   Funciones globales — depende de las constantes/estado/helpers
   definidos en app.js, que se carga ANTES que este archivo.
   ============================================================ */

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

function recomputeCliente(c){
  if(!c.sesiones) return;
  var done = c.sesiones.filter(function(s){return s.estado==='done';});
  // Sumar montos reales cobrados por sesión (no precio fijo * cantidad)
  c.cobrado   = done.reduce(function(sum, s){ return sum + (Number(s.precio)||0); }, 0);
  // porCobrar = monto total pactado - lo cobrado (no suma de sesiones pendientes)
  c.porCobrar = Math.max(0, (Number(c.monto) || 0) - c.cobrado);
  if(c.sesiones.length>0 && done.length===c.sesiones.length && c.estado!=='Cancelado' && c.estado!=='Pausado'){
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

function dotClass(estado, cobrada){
  if(estado==='done') return (cobrada==='Sí'||cobrada===true||cobrada==='Si') ? 'sd-done' : 'sd-next';
  if(estado==='next') return 'sd-scheduled'; // naranja — sesión impartida, confirmar
  if(estado==='scheduled') return 'sd-scheduled';
  return 'sd-pending';
}

function dotLabel(estado, cobrada){
  if(estado==='done') return (cobrada==='Sí'||cobrada===true||cobrada==='Si') ? 'Cobrada ✓' : 'Realizada · por cobrar';
  if(estado==='next') return 'Impartida · por confirmar';
  if(estado==='scheduled') return 'Agendada · por confirmar';
  return 'Por agendar';
}

function sesTrackHtml(c){
  if(!c.sesiones || c.sesiones.length===0){
    return '<div style="font-size:12.5px;color:var(--ink-3);padding:6px 0">Aún sin sesiones. Completa el onboarding para activar el tratamiento.</div>';
  }
  var dots = c.sesiones.map(function(s){
    return '<div class="ses-dot '+dotClass(s.estado,s.cobrada)+'" title="Sesión '+s.n+' · '+dotLabel(s.estado,s.cobrada)+'" onclick="clickDot(\''+c.id+'\','+s.n+')">'+s.n+'</div>';
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

function renderCliFiltroChips(){
  // ── Chips de estado ──
  var estados = ['Todos'].concat(LISTAS.estadosCliente);
  var chips = estados.map(function(e){
    var active = cliFiltroEstado === e;
    return '<button class="chip'+(active?' active':'')+'" data-est="'+e+'" onclick="setClifiltro_btn(this)">'
      + e
      + (e!=='Todos' ? '<span class="n">'+clientesData.filter(function(c){return c.estado===e;}).length+'</span>' : '')
      + '</button>';
  }).join('');

  // ── Selectores de año/mes ──
  var anios = [];
  clientesData.forEach(function(c){
    var a = (c.creadoEn||'').slice(0,4);
    if(a && anios.indexOf(a)===-1) anios.push(a);
  });
  anios.sort().reverse();
  if(anios.indexOf(new Date().getFullYear().toString())===-1)
    anios.unshift(new Date().getFullYear().toString());

  var MESES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var anioOpts = '<option value="">Todos los años</option>'
    + anios.map(function(a){ return '<option value="'+a+'"'+(cliFiltroAnio===a?' selected':'')+'>'+a+'</option>'; }).join('');
  var mesOpts = '<option value="">Todos los meses</option>'
    + MESES_LABEL.map(function(m,i){
        var num = (i+1).toString().padStart(2,'0');
        return '<option value="'+num+'"'+(cliFiltroMes===num?' selected':'')+'>'+m+'</option>';
      }).join('');

  var selects = '<div style="display:flex;align-items:center;gap:6px;margin-left:auto">'
    + '<select class="fin-filtro-sel" onchange="setCliFiltroAnio(this.value)" style="font-size:0.8rem;padding:5px 8px;border-radius:7px;border:1.5px solid var(--line,#E5E7EB)">'+anioOpts+'</select>'
    + '<select class="fin-filtro-sel" onchange="setCliFiltroMes(this.value)" style="font-size:0.8rem;padding:5px 8px;border-radius:7px;border:1.5px solid var(--line,#E5E7EB)">'+mesOpts+'</select>'
    + '</div>';

  var el = $('cli-filtro-chips');
  if(el) el.innerHTML = '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;width:100%">'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px;flex:1">'+chips+'</div>'
    + selects
    + '</div>';
}

function setClifiltro_btn(btn){ setClifiltro(btn.getAttribute('data-est')); }

function setCliFiltroAnio(v){ cliFiltroAnio = v; renderClientes(); }

function setCliFiltroMes(v){  cliFiltroMes  = v; renderClientes(); }

function setClifiltro(estado){
  cliFiltroEstado = estado;
  renderClientes();
}

function renderClientes(){
  renderClientesKpis();
  var cont = $('clientes-acordeones'); if(!cont) return;
  var lista = clientesData.filter(function(c){
    if(cliFiltroEstado !== 'Todos' && c.estado !== cliFiltroEstado) return false;
    if(cliFiltroAnio || cliFiltroMes){
      var fp = (c.creadoEn||'').slice(0,10);
      if(cliFiltroAnio && fp.slice(0,4) !== cliFiltroAnio) return false;
      if(cliFiltroMes  && fp.slice(5,7) !== cliFiltroMes)  return false;
    }
    return true;
  });
  setText('cli-count', lista.length+' cliente'+(lista.length!==1?'s':''));
  renderCliFiltroChips();
  var html = '';
  lista.forEach(function(c){ html += accClienteHtml(c, c.id===clienteAbiertoId); });
  if(lista.length === 0) html = '<div class="empty" style="padding:32px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><div>Sin clientes con estado "'+esc(cliFiltroEstado)+'"</div></div>';
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
  if(estado==='Completado') renderPipeline();
  toast(c.nombre+' → '+estado);
  gs('updateCliente', {id:id, estado:estado, actualizadoEn:new Date().toISOString()})
    .catch(function(e){ console.error('[CDC GS] updateCliente estado:',e); });
}

function setRazonCancel(id, r){ var c=getCliente(id); if(!c) return; c.razonCancel=r; if(r==='Otro') renderClientes(); }

function setRazonOtro(id, v){ var c=getCliente(id); if(c) c.razonOtro=v; }

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
  // Crear todas las sesiones en una sola llamada (evita rate limiting)
  var sesionesPayload = c.sesiones.map(function(s){
    return {
      id:'s-'+c.id+'-'+s.n, clienteId:c.id,
      n:s.n, estado:s.estado, fecha:s.fecha||'',
      hora:s.hora||'', notas:'', precio:s.precio,
      cobrada:'No', facturaRequerida:'No', folioCFDI:'',
      creadoEn:ahora, actualizadoEn:ahora
    };
  });
  gs('createSesiones', { sesiones: sesionesPayload })
    .then(function(r){ if(!r.ok) console.error('[CDC GS] createSesiones:', r.error); })
    .catch(function(e){ console.error('[CDC GS] createSesiones error:',e); });
}

