// Módulo Sesiones · Clínica del Cerebro
// Fase V3.1: archivo creado para la migración modular.
// La lógica funcional actual sigue en js/app.js para evitar romper la app.

export const sesionesModule = {
  name: 'sesiones',
  label: 'Sesiones',
  enabled: true,
};

export function initSesiones() {
  console.info('[Módulo activo] Sesiones');
}
