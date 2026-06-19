# Módulos del sistema

## Core
- Configuración
- Estado global
- Usuarios
- Permisos
- Utilidades
- Registro de módulos

## API
- Google Sheets API
- Mock API para pruebas futuras

## Módulos funcionales
- Leads
- Clientes
- Agenda
- Sesiones
- Cobros
- Egresos
- Facturas
- Tableros

## Criterio de migración

Cada módulo deberá contener:

```txt
render()
init()
create()
update()
remove() // si aplica
bindEvents()
```

La migración debe hacerse módulo por módulo, probando después de cada cambio.
