/* ============================================================
   CLÍNICA DEL CEREBRO · MÓDULO Leads · Pipeline
   Extraído de app.js (estructura modular V3.1).
   Funciones globales — depende de las constantes/estado/helpers
   definidos en app.js, que se carga ANTES que este archivo.
   ============================================================ */

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
    var leads = leadsData.filter(function(l){
      if(l.etapa !== et) return false;
      if(et === 'Ganado'){
        var cli = getCliente('c-' + l.id);
        if(cli && cli.estado === 'Completado') return false;
      }
      return true;
    });
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
  var l = getLead(pipeActualId);
  if(!l){
    console.error('[CDC] guardarPipe: lead no encontrado con id:', pipeActualId);
    closeModal('m-pipe-detalle'); return;
  }
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

function cambiarEtapaLead(id, nuevaEtapa, fromDrag){
  var l = getLead(id); if(!l) return;
  var prev = l.etapa;
  if(prev===nuevaEtapa) return;
  // Actualizar contexto al lead correcto
  pipeActualId = id;
  // Guardar etapa anterior ANTES de cambiar
  var etapaAnterior = prev;
  l.etapa = nuevaEtapa;
  l.historial = l.historial || [];
  l.historial.unshift({t:fechaLarga(HOY), x:'Etapa: '+etapaAnterior+' → '+nuevaEtapa});
  // Guardar en Sheets
  gs('updateLead', {
    id: l.id,
    etapa: nuevaEtapa,
    historial: JSON.stringify(l.historial),
    actualizadoEn: new Date().toISOString()
  }).catch(function(e){ console.error('[CDC GS] updateLead etapa:',e); });
  renderLeads(); renderNav();
  if(nuevaEtapa==='Ganado'){
    setTimeout(function(){ ganarLead(id, etapaAnterior); }, 300);
  } else {
    abrirEtapaActividad(id, etapaAnterior, nuevaEtapa);
  }
}

function setLeadActividad(l, tipo, fecha, hora, nota){
  // reemplaza la actividad abierta previa de este lead
  actividadesData = actividadesData.filter(function(a){ return !(a.refTipo==='lead' && a.refId===l.id && !a.done); });
  l.sigAct = tipo; l.sigFecha = fecha; l.sigHora = hora;
  var nuevaAct = {
    id:uid('a'), prospecto:l.nombre, refTipo:'lead', refId:l.id, tipo:tipo, fecha:fecha, hora:hora,
    grupo:clasificarGrupo(fecha), done:false, urgente:(clasificarGrupo(fecha)==='vencido'),
    contexto: (nota && nota.trim()) ? nota.trim() : (l.padecimiento+' · '+tipo+' tras pasar a '+l.etapa+'.')
  };
  actividadesData.push(nuevaAct);
  return nuevaAct;
}

function abrirEtapaActividad(id, prev, etapa){
  var l = getLead(id); if(!l) return;
  etapaActCtx = {id:id, etapa:etapa, prev:prev};
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
  // Asegurar que pipeActualId apunta al lead correcto
  pipeActualId = etapaActCtx.id;
  var l = getLead(etapaActCtx.id); if(!l){ closeModal('m-etapa-actividad'); return; }
  var opcional = (ETAPAS_OPCIONALES.indexOf(etapaActCtx.etapa)>=0);
  var tipo = $('ea-tipo').value;
  var fecha = $('ea-fecha').value || HOY;
  var hora = $('ea-hora').value || '10:00';
  var nota = $('ea-nota').value;
  if(!opcional && !tipo){ toast('Define una actividad de seguimiento'); return; }
  if(nota && nota.trim()){ l.historial = l.historial||[]; l.historial.unshift({t:fechaLarga(HOY), x:nota.trim()}); }
  if(tipo){
    var nuevaAct = setLeadActividad(l, tipo, fecha, hora, nota);
    toast('Actividad "'+tipo+'" agendada · '+fechaHoraTxt(fecha,hora));
    if(nuevaAct){
      var ahora = new Date().toISOString();
      gs('createCita', {
        id:nuevaAct.id, prospecto:nuevaAct.prospecto,
        refTipo:nuevaAct.refTipo, refId:String(nuevaAct.refId),
        tipo:nuevaAct.tipo, fecha:nuevaAct.fecha, hora:nuevaAct.hora||'',
        grupo:nuevaAct.grupo, done:'No',
        urgente:(nuevaAct.urgente?'Sí':'No'),
        contexto:nuevaAct.contexto||'',
        creadoEn:ahora, actualizadoEn:ahora
      }).then(function(r){
        if(!r.ok) console.error('[CDC GS] createCita:', r.error);
        else console.info('[CDC GS] Actividad guardada:', nuevaAct.tipo, nuevaAct.prospecto);
      }).catch(function(e){ console.error('[CDC GS] createCita:',e); });
    }
  } else {
    l.sigAct=''; l.sigFecha=''; l.sigHora='';
    actividadesData = actividadesData.filter(function(a){ return !(a.refTipo==='lead' && a.refId===l.id && !a.done); });
    toast(l.nombre+' → '+etapaActCtx.etapa);
  }
  closeModal('m-etapa-actividad');
  renderLeads(); renderNav();
  if(pantallaActual==='hoy'){ renderActividades(actFiltro); renderActChips(); }
}

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

