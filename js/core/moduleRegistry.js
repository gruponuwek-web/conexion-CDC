// Registro central de módulos · Clínica del Cerebro
// Esta capa permite prender/apagar módulos sin borrar código.

export const MODULES = {
  leads: { enabled: true, label: 'Leads', file: '../modules/leads.js' },
  clientes: { enabled: true, label: 'Clientes', file: '../modules/clientes.js' },
  agenda: { enabled: true, label: 'Agenda', file: '../modules/agenda.js' },
  sesiones: { enabled: true, label: 'Sesiones', file: '../modules/sesiones.js' },
  cobros: { enabled: true, label: 'Cobros', file: '../modules/cobros.js' },
  egresos: { enabled: true, label: 'Egresos', file: '../modules/egresos.js' },
  facturas: { enabled: true, label: 'Facturas', file: '../modules/facturas.js' },
  tableros: { enabled: true, label: 'Tableros', file: '../modules/tableros.js' },
};

export function isModuleEnabled(moduleName) {
  return Boolean(MODULES[moduleName]?.enabled);
}
