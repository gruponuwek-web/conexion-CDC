// Permisos por usuario
export const PERMISSIONS = {
  willy: {
    leads: true,
    clientes: true,
    agenda: true,
    sesiones: true,
    cobros: true,
    egresos: true,
    facturas: true,
    tableros: true,
    config: true,
  },
  vicky: {
    leads: true,
    clientes: true,
    agenda: true,
    sesiones: true,
    cobros: true,
    egresos: true,
    facturas: true,
    tableros: false,
    config: false,
  },
};

export function can(userId, moduleName) {
  return Boolean(PERMISSIONS[userId]?.[moduleName]);
}
