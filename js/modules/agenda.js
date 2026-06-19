// Módulo Agenda · Clínica del Cerebro
// Fase V3.1: archivo creado para la migración modular.
// La lógica funcional actual sigue en js/app.js para evitar romper la app.

export const agendaModule = {
  name: 'agenda',
  label: 'Agenda',
  enabled: true,
};

export function initAgenda() {
  console.info('[Módulo activo] Agenda');
}
