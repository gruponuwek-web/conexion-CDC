// Módulo Leads · Clínica del Cerebro
// Fase V3.1: archivo creado para la migración modular.
// La lógica funcional actual sigue en js/app.js para evitar romper la app.

export const leadsModule = {
  name: 'leads',
  label: 'Leads',
  enabled: true,
};

export function initLeads() {
  console.info('[Módulo activo] Leads');
}
