// Configuración central · Clínica del Cerebro
// Esta versión ya apunta a tu Google Apps Script publicado.
export const APP_CONFIG = {
  appName: 'Clínica del Cerebro · CRM/ERP',
  version: '3.1.0',
  timezone: 'America/Mexico_City',
  googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfycbwh9YoKdHeFM4aNXTgeYE4d7JhAh2cyl7Bt20JInEw_D1ey7t7pK69RN1mblEiwCdU9Nw/exec',
  dataSource: 'googleSheets', // mock | googleSheets
};

export const SHEETS = {
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
