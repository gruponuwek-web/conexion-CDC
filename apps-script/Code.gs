// ══════════════════════════════════════════════════════════════
//  CDC CRM/ERP · Clínica del Cerebro · Apps Script Backend
//  Patrón: Grupo Nuwek CORS Guide · e.parameter.data
// ══════════════════════════════════════════════════════════════

const SHEET_NAMES = {
  leads:    'Leads',
  clientes: 'Clientes',
  agenda:   'Agenda',
  sesiones: 'Sesiones',
  cobros:   'Cobros',
  egresos:  'Egresos',
  facturas: 'Facturas',
  usuarios: 'Usuarios',
  config:   'Config',
  listas:   'Listas',
};

// ── Entradas ────────────────────────────────────────────────────
function doGet(e)  { return handle(e); }
function doPost(e) { return handle(e); }

// ── Router principal (patrón exacto del PDF Grupo Nuwek) ────────
function handle(e) {
  const p = (e && e.parameter) || {};

  // Leer data desde e.parameter.data (URLSearchParams desde el front)
  let data = {};
  try { if (p.data) data = JSON.parse(p.data); } catch (_) {}

  // Fallback: si alguien manda JSON crudo en el body
  if (e && e.postData && e.postData.contents && !p.data) {
    try { data = JSON.parse(e.postData.contents); } catch (_) {}
  }

  let out;
  try {
    switch (p.action) {
      case 'ping':          out = { status: 'Clínica del Cerebro API activa', version: '2.0.0' }; break;

      case 'getLeads':      out = getRows(SHEET_NAMES.leads);                                      break;
      case 'createLead':    out = appendRow(SHEET_NAMES.leads, data);                              break;
      case 'updateLead':    out = updateRowById(SHEET_NAMES.leads, 'IDLead', data.IDLead, data);   break;

      case 'getClientes':   out = getRows(SHEET_NAMES.clientes);                                   break;
      case 'createCliente': out = appendRow(SHEET_NAMES.clientes, normalizeCliente(data));         break;
      case 'updateCliente': out = updateRowById(SHEET_NAMES.clientes, 'IDCliente', data.IDCliente, normalizeCliente(data)); break;

      case 'getAgenda':     out = getRows(SHEET_NAMES.agenda);                                     break;
      case 'createCita':    out = appendRow(SHEET_NAMES.agenda, data);                             break;
      case 'updateCita':    out = updateRowById(SHEET_NAMES.agenda, 'IDCita', data.IDCita, data);  break;

      case 'getSesiones':   out = getRows(SHEET_NAMES.sesiones);                                   break;
      case 'createSesion':  out = appendRow(SHEET_NAMES.sesiones, data);                           break;
      case 'updateSesion':  out = updateRowById(SHEET_NAMES.sesiones, 'IDSesion', data.IDSesion, data); break;

      case 'getCobros':     out = getRows(SHEET_NAMES.cobros);                                     break;
      case 'createCobro':   out = appendRow(SHEET_NAMES.cobros, data);                             break;
      case 'updateCobro':   out = updateRowById(SHEET_NAMES.cobros, 'IDCobro', data.IDCobro, data); break;

      case 'getEgresos':    out = getRows(SHEET_NAMES.egresos);                                    break;
      case 'createEgreso':  out = appendRow(SHEET_NAMES.egresos, data);                            break;
      case 'updateEgreso':  out = updateRowById(SHEET_NAMES.egresos, 'IDEgreso', data.IDEgreso, data); break;

      case 'getFacturas':   out = getRows(SHEET_NAMES.facturas);                                   break;
      case 'createFactura': out = appendRow(SHEET_NAMES.facturas, data);                           break;
      case 'updateFactura': out = updateRowById(SHEET_NAMES.facturas, 'IDFactura', data.IDFactura, data); break;

      case 'getUsuarios':   out = getRows(SHEET_NAMES.usuarios);                                   break;
      case 'getConfig':     out = getRows(SHEET_NAMES.config);                                     break;
      case 'getListas':     out = getRows(SHEET_NAMES.listas);                                     break;

      default:
        out = { ok: false, error: 'Accion no reconocida: ' + p.action };
        return jsonOut(JSON.stringify(out), p.callback);
    }
  } catch (err) {
    out = { ok: false, error: err.message };
    return jsonOut(JSON.stringify(out), p.callback);
  }

  const json = JSON.stringify({ ok: true, data: out });
  return jsonOut(json, p.callback);
}

// ── JSONP support (Plan B del PDF) ──────────────────────────────
function jsonOut(json, callback) {
  return callback
    ? ContentService.createTextOutput(callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(json)
        .setMimeType(ContentService.MimeType.JSON);
}

// ── Utilidades de Sheets ─────────────────────────────────────────

function getRows(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values
    .slice(1)
    .filter(row => row.some(Boolean))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

function appendRow(sheetName, data) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h =>
    Object.prototype.hasOwnProperty.call(data, h) ? data[h] : ''
  );
  sheet.appendRow(row);
  return data;
}

function updateRowById(sheetName, idHeader, idValue, data) {
  if (!idValue) throw new Error('Falta ID para actualizar');
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf(idHeader);
  if (idCol < 0) throw new Error('No existe columna: ' + idHeader);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(idValue)) {
      const newRow = headers.map((h, col) =>
        Object.prototype.hasOwnProperty.call(data, h) ? data[h] : values[i][col]
      );
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
      return data;
    }
  }
  throw new Error('Registro no encontrado: ' + idValue);
}

function getSheet(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) throw new Error('No existe la hoja: ' + sheetName);
  return sheet;
}

function normalizeCliente(data) {
  return {
    IDCliente:           data.IDCliente || '',
    IDLead:              data.IDLead || '',
    FechaAltaCliente:    data.FechaAltaCliente || new Date(),
    NombreContacto:      data.NombreContacto || '',
    Correo:              data.Correo || '',
    Celular:             data.Celular || '',
    NombrePaciente:      data.NombrePaciente || '',
    Servicio:            data.Servicio || '',
    FechaInicio:         data.FechaInicio || '',
    SesionesContratadas: data.SesionesContratadas || '',
    SesionesRealizadas:  data.SesionesRealizadas || 0,
    MontoTotal:          data.MontoTotal || 0,
    TotalCobrado:        data.TotalCobrado || 0,
    SaldoPendiente:      data.SaldoPendiente || 0,
    Estado:              data.Estado || 'Activo',
    Responsable:         data.Responsable || '',
    Notas:               data.Notas || '',
    FechaActualizacion:  new Date(),
  };
}