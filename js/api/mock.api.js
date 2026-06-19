// Adaptador temporal para migrar los arreglos demo del app.js legado.
// Cuando conectemos Google Sheets, este archivo puede servir para pruebas locales.
export const MockAPI = {
  getLeads: async () => [],
  getClientes: async () => [],
  getAgenda: async () => [],
  getCobros: async () => [],
  getEgresos: async () => [],
  getFacturas: async () => [],
};
