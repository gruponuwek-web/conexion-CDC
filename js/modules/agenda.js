/* ============================================================
   CLÍNICA DEL CEREBRO · MÓDULO Agenda / Hoy · Actividades
   Extraído de app.js (estructura modular V3.1).
   Funciones globales — depende de las constantes/estado/helpers
   definidos en app.js, que se carga ANTES que este archivo.
   ============================================================ */

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

async function gs_marcarHecha(id) {
  return gs_actualizarActividad({ id: id, done: 'Sí', grupo: 'completadas' });
}

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

function renderHoyKpis(){
  var pend = actividadesData.filter(function(a){return !a.done;});
  setText('kpi-urg', pend.filter(function(a){return a.urgente || a.grupo==='vencido';}).length);
  setText('kpi-hoy', pend.filter(function(a){return a.grupo==='hoy';}).length);
  setText('kpi-man', pend.filter(function(a){return a.grupo==='manana';}).length);
  setText('kpi-done', actividadesData.filter(function(a){return a.done;}).length);
}

function renderActChips(){
  var counts = {
    todas: actividadesData.filter(function(a){return !a.done;}).length,
    vencido: actividadesData.filter(function(a){return !a.done && (a.grupo==='vencido'||a.grupo==='urgente');}).length,
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
  else if(filtro==='vencido') list = actividadesData.filter(function(a){return !a.done && (a.grupo==='vencido' || a.grupo==='urgente');});
  else list = actividadesData.filter(function(a){return !a.done && a.grupo===filtro;});

  if(list.length===0){
    cont.innerHTML = '<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><div>Sin actividades en este filtro.</div></div>';
    return;
  }
  var html = '';
  if(filtro==='todas'){
    // Incluir vencidas/urgentes en el grupo "Vencidas" de la vista Todas
    var todosGrupos = [{key:'vencido',label:'Vencidas'},{key:'urgente',label:'Vencidas'}].concat(GRUPOS);
    var yaVisto = {};
    todosGrupos.forEach(function(g){
      var sub = ordenarActs(list.filter(function(a){
        if(yaVisto[a.id]) return false;
        var match = (a.grupo===g.key);
        if(match) yaVisto[a.id] = true;
        return match;
      }));
      if(sub.length===0) return;
      var label = (g.key==='vencido'||g.key==='urgente') ? 'Vencidas' : g.label;
      html += '<div class="act-group-title">'+label+' · '+sub.length+'</div>';
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

