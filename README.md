# Sistema de Planillas — J&P Periféricos SAC (Backend)

Monolito modular pragmático orientado a casos de uso para la gestión de **Recursos Humanos, Control de Asistencia, Cálculo de Planillas (Legislación Laboral Peruana) e Integraciones (SUNAT PLAME, AFPnet, Telecrédito BCP y Boletas PDF con n8n)**.

---

## 1. Stack Tecnológico y Arquitectura

| Componente | Tecnología | Rol en el Sistema |
| :--- | :--- | :--- |
| **Framework HTTP** | NestJS 11 + Fastify 5 | API REST bajo prefijo `/api/v1`, validación con `ZodValidationPipe` y errores estandarizados **RFC 7807 (`application/problem+json`)**. |
| **Persistencia y ORM** | PostgreSQL 16 + Prisma 7 | Modelo relacional con índices parciales, bloqueos transaccionales por colaborador (`SELECT ... FOR UPDATE`), auditoría atómica y triggers SQL de inmutabilidad. |
| **Colas y Caché** | Redis + BullMQ | Cola asíncrona de generación masiva de planillas, caché de catálogos/parámetros legales y protección anti-replay de nonces M2M. |
| **Cálculo Paralelo** | Piscina (Worker Threads) + `decimal.js` | Motor puro de cálculo de planillas fuera del hilo HTTP principal con precisión decimal exacta. |
| **Automatización e Integración** | n8n + Canal M2M HMAC-SHA256 | Bandeja de salida (`integracion_trabajo`), despacho cron con firma HMAC-SHA256 y generación verificada (SHA-256) de archivos `.jor`/`.rem` (PLAME), AFPnet, BCP y boletas PDF. |
| **Contratos Compartidos** | `@jyp/shared-contracts` (Zod) | Single Source of Truth (SSOT) de esquemas de validación y DTOs compartidos con el frontend. |
| **Calidad y Pruebas** | Jest + SonarQube | Suite unitaria bajo el patrón **AAA (`// Arrange`, `// Act`, `// Assert`)** con cobertura global $> 80\%$ en sentencias, ramas, funciones y líneas. |

### Estructura de Módulos (`src/modules/`)

1. **`core/`**: Autenticación JWT + Cookies HttpOnly (`auth`), gestión de usuarios y perfiles (`usuarios`), y bitácora de auditoría (`audit`).
2. **`RRHH/`**: Estructura organizacional (`area`, `cargo`, `jornadas`, `empleado`, carga masiva CSV/XLSX `empleado/bulk`, `derechohabientes`), gestión de contratos y alertas de vencimiento (`contrato`), solicitudes con flujo de aprobación (`solicitudes`), tablero gerencial (`dashboard`) y bandeja de tareas operativas (`tareas`).
3. **`asistencia/`**: Registro manual y biométrico Excel (`asistencias`, `importacion`), motor determinista de evaluación diaria y feriados peruanos (`domain/`), e incidencias mensuales versionadas con huella SHA-256 (`incidencias`).
4. **`payroll/`**: Catálogo de bancos (`bancos`), AFPs y comisiones históricas SBS (`afp`), datos financieros cifrados con **AES-256-GCM** y Step-Up Auth (`datoFinanciero`), parámetros legales vigentes (`services/parametros-legales.service.ts`), y motor de planillas mensuales, novedades, desembolsos de adelantos, congelamiento contable y descarga de boletas (`planillas`).
5. **`integraciones/`**: Solicitud idempotente y descarga verificada de exportaciones (`PLAME`, `AFPNET`, `BCP_HABERES`, `BOLETAS`, `COSTOS`) y canal interno M2M para `n8n` protegido por `FirmaN8NGuard`.

---

## 2. Responsabilidad de cada Tipo de Archivo

| Pieza | Responsabilidad | Ejemplo real |
| :--- | :--- | :--- |
| **Controller** | Recibir HTTP, autenticar, comprobar roles, validar con Zod y delegar al caso de uso | `controller/gestion-asistencia.controller.ts` |
| **Caso de uso (`UseCase`)** | Representar una acción de negocio y coordinar sus reglas transaccionales | `asignarJornadaAsistencia.useCase.ts` |
| **Service de operaciones masivas** | Recorrer un lote y coordinar acciones por colaborador | `generacion-masiva-asistencia.service.ts` |
| **Service de infraestructura** | Conectar con colas BullMQ, caché Redis, despacho n8n o verificar triggers SQL | `cola-payroll.service.ts`, `esquema-asistencia.service.ts`, `despacho-n8n.service.ts` |
| **Helper** | Reutilizar pasos concretos: leer fuentes, interpretar un Excel o preparar entradas | `asistencia-contexto.helper.ts`, `preparar-planilla.helper.ts` |
| **Domain** | Calcular reglas laborales puras sin consultar PostgreSQL ni Redis | `calcular-asistencia.ts`, `calcular-planilla.ts`, `plame.ts`, `afpnet.ts`, `banco-haberes.ts` |
| **Worker** | Ejecutar cálculos intensivos fuera del Event Loop HTTP | `workers/calculo-masivo/calcular-planilla.worker.ts` |
| **Prisma y SQL** | Definir esquema, triggers de auditoría/inmutabilidad y semillas de catálogos | `prisma/schema.prisma`, `prisma/seed.ts`, `scripts/basededatos.sql` |

---

## 3. Flujo de Asistencia e Historial de Jornadas

1. **Asignación histórica de jornada**: `jornada` es el catálogo; `asistencia_jornada` conserva la copia exacta del horario que se aplicó a un colaborador desde una fecha (`desde`). Cambiar el catálogo nunca reescribe el pasado. Además, `ListarEmpleadosUseCase` consulta la vigencia histórica activa en `asistencia_jornada` para exponer siempre el horario efectivo del colaborador.
2. **Importación biométrica**: Se valida primero en seco (`POST /api/v1/asistencia/importacion/validar-excel`) y luego se confirma (`POST /api/v1/asistencia/importacion/importar-excel`), interpretando fechas y horas en zona horaria `America/Lima` y omitiendo marcas duplicadas.
3. **Evaluación diaria determinista (`evaluar-dia.ts`)**:
   - Soporta jornadas diurnas regulares de 5 o 6 días laborables (40 a 48 horas semanales, entre 4 y 8 horas diarias uniformes, con al menos 45 minutos de refrigerio).
   - Distingue entre **ausencia pendiente**, **permiso con/sin goce**, **subsidio médico** (alertando cuando se superan los 20 primeros días acumulados en el año a cargo del empleador) y **marcación incompleta**.
   - Calcula tardanza inicial (respetando `tolerancia_minutos` bajo política `COMPLETA` o `EXCESO`), tardanza en el retorno de refrigerio (sin volver a aplicar la tolerancia inicial) y sobretiempo dividido en las 2 primeras horas al **25%** y el resto al **35%** (D.S. N° 007-2002-TR).
4. **Cierre y aprobación de incidencias**: `GenerarIncidenciaEmpleadoUseCase` calcula y guarda el resumen con una huella SHA-256 (`fuente_hash`). La aprobación (`PATCH /api/v1/asistencia/incidencias/aprobar`) exige resumen completo, vigente, sin alertas pendientes y con huella idéntica a las fuentes actuales.

---

## 4. Contexto de Auditoría Transaccional (`ActorOperacion`)

```ts
export interface ActorOperacion {
  id: string; // usuarios.id autenticado en el JWT
  ip: string; // dirección IP de origen
}
```

Las operaciones mutables utilizan `transaccionAuditada(prisma, actor, callback)`, que ejecuta `set_config('app.usuario_id', actor.id, true)` y `set_config('app.ip', actor.ip, true)` con alcance estrictamente local a la transacción actual. Los triggers de PostgreSQL leen esa configuración e insertan el rastro en `audit_log` de forma atómica con el cambio de negocio.

---

## 5. Flujo de Planillas (Payroll) y Reglas Laborales

1. **Solicitud asíncrona e idempotente (`POST /api/v1/payroll/planillas/generar`)**: Encola el trabajo en BullMQ usando `solicitud_id` como clave de idempotencia y responde `HTTP 202 Accepted`.
2. **Preparación de fuentes (`preparar-planilla.helper.ts`)**:
   - `fuentes-planilla.helper.ts`: Verifica que el período no sea futuro, que la planilla esté abierta y que la incidencia mensual esté `APROBADO`, `vigente`, `completo`, sin pendientes y con `fuente_hash` intacto.
   - `parametros-planilla.helper.ts`: Verifica vigencia única para el período de `RMV`, `UIT`, `ESSALUD_PCT`, `ONP_PCT` y `VIDA_LEY_PCT`.
   - `pension-planilla.helper.ts`: Determina `ONP` (13%) o `AFP/SPP` (10% fondo + prima de seguro con tope `remuneracion_maxima_asegurable` + comisión por flujo).
   - `historial-planilla.helper.ts`: Verifica que los meses previos del ejercicio estén congelados para proyectar **Impuesto a la Renta de Quinta Categoría** con los divisores de ley (`12`, `9`, `8`, `5`, `4`, `1`) y tramos progresivos (`8%`, `14%`, `17%`, `20%`, `30%`) tras deducir las **7 UIT**.
   - `gratificacion-planilla.helper.ts`: Evalúa los meses completos trabajados en el semestre para julio y diciembre más la **Bonificación Extraordinaria del 9% (Ley N° 29351)** (o `6.75%` si cuenta con EPS).
   - `novedades-planilla.helper.ts`: Consolida bonos/descuentos visados por el contador, la determinación obligatoria del descuento dominical proporcional (**DSO**) cuando existe ausentismo, y los adelantos efectivamente desembolsados (`adelanto_desembolso`).
   - `horasDiariasPlanilla`: Obtiene las horas diarias efectivas desde `asistencia_jornada` para calcular el valor hora exacto.
3. **Cálculo en `Piscina`, verificación de huella y congelamiento**: Tras ejecutar el cálculo puro en el worker, una segunda transacción verifica que la huella de las fuentes no haya cambiado antes de persistir el `snapshot_calculo`. Cuando el contador congela la planilla (`PATCH /api/v1/payroll/planillas/:id/congelar`), se vuelve a conciliar la huella y el trigger SQL `trg_proteger_planilla` bloquea cualquier alteración posterior.

---

## 6. Módulo de Integraciones y Canal M2M con n8n

El módulo `src/modules/integraciones/` implementa el patrón **Transactional Outbox** sobre la tabla `integracion_trabajo`:

1. **Solicitud de exportación (`POST /api/v1/integraciones/exportaciones`)**: Valida que las planillas seleccionadas estén en estado `CONGELADO` o `DECLARADO` y registra el trabajo cifrando la configuración con `AES-256-GCM`.
2. **Despacho automático (`DespachoN8nService`)**: Cada 15 segundos toma los trabajos `PENDIENTE` y los envía al webhook de `n8n` (`N8N_WEBHOOK_URL_TRABAJOS`) firmando la petición con `X-Jyp-Timestamp`, `X-Jyp-Nonce` y `X-Jyp-Signature` (`HMAC-SHA256` sobre el JSON canónico).
3. **Procesamiento y descarga verificada**: `n8n` valida, reclama el trabajo, pagina las filas desde `/api/v1/integraciones/n8n/trabajos/:id/datos`, genera los archivos (**SUNAT PLAME `.jor`/`.rem` Tabla 22**, **AFPnet 141 posiciones**, **Telecrédito BCP 113/195 posiciones**, **Boletas PDF**) y registra el manifiesto con el hash `sha256` y tamaño en bytes. Al descargar el archivo o la boleta (`GET /api/v1/payroll/planillas/boleta/:id`), el backend recalcula el `sha256` en streaming antes de entregarlo.

---

## 7. Instalación, Base de Datos (Post-Drop) y Datos de Prueba

Los seeders oficiales (`prisma/seed.ts`) y el script de demostración (`scripts/datosprueba.sql`) tienen responsabilidades separadas y complementarias:

* **`npx prisma db seed` (`pnpm db:seed`)**: Siembra exclusivamente los **catálogos oficiales** (`bancos`, `tipo_documento`, `regimen_pension`, `tipo_afp`, `comisiones_afp` SBS de octubre 2026 y `parametro_legal`: `RMV`, `UIT`, `ESSALUD_PCT`, `ONP_PCT` y opcionalmente `VIDA_LEY_PCT` si está definido en `.env`).
* **`scripts/datosprueba.sql` (`pnpm db:demo`)**: Siembra exclusivamente **datos ficticios de demostración** (área, cargo, jornada de 48 horas, empleados de prueba, usuarios con clave `DemoPlanillas2026!`, datos financieros y 156 marcaciones de septiembre 2026) consultando los catálogos ya creados por el seeder. Incluye `SET client_encoding = 'UTF8';` y `SET app.entorno_pruebas = 'SI';` para que pueda ejecutarse directamente desde **VS Code SQLTools (`▷ Run`)**, **pgAdmin**, **DBeaver** o consola.

### Pasos tras eliminar o recrear la base de datos (`DROP DATABASE`)

```bash
# 1. Crear tablas y objetos/triggers SQL en una base nueva
pnpm db:crear
# (Alternativa si ya corriste `npx prisma db push`: ejecuta `pnpm db:instalar-objetos`)

# 2. Sembrar los catálogos base (bancos, AFP, comisiones, parámetros legales, documentos)
pnpm db:seed

# 3. Cargar los colaboradores, usuarios y marcaciones de demostración
pnpm db:demo
```

---

## 8. Ejecución de Pruebas Unitarias, OpenAPI y SonarQube

```bash
# Ejecutar todas las pruebas unitarias
pnpm test

# Ejecutar pruebas con reporte de cobertura LCOV para SonarQube (umbral >= 80%)
pnpm test:cov

# Verificar complejidad ciclomática (0 alertas de mantenibilidad)
pnpm check:complejidad

# Exportar especificación OpenAPI sincronizada (openapi.json)
pnpm docs:exportar
```

La especificación completa de los **92 endpoints** se encuentra documentada en español en `openapi.yml` y `openapi.json`.
