# Estructura Google Sheets · Clínica del Cerebro

## Pestañas requeridas

- Leads
- Clientes
- Agenda
- Sesiones
- Cobros
- Egresos
- Facturas
- Usuarios
- Config
- Listas

## Clientes

Encabezados exactos:

```txt
IDCliente | IDLead | FechaAltaCliente | NombreContacto | Correo | Celular | NombrePaciente | Servicio | FechaInicio | SesionesContratadas | SesionesRealizadas | MontoTotal | TotalCobrado | SaldoPendiente | Estado | Responsable | Notas | FechaActualizacion
```

## Leads

```txt
IDLead | FechaAlta | NombreContacto | Correo | Celular | NombrePaciente | Edad | Genero | Padecimiento | Temperatura | Canal | Etapa | SiguienteActividad | FechaSiguiente | HoraSiguiente | Notas | Responsable | FechaActualizacion
```

## Flujo operativo

```txt
Lead → Cliente → Agenda/Sesiones → Cobros → Facturas
```

Nota: un lead no necesariamente es el paciente. Por eso Clientes conserva NombreContacto y NombrePaciente.
