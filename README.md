# LPE RH

Aplicacion web para administracion de Recursos Humanos de LPE Transporte.

## Stack

- React + Vite
- Supabase Auth y Postgres
- Vercel
- GitHub

## Configuracion

1. Copia `.env.example` a `.env.local`.
2. Configura:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Instala dependencias:

```bash
pnpm install
```

4. Ejecuta localmente:

```bash
pnpm dev
```

## Version

Version actual: `1.1.0`

## Proyecto Supabase

Proyecto: `LPE_RH`

Ref: `hvrbbubobtbgwvutrpss`

## Modulos MVP

- Dashboard general
- Empleados
- Asociados / patrones
- Solicitudes de autorizacion
- Historial y auditoria
- Catalogos de areas, puestos y tarifas
- Base para turnos, asistencia y gastos
- Roles base: admin, RH, finanzas, supervisor y solo lectura
