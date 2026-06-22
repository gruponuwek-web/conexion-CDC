import { APP_CONFIG } from '../core/config.js';

// ── Helper único · Patrón Grupo Nuwek (PDF CORS) ────────────────
// SIN headers + URLSearchParams = petición "simple" = sin preflight
// El body viaja como x-www-form-urlencoded → llega a e.parameter en Apps Script
async function request(action, payload = {}) {
  if (!APP_CONFIG.googleAppsScriptUrl) {
    throw new Error('Falta configurar googleAppsScriptUrl en js/core/config.js');
  }

  const res = await fetch(APP_CONFIG.googleAppsScriptUrl, {
    method: 'POST',
    body: new URLSearchParams({
      action,
      data: JSON.stringify(payload),  // ← "data" coincide con e.parameter.data en Code.gs
    }),
    // ← SIN objeto headers. Crítico. Ver guía CORS Grupo Nuwek.
  });

  const result = await res.json();
  if (!result.ok) throw new Error(result.error || 'Error en Google Apps Script');
  return result.data;
}

export const GoogleSheetsAPI = {
  ping: () => request('ping'),

  getLeads:      ()       => request('getLeads'),
  createLead:    (data)   => request('createLead', data),
  updateLead:    (data)   => request('updateLead', data),

  getClientes:   ()       => request('getClientes'),
  createCliente: (data)   => request('createCliente', data),
  updateCliente: (data)   => request('updateCliente', data),

  getAgenda:     ()       => request('getAgenda'),
  createCita:    (data)   => request('createCita', data),
  updateCita:    (data)   => request('updateCita', data),

  getSesiones:   ()       => request('getSesiones'),
  createSesion:  (data)   => request('createSesion', data),
  updateSesion:  (data)   => request('updateSesion', data),

  getCobros:     ()       => request('getCobros'),
  createCobro:   (data)   => request('createCobro', data),
  updateCobro:   (data)   => request('updateCobro', data),

  getEgresos:    ()       => request('getEgresos'),
  createEgreso:  (data)   => request('createEgreso', data),
  updateEgreso:  (data)   => request('updateEgreso', data),

  getFacturas:   ()       => request('getFacturas'),
  createFactura: (data)   => request('createFactura', data),
  updateFactura: (data)   => request('updateFactura', data),

  getUsuarios:   ()       => request('getUsuarios'),
  getConfig:     ()       => request('getConfig'),
  getListas:     ()       => request('getListas'),
};