# Instalación de la base de datos: dos rutas alternativas

## Qué hace cada pieza

| Pieza | Propósito |
|---|---|
| `schema.prisma` y db push | Sincronizar tablas, columnas, relaciones, índices y enums del modelo |
| prisma generate | Generar los tipos y el cliente con el que Node consulta la BD |
| `prisma/asistencia-payroll-instalar-objetos.sql` | Instalar funciones SQL, triggers y restricciones adicionales que no están representadas por db push |
| prisma db seed | Cargar catálogos y parámetros iniciales; no empleados/cargos/áreas/jornadas/solicitudes |
| `datosprueba.sql` | Cargar únicamente la demostración opcional en una base de pruebas |
| `basededatos.sql` | Ruta alternativa de instalación completa: incluye estructura y protecciones |
| `prisma/preflight-legajo.sql` | Diagnóstico de legajos incompletos antes de actualizar una BD existente |
| `prisma/revision-preflight.sql` | Comprobación interna del esquema; ya está incluida en el instalador de protecciones |
| `prisma/restricciones-estabilizacion.sql` | Fuente de restricciones ya incorporadas en el instalador y en el SQL completo |
| `prisma/migrations/.../migration.sql` | Incrementos versionados para esquemas anteriores, no archivos que se deban ejecutar todos después de db push |

## Ruta A — db push, para una base nueva del MVP/desarrollo

Desde la raíz del backend, con sus dependencias instaladas y DATABASE_URL apuntando a la base correcta:

```bash
pnpm exec prisma db push
pnpm exec prisma generate
```

Después, abre tu cliente SQL conectado a ESA MISMA base y ejecuta **un único archivo**:

```text
prisma/asistencia-payroll-instalar-objetos.sql
```

Finalmente, desde el backend:

```bash
pnpm exec prisma db seed
```

El orden recomendado queda: **estructura → cliente Prisma → protecciones → catálogos → datos demo opcionales**. En Prisma 7, db push no invoca generate automáticamente. Los seeders utilizan tsx: ejecutarlos desde el checkout/entorno de despliegue con las dependencias necesarias, antes de usar una imagen final que haya eliminado dependencias de desarrollo.

No ejecutes además basededatos.sql. No hace falta ejecutar restricciones-estabilizacion.sql, revision-preflight.sql y cada migración uno por uno: el instalador ya reúne las protecciones correspondientes.

Si usas la CLI psql para ejecutar archivos, recuerda que psql no carga .env por sí solo. Prisma sí lo lee mediante prisma.config.ts. Puedes usar una conexión configurada en tu cliente SQL, o cargar la variable de conexión de tu shell sin publicarla ni guardarla en documentación.

### Datos de prueba opcionales

Solo en una base exclusiva de pruebas, después del seed:

```sql
SET app.entorno_pruebas = 'SI';
-- Ejecutar datosprueba.sql en esta misma conexión/sesión.
```

La fixture está separada del seeder y contiene personas y credenciales públicas DEMO. No se carga para inicializar producción.

## Ruta B — SQL completo, también para una base nueva

En lugar de db push, ejecuta `basededatos.sql` en una base vacía mediante el cliente SQL conectado al servidor elegido. Ya incluye tablas, funciones, triggers y restricciones.

Luego genera el cliente del backend y carga los catálogos:

```bash
pnpm exec prisma generate
pnpm exec prisma db seed
```

Los datos demo son opcionales y van al final, igual que en la ruta A. No se ejecuta otra vez el instalador de protecciones ni se mezcla esta ruta con db push para crear las mismas tablas dos veces.

Esta ruta no exige Python: se utiliza el SQL que ya está generado. Los scripts Python solo se necesitan si se quiere regenerar su presentación documentada.

## Base con información existente

Las dos rutas anteriores describen instalaciones nuevas. Para una base con datos reales, revisa primero los incrementos aplicados y ejecuta `prisma/preflight-legajo.sql` antes del incremento de legajo/enum de esta revisión. No utilices el SQL completo para actualizarla.

La migración `20261022220000_listados_legajo_enum/migration.sql` exige campos personales completos y verifica el catálogo legado antes de retirarlo. No inventa datos ni utiliza DROP CASCADE. Una base anterior de otro diseño necesita revisar su recorrido de actualización; no basta con ejecutar todos los SQL en cualquier orden.

## Azure y otros hosts

Que PostgreSQL esté en otro host no impide ejecutar db push, seed o un archivo SQL. Cambian la conexión, los permisos de red y la configuración TLS del proveedor; todos los pasos deben apuntar a la misma base.

Para una aplicación ejecutada fuera de Compose, configura DATABASE_URL con la conexión del servidor remoto. Dentro del Compose LOCAL entregado, DATABASE_URL se construye expresamente con el host `postgres`; cambiar solo la variable DATABASE_URL del .env no sustituye esa expresión del YAML. Un despliegue con BD administrada debe usar su URL externa en la configuración del backend y revisar la dependencia del PostgreSQL local.

En producción, el objetivo es aplicar migraciones versionadas con `prisma migrate deploy`, incluyendo el SQL personalizado, desde el proceso de despliegue. El historial recibido no es una línea base completa desde cero: no se debe recomendar migrate deploy como instalador de una base vacía sin preparar antes esa línea base. db push no registra historial en _prisma_migrations.

## Vida Ley y empresa

EMPRESA_NOMBRE/RUC/DIRECCION son datos temporales del MVP, no secretos. Se mantienen porque el código todavía los lee para la cabecera/snapshot de la planilla. La incorporación de Empresa debe sustituir esa lectura con la empresa asociada al empleado y conservar la información histórica de cada boleta.

El seeder puede recibir SEED_VIDA_LEY_PCT/DESDE/HASTA para una carga inicial explícita. Ya guarda el dato en parametro_legal y el cálculo consulta la BD, no el .env. La tarifa corresponde a una póliza empresarial; el motor actual solo representa una tasa por vigencia, sin tramos por edad.

## Comprobación de este orden, 25/10/2026

Se probó la ruta A en una base aislada: db push, instalador de protecciones, repetición del instalador, seeders y fixture opcional. Se comprobó que la ruta B instala los mismos nombres de tablas, funciones y triggers. El registro está en `docs/evidencias/instalacion-dbpush-2026-10-25.log`.

La comprobación utilizó PostgreSQL WASM. No se ejecutó sobre Azure ni acredita concurrencia en PostgreSQL nativo. Tampoco se levantaron los contenedores Docker de esta entrega documental.

Referencias: [Prisma 7: db push](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/prototyping-your-schema), [configuración de n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/endpoints).
