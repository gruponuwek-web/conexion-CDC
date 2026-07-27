/* ============================================================
   CLÍNICA DEL CEREBRO · MÓDULO Escenarios Financieros
   Evaluación adaptativa: CRÍTICO / MALO / ESTABLE / BUENO
   Depende de globals: ingresosData, ingresosExtras, historialEgresos,
   pagosFijos, HOY, money(), _MESES_COM, gs(), toast(), $()
   ============================================================ */

// ── Estado global de configuración ────────────────────────
var CDC_ESCENARIO = {
  equilibrio_monto:        0,
  equilibrio_tratamientos: 0,
  meses_activacion:        2,
  umbral_critico:          1,
  reserva_actual:          0,
  ahorro_pct:              20,
  reinversion_pct:         10,
  cats_recortables:        ['Software','Marketing','Insumos']
};

// ── Guardar una clave en Sheets ────────────────────────────
function _esSetConfig(campo, valor) {
  CDC_ESCENARIO[campo] = valor;
  var v = Array.isArray(valor) ? JSON.stringify(valor) : String(valor);
  gs('setConfig', { key: 'escenario_' + campo, valor: v })
    .catch(function(e) { console.error('[CDC GS] setConfig escenario:', e); });
}

// ── Motor de cálculo ───────────────────────────────────────
function calcEscenario() {
  var eq      = Number(CDC_ESCENARIO.equilibrio_monto)  || 0;
  var nMeses  = Number(CDC_ESCENARIO.meses_activacion)  || 2;
  var umbral  = Number(CDC_ESCENARIO.umbral_critico)    || 1;
  var reserva = Number(CDC_ESCENARIO.reserva_actual)    || 0;

  // Agrupar ingresos y egresos por mes YYYY-MM
  var ingByMonth = {}, egByMonth = {};
  var iExtras = (typeof ingresosExtras !== 'undefined') ? ingresosExtras : [];
  var allIng  = (ingresosData || []).concat(iExtras);

  allIng.forEach(function(r) {
    var m = (r.fecha || '').slice(0, 7); if (!m) return;
    ingByMonth[m] = (ingByMonth[m] || 0) + (Number(r.monto) || 0);
  });
  (historialEgresos || []).forEach(function(r) {
    var m = (r.fecha || '').slice(0, 7); if (!m) return;
    egByMonth[m] = (egByMonth[m] || 0) + (Number(r.monto) || 0);
  });

  // Meses únicos ordenados, excluir mes actual (datos incompletos)
  var hoyMes = HOY.slice(0, 7);
  var allMs  = Object.keys(ingByMonth).concat(Object.keys(egByMonth));
  var unique = allMs.filter(function(m, i) { return allMs.indexOf(m) === i && m < hoyMes; }).sort();

  var resultados = unique.map(function(m) {
    var ing = ingByMonth[m] || 0, eg = egByMonth[m] || 0;
    return { mes: m, ingresos: ing, egresos: eg, resultado: ing - eg };
  });

  // Últimos N meses para evaluación
  var evaluar = resultados.slice(-nMeses);

  var todasBajas = evaluar.length >= nMeses && evaluar.every(function(r) { return r.resultado < eq; });
  var todasAltas = evaluar.length >= nMeses && evaluar.every(function(r) { return r.resultado >= eq; });

  // Costos fijos mensuales ponderados por periodicidad (usa tramo activo del mes si existe)
  var _montoFijo = typeof _pfMontoActual === 'function' ? _pfMontoActual : function(p){ return Number(p.monto)||0; };
  var costosFijos = (pagosFijos || []).reduce(function(sum, p) {
    var per = p.periodicidad || 'mensual', m = _montoFijo(p);
    return sum + (per === 'anual' ? m / 12 : per === 'bimestral' ? m / 2 : m);
  }, 0);

  var reservaMeses = (costosFijos > 0) ? (reserva / costosFijos) : (reserva > 0 ? 999 : 0);
  var promedioUlt  = evaluar.length ? evaluar.reduce(function(s, r) { return s + r.resultado; }, 0) / evaluar.length : 0;
  var excedente    = Math.max(0, promedioUlt - eq);

  // Clasificar
  var escenario;
  if (!eq)                                        escenario = 'SIN_CONFIG';
  else if (todasBajas && reservaMeses < umbral)   escenario = 'CRITICO';
  else if (todasBajas)                            escenario = 'MALO';
  else if (todasAltas)                            escenario = 'BUENO';
  else                                            escenario = 'ESTABLE';

  // Datos del mes actual (parciales, solo referencia)
  var mesActual = {
    mes: hoyMes,
    ingresos: ingByMonth[hoyMes] || 0,
    egresos:  egByMonth[hoyMes]  || 0,
    resultado: (ingByMonth[hoyMes] || 0) - (egByMonth[hoyMes] || 0)
  };

  return { escenario: escenario, resultados: resultados, evaluar: evaluar,
           costosFijos: costosFijos, reservaMeses: reservaMeses,
           eq: eq, nMeses: nMeses, promedioUlt: promedioUlt, excedente: excedente,
           mesActual: mesActual,
           ahorro_pct: Number(CDC_ESCENARIO.ahorro_pct) || 20,
           reinv_pct:  Number(CDC_ESCENARIO.reinversion_pct) || 10 };
}

// ── Meta visual por escenario ──────────────────────────────
var ES_META = {
  CRITICO:    { label:'CRÍTICO',       color:'var(--red)',   bg:'var(--red-bg)',            borde:'rgba(239,68,68,.35)',  icoBg:'var(--red)',   emoji:'⚠' },
  MALO:       { label:'MALO',          color:'var(--amber)', bg:'var(--amber-bg)',           borde:'rgba(245,158,11,.35)', icoBg:'var(--amber)', emoji:'↘' },
  ESTABLE:    { label:'ESTABLE',       color:'#059669',      bg:'rgba(16,185,129,.07)',      borde:'rgba(16,185,129,.3)', icoBg:'#059669',      emoji:'≈' },
  BUENO:      { label:'BUENO',         color:'#059669',      bg:'rgba(16,185,129,.07)',      borde:'rgba(16,185,129,.3)', icoBg:'#059669',      emoji:'↗' },
  SIN_CONFIG: { label:'Sin configurar', color:'var(--ink-3)', bg:'rgba(0,0,0,.03)',          borde:'var(--line)',          icoBg:'var(--ink-3)', emoji:'⚙' }
};

// ── Generar recomendaciones ────────────────────────────────
function _esRecs(res) {
  var cats = (CDC_ESCENARIO.cats_recortables || []).join(', ') || 'ver Config → Escenarios';
  var recs = [];
  if (res.escenario === 'CRITICO') {
    recs.push({ tipo:'alerta', txt:'Ingresos por debajo del equilibrio con reservas insuficientes. Acción inmediata requerida.' });
    recs.push({ tipo:'accion', txt:'Recortar gastos variables no esenciales: ' + cats + '.' });
    recs.push({ tipo:'accion', txt:'Revisar sueldo del dueño temporalmente.' });
    recs.push({ tipo:'accion', txt:'Priorizar cobranza: revisar pagos pendientes de clientes.' });
    recs.push({ tipo:'meta',   txt:'Meta inmediata: superar ' + money(res.eq) + '/mes durante ' + res.nMeses + ' meses consecutivos.' });
  } else if (res.escenario === 'MALO') {
    recs.push({ tipo:'accion', txt:'Congelar aprobación de gastos nuevos este mes.' });
    recs.push({ tipo:'accion', txt:'Reducir: ' + cats + '.' });
    recs.push({ tipo:'accion', txt:'Sin bonos ni extras hasta recuperar el equilibrio.' });
    recs.push({ tipo:'meta',   txt:'Meta: ' + money(res.eq) + '/mes. Promedio actual: ' + money(res.promedioUlt) + ' (déficit ' + money(res.eq - res.promedioUlt) + ').' });
  } else if (res.escenario === 'ESTABLE') {
    recs.push({ tipo:'ok',     txt:'Operación normal. Mantener presupuestos actuales.' });
    recs.push({ tipo:'ok',     txt:'Punto de equilibrio (' + money(res.eq) + '/mes) cubierto.' });
    recs.push({ tipo:'meta',   txt:'Mantener tendencia los próximos ' + res.nMeses + ' meses para mejorar el escenario.' });
  } else if (res.escenario === 'BUENO') {
    var ahorro = Math.round(res.excedente * res.ahorro_pct / 100);
    var reinv  = Math.round(res.excedente * res.reinv_pct  / 100);
    recs.push({ tipo:'ok',    txt:'Excedente promedio: ' + money(res.excedente) + '/mes sobre el punto de equilibrio.' });
    recs.push({ tipo:'meta',  txt:'Sugerencia de reserva (' + res.ahorro_pct + '%): ' + money(ahorro) + ' este mes.' });
    recs.push({ tipo:'meta',  txt:'Sugerencia de reinversión (' + res.reinv_pct + '%): ' + money(reinv) + ' este mes.' });
    recs.push({ tipo:'ok',    txt:'Bonos e inversión habilitados este período.' });
  } else {
    recs.push({ tipo:'accion', txt:'Configura el punto de equilibrio para activar el análisis automático.' });
  }
  return recs;
}

// ── HTML para chips de meses evaluados ────────────────────
function _esMesesHtml(res) {
  if (!res.evaluar.length) return '<span style="font-size:12px;color:var(--ink-3)">Sin datos históricos suficientes</span>';
  return res.evaluar.map(function(r) {
    var ok  = r.resultado >= res.eq;
    var col = ok ? '#059669' : 'var(--red)';
    var lbl = (_MESES_COM[r.mes.slice(5, 7)] || r.mes).slice(0, 3);
    return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;background:' + col + ';color:#fff;font-size:11px;font-weight:600">'
      + (ok ? '↑' : '↓') + ' ' + lbl + ' ' + money(r.resultado)
    + '</span>';
  }).join(' ');
}

// ── Banner principal (Tableros → #escenario-banner) ────────
function renderEscenarioBanner() {
  var cont = $('escenario-banner'); if (!cont) return;
  var res  = calcEscenario();
  var meta = ES_META[res.escenario] || ES_META.SIN_CONFIG;
  var recs = _esRecs(res);

  var reservaStr = res.costosFijos > 0
    ? '&nbsp;·&nbsp;Reservas: <b>' + res.reservaMeses.toFixed(1) + '</b> meses de costos fijos'
    : (CDC_ESCENARIO.reserva_actual > 0 ? '&nbsp;·&nbsp;Reserva: ' + money(CDC_ESCENARIO.reserva_actual) : '');

  var recHtml = recs.map(function(r) {
    var col = r.tipo === 'alerta' ? 'var(--red)'
            : r.tipo === 'ok'     ? '#059669'
            : r.tipo === 'meta'   ? meta.color
            : 'var(--ink-2)';
    var ico = r.tipo === 'alerta' ? '⚠' : r.tipo === 'ok' ? '✓' : r.tipo === 'meta' ? '→' : '•';
    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid rgba(0,0,0,.05)">'
      + '<span style="color:' + col + ';font-size:15px;line-height:1.2;flex-shrink:0">' + ico + '</span>'
      + '<span style="font-size:13px;color:var(--ink-2)">' + r.txt + '</span>'
    + '</div>';
  }).join('');

  // Mes actual (parcial)
  var mesActHtml = res.mesActual.ingresos || res.mesActual.egresos
    ? '<div style="margin-top:12px;padding:10px 14px;background:rgba(0,0,0,.04);border-radius:8px;font-size:12px;color:var(--ink-3)">'
      + '<b style="color:var(--ink)">Mes actual (parcial)</b>&nbsp;&nbsp;'
      + 'Ingresos: <b>' + money(res.mesActual.ingresos) + '</b>&nbsp;'
      + 'Egresos: <b>'  + money(res.mesActual.egresos)  + '</b>&nbsp;'
      + 'Resultado: <b style="color:' + (res.mesActual.resultado >= 0 ? '#059669' : 'var(--red)') + '">' + money(res.mesActual.resultado) + '</b>'
    + '</div>'
    : '';

  cont.innerHTML =
    '<div id="escenario-card" style="border:1.5px solid ' + meta.borde + ';background:' + meta.bg + ';border-radius:14px;margin-bottom:20px;overflow:hidden">'
    + '<div style="padding:16px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;cursor:pointer" onclick="esToggleDetalle()">'
      + '<div style="display:flex;align-items:center;gap:14px">'
        + '<div style="width:44px;height:44px;border-radius:10px;background:' + meta.icoBg + ';display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;color:#fff">'
          + meta.emoji
        + '</div>'
        + '<div>'
          + '<div style="font-size:11px;font-weight:700;letter-spacing:.07em;color:' + meta.color + ';text-transform:uppercase">Escenario financiero</div>'
          + '<div style="font-size:20px;font-weight:800;color:' + meta.color + ';line-height:1.2">' + meta.label + '</div>'
          + '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">'
            + _esMesesHtml(res)
            + '<span style="font-size:12px;color:var(--ink-3)">' + reservaStr + '</span>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--ink-3);white-space:nowrap;padding-top:6px;flex-shrink:0" id="es-toggle-lbl">Ver recomendaciones ▾</div>'
    + '</div>'
    + '<div id="es-detalle" style="display:none;padding:0 20px 16px;border-top:1px solid ' + meta.borde + '">'
      + '<div style="padding-top:4px">' + recHtml + '</div>'
      + mesActHtml
      + (res.escenario === 'SIN_CONFIG'
          ? '<div style="margin-top:12px"><button class="btn btn-soft btn-sm" onclick="event.stopPropagation();nav(\'admin\')">Configurar escenarios →</button></div>'
          : '')
    + '</div>'
  + '</div>';
}

function esToggleDetalle() {
  var det = $('es-detalle'), lbl = $('es-toggle-lbl');
  if (!det) return;
  var vis = det.style.display !== 'none';
  det.style.display  = vis ? 'none' : 'block';
  if (lbl) lbl.textContent = vis ? 'Ver recomendaciones ▾' : 'Ocultar ▴';
}

// ── Chip en Finanzas (#escenario-chip-fin) ─────────────────
function renderEscenarioChip() {
  var cont = $('escenario-chip-fin'); if (!cont) return;
  var res  = calcEscenario();
  if (res.escenario === 'SIN_CONFIG' || res.escenario === 'ESTABLE') { cont.innerHTML = ''; return; }
  var meta = ES_META[res.escenario];
  cont.innerHTML =
    '<div style="margin-bottom:12px">'
    + '<span style="display:inline-flex;align-items:center;gap:7px;padding:5px 14px;border-radius:20px;border:1.5px solid ' + meta.borde + ';background:' + meta.bg + ';color:' + meta.color + ';font-size:12px;font-weight:700;cursor:pointer" onclick="nav(\'tableros\')" title="Ver análisis completo en Tableros">'
      + meta.emoji + ' Escenario ' + meta.label + '&nbsp;·&nbsp;Ver análisis →'
    + '</span>'
  + '</div>';
}

// ── Panel de configuración (#admin-escenario-cont) ─────────
var ES_CATS_ALL = ['Renta','Nómina','Servicios','Insumos','Equipo','Software','Marketing','Otro'];
var ES_CATS_FIJAS = ['Renta','Nómina'];

function _esMesActualData() {
  var hoyMes = HOY.slice(0, 7);
  var iExtras = (typeof ingresosExtras !== 'undefined') ? ingresosExtras : [];
  var allIng  = (ingresosData || []).concat(iExtras);
  var ing = allIng.reduce(function(s, r) { return s + (r.fecha || '').startsWith(hoyMes) ? (Number(r.monto) || 0) : 0; }, 0);
  var eg  = (historialEgresos || []).reduce(function(s, r) { return s + (r.fecha || '').startsWith(hoyMes) ? (Number(r.monto) || 0) : 0; }, 0);
  var mesLabel = (_MESES_COM[hoyMes.slice(5, 7)] || hoyMes);
  return { ing: ing, eg: eg, mes: mesLabel, ym: hoyMes };
}

function esUsarMesActual() {
  var d = _esMesActualData();
  var campo = $('es-eq-monto');
  if (campo && d.ing > 0) { campo.value = Math.round(d.ing); campo.focus(); }
}

function renderEscenarioConfig() {
  var cont = $('admin-escenario-cont'); if (!cont) return;
  var c = CDC_ESCENARIO;
  var cats = Array.isArray(c.cats_recortables) ? c.cats_recortables : [];

  var _mf = typeof _pfMontoActual === 'function' ? _pfMontoActual : function(p){ return Number(p.monto)||0; };
  var costosFijos = (pagosFijos || []).reduce(function(sum, p) {
    var per = p.periodicidad || 'mensual', m = _mf(p);
    return sum + (per === 'anual' ? m / 12 : per === 'bimestral' ? m / 2 : m);
  }, 0);
  var cobertura = (costosFijos > 0 && c.reserva_actual)
    ? ' · <b style="color:var(--ink)">' + (c.reserva_actual / costosFijos).toFixed(1) + ' meses</b> de cobertura'
    : '';

  var ma = _esMesActualData();
  var mesActualHint = ma.ing > 0
    ? '<div class="hint" style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:8px">'
        + '<span>' + ma.mes + ' (parcial): <b>' + money(ma.ing) + '</b> ing · <b>' + money(ma.eg) + '</b> eg</span>'
        + '<button type="button" class="btn btn-soft btn-sm" onclick="esUsarMesActual()" style="flex-shrink:0">Usar este mes</button>'
      + '</div>'
    : '';

  var catsHtml = ES_CATS_ALL.map(function(cat) {
    var bloq    = ES_CATS_FIJAS.indexOf(cat) >= 0;
    var checked = !bloq && cats.indexOf(cat) >= 0;
    return '<label id="escat-' + cat + '" class="checkrow' + (checked ? ' on' : '') + '" '
      + (bloq ? 'style="opacity:.4;cursor:not-allowed"' : 'style="cursor:pointer" onclick="esCatToggle(\'' + cat + '\')"')
      + '>'
      + '<span class="cbox"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>'
      + '<span><span class="ct">' + cat + '</span>' + (bloq ? ' <span style="font-size:11px;color:var(--ink-3)">(no recortable)</span>' : '') + '</span>'
    + '</label>';
  }).join('');

  cont.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">'

    + '<div class="card" style="padding:20px">'
      + '<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:14px">Punto de equilibrio</div>'
      + '<div class="field"><label>Ingreso mensual mínimo ($)</label><input id="es-eq-monto" type="number" min="0" placeholder="Ej. 142000" value="' + (c.equilibrio_monto || '') + '"></div>'
      + mesActualHint
      + '<div class="field"><label>Tratamientos mínimos (referencia)</label><input id="es-eq-trat" type="number" min="0" placeholder="Ej. 45" value="' + (c.equilibrio_tratamientos || '') + '"></div>'
    + '</div>'

    + '<div class="card" style="padding:20px">'
      + '<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:14px">Activación de escenarios</div>'
      + '<div class="field"><label>Meses consecutivos para MALO / CRÍTICO</label><input id="es-meses" type="number" min="1" max="6" value="' + (c.meses_activacion || 2) + '"></div>'
      + '<div class="field"><label>Umbral CRÍTICO: reservas menores a (meses)</label><input id="es-umbral" type="number" min="0" max="24" step="0.5" value="' + (c.umbral_critico || 1) + '"></div>'
    + '</div>'

    + '<div class="card" style="padding:20px">'
      + '<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:14px">Reservas</div>'
      + '<div class="field"><label>Saldo de reservas actual ($)</label><input id="es-reserva" type="number" min="0" placeholder="0" value="' + (c.reserva_actual || '') + '"></div>'
      + '<div class="hint">Costos fijos calculados (pagos recurrentes): <b>' + money(costosFijos) + '</b>/mes' + cobertura + '</div>'
      + '<div class="hint">Actualizar manualmente cada mes hasta integrar banco.</div>'
    + '</div>'

    + '<div class="card" style="padding:20px">'
      + '<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:14px">Escenario BUENO — distribución del excedente</div>'
      + '<div class="field"><label>% sugerir como reserva</label><input id="es-ahorro" type="number" min="0" max="100" value="' + (c.ahorro_pct || 20) + '"></div>'
      + '<div class="field"><label>% sugerir como reinversión</label><input id="es-reinv"  type="number" min="0" max="100" value="' + (c.reinversion_pct || 10) + '"></div>'
    + '</div>'

    + '</div>'

    + '<div class="card" style="padding:20px;margin-top:16px">'
      + '<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px">Categorías recortables</div>'
      + '<div class="hint" style="margin-bottom:14px">Se mencionan en las recomendaciones de escenarios MALO y CRÍTICO.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:4px">' + catsHtml + '</div>'
    + '</div>'

    // Vista previa del escenario actual
    + _esPreviaActual()

    + '<div style="margin-top:20px;display:flex;justify-content:flex-end">'
      + '<button class="btn btn-primary" onclick="guardarEscenarioConfig()">Guardar configuración</button>'
    + '</div>';
}

function _esPreviaActual() {
  var res  = calcEscenario();
  if (res.escenario === 'SIN_CONFIG') return '';
  var meta = ES_META[res.escenario];
  return '<div class="card" style="padding:16px 20px;margin-top:16px;border:1.5px solid ' + meta.borde + ';background:' + meta.bg + '">'
    + '<div style="font-size:12px;font-weight:700;color:' + meta.color + ';text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Vista previa · Escenario actual</div>'
    + '<div style="display:flex;align-items:center;gap:12px">'
      + '<span style="font-size:28px">' + meta.emoji + '</span>'
      + '<div>'
        + '<div style="font-size:18px;font-weight:800;color:' + meta.color + '">' + meta.label + '</div>'
        + '<div style="font-size:12px;color:var(--ink-3);margin-top:3px">' + _esMesesHtml(res) + '</div>'
      + '</div>'
    + '</div>'
  + '</div>';
}

function esCatToggle(cat) {
  if (ES_CATS_FIJAS.indexOf(cat) >= 0) return;
  var el = $('escat-' + cat); if (!el) return;
  el.classList.toggle('on');
}

function guardarEscenarioConfig() {
  _esSetConfig('equilibrio_monto',        Number($('es-eq-monto').value) || 0);
  _esSetConfig('equilibrio_tratamientos', Number($('es-eq-trat').value)  || 0);
  _esSetConfig('meses_activacion',        Number($('es-meses').value)    || 2);
  _esSetConfig('umbral_critico',          Number($('es-umbral').value)   || 1);
  _esSetConfig('reserva_actual',          Number($('es-reserva').value)  || 0);
  _esSetConfig('ahorro_pct',              Number($('es-ahorro').value)   || 20);
  _esSetConfig('reinversion_pct',         Number($('es-reinv').value)    || 10);
  _esSetConfig('cats_recortables', ES_CATS_ALL.filter(function(cat) {
    if (ES_CATS_FIJAS.indexOf(cat) >= 0) return false;
    var el = $('escat-' + cat); return el && el.classList.contains('on');
  }));

  toast('Configuración de escenarios guardada');
  renderEscenarioBanner();
  renderEscenarioChip();
  renderEscenarioConfig();
}
