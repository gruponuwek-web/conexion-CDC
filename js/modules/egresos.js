/* ============================================================
   CLÍNICA DEL CEREBRO · MÓDULO Egresos / Finanzas
   Extraído de app.js (estructura modular V3.1).
   Funciones globales — depende de las constantes/estado/helpers
   definidos en app.js, que se carga ANTES que este archivo.
   ============================================================ */

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

function finFiltroHtml(){
  var anios = [];
  var todas = ingresosData.concat(historialEgresos);
  todas.forEach(function(r){
    var a = (r.fecha||'').slice(0,4);
    if(a && anios.indexOf(a)===-1) anios.push(a);
  });
  anios.sort().reverse();
  if(anios.indexOf(new Date().getFullYear().toString())===-1)
    anios.unshift(new Date().getFullYear().toString());

  var MESES_LABEL = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var MESES = [
    ['','Todos los meses'],['01','Enero'],['02','Febrero'],['03','Marzo'],
    ['04','Abril'],['05','Mayo'],['06','Junio'],['07','Julio'],
    ['08','Agosto'],['09','Septiembre'],['10','Octubre'],
    ['11','Noviembre'],['12','Diciembre']
  ];

  var activo = finFiltroMes || finFiltroAnio;
  var badgeTxt = '';
  if(finFiltroMes && finFiltroAnio) badgeTxt = MESES_LABEL[parseInt(finFiltroMes,10)]+' '+finFiltroAnio;
  else if(finFiltroMes) badgeTxt = MESES[parseInt(finFiltroMes,10)][1];
  else if(finFiltroAnio) badgeTxt = finFiltroAnio;

  var mesOpts = MESES.map(function(m){
    return '<option value="'+m[0]+'"'+(finFiltroMes===m[0]?' selected':'')+'>'+m[1]+'</option>';
  }).join('');
  var anioOpts = '<option value=""'+(finFiltroAnio===''?' selected':'')+'>Todos los años</option>'
    + anios.map(function(a){
        return '<option value="'+a+'"'+(finFiltroAnio===a?' selected':'')+'>'+a+'</option>';
      }).join('');

  // Construir opciones para custom dropdowns
  var mesItems = MESES.map(function(m){
    var sel = finFiltroMes === m[0];
    var v = m[0];
    return '<div class="fdd-item'+(sel?' selected':'')+'" onclick="setFinFiltroMes(\'' + v + '\')">'+m[1]+'</div>';
  }).join('');

  var anioItems = '<div class="fdd-item'+(finFiltroAnio===''?' selected':'')+'" onclick="setFinFiltroAnio(\'\')">Todos los a\u00f1os</div>'
    + anios.map(function(a){
        var sel = finFiltroAnio === a;
        return '<div class="fdd-item'+(sel?' selected':'')+'" onclick="setFinFiltroAnio(\''+a+'\')">'+a+'</div>';
      }).join('');

  var mesTxt  = finFiltroMes  ? MESES[parseInt(finFiltroMes,10)][1] : 'Todos los meses';
  var anioTxt = finFiltroAnio ? finFiltroAnio : 'Todos los años';

  var chevSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>';
  return '<div class="fin-filtro-bar">'
    + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="fin-filtro-ico"><path d="M3 4h18M7 10h10M10 16h4"/></svg>'
    + '<span class="fin-filtro-label">Per\u00edodo</span>'
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
          + '<button class="btn btn-ghost btn-sm fin-filtro-clear" onclick="limpiarFinFiltro()">\u2715 Limpiar</button>'
        : '')
    + '</div>';
  // Cerrar todos los demás
  document.querySelectorAll('.fdd.open').forEach(function(d){ if(d!==el) d.classList.remove('open'); });
  el.classList.toggle('open');
}

function limpiarCrossFilter(){
  dashCrossFilter = { etapa: null, mes: null, estadoCli: null };
  buildCharts('general');
}

function actualizarCrossHint(){
  var hint = $('dash-cross-hint');
  var txt  = $('dash-cross-txt');
  var panel = $('dash-detalle-panel');
  if(!hint) return;
  var filtros = [];
  if(dashCrossFilter.etapa)   filtros.push('Etapa: <b>'+dashCrossFilter.etapa+'</b>');
  if(dashCrossFilter.mes)     filtros.push('Mes: <b>'+MESES_CORTO[parseInt(dashCrossFilter.mes,10)-1]+'</b>');
  if(dashCrossFilter.estadoCli) filtros.push('Estado: <b>'+dashCrossFilter.estadoCli+'</b>');
  if(filtros.length > 0){
    hint.style.display = 'flex';
    txt.innerHTML = 'Filtro activo → ' + filtros.join(' · ');
    // Mostrar cobros del mes seleccionado
    if(dashCrossFilter.mes && panel){
      var m = dashCrossFilter.mes;
      var cobsMes = ingresosData.concat(ingresosExtras).filter(function(r){
        var f=(r.fecha||'').slice(0,10);
        return f.slice(0,4)===dashFiltroAnio && f.slice(5,7)===m;
      });
      if(cobsMes.length > 0){
        var rows = cobsMes.map(function(c){
          return '<div style="display:flex;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)">'
            + '<div style="flex:1;font-size:13px;font-weight:600">'+esc(c.cliente)+'</div>'
            + '<div style="font-size:12px;color:var(--ink-3)">'+esc(c.concepto)+'</div>'
            + '<div style="font-size:13px;font-weight:700;color:var(--green)">'+money(c.monto)+'</div>'
            + '</div>';
        }).join('');
        panel.style.display = 'block';
        panel.innerHTML = '<div style="font-size:13px;font-weight:700;margin-bottom:10px">Cobros de '+MESES_CORTO[parseInt(m,10)-1]+' '+dashFiltroAnio+' — '+cobsMes.length+' registro'+(cobsMes.length!==1?'s':'')+'</div>' + rows;
      } else {
        panel.style.display = 'block';
        panel.innerHTML = '<div style="font-size:13px;color:var(--ink-3);text-align:center;padding:16px">Sin cobros registrados en '+MESES_CORTO[parseInt(m,10)-1]+' '+dashFiltroAnio+'</div>';
      }
    } else {
      if(panel) panel.style.display = 'none';
    }
  } else {
    hint.style.display = 'none';
    if(panel) panel.style.display = 'none';
  }
}

function fddToggle(el){
  document.querySelectorAll('.fdd.open').forEach(function(d){ if(d!==el) d.classList.remove('open'); });
  el.classList.toggle('open');
}

function setFinFiltroMes(v)  { finFiltroMes  = v; document.querySelectorAll('.fdd.open').forEach(function(d){ d.classList.remove('open'); }); renderFinanzas(); }

function setFinFiltroAnio(v) { finFiltroAnio = v; renderFinanzas(); }

function limpiarFinFiltro()  { finFiltroMes=''; finFiltroAnio=''; renderFinanzas(); }

function finFiltrar(rows){
  return rows.filter(function(r){
    var fecha = (r.fecha||'');
    // Normalizar fecha ISO con timezone
    if(fecha.length > 10) fecha = fecha.slice(0,10);
    var mes  = fecha.slice(5,7);
    var anio = fecha.slice(0,4);
    if(finFiltroMes  && mes  !== finFiltroMes)  return false;
    if(finFiltroAnio && anio !== finFiltroAnio) return false;
    return true;
  });
}

function finKpiCard(cls, iconName, val, lbl){
  return '<div class="kpi '+cls+'"><div class="ic">'+ico(iconName)+'</div><div class="val">'+val+'</div><div class="lbl">'+lbl+'</div></div>';
}

function renderFinKpis(which){
  var cont = $('fin-kpis'); if(!cont) return;
  var html='';
  if(which==='ingresos'){
    var inFilt  = finFiltrar(ingresosData);
    var extFilt2 = finFiltrar(ingresosExtras);
    var totalIn = inFilt.reduce(function(s,i){return s+(i.monto||0);},0)
                + extFilt2.reduce(function(s,i){return s+(i.monto||0);},0);
    var sinConc = inFilt.filter(function(i){return !i.conciliado;}).length
                + extFilt2.filter(function(i){return !i.conciliado;}).length;
    var fact = inFilt.filter(function(i){return i.factura==='Sí';}).reduce(function(s,i){return s+(i.monto||0);},0);
    var lblPeriodo = (finFiltroMes||finFiltroAnio) ? 'en el período' : 'total';
    html += finKpiCard('x-green','cobro', money(totalIn), 'Ingresos '+lblPeriodo);
    html += finKpiCard('x-blue','cita', inFilt.length, 'Cobros '+lblPeriodo);
    html += finKpiCard('x-violet','doc', sinConc, 'Sin conciliar');
    html += finKpiCard('x-primary','doc', money(fact), 'Facturados');
  } else {
    var egFilt = finFiltrar(historialEgresos);
    var totalEg = egFilt.reduce(function(s,e){return s+(e.monto||0);},0);
    var ded = egFilt.filter(function(e){return e.deducible==='Sí';}).reduce(function(s,e){return s+(e.monto||0);},0);
    var lblEg = (finFiltroMes||finFiltroAnio) ? 'en el período' : 'total';
    html += finKpiCard('x-red','cobro', money(totalEg), 'Egresos '+lblEg);
    html += finKpiCard('x-amber','reloj', porPagarData.length, 'Por pagar');
    html += finKpiCard('x-violet','doc', egFilt.filter(function(e){return !e.conciliado;}).length, 'Sin conciliar');
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
  var egresosVis = finFiltrar(historialEgresos);
  var heRows = egresosVis.length? egresosVis.slice().sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');}).map(function(e){
    return '<div class="histrow" style="cursor:pointer" onclick="openEgresoDetalle(\''+e.id+'\')">'
      + '<div class="act-ico" style="width:34px;height:34px;background:var(--gray-bg);color:var(--ink-2)">'+ico('cobro')+'</div>'
      + '<div style="flex:1"><b style="font-weight:650">'+esc(e.nombre)+'</b><div class="meta" style="font-size:12px;color:var(--ink-3)">'+fechaLarga(e.fecha)+' · '+esc(e.metodo)+' · '+esc(e.cuenta||'—')+' · '+esc(e.cat)+'</div></div>'
      + (e.deducible==='Sí'?'<span class="badge b-green" style="margin-right:8px">Deducible</span>':'')
      + '<div style="font-weight:700;margin-right:10px">'+money(e.monto)+'</div>'
      + concBtn('egreso', e.id, e.conciliado)+'</div>';
  }).join('') : '<div class="empty" style="padding:18px">Sin egresos'+(finFiltroMes||finFiltroAnio?' en el período':'')+'</div>';
  html += egSection('Historial de egresos', 'Pagos ya realizados', egresosVis.length, heRows, '');

  cont.innerHTML = html;
  renderFinKpis(finTabActual);
}

function concBtn(tipo, id, conc){
  var fn = tipo==='ingreso' ? 'toggleConciliarIngreso' : (tipo==='ingresoExtra' ? 'toggleConciliarIngresoExtra' : 'toggleConciliarEgreso');
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
  var ingresosVis = finFiltrar(ingresosData);
  var rows = ingresosVis.length? ingresosVis.slice().sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');}).map(function(i){
    return '<div class="histrow">'
      + '<div class="act-ico" style="width:34px;height:34px;background:var(--green-bg);color:var(--green)">'+ico('cobro')+'</div>'
      + '<div style="flex:1"><b style="font-weight:650">'+esc(i.cliente)+'</b><div class="meta" style="font-size:12px;color:var(--ink-3)">'+fechaLarga(i.fecha)+' · '+esc(i.concepto)+' · '+esc(i.metodo)+' · '+esc(i.cuenta||'—')+'</div></div>'
      + (i.factura==='Sí'?'<span class="badge b-blue" style="margin-right:8px">Facturado</span>':'')
      + '<div style="font-weight:700;color:var(--green);margin-right:10px">'+money(i.monto)+'</div>'
      + concBtn('ingreso', i.id, i.conciliado)+'</div>';
  }).join('') : '<div class="empty" style="padding:18px">Sin ingresos'+(finFiltroMes||finFiltroAnio?' en el período':'')+'</div>';
  var html = egSection('Historial de ingresos', 'Cobros recibidos de clientes', ingresosData.length, rows, '');

  // ── Ingresos adicionales ──────────────────────────────────────
  var extFilt = finFiltrar(ingresosExtras);
  var extRows = extFilt.length ? extFilt.slice().sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');}).map(function(i){
    return '<div class="histrow" style="cursor:pointer" onclick="abrirIngresoExtraDetalle(\''+i.id+'\')"><div class="act-ico" style="width:34px;height:34px;background:var(--emerald-bg,#D1FAE5);color:var(--emerald,#0E8F73)">'+ico('cobro')+'</div>'
      + '<div style="flex:1"><b style="font-weight:650">'+esc(i.concepto)+'</b><div class="meta" style="font-size:12px;color:var(--ink-3)">'+fechaLarga(i.fecha)+' · '+esc(i.cliente||'—')+' · '+esc(i.metodo)+' · '+esc(i.cat)+'</div></div>'
      + '<div style="font-weight:700;color:var(--green);margin-right:10px">'+money(i.monto)+'</div>'
      + concBtn('ingresoExtra', i.id, i.conciliado)+'</div>';
  }).join('') : '<div class="empty" style="padding:18px">Sin ingresos adicionales'+(finFiltroMes||finFiltroAnio?' en el período':'')+'</div>';
  var btnExtra = '<button class="btn btn-soft btn-sm" onclick="event.stopPropagation();openNuevoIngresoExtra()">+ Agregar</button>';
  html += egSection('Ingresos adicionales', 'Consultoría, ventas, donativos, otros', extFilt.length, extRows, btnExtra);

  cont.innerHTML = html;
}

function finTab(which){
  finTabActual = which;
  ['egresos','ingresos'].forEach(function(t){
    var tab=$('fintab-'+t); if(tab) tab.classList.toggle('active', t===which);
  });
  var egC=$('egresos-acordeones'), inC=$('ingresos-acordeones');
  var egF=$('fin-filtro-egresos'), inF=$('fin-filtro-ingresos');
  if(egC) egC.style.display = which==='egresos'?'':'none';
  if(inC) inC.style.display = which==='ingresos'?'':'none';
  // filtro global — siempre visible
  setText('fin-head', which==='ingresos'?'Ingresos':'Egresos');
  var btn=$('fin-nuevo-btn'); if(btn) btn.style.display = which==='ingresos'?'none':'';
  renderFinKpis(which);
}

function renderFinanzas(){
  var fg = $('fin-filtro-global');
  if(fg) fg.innerHTML = finFiltroHtml();
  renderEgresos();
  renderIngresos();
  finTab(finTabActual);
}

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

function getPagoFijo(id){ for(var i=0;i<pagosFijos.length;i++){if(pagosFijos[i].id===id)return pagosFijos[i];} return null; }

function getPorPagar(id){ for(var i=0;i<porPagarData.length;i++){if(porPagarData[i].id===id)return porPagarData[i];} return null; }

function getEgreso(id){ for(var i=0;i<historialEgresos.length;i++){if(historialEgresos[i].id===id)return historialEgresos[i];} return null; }

function getIngreso(id){ for(var i=0;i<ingresosData.length;i++){if(ingresosData[i].id===id)return ingresosData[i];} return null; }

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

function getIngresoExtra(id){ for(var i=0;i<ingresosExtras.length;i++){ if(ingresosExtras[i].id===id) return ingresosExtras[i]; } return null; }

function openNuevoIngresoExtra(){
  $('ie-concepto').value=''; $('ie-cliente').value=''; $('ie-monto').value='';
  $('ie-fecha').value=HOY; $('ie-metodo').value='Transferencia';
  $('ie-cat').value='Consultoría';
  var cr=$('ie-conciliado-row'); if(cr) cr.classList.remove('on');
  ieActualizarCuenta();
  openModal('m-ingreso-extra');
}

function ieActualizarCuenta(){
  var metodo = $('ie-metodo').value;
  var cuentas = cuentasPorMetodo[metodo] || [];
  setHtml('ie-cuenta', cuentas.map(function(c){return '<option>'+esc(c)+'</option>';}).join(''));
}

function guardarIngresoExtra(){
  var concepto = $('ie-concepto').value.trim();
  var monto    = Number($('ie-monto').value)||0;
  if(!concepto){ toast('Captura el concepto'); return; }
  if(monto<=0){  toast('Captura un monto válido'); return; }
  var ie = {
    id:         uid('ie'),
    concepto:   concepto,
    cliente:    $('ie-cliente').value.trim()||'—',
    monto:      monto,
    fecha:      $('ie-fecha').value||HOY,
    metodo:     $('ie-metodo').value,
    cuenta:     $('ie-cuenta').value||'',
    cat:        $('ie-cat').value,
    conciliado: !!($('ie-conciliado-row').classList.contains('on'))
  };
  ingresosExtras.push(ie);
  closeModal('m-ingreso-extra');
  renderIngresos(); renderFinKpis('ingresos');
  toast('Ingreso adicional registrado: '+money(ie.monto));
  var ahora = new Date().toISOString();
  gs('createIngresoExtra', {
    id:ie.id, concepto:ie.concepto, cliente:ie.cliente||'', monto:ie.monto,
    fecha:ie.fecha, metodo:ie.metodo, cuenta:ie.cuenta, cat:ie.cat,
    conciliado:(ie.conciliado?'Sí':'No'), creadoEn:ahora, actualizadoEn:ahora
  }).catch(function(e){ console.error('[CDC GS] createIngresoExtra:',e); });
}

function toggleConciliarIngresoExtra(id){
  var ie=getIngresoExtra(id); if(!ie) return;
  ie.conciliado=!ie.conciliado;
  renderIngresos(); renderFinKpis('ingresos');
  toast(ie.conciliado?'Ingreso adicional conciliado':'Ingreso marcado como pendiente');
  gs('updateIngresoExtra', {id:id, conciliado:(ie.conciliado?'Sí':'No'), actualizadoEn:new Date().toISOString()})
    .catch(function(e){ console.error('[CDC GS] updateIngresoExtra:',e); });
}

function abrirIngresoExtraDetalle(id){
  var ie=getIngresoExtra(id); if(!ie) return;
  ingresoExtraCtx = id;
  setText('ied-titulo', ie.concepto);
  setText('ied-sub', fechaLarga(ie.fecha)+' · '+ie.cat+' · '+(ie.cliente||'—'));
  $('ied-monto').value  = ie.monto;
  $('ied-fecha').value  = ie.fecha;
  $('ied-metodo').value = ie.metodo;
  $('ied-cat').value    = ie.cat;
  var cr=$('ied-conciliado'); if(cr) cr.classList.toggle('on', !!ie.conciliado);
  iedActualizarCuenta(ie.cuenta);
  openModal('m-ingreso-extra-detalle');
}

function iedActualizarCuenta(keep){
  var metodo = $('ied-metodo').value;
  var cuentas = cuentasPorMetodo[metodo]||[];
  setHtml('ied-cuenta', cuentas.map(function(c){return '<option>'+esc(c)+'</option>';}).join(''));
  if(keep && cuentas.indexOf(keep)>=0) $('ied-cuenta').value=keep;
}

function guardarIngresoExtraDetalle(){
  var ie=getIngresoExtra(ingresoExtraCtx); if(!ie){closeModal('m-ingreso-extra-detalle');return;}
  ie.monto  = Number($('ied-monto').value)||0;
  ie.fecha  = $('ied-fecha').value;
  ie.metodo = $('ied-metodo').value;
  ie.cuenta = $('ied-cuenta').value;
  ie.cat    = $('ied-cat').value;
  ie.conciliado = !!($('ied-conciliado').classList.contains('on'));
  closeModal('m-ingreso-extra-detalle');
  renderIngresos(); renderFinKpis('ingresos');
  toast('Ingreso adicional actualizado');
  gs('updateIngresoExtra', {
    id:ie.id, monto:ie.monto, fecha:ie.fecha, metodo:ie.metodo,
    cuenta:ie.cuenta, cat:ie.cat, conciliado:(ie.conciliado?'Sí':'No'),
    actualizadoEn:new Date().toISOString()
  }).catch(function(e){ console.error('[CDC GS] updateIngresoExtra:',e); });
}

