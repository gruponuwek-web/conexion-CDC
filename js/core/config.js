// Configuración central · Clínica del Cerebro
// Esta versión ya apunta a tu Google Apps Script publicado.
export const APP_CONFIG = {
  appName: 'Clínica del Cerebro · CRM/ERP',
  version: '3.1.1',
  timezone: 'America/Mexico_City',
  googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfycbxg9s6mD-3h12Wnnh96hn99yx-I5L2k4e-Fhb5n4Gqa4mqmzkP6xTDsQtG0j_qqRITHGA/exec',
  dataSource: 'googleSheets', // mock | googleSheets
};

export const SHEETS = {
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