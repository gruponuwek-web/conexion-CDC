/* ================================================================
   CDC · TEST SUITE — 2 leads sintéticos que cubren todos los módulos
   Ejecutar en consola del browser: cargar el script o pegar su contenido.
   No modifica Google Sheets — opera solo sobre el estado en memoria.
   ================================================================ */

(function CDC_TEST() {

  var PASS = 0, FAIL = 0, WARN = 0;
  var RESULTS = [];

  function ok(label) { PASS++; RESULTS.push('  ✓ ' + label); }
  function fail(label, detail) { FAIL++; RESULTS.push('  ✗ ' + label + (detail ? ' — ' + detail : '')); }
  function warn(label) { WARN++; RESULTS.push('  ⚠ ' + label); }

  function check(cond, label, detail) { cond ? ok(label) : fail(label, detail); }

  console.group('%c CDC TEST SUITE', 'font-weight:800;font-size:14px;color:#0E6E66');

  /* ================================================================
     DATOS SINTÉTICOS
     Lead A: en etapa Cotizado, actividades hoy + vencida, sin ganar
     Lead B: ganado → cliente activo, sesiones, cobro, factura
     ================================================================ */

  var HOY_ISO = (typeof HOY !== 'undefined') ? HOY : new Date().toISOString().slice(0,10);
  var AYER    = (function(){ var d=new Date(HOY_ISO+'T00:00:00'); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
  var MANANA  = (function(){ var d=new Date(HOY_ISO+'T00:00:00'); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();

  /* ── Lead A: Daniela Suárez — prospecto activo en Cotizado ── */
  var leadA = {
    id:          'TEST-A-001',
    nombre:      'Suárez, Daniela',
    paciente:    'Suárez, Mateo (hijo)',
    padecimiento:'TDAH',
    etapa:       'Cotizado',
    canal:       'Instagram',
    temp:        'Caliente',
    correo:      'daniela.suarez@ejemplo.com',
    cel:         '55 1111 2222',
    edad:        9,
    genero:      'Masculino',
    sigAct:      'Seguimiento cotización',
    sigFecha:    HOY_ISO,
    sigHora:     '11:00',
    nota:        'Mamá muy interesada. Cotización enviada el lunes. Pendiente respuesta.',
    historial:   [
      { fecha: AYER,    tipo: 'Llamada',             nota: 'Primer contacto. Mamá pregunta por precios.', user: 'Dr. Willy' },
      { fecha: HOY_ISO, tipo: 'Enviar cotización',   nota: 'Se envió propuesta de 20 sesiones TMS.',      user: 'Sra. Vicky' }
    ]
  };

  /* ── Lead B: Carlos Mendoza — ganado, ya es cliente activo ── */
  var leadB = {
    id:          'TEST-B-001',
    nombre:      'Mendoza, Carlos',
    paciente:    'Mendoza, Carlos',
    padecimiento:'Ansiedad',
    etapa:       'Ganado',
    canal:       'Referido',
    temp:        'Caliente',
    correo:      'carlos.mendoza@ejemplo.com',
    cel:         '55 9999 8888',
    edad:        34,
    genero:      'Masculino',
    sigAct:      'Llamada',
    sigFecha:    MANANA,
    sigHora:     '09:00',
    nota:        'Viene referido por el Dr. Pérez. Muy motivado.',
    historial:   [
      { fecha: AYER,    tipo: 'Agendar cita',         nota: 'Cita de diagnóstico agendada.',    user: 'Sra. Vicky' },
      { fecha: HOY_ISO, tipo: 'Seguimiento cotización',nota: 'Acepta tratamiento. Paga hoy.',    user: 'Dr. Willy' }
    ]
  };

  /* ── Cliente derivado de Lead B ── */
  var clienteB = {
    id:          'TEST-CLI-B001',
    leadId:      'TEST-B-001',
    nombre:      'Mendoza, Carlos',
    paciente:    'Mendoza, Carlos',
    padecimiento:'Ansiedad',
    correo:      'carlos.mendoza@ejemplo.com',
    cel:         '55 9999 8888',
    estado:      'Activo',
    servicio:    'Sesiones TMS (20 sesiones)',
    numSes:      20,
    sesRealizadas:3,
    monto:       32000,
    cobrado:     4800,
    porCobrar:   27200,
    precioSes:   1600,
    fechaPrimera:HOY_ISO,
    sesiones:    mkSesiones ? mkSesiones(20, 3, 1600, HOY_ISO) : []
  };

  /* ── Actividades de ambos leads ── */
  var actA1 = { id:'TEST-ACT-A1', prospecto:'Suárez, Daniela', refTipo:'lead', refId:'TEST-A-001',
    tipo:'Seguimiento cotización', fecha:HOY_ISO, hora:'11:00', grupo:'hoy',
    done:false, urgente:false, contexto:'Dar seguimiento a cotización enviada el día anterior.' };

  var actA2 = { id:'TEST-ACT-A2', prospecto:'Suárez, Daniela', refTipo:'lead', refId:'TEST-A-001',
    tipo:'Llamada', fecha:AYER, hora:'09:00', grupo:'vencido',
    done:false, urgente:true, contexto:'Llamada de primer contacto — pendiente agendar cita.' };

  var actB1 = { id:'TEST-ACT-B1', prospecto:'Mendoza, Carlos', refTipo:'lead', refId:'TEST-B-001',
    tipo:'Llamada', fecha:MANANA, hora:'09:00', grupo:'manana',
    done:false, urgente:false, contexto:'Llamada de bienvenida al programa de sesiones TMS.' };

  var actB2 = { id:'TEST-ACT-B2', prospecto:'Mendoza, Carlos', refTipo:'cliente', refId:'TEST-CLI-B001',
    tipo:'Agendar cita', fecha:HOY_ISO, hora:'14:00', grupo:'hoy',
    done:true, urgente:false, contexto:'Sesión #4 confirmada — ya asistió.' };

  /* ── Cobro del cliente B ── */
  var cobroB = { id:'TEST-COB-B1', clienteId:'TEST-CLI-B001', clienteNombre:'Mendoza, Carlos',
    monto:4800, fecha:HOY_ISO, metodo:'Transferencia', cuenta:'HSBC 7832',
    factura:'Sí', estado:'cobrado' };

  /* ── Factura ── */
  var facturaB = { id:'TEST-FACT-B1', clienteId:'TEST-CLI-B001', clienteNombre:'Mendoza, Carlos',
    monto:4800, fecha:HOY_ISO, estado:'Por crear', cobros:[cobroB.id] };

  /* ================================================================
     INYECTAR EN ESTADO GLOBAL
     ================================================================ */
  console.group('1. Inyección de datos');
  try {
    // Leads
    var yaA = leadsData.findIndex(function(l){ return l.id==='TEST-A-001'; });
    if(yaA>=0) leadsData[yaA]=leadA; else leadsData.push(leadA);
    var yaB = leadsData.findIndex(function(l){ return l.id==='TEST-B-001'; });
    if(yaB>=0) leadsData[yaB]=leadB; else leadsData.push(leadB);
    ok('leadsData: Lead A (Cotizado) y Lead B (Ganado) insertados');

    // Cliente
    var yaC = clientesData.findIndex(function(c){ return c.id==='TEST-CLI-B001'; });
    if(yaC>=0) clientesData[yaC]=clienteB; else clientesData.push(clienteB);
    ok('clientesData: Cliente B (Activo, 20 sesiones) insertado');

    // Actividades
    [actA1,actA2,actB1,actB2].forEach(function(a){
      var idx = actividadesData.findIndex(function(x){ return x.id===a.id; });
      if(idx>=0) actividadesData[idx]=a; else actividadesData.push(a);
    });
    ok('actividadesData: 4 actividades inyectadas (vencida, hoy x2, mañana)');

    // Cobro
    if(typeof cobrosData !== 'undefined'){
      var yaK = cobrosData.findIndex(function(c){ return c.id===cobroB.id; });
      if(yaK>=0) cobrosData[yaK]=cobroB; else cobrosData.push(cobroB);
      ok('cobrosData: Cobro $4,800 insertado');
    } else { warn('cobrosData no definido — skipping'); }

    // Factura
    var yaF = facturasData.findIndex(function(f){ return f.id===facturaB.id; });
    if(yaF>=0) facturasData[yaF]=facturaB; else facturasData.push(facturaB);
    ok('facturasData: Factura "Por crear" insertada');

    // Rebuild maps
    if(typeof _rebuildMaps==='function'){ _rebuildMaps(); ok('_rebuildMaps() ejecutado'); }

  } catch(e){ fail('Inyección de datos', e.message); }
  console.groupEnd();

  /* ================================================================
     TEST — MÓDULO HOY / AGENDA
     ================================================================ */
  console.group('2. Módulo Hoy / Agenda');
  try {
    check(typeof renderActividades==='function', 'renderActividades existe');
    check(typeof renderActChips==='function',    'renderActChips existe');
    check(typeof clasificarGrupo==='function',   'clasificarGrupo existe');
    check(typeof marcarHecha==='function',        'marcarHecha existe');
    check(typeof reprog==='function',             'reprog existe');
    check(typeof abrirActDetalle==='function',    'abrirActDetalle existe');

    // clasificarGrupo
    check(clasificarGrupo(AYER)==='vencido',  'clasificarGrupo(ayer) → vencido');
    check(clasificarGrupo(HOY_ISO)==='hoy',   'clasificarGrupo(hoy)  → hoy');
    check(clasificarGrupo(MANANA)==='manana', 'clasificarGrupo(mañana) → manana');

    // Render sin error
    try { renderActividades('todas'); ok('renderActividades("todas") sin errores'); }
    catch(e){ fail('renderActividades', e.message); }

    try { renderActividades('vencido'); ok('renderActividades("vencido") sin errores'); }
    catch(e){ fail('renderActividades("vencido")', e.message); }

    try { renderActChips(); ok('renderActChips() sin errores'); }
    catch(e){ fail('renderActChips', e.message); }

    // KPIs
    var urg = actividadesData.filter(function(a){ return !a.done && (a.urgente||a.grupo==='hoy'); }).length;
    check(urg >= 2, 'KPI urgentes/hoy >= 2 (actA1 + actA2 urgente)');

    var done = actividadesData.filter(function(a){ return a.done; }).length;
    check(done >= 1, 'KPI completadas >= 1 (actB2)');

  } catch(e){ fail('Módulo Hoy', e.message); }
  console.groupEnd();

  /* ================================================================
     TEST — MÓDULO CALENDARIO
     ================================================================ */
  console.group('3. Módulo Calendario');
  try {
    check(typeof renderCalendario==='function', 'renderCalendario existe');
    check(typeof hoyVista==='function',         'hoyVista existe');
    check(typeof _calRenderGrid==='function',   '_calRenderGrid existe');
    check(typeof _calRenderDetail==='function', '_calRenderDetail existe');
    check(typeof _calIso==='function',          '_calIso existe');

    // _calIso
    check(_calIso(2026,6,17)==='2026-07-17', '_calIso(2026,6,17) → 2026-07-17');

    // Render calendario en hoy-cal-view
    try {
      hoyVista('calendario');
      var calWrap = document.getElementById('hoy-cal-view');
      check(calWrap && calWrap.innerHTML.length > 100, 'hoy-cal-view tiene contenido tras hoyVista("calendario")');
      check(!!document.getElementById('cal-days-grid'), 'cal-days-grid existe en DOM');
      check(!!document.getElementById('cal-detail-hd'), 'cal-detail-hd existe en DOM');
    } catch(e){ fail('renderCalendario()', e.message); }

    // Selección de día con actividades
    try {
      calSelectedDate = HOY_ISO;
      _calRenderDetail();
      var lista = document.getElementById('cal-act-list');
      check(lista && lista.querySelectorAll('.act-card').length >= 1, 'Panel detalle muestra actividades del día');
    } catch(e){ fail('_calRenderDetail con actividades', e.message); }

    // Pips en el grid
    var pips = document.querySelectorAll('.cal-pip');
    check(pips.length >= 1, 'Grid tiene pips de actividades (' + pips.length + ' encontrados)');

    // Volver a lista
    try { hoyVista('lista'); ok('hoyVista("lista") sin errores'); }
    catch(e){ fail('hoyVista("lista")', e.message); }

  } catch(e){ fail('Módulo Calendario', e.message); }
  console.groupEnd();

  /* ================================================================
     TEST — MÓDULO LEADS / PIPELINE
     ================================================================ */
  console.group('4. Módulo Leads / Pipeline');
  try {
    check(typeof renderLeads==='function',    'renderLeads existe');
    check(typeof openPipeDetalle==='function','openPipeDetalle existe');
    check(typeof getLead==='function',        'getLead existe');

    // getLead
    var lA = getLead('TEST-A-001');
    check(!!lA, 'getLead("TEST-A-001") retorna objeto');
    check(lA && lA.etapa==='Cotizado', 'Lead A etapa === Cotizado');
    check(lA && lA.temp==='Caliente',  'Lead A temperatura === Caliente');

    var lB = getLead('TEST-B-001');
    check(!!lB, 'getLead("TEST-B-001") retorna objeto');
    check(lB && lB.etapa==='Ganado',   'Lead B etapa === Ganado');

    // Render sin error
    try { nav('leads'); ok('nav("leads") sin errores'); }
    catch(e){ fail('nav("leads")', e.message); }

    // ETAPA_ACT_TIPOS
    check(typeof ETAPA_ACT_TIPOS !== 'undefined', 'ETAPA_ACT_TIPOS definido');
    if(typeof ETAPA_ACT_TIPOS !== 'undefined'){
      check(Array.isArray(ETAPA_ACT_TIPOS['Cotizado']), 'ETAPA_ACT_TIPOS["Cotizado"] es array');
      check(ETAPA_ACT_TIPOS['Cotizado'].indexOf('Seguimiento cotización') >= 0,
        'Cotizado incluye "Seguimiento cotización"');
    }

    // _normFecha
    check(typeof _normFecha==='function', '_normFecha existe');
    check(_normFecha('2026-07-17T06:00:00.000Z')==='2026-07-17', '_normFecha normaliza ISO completo');
    check(_normFecha('2026-07-17')==='2026-07-17',               '_normFecha pasa fecha simple sin cambio');

  } catch(e){ fail('Módulo Leads', e.message); }
  console.groupEnd();

  /* ================================================================
     TEST — MÓDULO CLIENTES
     ================================================================ */
  console.group('5. Módulo Clientes');
  try {
    check(typeof renderClientes==='function', 'renderClientes existe');
    check(typeof getCliente==='function',     'getCliente existe');

    var cB = getCliente('TEST-CLI-B001');
    check(!!cB, 'getCliente("TEST-CLI-B001") retorna objeto');
    check(cB && cB.estado==='Activo',     'Cliente B estado === Activo');
    check(cB && cB.numSes===20,           'Cliente B numSes === 20');
    check(cB && cB.monto===32000,         'Cliente B monto === 32000');
    check(cB && cB.cobrado===4800,        'Cliente B cobrado === 4800');
    check(cB && cB.porCobrar===27200,     'Cliente B porCobrar === 27200');
    check(cB && Array.isArray(cB.sesiones) && cB.sesiones.length===20,
      'Cliente B tiene 20 sesiones');

    try { nav('clientes'); ok('nav("clientes") sin errores'); }
    catch(e){ fail('nav("clientes")', e.message); }

  } catch(e){ fail('Módulo Clientes', e.message); }
  console.groupEnd();

  /* ================================================================
     TEST — MÓDULO FACTURAS
     ================================================================ */
  console.group('6. Módulo Facturas');
  try {
    check(typeof renderFacturas==='function', 'renderFacturas existe');

    var fB = facturasData.find(function(f){ return f.id==='TEST-FACT-B1'; });
    check(!!fB,                       'Factura TEST-FACT-B1 en facturasData');
    check(fB && fB.estado==='Por crear', 'Factura estado === "Por crear"');
    check(fB && fB.monto===4800,         'Factura monto === 4800');

    try { nav('facturas'); ok('nav("facturas") sin errores'); }
    catch(e){ fail('nav("facturas")', e.message); }

  } catch(e){ fail('Módulo Facturas', e.message); }
  console.groupEnd();

  /* ================================================================
     TEST — HELPERS GLOBALES
     ================================================================ */
  console.group('7. Helpers globales');
  try {
    check(typeof esc==='function',          'esc() existe');
    check(typeof $==='function',            '$() existe');
    check(typeof setText==='function',      'setText() existe');
    check(typeof setHtml==='function',      'setHtml() existe');
    check(typeof toast==='function',        'toast() existe');
    check(typeof openModal==='function',    'openModal() existe');
    check(typeof closeModal==='function',   'closeModal() existe');
    check(typeof tipoIcon==='function',     'tipoIcon() existe');
    check(typeof ico==='function',          'ico() existe');
    check(typeof fechaHoraTxt==='function', 'fechaHoraTxt() existe');
    check(typeof gs==='function',           'gs() (API GAS) existe');

    check(esc('<script>') === '&lt;script&gt;', 'esc() escapa HTML correctamente');
    check(typeof tipoIcon('Llamada') === 'string' && tipoIcon('Llamada').length > 0,
      'tipoIcon("Llamada") retorna string no vacío');

  } catch(e){ fail('Helpers', e.message); }
  console.groupEnd();

  /* ================================================================
     TEST — NAVEGACIÓN COMPLETA
     ================================================================ */
  console.group('8. Navegación completa (smoke test)');
  ['hoy','leads','clientes','facturas'].forEach(function(k){
    try { nav(k); ok('nav("'+k+'") sin errores'); }
    catch(e){ fail('nav("'+k+'")', e.message); }
  });
  // Regresar a hoy con calendario
  try { nav('hoy'); hoyVista('calendario'); ok('Regreso a Hoy → calendario sin errores'); }
  catch(e){ fail('Regreso a Hoy → calendario', e.message); }
  console.groupEnd();

  /* ================================================================
     RESUMEN
     ================================================================ */
  var total = PASS + FAIL + WARN;
  console.group(
    '%c RESULTADO: ' + PASS + '/' + total + ' ✓  |  ' + FAIL + ' ✗  |  ' + WARN + ' ⚠',
    'font-weight:800;font-size:13px;color:' + (FAIL===0?'#1F8A4C':'#C43D3D')
  );
  RESULTS.forEach(function(r){ console.log(r); });
  console.groupEnd();
  console.groupEnd(); // grupo principal

  return { pass: PASS, fail: FAIL, warn: WARN, total: total, results: RESULTS };

})();
