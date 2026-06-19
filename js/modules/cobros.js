// Módulo Cobros · Clínica del Cerebro
// Fase V3.1: archivo creado para la migración modular.
// La lógica funcional actual sigue en js/app.js para evitar romper la app.

export const cobrosModule = {
  name: 'cobros',
  label: 'Cobros',
  enabled: true,
};

export function initCobros() {
  console.info('[Módulo activo] Cobros');
}
