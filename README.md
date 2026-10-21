### Proyecto Backend del sistema de planillas : Documentacion 

# Guía del código de asistencia y planillas

Revisión del 21/10/2026 sobre el ZIP adjuntado por Daniel. Este documento explica lo que existe, las correcciones realizadas y sus límites. No afirma que todos los requerimientos del producto estén terminados.

## 1. Qué se tomó de tus documentos y qué se decidió al implementar

La estructura modular y los casos de uso separados corresponden a los documentos de arquitectura. La carga de asistencia, las incidencias, el cálculo masivo, el visado del contador, la auditoría y las boletas corresponden a los casos de uso y requerimientos funcionales.

Las huellas SHA-256, la copia del horario por vigencia, la versión del motor, las transacciones serializables y los bloqueos por colaborador son decisiones técnicas para proteger esos flujos. Los documentos no especifican necesariamente esos mecanismos concretos. La restricción anterior a 40 horas fue una suposición de alcance demasiado estrecha: se corrigió.

No sería honesto asegurar que cada decisión anterior fue contrastada con todos los documentos ni que todos los casos del producto están implementados. La matriz adjunta distingue comportamiento comprobado, implementación parcial y trabajo pendiente. Se contrastaron los textos 18 (casos de uso), 19 (SRS), 20 y 21 (arquitectura). No se realizó una nueva revisión bibliográfica de los 17 artículos académicos: no sustituyen las reglas concretas del negocio.

Hay diferencias entre tus documentos: unas secciones asignan el cierre al administrador y otras al contador; una arquitectura exige contexto implícito mediante CLS y otra permite casos de uso directos con Prisma; algunos apartados delegan los PDF enteramente a n8n. La revisión conserva el cierre por CONTADOR y el PDF de descarga existente. Estas diferencias están identificadas, no resueltas afirmando que todo cumple simultáneamente.

## 2. Para qué sirve cada clase de archivo

| Pieza | Responsabilidad | Ejemplo real |
|---|---|---|
| Controller | Recibir HTTP, autenticar, comprobar roles, validar Zod y llamar al caso de uso | `controller/gestion-asistencia.controller.ts` |
| Caso de uso | Representar una acción del usuario y coordinar sus reglas | `asignarJornadaAsistencia.useCase.ts` |
| Service de operaciones masivas | Recorrer un lote y coordinar acciones por empleado | `generacion-masiva-asistencia.service.ts` |
| Service de infraestructura | Conectar con una cola o verificar infraestructura | `cola-payroll.service.ts`, `esquema-asistencia.service.ts` |
| Helper | Reutilizar un paso concreto: leer fuentes, interpretar un Excel o preparar datos | `asistencia-contexto.helper.ts`, `preparar-planilla.helper.ts` |
| Domain | Calcular reglas sin consultar PostgreSQL o Redis | `calcular-asistencia.ts`, `calcular-planilla.ts` |
| Worker | Ejecutar un cálculo pesado fuera del hilo HTTP | `workers/calculo-masivo/calcular-planilla.worker.ts` |
| Prisma y SQL | Definir persistencia; SQL añade funciones, triggers y restricciones que el modelo no expresa | `schema.prisma`, `basededatos.sql` |

Un service no significa automáticamente una acción masiva. Los services de infraestructura siguen siendo apropiados: un nombre como `EsquemaAsistenciaService` representa una comprobación de arranque, no una acción de usuario. Las acciones de crear, consultar, resolver, aprobar y congelar permanecen en casos de uso separados. El servicio de parámetros existente consulta la base y utiliza Redis como caché; el cierre financiero comprueba las fuentes directamente dentro de una transacción.

## 3. Recorrido de asistencia, paso a paso

1. RRHH configura un horario y lo asigna al empleado desde una fecha concreta.
2. El biométrico produce el Excel. Se puede validar sin guardar y después importar el mismo contenido.
3. La importación identifica al empleado por documento, interpreta fecha y hora en Perú, detecta duplicados y verifica que el período sea editable. Guarda marcas originales y su auditoría.
4. El cálculo carga un contexto: ingreso/cese, jornadas históricas, marcas, solicitudes relevantes, decisiones y calendario.
5. `evaluar-dia.ts` coordina la evaluación de cada fecha. Sus colaboradores separan preparación, ausencia, intervalos, permisos y marcaciones.
6. `GenerarIncidenciaEmpleadoUseCase` guarda el resumen y el detalle diario. Generar no equivale a aprobar.
7. RRHH revisa pendientes. Si corresponde, registra una decisión con motivo. La decisión complementa la evidencia; no borra las marcas del biométrico.
8. La aprobación exige resumen completo, vigente, sin pendientes y con la misma huella que sus fuentes actuales.

### Los services de asistencia

| Archivo | Qué hace | Transacción |
|---|---|---|
| `importar-marcaciones.service.ts` | Inserta un lote validado, omite duplicados y conserva su origen | Atómica para ese archivo/lote admitido |
| `generacion-masiva-asistencia.service.ts` | Selecciona empleados por período/filtros y procesa páginas | Una transacción por empleado; devuelve errores por fila en un lote general |
| `aprobacion-masiva-asistencia.service.ts` | Verifica y aprueba hasta 100 resúmenes | Una transacción para el lote; si uno falla, no se aprueba parcialmente |
| `esquema-asistencia.service.ts` | Comprueba versión SQL y diez triggers críticos | Sólo consulta al arrancar; no instala DDL automáticamente |

Los límites del lote evitan transacciones demasiado grandes. Más de cien aprobaciones requieren filtrar por colaborador con la API actual. No hay una promesa medida de procesar mil empleados en menos de diez segundos.

### Ausencia, permiso y marca incompleta son cosas diferentes

Una entrada sin salida genera pendiente; no se transforma automáticamente en una falta descontable. Una ausencia sin evidencia también requiere revisión. Un permiso aprobado necesita indicar su efecto: `CON_GOCE`, `SIN_GOCE` o, cuando corresponda médicamente, `SUBSIDIO`. Aprobar el trámite no basta para decidir su tratamiento económico.

Se corrigió la evaluación de solicitudes porque la versión adjunta no guardaba `efecto_asistencia`; también se recuperó la persistencia de las horas de los permisos. Un permiso de 09:00 a 09:10 debe conservar esas horas para cruzarlo con las marcas. Las fechas imposibles, como 2026-02-30, ahora responden HTTP 400.

Los descansos médicos que requieren tratamiento de subsidios y determinados acumulados no se liquidan inventando importes: el motor mantiene bloqueos y pendientes para los casos no cubiertos. Las jornadas nocturnas y rotativas requieren reglas adicionales.

## 4. Una jornada efectiva por fecha, con historial

`jornada` es el catálogo del horario. `asistencia_jornada` conserva la copia que se aplicó a una persona desde una fecha. Cambiar el catálogo no debe reescribir el pasado.

Ejemplo:

| Desde | Jornada | Efecto |
|---|---|---|
| 01/09 | 40 horas | Se usa hasta el 31/10 |
| 01/11 | Nuevo horario de 40 horas | Sustituye al anterior desde el 01/11 |
| 01/12 | 48 horas | Se usa desde diciembre |

El motor selecciona la última vigencia cuya fecha `desde` sea menor o igual al día evaluado. Por eso pueden existir varias filas históricas, pero sólo se selecciona una para una fecha. La combinación empleado/desde es única. La asignación toma un bloqueo por empleado y responde 409 si ya existe una vigencia con el mismo inicio. Además rechaza inicios anteriores al ingreso.

**Límite que permanece:** `empleados.jornada_id` es una referencia del legajo; no se sincroniza automáticamente con las asignaciones futuras. La asistencia usa el historial. Una pantalla que muestre exclusivamente esa referencia puede mostrar un horario diferente al efectivo. No se añade un cron que reescriba esa columna sin una definición de negocio; debe consultarse el horario efectivo al construir esa pantalla.

### Las 48 horas y el valor hora

La jornada ordinaria máxima se expresa en ocho horas diarias o cuarenta y ocho semanales, con reglas particulares para redistribuciones y jornadas atípicas. No significa que todas las personas deban trabajar 48 horas ni que sus horas adicionales sólo empiecen al alcanzar ese máximo.

El alcance mensual actual admite jornadas diurnas regulares, de duración diaria uniforme entre cuatro y ocho horas efectivas, cinco o seis días laborables y hasta 48 horas semanales. Admite el horario anterior de 40 horas y el de lunes a sábado con 48. Excluye cruce de medianoche y horas fuera de 06:00–22:00. Exige refrigerio configurado de al menos 45 minutos, descontado del tiempo efectivo. Estos límites describen este motor, no todos los regímenes que permite la legislación.

Ejemplo: 08:00–17:00, con descanso de 12:00–13:00, son ocho horas efectivas. De lunes a sábado suman 48. El campo total declarado debe coincidir con esa suma.

`horas-jornada.helper.ts` obtiene la duración diaria para preparar payroll. Si la persona tiene seis horas diarias uniformes, el cálculo recibe seis en lugar de una constante ocho. Se usa Decimal para convertir los minutos a horas. Cambiar la duración diaria a mitad de mes se rechaza expresamente: requiere liquidación por tramos, todavía no implementada. Los catálogos marcados TIEMPO_PARCIAL y los regímenes especiales necesitan reglas propias de beneficios; no se admiten en esta generación mensual.

## 5. Qué representa ActorOperacion

```ts
interface ActorOperacion {
    id: string; // usuarios.id, no empleados.id
    ip: string; // origen de la petición
}
```

No crea una tabla, no es un rol y no concede permisos. Los guards resuelven la autorización; este objeto conserva quién ejecutó una acción. El controlador lo construye a partir del usuario autenticado y la IP, sin confiar en un usuario enviado en el cuerpo HTTP.

La transacción utiliza `set_config('app.usuario_id', ..., true)` y `set_config('app.ip', ..., true)`. El último argumento hace que el contexto sea local a esa transacción: no debe pasar accidentalmente al siguiente usuario de una conexión reutilizada. Los triggers leen ese contexto e insertan la auditoría junto con el cambio. Si la transacción se revierte, también se revierte la auditoría.

Sí se relaciona con auditoría y solicitudes en este sentido: crear, tomar revisión, evaluar o anular una solicitud debe propagar el usuario y la IP a la escritura. No necesita una relación llamada `actor_operacion` en Prisma. `solicitud.empleado_id` identifica al beneficiario; `responsable_id` al revisor; `ActorOperacion.id` a quien ejecutó esa operación concreta. Pueden ser personas distintas.

Se corrigieron esas cuatro escrituras porque habían quedado fuera del contexto transaccional de auditoría. Los casos de uso siguen separados.

## 6. Recorrido de payroll

1. El usuario solicita generar por período, empleado o área. `solicitarGeneracionPlanilla.useCase.ts` coordina esa petición.
2. `ColaPayrollService` guarda un trabajo BullMQ en Redis y devuelve HTTP 202 con su URL de consulta. `solicitud_id` es aquí una clave de idempotencia del trabajo, no el ID de un permiso o adelanto de RRHH.
3. Repetir la misma clave con el mismo contenido recupera el trabajo; usarla con otro contenido produce conflicto.
4. `ProcesamientoMasivoPlanillasService` recorre empleados por páginas. El procesamiento actual es secuencial por colaborador dentro del trabajo; tener un pool no garantiza paralelismo masivo del lote.
5. `GenerarPlanillaUseCase` abre una transacción corta para preparar las fuentes. La asistencia debe estar aprobada y conservar su huella.
6. El cálculo puro se ejecuta mediante Piscina fuera de esa transacción inicial.
7. Otra transacción vuelve a leer fuentes y compara la huella. Si cambiaron durante el cálculo, no guarda un resultado mezclado.
8. Si las fuentes siguen iguales, guarda montos, versión y una instantánea con entradas, resultado y datos de cabecera. Una regeneración idéntica no crea otra planilla.
9. El contador revisa y congela la versión consultada. Se recalcula y concilia antes del cierre. La implementación de congelamiento mantiene esa verificación dentro de su transacción; no se declara resuelto un ensayo de alta concurrencia.
10. La boleta se reconstruye desde la instantánea congelada. Si cambian el nombre del cargo o una tasa posteriormente, no se sustituye la información ya capturada en esa boleta.

### Qué separan los helpers

| Helper | Pregunta que resuelve |
|---|---|
| `fuentes-planilla` | ¿La asistencia aprobada y las fuentes corresponden al empleado y período? |
| `parametros-planilla` | ¿Existe exactamente una vigencia de cada parámetro obligatorio? |
| `pension-planilla` | ¿Corresponde ONP o AFP y qué comisión está vigente? |
| `historial-planilla` | ¿Están los meses anteriores necesarios para acumulados y quinta? |
| `gratificacion-planilla` | ¿Hay meses computables admitidos por la regla actual? |
| `novedades-planilla` | ¿Qué bonos/descuentos fueron visados y qué adelantos realmente se entregaron? |
| `horas-jornada` | ¿Qué duración diaria se debe usar para calcular el valor hora? |
| `preparar-planilla` | ¿Cómo reúno esas respuestas en una entrada y una huella verificable? |

El motor de dominio separa remuneración, pensión, quinta, beneficios y redondeo. Usa Decimal para dinero y cuatro decimales en los importes persistidos. Los minutos y contadores de días usan enteros; el monto salarial no debe sumarse mediante `Number`.

Un adelanto aprobado no significa dinero entregado. `adelanto_desembolso` registra la entrega real y evita descontar dos veces la misma solicitud. `novedad_planilla` registra un bono o descuento y su revisión por el contador. No implementa por sí sola todos los tipos de comisión, préstamo o concepto variable del documento.

### El error de TypeScript sobre unknown

Una transacción es una función que devuelve el resultado de otra función. Si se pierde su tipo genérico, TypeScript ya no sabe que ese resultado tiene `entrada` y `hash`. La revisión hace explícitos `$transaction<T>`, el tipo `PlanillaPreparada` y su uso en generación. No se corrigió ocultando el problema con `as any`.

### Qué protege el cierre y qué no implementa

Los triggers bloquean actualizar o borrar una planilla congelada, y bloquean cambios incompatibles en fuentes de asistencia. El contador debe ser un usuario activo y la incidencia aprobada debe coincidir con la versión calculada.

**No hay reapertura excepcional de planilla implementada.** Reabrir una incidencia antes del cierre es otra operación. Tampoco existe todavía una transición permitida desde CONGELADO a DECLARADO: el trigger conserva la inmutabilidad estricta. Estas dos necesidades deben diseñarse como acciones explícitas y auditadas, no resolverse deshabilitando el trigger.

## 7. Swagger y Zod

`common/decorators/api-contrato.decorator.ts` es reutilizable por todo el backend, no exclusivo de asistencia. Convierte los contratos Zod 3 del paquete compartido a esquemas OpenAPI y documenta la entrada HTTP anterior a transformaciones como string → Date. Los decorators de cada módulo añaden descripción, roles y respuestas.

No migra mágicamente los otros módulos a este estilo. La dependencia compartida incluida usa Zod 3; el proyecto también instala Zod 4, y este adaptador no debe usarse con esquemas Zod 4 sin un ajuste explícito. Tampoco reemplaza al `ZodValidationPipe`: documentar no valida ni autoriza.

Se repuso el decorator que faltaba en la consulta de incidencias. La prueba compara los 22 endpoints de asistencia/planillas con sus contratos y roles reales. `openapi.json` se genera desde la aplicación montada. Se unificaron las rutas de estos dominios en `/api/v1`; los clientes deben actualizar las rutas antiguas.

La descarga de plantilla de marcaciones permanece retirada. La plantilla de carga masiva de empleados sigue disponible. Importar el Excel del biométrico sigue requiriendo mapear sus columnas al formato admitido; no se declara compatible cualquier exportación de cualquier marca de reloj.

## 8. SQL, modelo y seeders

Prisma describe tablas y tipos; `prisma generate` sólo genera el cliente. Ni ese comando ni `db push` instalan estas funciones y triggers propios. Por eso la aplicación puede compilar y aun así fallar al arrancar por la función de versión ausente.

`basededatos.sql` se reconstruye desde `schema.prisma` y añade las protecciones SQL. Es para una base vacía. El instalador separado añade/reemplaza funciones y triggers en una base que ya tenga las tablas y columnas actuales. Ambos se generan con `scripts/construir-sql.py` para evitar mantener dos versiones manuales distintas.

El SQL original mezclaba nombres antiguos (`empleado`) y estados en minúsculas con código que usa `empleados` y enums en mayúsculas. No es una línea base intercambiable. La migración que faltaba se recuperó, pero no basta para transformar automáticamente cualquier versión antigua. Sigue las rutas de instalación; no ejecutes migraciones históricas a ciegas sobre una base ya creada.

Los seeders crean bancos, documentos de identidad, regímenes de pensión, AFP y parámetros/tasas con vigencia. No crean empleados, cargos, áreas, usuarios, horarios ni solicitudes. Buscan registros existentes, no sobrescriben tasas y se ejecutan dentro de una transacción con bloqueo para evitar dos siembras simultáneas. Las discrepancias detienen la siembra para que no se borren decisiones anteriores.

Las tasas AFP verificadas se cargan sólo para octubre de 2026: prima 1,37 %, aporte 10 %, flujo mixto 0 % y tope asegurable S/12.732,70. La tasa anual sobre saldo se conserva como dato separado. No se extienden esos valores indefinidamente a meses futuros.

La RMV se conserva por vigencia: S/1.130 desde enero de 2025 hasta septiembre de 2026; S/1.230 desde octubre de 2026, según las fuentes consultadas. La UIT 2026 es S/5.500. No se adelantó el segundo tramo de RMV anunciado para 2027. Vida Ley requiere la tasa real y las fechas de la póliza: no se mantiene 1,25 % como una ley universal.

`datosprueba.sql` es una demostración aparte: tres personas ficticias, usuarios de prueba y marcas para septiembre con 48 horas. No contiene TRUNCATE ni borra tablas. La tarifa Vida Ley marcada DEMO es ficticia y sólo sirve para esa prueba.

## 9. Por qué están esas tablas

| Tablas | Justificación / estado |
|---|---|
| `asistencia_marcacion` | Evidencia original del reloj o registro manual |
| `asistencia_jornada` | Horario histórico efectivo; evita alterar el pasado al editar el catálogo |
| `asistencia_decision` | Resoluciones motivadas sin destruir evidencia |
| `asistencia_calendario` | Descansos adicionales configurados; complementa feriados nacionales |
| `incidencias_mes` | Resumen revisable, aprobado y versionado que consume payroll |
| `historial_planillas` | Montos e instantánea del cálculo y su cierre |
| `novedad_planilla` | Conceptos variables y su visado independiente |
| `adelanto_desembolso` | Evidencia de entrega real, distinta de la solicitud aprobada |
| `vinculo_laboral`, `historial_remuneracion` | Propuesta de historia laboral/salarial; el motor actual no las utiliza como fuente histórica completa |
| `periodo_vacacional`, `vacacion`, `vacacion_imputacion`, `liquidacion`, `liquidacion_concepto` | Modelo preparado para beneficios; no demuestra que existan sus casos de uso |
| `estado_contrato` junto al enum | Compatibilidad heredada. Los contratos nuevos usan principalmente el enum; revisar retiro mediante migración específica |

No se borraron las tablas futuras ni las de compatibilidad porque no se recibió una base con la que verificar sus datos/referencias. **No son necesarias todas para calcular la planilla mensual regular.** Antes de un despliegue limpio puede aprobarse un esquema MVP reducido; eliminarlas de una instalación existente exige una migración revisada. Esta entrega no incorpora empresa/sucursal ni promete aislamiento multiempresa: la cabecera de empresa todavía proviene de variables de entorno.

## 10. Resultado verificable y pendientes

La compilación, la validación Prisma, los tipos del seeder, las reglas de complejidad del alcance y las pruebas específicas se registran en `VALIDACION.md`. No equivalen a una certificación contable ni a la aprobación de todo el SRS.

Quedan pendientes: sanear la suite Jest general, ejecutar concurrencia sobre PostgreSQL nativo 16, contrastar casos reales de cierre con el contador, incorporación de acumulados anteriores a la implantación, liquidaciones y CTS, beneficios extraordinarios completos, jornadas especiales, reapertura excepcional, transición de declaración, portal/cifrado/firma digital y exportaciones/integración n8n. La matriz detalla el estado por requisito.

Para comenzar n8n debe definirse además un evento de cierre durable con reintentos e idempotencia. Consultar un trabajo de BullMQ o descargar un PDF no implementa ese contrato de integración. Esta revisión prepara y verifica el flujo regular; no oculta esos faltantes.
