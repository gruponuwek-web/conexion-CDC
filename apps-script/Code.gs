const SHEET_NAMES = {
  leads: 'Leads',
  clientes: 'Clientes',
  agenda: 'Agenda',
  sesiones: 'Sesiones',
  cobros: 'Cobros',
  egresos: 'Egresos',
  facturas: 'Facturas',
  usuarios: 'Usuarios',
  config: 'Config',
  listas: 'Listas',
};

function doGet() {
  return jsonResponse({
    ok: true,
    data: {
      status: 'Clínica del Cerebro API activa',
      version: '1.0.1'
    }
  });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;
    const payload = body.payload || {};

    const routes = {
      getLeads: () => getRows(SHEET_NAMES.leads),
      createLead: () => appendRow(SHEET_NAMES.leads, payload),
      updateLead: () => updateRowById(SHEET_NAMES.leads, 'IDLead', payload.IDLead, payload),

      getClientes: () => getRows(SHEET_NAMES.clientes),
      createCliente: () => appendRow(SHEET_NAMES.clientes, normalizeCliente(payload)),
      updateCliente: () => updateRowById(SHEET_NAMES.clientes, 'IDCliente', payload.IDCliente, normalizeCliente(payload)),

      getAgenda: () => getRows(SHEET_NAMES.agenda),
      createCita: () => appendRow(SHEET_NAMES.agenda, payload),
      updateCita: () => updateRowById(SHEET_NAMES.agenda, 'IDCita', payload.IDCita, payload),

      getSesiones: () => getRows(SHEET_NAMES.sesiones),
      createSesion: () => appendRow(SHEET_NAMES.sesiones, payload),
      updateSesion: () => updateRowById(SHEET_NAMES.sesiones, 'IDSesion', payload.IDSesion, payload),

      getCobros: () => getRows(SHEET_NAMES.cobros),
      createCobro: () => appendRow(SHEET_NAMES.cobros, payload),
      updateCobro: () => updateRowById(SHEET_NAMES.cobros, 'IDCobro', payload.IDCobro, payload),

      getEgresos: () => getRows(SHEET_NAMES.egresos),
      createEgreso: () => appendRow(SHEET_NAMES.egresos, payload),
      updateEgreso: () => updateRowById(SHEET_NAMES.egresos, 'IDEgreso', payload.IDEgreso, payload),

      getFacturas: () => getRows(SHEET_NAMES.facturas),
      createFactura: () => appendRow(SHEET_NAMES.facturas, payload),
      updateFactura: () => updateRowById(SHEET_NAMES.facturas, 'IDFactura', payload.IDFactura, payload),

      getUsuarios: () => getRows(SHEET_NAMES.usuarios),
      getConfig: () => getRows(SHEET_NAMES.config),
      getListas: () => getRows(SHEET_NAMES.listas),
    };

    if (!routes[action]) {
      throw new Error('Acción no soportada: ' + action);
    }

    return jsonResponse({
      ok: true,
      data: routes[action]()
    });

  } catch (err) {
    return jsonResponse({
      ok: false,
      error: err.message
    });
  }
}

function normalizeCliente(payload) {
  return {
    IDCliente: payload.IDCliente || '',
    IDLead: payload.IDLead || '',
    FechaAltaCliente: payload.FechaAltaCliente || new Date(),
    NombreContacto: payload.NombreContacto || '',
    Correo: payload.Correo || '',
    Celular: payload.Celular || '',
    NombrePaciente: payload.NombrePaciente || '',
    Servicio: payload.Servicio || '',
    FechaInicio: payload.FechaInicio || '',
    SesionesContratadas: payload.SesionesContratadas || '',
    SesionesRealizadas: payload.SesionesRealizadas || 0,
    MontoTotal: payload.MontoTotal || 0,
    TotalCobrado: payload.TotalCobrado || 0,
    SaldoPendiente: payload.SaldoPendiente || 0,
    Estado: payload.Estado || 'Activo',
    Responsable: payload.Responsable || '',
    Notas: payload.Notas || '',
    FechaActualizacion: new Date()
  };
}

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
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
}

function appendRow(sheetName, payload) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const row = headers.map(header => {
    return Object.prototype.hasOwnProperty.call(payload, header)
      ? payload[header]
      : '';
  });

  sheet.appendRow(row);

  return payload;
}

function updateRowById(sheetName, idHeader, idValue, payload) {
  if (!idValue) {
    throw new Error('Falta ID para actualizar');
  }

  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf(idHeader);

  if (idCol < 0) {
    throw new Error('No existe columna ' + idHeader);
  }

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][idCol]) === String(idValue)) {
      const newRow = headers.map((header, colIndex) => {
        return Object.prototype.hasOwnProperty.call(payload, header)
          ? payload[header]
          : values[rowIndex][colIndex];
      });

      sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([newRow]);

      return payload;
    }
  }

  throw new Error('No se encontró el registro: ' + idValue);
}

function getSheet(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('No existe la hoja: ' + sheetName);
  }

  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
