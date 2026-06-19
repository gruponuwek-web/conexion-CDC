// Módulo Clientes · Clínica del Cerebro
// Fase V3.1: archivo creado para la migración modular.
// La lógica funcional actual sigue en js/app.js para evitar romper la app.

export const clientesModule = {
  name: 'clientes',
  label: 'Clientes',
  enabled: true,
};

export function initClientes() {
  console.info('[Módulo activo] Clientes');
}
