/* ============================================================
   CLÍNICA DEL CEREBRO · MÓDULO Tableros · Chart.js
   Extraído de app.js (estructura modular V3.1).
   Funciones globales — depende de las constantes/estado/helpers
   definidos en app.js, que se carga ANTES que este archivo.
   ============================================================ */

function dashFiltroHtml(){
  var now = new Date();
  var y   = now.getFullYear();
  var m   = now.getMonth(); // 0-indexed
  var q   = Math.ceil((m + 1) / 3);
  var badges = {
    'este-mes':      MESES_CORTO[m],
    'trim-actual':   'Q' + q,
    'ultimos-3':     MESES_CORTO[(m + 10) % 12] + '–' + MESES_CORTO[m],
    'este-anio':     y.toString(),
    'anio-anterior': (y - 1).toString()
  };
  var presets = [
    ['este-mes',      'Este mes'],
    ['trim-actual',   'Trim. actual'],
    ['ultimos-3',     'Últ. 3 meses'],
    ['este-anio',     'Este año'],
    ['anio-anterior', 'Año anterior'],
    ['personalizado', 'Personalizado']
  ];
  var chips = presets.map(function(p){
    var key = p[0], lbl = p[1], act = dashPreset === key;
    var bdg = badges[key] ? '<span class="dash-preset-bdg'+(act?' act':'')+'">'+badges[key]+'</span>' : '';
    return '<button class="dash-preset-chip'+(act?' active':'')+'" onclick="setDashPreset(\''+key+'\')">'+lbl+bdg+'</button>';
  }).join('');

  var html = '<div class="dash-filtro-bar" style="flex-direction:column;align-items:flex-start;gap:8px">'
    + '<div class="dash-preset-row">' + chips + '</div>';

  if(dashPreset === 'personalizado'){
    var anios = [];
    ingresosData.concat(historialEgresos).forEach(function(r){
      var a = (r.fecha||'').slice(0,4);
      if(a && anios.indexOf(a)===-1) anios.push(a);
    });
    anios.sort().reverse();
    if(anios.indexOf(y.toString())===-1) anios.unshift(y.toString());
    var anioOpts = anios.map(function(a){
      return '<option value="'+a+'"'+(dashFiltroAnio===a?' selected':'')+'>'+a+'</option>';
    }).join('');
    var mesChips = MESES_CORTO.map(function(mes, i){
      var num = (i+1).toString().padStart(2,'0');
      var sel = dashFiltroMeses.length===0 || dashFiltroMeses.indexOf(num)!==-1;
      return '<button class="dash-mes-chip'+(sel?' active':'')+'" onclick="toggleDashMes(\''+num+'\')" data-mes="'+num+'">'+mes+'</button>';
    }).join('');
    html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:4px;border-top:1px solid var(--line)">'
      + '<span class="fin-filtro-label">Año</span>'
      + '<select class="fin-filtro-sel" style="min-width:90px;height:32px" onchange="setDashAnio(this.value)">'+anioOpts+'</select>'
      + '<span class="fin-filtro-label" style="margin-left:4px">Meses</span>'
      + '<div class="dash-mes-chips">'+mesChips+'</div>'
      + '<button class="btn btn-ghost btn-sm fin-filtro-clear" onclick="limpiarDashMeses()">Todos</button>'
      + '</div>';
  }
  html += '</div>';
  return html;
}

function setDashPreset(preset){
  dashPreset = preset;
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth() + 1; // m = 1-12
  dashFiltroDesde = ''; dashFiltroHasta = '';
  if(preset !== 'personalizado'){ dashFiltroAnio = y.toString(); dashFiltroMeses = []; }

  if(preset === 'este-mes'){
    dashFiltroMeses = [m.toString().padStart(2,'0')];
  } else if(preset === 'trim-actual'){
    var q = Math.ceil(m / 3), m1 = (q - 1) * 3 + 1;
    dashFiltroMeses = [m1, m1+1, m1+2].map(function(x){ return x.toString().padStart(2,'0'); });
  } else if(preset === 'ultimos-3'){
    var desde = new Date(y, m - 3, 1); // JS handles month underflow (cross-year)
    var hasta  = new Date(y, m, 0);    // último día del mes actual
    dashFiltroDesde = desde.getFullYear()+'-'+(desde.getMonth()+1).toString().padStart(2,'0')+'-01';
    dashFiltroHasta = hasta.getFullYear()+'-'+(hasta.getMonth()+1).toString().padStart(2,'0')+'-'+hasta.getDate().toString().padStart(2,'0');
    dashFiltroAnio = ''; // usar rango, no año fijo
  } else if(preset === 'anio-anterior'){
    dashFiltroAnio = (y - 1).toString();
  }
  // 'este-anio': dashFiltroAnio=y, meses=[] ya seteados
  // 'personalizado': mantener estado previo

  var fg = $('dash-filtro');
  if(fg) fg.innerHTML = dashFiltroHtml();
  buildCharts(dashTabActual);
}

function setDashAnio(v){
  dashFiltroDesde = ''; dashFiltroHasta = '';
  dashFiltroAnio = v;
  dashPreset = 'personalizado';
  var fg = $('dash-filtro');
  if(fg) fg.innerHTML = dashFiltroHtml();
  buildCharts(dashTabActual);
}

function toggleDashMes(num){
  dashFiltroDesde = ''; dashFiltroHasta = '';
  dashPreset = 'personalizado';
  if(dashFiltroMeses.length === 0){
    dashFiltroMeses = [num];
  } else {
    var idx = dashFiltroMeses.indexOf(num);
    if(idx === -1){ dashFiltroMeses.push(num); }
    else { dashFiltroMeses.splice(idx, 1); }
  }
  var fg = $('dash-filtro');
  if(fg) fg.innerHTML = dashFiltroHtml();
  buildCharts(dashTabActual);
}

function limpiarDashMeses(){
  dashFiltroMeses = [];
  var fg = $('dash-filtro');
  if(fg) fg.innerHTML = dashFiltroHtml();
  buildCharts(dashTabActual);
}

function limpiarDashFiltro(){ setDashPreset('este-anio'); }

function dashFiltrar(rows){
  return rows.filter(function(r){ return _enFiltro((r.fecha||'').slice(0,10)); });
}

function _enFiltro(f){
  f = (f||'').slice(0,10);
  if(dashFiltroDesde || dashFiltroHasta){
    if(dashFiltroDesde && f < dashFiltroDesde) return false;
    if(dashFiltroHasta && f > dashFiltroHasta) return false;
    return true;
  }
  var anio = f.slice(0,4), mes = f.slice(5,7);
  if(dashFiltroAnio && anio !== dashFiltroAnio) return false;
  if(dashFiltroMeses.length > 0 && dashFiltroMeses.indexOf(mes) === -1) return false;
  return true;
}

function _mesesBarra(){
  if(dashFiltroDesde && dashFiltroHasta){
    var meses = [], cur = dashFiltroDesde.slice(0,7), end = dashFiltroHasta.slice(0,7);
    while(cur <= end){
      meses.push(cur.slice(5,7));
      var y2 = parseInt(cur.slice(0,4),10), m2 = parseInt(cur.slice(5,7),10);
      if(++m2 > 12){ m2 = 1; y2++; }
      cur = y2 + '-' + m2.toString().padStart(2,'0');
    }
    return meses;
  }
  return dashFiltroMeses.length > 0 ? dashFiltroMeses.slice().sort() : MESES_CORTO.map(function(_,i){ return (i+1).toString().padStart(2,'0'); });
}

function applyChartDefaults(){
  if(typeof Chart==='undefined' || Chart_defaults_applied) return;
  Chart.defaults.font.family = "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = CL.ink3;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.padding = 14;
  Chart_defaults_applied = true;
}

function safeChart(id, cfg){
  var el = $(id);
  if(!el || typeof Chart==='undefined') return;
  var ex = Chart.getChart(el);
  if(ex) ex.destroy();
  applyChartDefaults();
  return new Chart(el, cfg);
}

function chartCard(titulo, sub, canvasId, tall){
  return '<div class="chart-card"><h3>'+titulo+'</h3><div class="ch-sub">'+sub+'</div>'
    + '<div class="chart-wrap'+(tall?' tall':'')+'"><canvas id="'+canvasId+'"></canvas></div></div>';
}

function buildDashPanes(){
  setHtml('dash-general',
    '<div id="dash-kpis-general" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px"></div>'
    + '<div id="dash-cross-hint" style="display:none;padding:8px 14px;background:var(--primary-l);border:1px solid var(--primary);border-radius:8px;font-size:12.5px;color:var(--primary-d);margin-bottom:12px;display:flex;align-items:center;gap:8px">'
      + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px;flex-shrink:0"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>'
      + '<span id="dash-cross-txt">Haz clic en una barra o segmento para filtrar</span>'
      + '<button onclick="limpiarCrossFilter()" style="margin-left:auto;background:none;border:none;color:var(--primary);font-weight:700;cursor:pointer;font-size:13px">× Limpiar</button>'
    + '</div>'
    + '<div class="dash-grid" style="margin-bottom:16px">'
    + chartCard('Ingresos vs Egresos','Clic en un mes para ver detalle • filtrado por período','ch-ing-egr', true)
    + '</div>'
    + '<div class="dash-grid cols-2">'
    + chartCard('Embudo de pipeline','Clic en etapa para filtrar','ch-pipeline')
    + chartCard('Cartera de clientes','Clic en segmento para filtrar','ch-cartera-gen')
    + '</div>'
    + '<div id="dash-detalle-panel" style="display:none;margin-top:16px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-sm);padding:18px;box-shadow:var(--shadow-sm)"></div>');
  setHtml('dash-leads',
    '<div class="dash-grid cols-2">'
    + chartCard('Leads por canal','Origen de los prospectos','ch-canales')
    + chartCard('Leads por temperatura','Calificación de interés','ch-temp')
    + '</div>');
  setHtml('dash-clientes',
    '<div class="dash-grid cols-2">'
    + chartCard('Cartera por estado','Distribución de clientes','ch-cartera')
    + chartCard('Sesiones impartidas','Por cliente activo','ch-sesiones')
    + '</div>');
  setHtml('dash-sesiones',
    '<div class="dash-grid">'
    + chartCard('Estado de las sesiones','Total agregado de la cartera','ch-ses-estado', true)
    + '</div>');
  setHtml('dash-financiero',
    '<div class="dash-grid cols-2">'
    + chartCard('Ingresos vs egresos por mes','Comparativo mensual del período','ch-fin-mensual', false)
    + chartCard('Egresos por categoría','Distribución del período seleccionado','ch-eg-cat', false)
    + '</div>');
}

function dataPipeline(){
  return ETAPAS.map(function(e){ return leadsData.filter(function(l){return l.etapa===e;}).length; });
}

function dataCanales(){
  var m={}; leadsData.forEach(function(l){ m[l.canal]=(m[l.canal]||0)+1; });
  return m;
}

function dataTemp(){
  return ['Caliente','Tibio','Frío'].map(function(t){ return leadsData.filter(function(l){return l.temp===t;}).length; });
}

function dataCartera(){
  var estados=['Activo','En onboarding','Pausado','Completado','Cancelado'];
  return estados.map(function(e){ return clientesData.filter(function(c){return c.estado===e;}).length; });
}

function dataSesionesPorCliente(){
  var act = clientesData.filter(function(c){return c.sesiones && c.sesiones.length>0;});
  return {labels: act.map(function(c){return c.nombre.split(' ')[0];}), data: act.map(function(c){return c.sesiones.filter(function(s){return s.estado==='done';}).length;})};
}

function dataSesEstado(){
  var t={done:0,next:0,scheduled:0,pending:0};
  clientesData.forEach(function(c){ (c.sesiones||[]).forEach(function(s){ t[s.estado]=(t[s.estado]||0)+1; }); });
  return t;
}

function dataEgCat(){
  var m={};
  var egFilt = dashFiltrar(historialEgresos);
  egFilt.forEach(function(e){ m[e.cat]=(m[e.cat]||0)+(e.monto||0); });
  return m;
}

function buildCharts(tab){
  var gridCfg = { grid:{color:CL.grid}, ticks:{color:CL.ink3}, border:{display:false} };
  if(tab==='general'){
    // ── KPIs numéricos del período ──────────────────────────────
    var mesesKpi = _mesesBarra();
    var totalIn = dashFiltrar(ingresosData.concat(ingresosExtras)).reduce(function(s,r){return s+(r.monto||0);},0);
    var totalEg = dashFiltrar(historialEgresos).reduce(function(s,r){return s+(r.monto||0);},0);
    var utilidad = totalIn - totalEg;
    var cobPend  = clientesData.reduce(function(s,c){return s+(c.porCobrar||0);},0);
    var totalDesc = clientesData.reduce(function(s,c){
      var mf = Number(c.montoFinal)||0;
      var mo = Number(c.monto)||0;
      return s + (mf > 0 && mf < mo ? mo - mf : 0);
    }, 0);
    var totalCom = clientesData.reduce(function(s,c){
      if(!c.medicoReferido || c.medicoReferido.trim()==='') return s;
      var base = (Number(c.montoFinal)||0) > 0 ? Number(c.montoFinal) : (Number(c.monto)||0);
      return s + base * 0.10;
    }, 0);

    function kpiCard(color, icon, valor, label, sub, accentVal){
      return '<div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r-sm);padding:18px 20px;box-shadow:var(--shadow-sm)'+(accentVal?';border-left:4px solid '+color:'')+';">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
          + '<div style="width:36px;height:36px;border-radius:9px;background:'+color+'22;display:flex;align-items:center;justify-content:center;color:'+color+'">'+icon+'</div>'
          + '<span style="font-size:12px;font-weight:600;color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em">'+label+'</span>'
        + '</div>'
        + '<div style="font-size:28px;font-weight:800;color:'+(accentVal?color:'var(--ink)')+';letter-spacing:-.5px;line-height:1">'+valor+'</div>'
        + (sub ? '<div style="font-size:12px;color:var(--ink-3);margin-top:5px">'+sub+'</div>' : '')
        + '</div>';
    }

    var svgIn   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:18px;height:18px"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
    var svgEg   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:18px;height:18px"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>';
    var svgUt   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:18px;height:18px"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg>';
    var svgCob  = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:18px;height:18px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    var svgDesc = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:18px;height:18px"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>';
    var svgCom  = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:18px;height:18px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';

    var kpiCont = $('dash-kpis-general');
    if(kpiCont){
      kpiCont.style.gridTemplateColumns = 'repeat(6,1fr)';
      kpiCont.innerHTML =
        kpiCard('#1F8A4C', svgIn,   money(totalIn),   'Ingresos',       mesesKpi.length+' mes'+(mesesKpi.length!==1?'es':''))
      + kpiCard('#C43D3D', svgEg,   money(totalEg),   'Egresos',        dashFiltroAnio)
      + kpiCard(utilidad>=0?'#0E6E66':'#C2820B', svgUt, money(utilidad), 'Utilidad bruta', utilidad>=0?'Positiva ↑':'Negativa ↓')
      + kpiCard('#C43D3D', svgDesc, money(totalDesc), 'Descuentos',     'Monto bonificado', true)
      + kpiCard('#1565A7', svgCom,  money(totalCom),  'Comisiones',     '10% referidos',   true)
      + kpiCard('#C2820B', svgCob,  money(cobPend),   'Por cobrar',     'Cartera activa');
    }

    // ── Embudo de pipeline (interactivo) ────────────────────────
    var pipeColors = ETAPAS.map(function(e){
      return dashCrossFilter.etapa === e ? CL.accent : [CL.gray,CL.blue,CL.amber,CL.violet,CL.green,CL.red,CL.gray][ETAPAS.indexOf(e)];
    });
    var chartPipe = safeChart('ch-pipeline', {type:'bar',
      data:{labels:ETAPAS, datasets:[{label:'Leads', data:dataPipeline(), backgroundColor:pipeColors, borderRadius:8, maxBarThickness:54, hoverBackgroundColor:CL.accent}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{title:function(ctx){return ctx[0].label;},label:function(ctx){return ' '+ctx.raw+' lead'+(ctx.raw!==1?'s':'');}}},},
        scales:{y:{beginAtZero:true,ticks:{precision:0,color:CL.ink3},grid:{color:CL.grid},border:{display:false}},x:{grid:{display:false},ticks:{color:CL.ink3},border:{display:false}}},
        onClick:function(evt, items){
          if(!items.length){ dashCrossFilter.etapa=null; }
          else { var etapa=ETAPAS[items[0].index]; dashCrossFilter.etapa=(dashCrossFilter.etapa===etapa?null:etapa); }
          buildCharts('general');
        }
      }});

    // Actualizar hint y panel de detalle
    actualizarCrossHint();

    // ── Cartera de clientes (interactivo) ───────────────────────
    var estadosCli = ['Activo','En onboarding','Pausado','Completado','Cancelado'];
    var carteraColors = estadosCli.map(function(e,i){
      var cols = [CL.green,CL.amber,CL.violet,CL.emerald,CL.red];
      return dashCrossFilter.estadoCli === e ? CL.accent : cols[i];
    });
    safeChart('ch-cartera-gen', {type:'doughnut',
      data:{labels:estadosCli, datasets:[{data:dataCartera(), backgroundColor:carteraColors, borderWidth:2, borderColor:'#fff', hoverBorderWidth:3}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'62%',
        plugins:{legend:{position:'right'},tooltip:{callbacks:{label:function(ctx){return ' '+ctx.label+': '+ctx.raw+' cliente'+(ctx.raw!==1?'s':'');}}}},
        onClick:function(evt, items){
          if(!items.length){ dashCrossFilter.estadoCli=null; }
          else { var est=estadosCli[items[0].index]; dashCrossFilter.estadoCli=(dashCrossFilter.estadoCli===est?null:est); }
          buildCharts('general');
        }
      }});

    // Siempre mostrar barras por mes para comparación clara
    var mesesActivos = _mesesBarra();
    var labMeses = mesesActivos.map(function(m){ return MESES_CORTO[parseInt(m,10)-1]; });
    var dataIn = mesesActivos.map(function(m){
      return ingresosData.concat(ingresosExtras).filter(function(r){
        var f=(r.fecha||'').slice(0,10);
        return _enFiltro(f) && f.slice(5,7)===m;
      }).reduce(function(s,r){return s+(r.monto||0);},0);
    });
    var dataEg = mesesActivos.map(function(m){
      return historialEgresos.filter(function(r){
        var f=(r.fecha||'').slice(0,10);
        return _enFiltro(f) && f.slice(5,7)===m;
      }).reduce(function(s,r){return s+(r.monto||0);},0);
    });
    var pluginLabelsIngEgr = {
      id:'labelsIngEgr',
      afterDatasetsDraw: function(chart){
        var ctx = chart.ctx;
        chart.data.datasets.forEach(function(ds, i){
          var meta = chart.getDatasetMeta(i);
          meta.data.forEach(function(pt, idx){
            var val = ds.data[idx];
            if(!val) return;
            var lbl = val >= 1000 ? '$'+(val/1000).toFixed(0)+'k' : '$'+val;
            ctx.save();
            ctx.font = '600 10px sans-serif';
            ctx.fillStyle = ds.borderColor;
            ctx.textAlign = 'center';
            ctx.fillText(lbl, pt.x, pt.y - 8);
            ctx.restore();
          });
        });
      }
    };
    safeChart('ch-ing-egr', {type:'line',
      plugins:[pluginLabelsIngEgr],
      data:{labels:labMeses, datasets:[
        {label:'Ingresos', data:dataIn, borderColor:CL.green, backgroundColor:'rgba(34,197,94,.12)',
         tension:.35, fill:true, pointRadius:4, pointHoverRadius:6, pointBackgroundColor:CL.green, borderWidth:2.5},
        {label:'Egresos',  data:dataEg, borderColor:CL.red,   backgroundColor:'rgba(239,68,68,.10)',
         tension:.35, fill:true, pointRadius:4, pointHoverRadius:6, pointBackgroundColor:CL.red,   borderWidth:2.5}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:true,position:'top'},
          tooltip:{mode:'index',intersect:false,callbacks:{label:function(ctx){
            var util=dataIn[ctx.dataIndex]-dataEg[ctx.dataIndex];
            var extra = ctx.datasetIndex===1 ? ' | Ut. bruta: $'+util.toLocaleString('es-MX') : '';
            return ' '+ctx.dataset.label+': $'+Number(ctx.raw).toLocaleString('es-MX')+extra;
          }}}},
        scales:{y:{beginAtZero:true,ticks:{color:CL.ink3,callback:function(v){return '$'+(v/1000)+'k';}},grid:{color:CL.grid},border:{display:false}},
                x:{grid:{display:false},ticks:{color:CL.ink3},border:{display:false}}},
        onClick:function(evt,items){
          if(!items.length){ dashCrossFilter.mes=null; }
          else { var mx=mesesActivos[items[0].index]; dashCrossFilter.mes=(dashCrossFilter.mes===mx?null:mx); }
          buildCharts('general');
        }
      }});
  }
  else if(tab==='leads'){
    var canales = dataCanales();
    safeChart('ch-canales', {type:'doughnut', data:{labels:Object.keys(canales), datasets:[{data:Object.values(canales), backgroundColor:[CL.primary,CL.accent,CL.blue,CL.violet,CL.green,CL.amber,CL.gray], borderWidth:2, borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right'}}}});
    safeChart('ch-temp', {type:'bar', data:{labels:['Caliente','Tibio','Frío'], datasets:[{data:dataTemp(), backgroundColor:[CL.red,CL.amber,CL.blue], borderRadius:8, maxBarThickness:60}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0,color:CL.ink3},grid:{color:CL.grid},border:{display:false}},y:{grid:{display:false},ticks:{color:CL.ink3},border:{display:false}}}}});
  }
  else if(tab==='clientes'){
    safeChart('ch-cartera', {type:'doughnut', data:{labels:['Activo','En onboarding','Pausado','Completado','Cancelado'], datasets:[{data:dataCartera(), backgroundColor:[CL.green,CL.amber,CL.violet,CL.emerald,CL.red], borderWidth:2, borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right'}}}});
    var spc = dataSesionesPorCliente();
    safeChart('ch-sesiones', {type:'bar', data:{labels:spc.labels, datasets:[{label:'Impartidas', data:spc.data, backgroundColor:CL.primary, borderRadius:8, maxBarThickness:48}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0,color:CL.ink3},grid:{color:CL.grid},border:{display:false}},x:{grid:{display:false},ticks:{color:CL.ink3},border:{display:false}}}}});
  }
  else if(tab==='sesiones'){
    var se = dataSesEstado();
    safeChart('ch-ses-estado', {type:'bar', data:{labels:['Impartidas y cobradas','Por cobrar','Por confirmar','Por agendar'], datasets:[{data:[se.done,se.next,se.scheduled,se.pending], backgroundColor:[CL.green,CL.blue,CL.orange,CL.gray], borderRadius:8, maxBarThickness:70}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0,color:CL.ink3},grid:{color:CL.grid},border:{display:false}},x:{grid:{display:false},ticks:{color:CL.ink3},border:{display:false}}}}});
  }
  else if(tab==='financiero'){
    // Gráfica 1: Ingresos vs egresos por mes
    var mesesFin = _mesesBarra();
    var labFin = mesesFin.map(function(m){ return MESES_CORTO[parseInt(m,10)-1]; });
    var dataFinIn = mesesFin.map(function(m){
      return ingresosData.concat(ingresosExtras).filter(function(r){
        var f=(r.fecha||'').slice(0,10);
        return _enFiltro(f) && f.slice(5,7)===m;
      }).reduce(function(s,r){return s+(r.monto||0);},0);
    });
    var dataFinEg = mesesFin.map(function(m){
      return historialEgresos.filter(function(r){
        var f=(r.fecha||'').slice(0,10);
        return _enFiltro(f) && f.slice(5,7)===m;
      }).reduce(function(s,r){return s+(r.monto||0);},0);
    });
    safeChart('ch-fin-mensual', {type:'bar',
      data:{labels:labFin, datasets:[
        {label:'Ingresos', data:dataFinIn, backgroundColor:CL.green, borderRadius:6, maxBarThickness:36},
        {label:'Egresos',  data:dataFinEg, backgroundColor:CL.red,   borderRadius:6, maxBarThickness:36}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:true,position:'top'},tooltip:{callbacks:{label:function(ctx){return ' '+ctx.dataset.label+': $'+Number(ctx.raw).toLocaleString('es-MX');}}}},
        scales:{y:{beginAtZero:true,ticks:{color:CL.ink3,callback:function(v){return '$'+(v/1000)+'k';}},grid:{color:CL.grid},border:{display:false}},
                x:{grid:{display:false},ticks:{color:CL.ink3},border:{display:false}}}}});
    // Gráfica 2: egresos por categoría
    var eg = dataEgCat();
    safeChart('ch-eg-cat', {type:'doughnut', data:{labels:Object.keys(eg), datasets:[{data:Object.values(eg), backgroundColor:[CL.primary,CL.accent,CL.blue,CL.violet,CL.green,CL.amber,CL.red,CL.gray], borderWidth:2, borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:{legend:{position:'right'},tooltip:{callbacks:{label:function(ctx){return ' '+ctx.label+': $'+Number(ctx.raw).toLocaleString('es-MX');}}}}}});
  }

}

function renderDashTabs(){
  var html = DASH_TABS.map(function(t){
    return '<button class="dash-tab'+(dashTabActual===t[0]?' active':'')+'" onclick="dashTab(\''+t[0]+'\')">'+t[1]+'</button>';
  }).join('');
  setHtml('dash-tabs', html);
}

function dashTab(key){
  dashTabActual = key;
  document.querySelectorAll('.dashpane').forEach(function(p){ p.classList.remove('active'); });
  var pane = $('dash-'+key); if(pane) pane.classList.add('active');
  renderDashTabs();
  buildCharts(key);
}

function renderTableros(){
  if(usuarioActual!=='willy'){
    $('tableros-lock').style.display='';
    $('tableros-content').style.display='none';
    renderMobNav();
    return;
  }
  $('tableros-lock').style.display='none';
  $('tableros-content').style.display='';
  buildDashPanes();
  var dg = $('dash-filtro');
  if(dg) dg.innerHTML = dashFiltroHtml();
  renderDashTabs();
  buildCharts(dashTabActual);
  renderMobNav();
}

