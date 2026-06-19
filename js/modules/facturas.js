// Módulo Facturas · Clínica del Cerebro
// Fase V3.1: archivo creado para la migración modular.
// La lógica funcional actual sigue en js/app.js para evitar romper la app.

export const facturasModule = {
  name: 'facturas',
  label: 'Facturas',
  enabled: true,
};

export function initFacturas() {
  console.info('[Módulo activo] Facturas');
}
