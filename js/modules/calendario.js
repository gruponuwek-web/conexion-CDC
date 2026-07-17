/* ============================================================
   CLÍNICA DEL CEREBRO · MÓDULO Calendario
   Depende de app.js (actividadesData, HOY, clasificarGrupo,
   marcarHecha, reprog, abrirActDetalle, tipoIcon, ico, esc,
   fechaHoraTxt, $, setHtml, setText)
   ============================================================ */

var calViewYear     = 0;
var calViewMonth    = 0;
var calSelectedDate = '';
var calFilter       = 'todas';

var CAL_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var CAL_DOW   = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
var CAL_DOW_LARGO = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

var hoyVistaActual = 'calendario';

function hoyVista(v) {
  hoyVistaActual = v;
  var lista = $('hoy-lista-view');
  var cal   = $('hoy-cal-view');
  var btnL  = $('btn-vista-lista');
  var btnC  = $('btn-vista-cal');
  if (!lista || !cal) return;

  if (v === 'calendario') {
    lista.style.display = 'none';
    cal.style.display   = '';
    if (btnL) { btnL.style.background = 'var(--surface)'; btnL.style.color = 'var(--ink-3)'; }
    if (btnC) { btnC.style.background = 'var(--ink)';     btnC.style.color = '#fff'; }
    renderCalendario();
  } else {
    lista.style.display = '';
    cal.style.display   = 'none';
    if (btnL) { btnL.style.background = 'var(--ink)';     btnL.style.color = '#fff'; }
    if (btnC) { btnC.style.background = 'var(--surface)'; btnC.style.color = 'var(--ink-3)'; }
    renderActividades(actFiltro);
    renderActChips();
  }
}

function renderCalendario() {
  var now = new Date();
  if (calSelectedDate === '') calSelectedDate = HOY;
  if (calViewYear  === 0) calViewYear  = now.getFullYear();
  if (calViewMonth === 0) calViewMonth = now.getMonth();

  var sc = $('hoy-cal-view');
  if (!sc) return;
  sc.innerHTML = _calHtml();
  _calBindEvents();
  _calRenderGrid();
  _calRenderDetail();
  _calRenderSummaryChips();
}

/* ── HTML esqueleto ──────────────────────────────────────── */
function _calHtml() {
  return '<div class="cal-wrap">'
    + '<div class="cal-summary-row" id="cal-summary-chips"></div>'
    + '<div class="cal-layout">'
      + '<div class="cal-card" id="cal-card">'
        + '<div class="cal-nav-bar">'
          + '<button class="btn btn-ghost" id="cal-prev" style="padding:5px 10px;font-size:16px">&#8249;</button>'
          + '<span class="cal-month-label" id="cal-month-label"></span>'
          + '<button class="btn btn-ghost" id="cal-next" style="padding:5px 10px;font-size:16px">&#8250;</button>'
        + '</div>'
        + '<div class="cal-dow-row">'
          + CAL_DOW.map(function(d){ return '<span>'+d+'</span>'; }).join('')
        + '</div>'
        + '<div class="cal-days-grid" id="cal-days-grid"></div>'
      + '</div>'
      + '<div class="cal-detail-card" id="cal-detail-card">'
        + '<div class="cal-detail-hd" id="cal-detail-hd"></div>'
        + '<div class="cal-filter-strip" id="cal-filter-strip">'
          + ['todas','pendientes','vencidas','completadas'].map(function(f){
              return '<button class="chip'+(f===calFilter?' active':'')+'" data-cal-filter="'+f+'">'+
                {todas:'Todas',pendientes:'Pendientes',vencidas:'Vencidas',completadas:'Completadas'}[f]+
              '</button>';
            }).join('')
        + '</div>'
        + '<div class="cal-act-list" id="cal-act-list"></div>'
      + '</div>'
    + '</div>'
  + '</div>';
}

/* ── Bind eventos ────────────────────────────────────────── */
function _calBindEvents() {
  var prev = $('cal-prev'), next = $('cal-next');
  if (prev) prev.addEventListener('click', function() {
    calViewMonth--;
    if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
    _calRenderGrid();
    _calRenderSummaryChips();
  });
  if (next) next.addEventListener('click', function() {
    calViewMonth++;
    if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
    _calRenderGrid();
    _calRenderSummaryChips();
  });

  var strip = $('cal-filter-strip');
  if (strip) strip.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-cal-filter]');
    if (!btn) return;
    calFilter = btn.dataset.calFilter;
    strip.querySelectorAll('[data-cal-filter]').forEach(function(b) {
      b.classList.toggle('active', b === btn);
    });
    _calRenderDetail();
  });
}

/* ── Grid de días ────────────────────────────────────────── */
function _calRenderGrid() {
  var lbl = $('cal-month-label');
  if (lbl) lbl.textContent = CAL_MESES[calViewMonth] + ' ' + calViewYear;

  var firstDay = new Date(calViewYear, calViewMonth, 1);
  var startDow = firstDay.getDay(); // 0=Dom
  startDow = startDow === 0 ? 6 : startDow - 1; // convertir a lunes=0

  var daysInMonth  = new Date(calViewYear, calViewMonth + 1, 0).getDate();
  var prevMonthDays = new Date(calViewYear, calViewMonth, 0).getDate();

  var html = '';

  // Relleno mes anterior
  for (var i = startDow - 1; i >= 0; i--) {
    html += '<div class="cal-day other-month"><span class="cal-day-num">'+(prevMonthDays-i)+'</span></div>';
  }

  // Días del mes
  for (var d = 1; d <= daysInMonth; d++) {
    var iso = _calIso(calViewYear, calViewMonth, d);
    var acts = actividadesData.filter(function(a){ return _normFecha(a.fecha) === iso; });
    var venc  = acts.filter(function(a){ return !a.done && _normFecha(a.fecha) < HOY; });
    var pend  = acts.filter(function(a){ return !a.done && _normFecha(a.fecha) >= HOY; });
    var done  = acts.filter(function(a){ return a.done; });

    var cls = 'cal-day'
      + (iso === HOY ? ' is-today' : '')
      + (iso === calSelectedDate ? ' is-selected' : '');

    var pips = '';
    venc.slice(0,4).forEach(function(){ pips += '<i class="cal-pip pip-venc"></i>'; });
    pend.slice(0,4).forEach(function(){ pips += '<i class="cal-pip pip-pend"></i>'; });
    done.slice(0,2).forEach(function(){ pips += '<i class="cal-pip pip-done"></i>'; });

    html += '<div class="'+cls+'" data-cal-date="'+iso+'" tabindex="0" role="button">'
          + '<span class="cal-day-num">'+d+'</span>'
          + (pips ? '<div class="cal-pips">'+pips+'</div>' : '')
          + '</div>';
  }

  // Relleno mes siguiente
  var total = startDow + daysInMonth;
  var rest  = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (var n = 1; n <= rest; n++) {
    html += '<div class="cal-day other-month"><span class="cal-day-num">'+n+'</span></div>';
  }

  var grid = $('cal-days-grid');
  if (!grid) return;
  grid.innerHTML = html;

  grid.querySelectorAll('[data-cal-date]').forEach(function(el) {
    el.addEventListener('click', function() {
      calSelectedDate = el.dataset.calDate;
      _calRenderGrid();   // re-pinta selected
      _calRenderDetail();
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        calSelectedDate = el.dataset.calDate;
        _calRenderGrid();
        _calRenderDetail();
      }
    });
  });
}

/* ── Panel de detalle ────────────────────────────────────── */
function _calRenderDetail() {
  var hd   = $('cal-detail-hd');
  var list = $('cal-act-list');
  if (!hd || !list) return;

  var iso  = calSelectedDate;
  var parts = iso.split('-');
  var dt   = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
  var dow  = CAL_DOW_LARGO[dt.getDay() === 0 ? 6 : dt.getDay()-1];
  var label = Number(parts[2]) + ' de ' + CAL_MESES[Number(parts[1])-1] + ' ' + parts[0];
  var esHoy = iso === HOY;

  var todosDelDia = actividadesData.filter(function(a){ return _normFecha(a.fecha) === iso; });
  var total   = todosDelDia.length;
  var pending = todosDelDia.filter(function(a){ return !a.done; }).length;

  hd.innerHTML = '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">'
    + '<span style="font-size:15px;font-weight:700;color:var(--ink)">'
      + label + (esHoy ? ' <span class="badge b-primary" style="font-size:10px;vertical-align:middle">Hoy</span>' : '')
    + '</span>'
    + '<span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3)">'+dow+'</span>'
    + '</div>'
    + (total > 0 ? '<div style="font-size:11px;color:var(--ink-3);margin-top:4px">'+pending+' pendiente'+(pending!==1?'s':'')+' · '+total+' total</div>' : '');

  // Aplicar filtro
  var acts = todosDelDia.slice();
  if (calFilter === 'pendientes')  acts = acts.filter(function(a){ return !a.done && _normFecha(a.fecha) >= HOY; });
  if (calFilter === 'vencidas')    acts = acts.filter(function(a){ return !a.done && _normFecha(a.fecha) < HOY; });
  if (calFilter === 'completadas') acts = acts.filter(function(a){ return a.done; });

  // Ordenar: pendientes primero, urgentes al tope, completadas al fondo
  acts.sort(function(a, b) {
    if (a.done && !b.done) return 1;
    if (!a.done && b.done) return -1;
    if (a.urgente && !b.urgente) return -1;
    if (!a.urgente && b.urgente) return 1;
    return (_calNormHora(a.hora)||'').localeCompare(_calNormHora(b.hora)||'');
  });

  if (acts.length === 0) {
    list.innerHTML = '<div class="empty" style="padding:40px 20px">'
      + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;opacity:.3"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
      + '<div>'+(total===0 ? 'Sin actividades este día.' : 'Sin actividades con este filtro.')+'</div>'
      + '</div>';
    return;
  }

  var html = '';
  acts.forEach(function(a) {
    var grupo  = a.done ? 'done' : clasificarGrupo(_normFecha(a.fecha));
    var icCls  = grupo==='done'?'b-green': grupo==='vencido'?'b-red': grupo==='hoy'?'b-amber':'b-blue';
    var igHtml = ico(tipoIcon(a.tipo));
    var horaStr = _calNormHora(a.hora);
    var horaTxt = horaStr ? '<span style="font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums">'+esc(horaStr)+'</span>' : '';
    var urgTag  = (a.urgente && !a.done) ? '<span class="badge b-red" style="font-size:10px">Urgente</span>' : '';
    var doneTag = a.done ? '<span class="badge b-green" style="font-size:10px">Completada</span>' : '';

    html += '<div class="act-card'+(a.done?' is-done':'')+'" onclick="abrirActDetalle(\''+a.id+'\')">'
      + '<div class="act-check'+(a.done?' on':'')+'" title="'+(a.done?'Reabrir':'Marcar hecha')+'" onclick="event.stopPropagation();marcarHecha(\''+a.id+'\')">'
        + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
      + '</div>'
      + '<div class="act-ico badge '+icCls+'" style="width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:none">'+igHtml+'</div>'
      + '<div class="act-main" style="flex:1;min-width:0">'
        + '<b style="font-size:13px">'+esc(a.tipo)+' · '+esc(a.prospecto)+'</b>'
        + '<div class="meta" style="display:flex;align-items:center;gap:6px;margin-top:3px">'+horaTxt+urgTag+doneTag+'</div>'
      + '</div>'
      + '<button class="icon-btn" title="Reprogramar" onclick="event.stopPropagation();reprog(\''+a.id+'\')" style="'+(a.done?'visibility:hidden':'')+'">'
        + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
      + '</button>'
      + '</div>';
  });

  list.innerHTML = html;
}

/* ── Chips de resumen global ─────────────────────────────── */
function _calRenderSummaryChips() {
  var el = $('cal-summary-chips');
  if (!el) return;
  var vencidas = actividadesData.filter(function(a){ return !a.done && _normFecha(a.fecha) < HOY; }).length;
  var pendHoy  = actividadesData.filter(function(a){ return !a.done && _normFecha(a.fecha) === HOY; }).length;
  var hechas   = actividadesData.filter(function(a){ return a.done; }).length;

  el.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:0 2px 4px">'
    + '<span class="badge b-red">'+vencidas+' vencida'+(vencidas!==1?'s':'')+'</span>'
    + '<span class="badge b-amber">'+pendHoy+' hoy</span>'
    + '<span class="badge b-green">'+hechas+' completada'+(hechas!==1?'s':'')+'</span>'
    + '</div>';
}

/* ── Helper ISO ──────────────────────────────────────────── */
function _calIso(y, m, d) {
  return y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
}

/* ── Normaliza hora: Sheets devuelve "1899-12-30T16:36:36.000Z" para tiempos ── */
function _calNormHora(h) {
  if (!h) return '';
  var s = String(h);
  if (s.indexOf('T') > 0) return s.split('T')[1].slice(0, 5);
  return s.slice(0, 5);
}
