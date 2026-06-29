// ══════════════════════════════════════════════════════════════
//  listas.js · Clínica del Cerebro · CRM/ERP
//  Catálogos editables del sistema
//  Edita este archivo para agregar o quitar opciones.
//  NO toques app.js para cambiar dropdowns.
// ══════════════════════════════════════════════════════════════

var LISTAS = {

  // ── Pipeline de ventas ──────────────────────────────────────
  etapas: ['Nuevo','Contactado','Diagnóstico','Cotizado','Ganado','Perdido','No clasifica'],
  etapasOpcionales: ['Perdido','No clasifica'], // etapas donde la actividad de seguimiento no es obligatoria

  // ── Leads ───────────────────────────────────────────────────
  padecimientos: ['TDAH','Ansiedad','Depresión','Estrés crónico','Dislexia','Migraña','Cognitivo','Otro'],
  canales: ['Instagram','Facebook','WhatsApp','Google','Referido','Otro'],
  temperaturas: ['Caliente','Tibio','Frío'],
  generos: ['Masculino','Femenino','Otro'],

  // ── Actividades ─────────────────────────────────────────────
  tiposActividad: ['Llamada','Mensaje WhatsApp','Enviar cotización','Agendar cita','Seguimiento cotización','Enviar documento'],

  // ── Clientes ────────────────────────────────────────────────
  estadosCliente: ['En onboarding','Activo','Pausado','Reagendado','Cancelado','Completado'],
  razonesCancel: ['Costo / presupuesto','Distancia / traslado','Decidió otra clínica','Mejoría sin tratamiento','Falta de tiempo','Problemas de salud','Cambio de ciudad','Sin respuesta del paciente','Insatisfacción con resultados','Otro'],

  // ── Finanzas · Egresos ──────────────────────────────────────
  catEgresos: ['Renta','Nómina','Servicios','Insumos','Equipo','Software','Marketing','Otro'],
  metodosPago: ['Transferencia','Tarjeta','Efectivo','Cheque'],
  cuentasPorMetodo: {
    'Efectivo':      ['Efectivo caja'],
    'Tarjeta':       ['BBVA 4521','HSBC 7832','Santander 1180'],
    'Transferencia': ['HSBC 7832','Banorte 3492'],
    'Cheque':        ['BBVA 4521','HSBC 7832']
  },

  // ── Finanzas · Ingresos adicionales ─────────────────────────
  catIngresosExtras: ['Consultoría','Venta de producto','Donativo','Patrocinio','Capacitación','Otro'],

  // ── Facturas ────────────────────────────────────────────────
  usosCFDI: ['D01 · Honorarios médicos','G03 · Gastos en general','S01 · Sin efectos fiscales'],

};
