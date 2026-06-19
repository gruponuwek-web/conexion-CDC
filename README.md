# Clínica del Cerebro · CRM/ERP Modular V3.1

Versión preparada para subir a GitHub Pages y conectar con Google Sheets vía Google Apps Script.

## Estructura

```txt
index.html
css/styles.css
js/app.js
js/core/config.js
js/core/state.js
js/core/users.js
js/core/permissions.js
js/core/utils.js
js/core/moduleRegistry.js
js/api/googleSheets.api.js
js/api/mock.api.js
js/modules/leads.js
js/modules/clientes.js
js/modules/agenda.js
js/modules/sesiones.js
js/modules/cobros.js
js/modules/egresos.js
js/modules/facturas.js
js/modules/tableros.js
apps-script/Code.gs
test-api.html
.nojekyll
```

## Nota importante

Por seguridad de operación, la lógica funcional original se conserva en `js/app.js` para no romper botones, modales y funciones inline del HTML.

La carpeta `js/modules/` ya existe como estructura modular para la siguiente fase: migrar cada bloque funcional de `app.js` a su módulo correspondiente.

## Google Apps Script

El archivo `apps-script/Code.gs` está actualizado con la estructura de Google Sheets, incluyendo la hoja `Clientes` con estas columnas:

```txt
IDCliente, IDLead, FechaAltaCliente, NombreContacto, Correo, Celular, NombrePaciente, Servicio, FechaInicio, SesionesContratadas, SesionesRealizadas, MontoTotal, TotalCobrado, SaldoPendiente, Estado, Responsable, Notas, FechaActualizacion
```

## Prueba rápida

Después de subir a GitHub Pages, abre:

```txt
test-api.html
```

Si la API está bien publicada, debe regresar estado activo.
