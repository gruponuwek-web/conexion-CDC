// ══════════════════════════════════════════════════════════════
//  CDC CRM/ERP · Clínica del Cerebro · Apps Script Backend
//  Patrón: Grupo Nuwek CORS Guide · e.parameter.data
//  Todos los IDs usan campo 'id' minúscula (alineado con app.js)
// ══════════════════════════════════════════════════════════════

const SHEET_NAMES = {
  leads:          'Leads',
  clientes:       'Clientes',
  agenda:         'Agenda',
  sesiones:       'Sesiones',
  cobros:         'Cobros',
  egresos:        'Egresos',
  facturas:       'Facturas',
  ingresosExtras: 'IngresosExtras',
  usuarios:       'Usuarios',
  config:         'Config',
  listas:         'Listas',
};

function doGet(e)  { return handle(e); }
function doPost(e) { return handle(e); }

function handle(e) {
  const p = (e && e.parameter) || {};

  let data = {};
  try { if (p.data) data = JSON.parse(p.data); } catch (_) {}
  if (e && e.postData && e.postData.contents && !p.data) {
    try { data = JSON.parse(e.postData.contents); } catch (_) {}
  }

  let out;
  try {
    switch (p.action) {
      case 'ping':
        out = { status: 'Clínica del Cerebro API activa', version: '3.0.1' };
        break;

      // ── LEADS ─────────────────────────────────────────────────
      case 'getLeads':      out = getRows(SHEET_NAMES.leads);                              break;
      case 'createLead':    out = appendRow(SHEET_NAMES.leads, data);                      break;
      case 'updateLead':    out = updateById(SHEET_NAMES.leads, data);                     break;

      // ── CLIENTES ──────────────────────────────────────────────
      case 'getClientes':   out = getRows(SHEET_NAMES.clientes);                           break;
      case 'createCliente': out = appendRow(SHEET_NAMES.clientes, data);                   break;
      case 'updateCliente': out = updateById(SHEET_NAMES.clientes, data);                  break;

      // ── AGENDA ────────────────────────────────────────────────
      case 'getAgenda':
      case 'getActividades':  out = getRows(SHEET_NAMES.agenda);                           break;
      case 'createCita':      out = appendRow(SHEET_NAMES.agenda, data);                   break;
      case 'updateCita':      out = updateById(SHEET_NAMES.agenda, data);                  break;

      // ── SESIONES ──────────────────────────────────────────────
      case 'getSesiones':    out = getRows(SHEET_NAMES.sesiones);                          break;
      case 'createSesion':   out = appendRow(SHEET_NAMES.sesiones, data);                  break;
      case 'createSesiones': out = appendRows(SHEET_NAMES.sesiones, data.sesiones);        break;
      case 'updateSesion':   out = updateById(SHEET_NAMES.sesiones, data);                 break;

      // ── COBROS ────────────────────────────────────────────────
      case 'getCobros':     out = getRows(SHEET_NAMES.cobros);                             break;
      case 'createCobro':   out = appendRow(SHEET_NAMES.cobros, data);                     break;
      case 'updateCobro':   out = updateById(SHEET_NAMES.cobros, data);                    break;

      // ── EGRESOS ───────────────────────────────────────────────
      case 'getEgresos':      out = getRows(SHEET_NAMES.egresos);                          break;
      case 'getPagosFijos':   out = getRows(SHEET_NAMES.egresos).filter(r => r.tipo === 'fijo'); break;
      case 'createEgreso':    out = appendRow(SHEET_NAMES.egresos, data);                  break;
      case 'updateEgreso':    out = updateById(SHEET_NAMES.egresos, data);                 break;
      case 'deleteEgreso':    out = deleteById(SHEET_NAMES.egresos, data.id);             break;
      case 'deletePagoFijo':  out = deleteById(SHEET_NAMES.egresos, data.id);             break;

      // ── FACTURAS ──────────────────────────────────────────────
      case 'getFacturas':   out = getRows(SHEET_NAMES.facturas);                           break;
      case 'createFactura': out = appendRow(SHEET_NAMES.facturas, data);                   break;
      case 'updateFactura': out = updateById(SHEET_NAMES.facturas, data);                  break;

      // ── INGRESOS EXTRAS ───────────────────────────────────────
      case 'getIngresosExtras':    out = getRows(SHEET_NAMES.ingresosExtras);              break;
      case 'createIngresoExtra':   out = appendRow(SHEET_NAMES.ingresosExtras, data);      break;
      case 'updateIngresoExtra':   out = updateById(SHEET_NAMES.ingresosExtras, data);     break;

      // ── CATÁLOGOS ─────────────────────────────────────────────
      case 'getUsuarios':   out = getRows(SHEET_NAMES.usuarios);                           break;
      case 'getConfig':     out = getRows(SHEET_NAMES.config);                             break;
      case 'setConfig':     out = upsertConfig(SHEET_NAMES.config, data.key, data.valor);  break;
      case 'getListas':     out = getRows(SHEET_NAMES.listas);                             break;

      default:
        out = { ok: false, error: 'Accion no reconocida: ' + p.action };
        return jsonOut(JSON.stringify(out), p.callback);
    }
  } catch (err) {
    out = { ok: false, error: err.message };
    return jsonOut(JSON.stringify(out), p.callback);
  }

  return jsonOut(JSON.stringify({ ok: true, data: out }), p.callback);
}

// ── JSONP support ────────────────────────────────────────────────
function jsonOut(json, callback) {
  return callback
    ? ContentService.createTextOutput(callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(json)
        .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════════
//  UTILIDADES DE SHEETS
// ════════════════════════════════════════════════════════════════

function getRows(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values
    .slice(1)
    .filter(row => row.some(v => v !== '' && v !== null && v !== undefined))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

function appendRows(sheetName, rows) {
  if (!rows || !rows.length) return { count: 0 };
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var matrix = rows.map(function(data) {
    return headers.map(function(h) {
      return Object.prototype.hasOwnProperty.call(data, h) ? data[h] : '';
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, matrix.length, headers.length).setValues(matrix);
  return { count: matrix.length };
}

function appendRow(sheetName, data) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h =>
    Object.prototype.hasOwnProperty.call(data, h) ? data[h] : ''
  );
  sheet.appendRow(row);
  return { id: data.id || '' };
}

// updateById — busca siempre por columna 'id' (minúscula)
function updateById(sheetName, data) {
  if (!data.id) throw new Error('Falta campo id para actualizar en ' + sheetName);

  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');

  if (idCol < 0) throw new Error('No existe columna "id" en hoja: ' + sheetName);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(data.id)) {
      const newRow = headers.map((h, col) =>
        Object.prototype.hasOwnProperty.call(data, h) ? data[h] : values[i][col]
      );
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
      return { id: data.id };
    }
  }
  throw new Error('Registro no encontrado: ' + data.id + ' en ' + sheetName);
}

function getSheet(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) throw new Error('No existe la hoja: ' + sheetName);
  return sheet;
}

function deleteById(sheetName, id) {
  if (!id) throw new Error('Falta id para eliminar en ' + sheetName);
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  if (idCol < 0) throw new Error('No existe columna "id" en hoja: ' + sheetName);
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { id: id };
    }
  }
  throw new Error('Registro no encontrado: ' + id + ' en ' + sheetName);
}

// upsertConfig — actualiza una fila si key existe, si no la crea
function upsertConfig(sheetName, key, valor) {
  if (!key) throw new Error('Falta key en setConfig');
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0]; // ['key','valor']
  const keyCol = headers.indexOf('key');
  const valCol = headers.indexOf('valor');
  if (keyCol < 0 || valCol < 0) throw new Error('La hoja Config necesita columnas "key" y "valor"');
  // Buscar fila existente
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][keyCol]) === String(key)) {
      sheet.getRange(i + 1, valCol + 1).setValue(valor);
      return { key: key, action: 'updated' };
    }
  }
  // No existe → agregar fila nueva
  const newRow = headers.map(h => h === 'key' ? key : (h === 'valor' ? valor : ''));
  sheet.appendRow(newRow);
  return { key: key, action: 'created' };
}
