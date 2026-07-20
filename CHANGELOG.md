# Changelog

## 1.2.0 - 2026-07-01

- Agrega modulo de administracion de usuarios para administradores.
- Permite activar usuarios, completar nombre y cambiar rol desde la app.
- Agrega funciones seguras de Supabase para listar usuarios de Auth y crear/actualizar perfiles RH.
- Activa como administradores a los usuarios actuales autorizados.

## 1.1.0 - 2026-06-24

- Agrega graficas al dashboard.
- Corrige antiguedad promedio para mostrar `años`.
- Genera automaticamente el ID de empleado desde Supabase.
- Limita CURP, RFC y NSS segun longitud oficial.
- Agrega catalogos de areas/departamentos, puestos ligados al area y tarifas.
- Permite crear area, puesto, asociado y tarifa desde el alta de empleado.
- Agrega datos de contacto: correo, telefono alterno y contacto de emergencia.
- Agrega campos de vacaciones por empleado/tarifa.
- Prepara tablas base para turnos, asistencia y gastos.
- Hace la tabla de empleados colapsable con encabezado y primera columna fijos.

## 1.0.1 - 2026-06-24

- Agrega logos oficiales de LPE Transporte.
- Usa Figtree local desde archivos del cliente.
- Suaviza iconos y controles visuales con esquinas mas redondeadas.
- Agrega favicon oficial.

## 1.0.0 - 2026-06-24

- Crea la primera version MVP de LPE RH.
- Agrega autenticacion con Supabase.
- Agrega dashboard, empleados, asociados, autorizaciones e historial.
- Conecta la app al proyecto Supabase `LPE_RH`.
