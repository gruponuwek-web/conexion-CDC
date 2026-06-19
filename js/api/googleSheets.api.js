import { APP_CONFIG } from '../core/config.js';

async function request(action, payload = {}) {
  if (!APP_CONFIG.googleAppsScriptUrl) {
    throw new Error('Falta configurar googleAppsScriptUrl en js/core/config.js');
  }

  const response = await fetch(APP_CONFIG.googleAppsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload }),
  });

  const data = await response.json();
  if (!data.ok) throw new Error(data.error || 'Error en Google Apps Script');
  return data.data;
}

export const GoogleSheetsAPI = {
  ping: async () => {
    const response = await fetch(APP_CONFIG.googleAppsScriptUrl);
    return response.json();
  },

  getLeads: () => request('getLeads'),
  createLead: (lead) => request('createLead', lead),
  updateLead: (lead) => request('updateLead', lead),

  getClientes: () => request('getClientes'),
  createCliente: (cliente) => request('createCliente', cliente),
  updateCliente: (cliente) => request('updateCliente', cliente),

  getAgenda: () => request('getAgenda'),
  createCita: (cita) => request('createCita', cita),
  updateCita: (cita) => request('updateCita', cita),

  getSesiones: () => request('getSesiones'),
  createSesion: (sesion) => request('createSesion', sesion),
  updateSesion: (sesion) => request('updateSesion', sesion),

  getCobros: () => request('getCobros'),
  createCobro: (cobro) => request('createCobro', cobro),
  updateCobro: (cobro) => request('updateCobro', cobro),

  getEgresos: () => request('getEgresos'),
  createEgreso: (egreso) => request('createEgreso', egreso),
  updateEgreso: (egreso) => request('updateEgreso', egreso),

  getFacturas: () => request('getFacturas'),
  createFactura: (factura) => request('createFactura', factura),
  updateFactura: (factura) => request('updateFactura', factura),

  getUsuarios: () => request('getUsuarios'),
  getConfig: () => request('getConfig'),
  getListas: () => request('getListas'),
};
