# Guía de Despliegue Local en Modo Desarrollo (`dev`) — Sistema de Planillas J&P Periféricos S.A.C.

Esta guía detalla paso a paso cómo levantar desde cero el backend (`bella-planillas-backend`) y su infraestructura asociada (PostgreSQL, Redis, n8n y Mailpit) en cualquier estación de trabajo local para desarrollo (`NODE_ENV=development`).

## 1. Requisitos Previos

Asegúrese de contar con las siguientes herramientas instaladas en el equipo host:

| Herramienta | Versión Recomendada | Comando de Verificación |
| :--- | :--- | :--- |
| **Node.js** | `>= 22.x LTS` | `node -v` |
| **pnpm** | `>= 10.x / 11.x` | `pnpm -v` |
| **Docker Desktop / Engine** | Docker Compose v2 | `docker compose version` |
| **Git** | `>= 2.40` | `git --version` |

## 2. Configuración de Variables de Entorno (`.env`)

En la raíz del proyecto (`bella-planillas-backend/`), cree un archivo llamado `.env`. Puede utilizar la siguiente plantilla lista para desarrollo local:

```dotenv
# ==============================================================================
# 1. ENTORNO LOCAL Y SERVIDOR HTTP (NESTJS + FASTIFY)
# ==============================================================================
NODE_ENV='development'
PORT=3000

FRONTEND_ORIGINS='http://localhost:5173'
FRONTEND_RESET_PASSWORD_URL='http://localhost:5173/restablecer-password'

# ==============================================================================
# 2. BASE DE DATOS POSTGRESQL Y PRISMA ORM
# ==============================================================================
DB_USER='postgres'
DB_PASSWORD='bella'
DB_NAME='planillas_db'

DATABASE_URL='postgresql://postgres:bella@localhost:5432/planillas_db?schema=public'
DIRECT_URL='postgresql://postgres:bella@localhost:5432/planillas_db?schema=public'

# ==============================================================================
# 3. INFRAESTRUCTURA REDIS (COLAS BULLMQ, CACHÉ E HISTORIAL DE NOTIFICACIONES)
# ==============================================================================
REDIS_HOST=localhost
REDIS_PORT=6379

# ==============================================================================
# 4. SEGURIDAD, SESIONES, TOKENS JWT Y CIFRADO FINANCIERO AES-256-GCM
# ==============================================================================
# Todas las llaves criptográficas deben tener al menos 32 caracteres.
COOKIE_SECRET='jyp_bella_cookie_super_secret_key_2026_min_32_chars'
JWT_ACCESS_SECRET='jyp_bella_access_jwt_secret_key_2026_min_32_chars'
JWT_REFRESH_SECRET='jyp_bella_refresh_jwt_secret_key_2026_min_32_chars'
FINANCIAL_DATA_ENCRYPTION_KEY='jyp_financial_master_key_super_secret_32_bytes_2026!'

# ==============================================================================
# 5. PARÁMETROS OPERATIVOS Y DATOS DE EMPRESA
# ==============================================================================
EMPRESA_NOMBRE='J&P PERIFERICOS S.A.C.'
EMPRESA_RUC='20601234567'
EMPRESA_DIRECCION='Av. Principal 123, Lima, Perú'

DIA_PAGO_PLANILLA='ULTIMO'
DIAS_AVISO_PAGO=3
DIAS_AVISO_SOLICITUD=2
UPLOAD_DIR='./archivos'

# ==============================================================================
# 6. INTEGRACIÓN CON N8N Y CORREO DE PRUEBAS (MAILPIT)
# ==============================================================================
N8N_DB_PASSWORD='n8n_local_db_password_2026'
N8N_ENCRYPTION_KEY='jyp_n8n_encryption_key_stable_2026_min_32_chars'
N8N_WEBHOOK_SECRET='jyp_n8n_hmac_webhook_secret_key_2026_min_32_chars'
N8N_WEBHOOK_URL='http://localhost:5678/'
N8N_WEBHOOK_URL_TRABAJOS='http://localhost:5678/webhook/jyp/trabajos'
N8N_CORREOS_MODO='SMTP'
ARCHIVOS_INTEGRACION_DIR='./archivos/integraciones'

SMTP_HOST='mailpit'
SMTP_PORT=1025
SMTP_FROM='planillas@example.test'
SMTP_SECURE='false'
SMTP_REQUIRE_TLS='false'
```

## 3. Instalación de Dependencias y Generación del Cliente Prisma

Abra una terminal en la raíz del repositorio y ejecute los siguientes comandos en orden para instalar los paquetes y generar los tipos y el cliente de Prisma ORM:

```bash
# 1. Instalar todas las dependencias del proyecto
pnpm install

# 2. Generar el cliente tipado de Prisma a partir de prisma/schema.prisma
pnpm prisma generate
```

## 4. Despliegue de Contenedores con Docker Compose

Cuando se desarrolla localmente ejecutando NestJS desde la terminal con recarga en caliente (`pnpm start:dev`), **solo se deben levantar los contenedores de infraestructura** (evitando iniciar el contenedor `backend` para no ocupar el puerto `3000`).

### 4.1 Verificar `JYP_BACKEND_URL` en `docker-compose.yml` (Modo Desarrollo Local)
Para que el contenedor `n8n` pueda comunicarse con el backend que corre en su máquina host (`localhost:3000`), asegúrese de que en `docker-compose.yml` dentro del servicio `n8n` la variable `JYP_BACKEND_URL` apunte a `host.docker.internal`:

```yaml
  n8n:
    # ...
    environment:
      JYP_BACKEND_URL: http://host.docker.internal:3000
```

### 4.2 Iniciar los contenedores de infraestructura
Ejecute el siguiente comando desde la raíz del proyecto:

```bash
docker compose up -d --build archivos-permisos postgres redis n8n-postgres n8n mailpit
```

Verifique que todos los contenedores estén saludables (`healthy` / `running`):

```bash
docker compose ps
```

| Servicio | Contenedor / Imagen | Puerto en Host | Propósito |
| :--- | :--- | :--- | :--- |
| `postgres` | `planillas_db` (`postgres:17-alpine`) | `localhost:5432` | Base de datos principal del sistema de planillas |
| `redis` | `planillas_redis` (`redis:7-alpine`) | `localhost:6379` | Colas BullMQ, caché de catálogos y alertas en tiempo real |
| `n8n-postgres` | `postgres:17-alpine` | *(Red interna)* | Base de datos exclusiva para workflows de n8n |
| `n8n` | `jyp-n8n-local:2.44.6` | `http://localhost:5678` | Motor de automatización para generación de boletas/TXT y envío de correos |
| `mailpit` | `axllent/mailpit:v1.32.0` | `http://localhost:8025` | Bandeja web SMTP local para inspeccionar correos enviados |

## 5. Creación del Esquema de Base de Datos, Objetos SQL y Seed Base

El contenedor `postgres` inicia con una base de datos vacía (`planillas_db`). Ejecute los siguientes comandos en orden para construir las tablas, instalar los triggers/vistas/funciones SQL y poblar los catálogos iniciales:

```bash
# 1. Crear todas las tablas, tipos ENUM, índices y llaves foráneas (ejecuta scripts/basededatos.sql)
pnpm db:crear

# 2. Instalar triggers de auditoría, bloqueos de inmutabilidad, vistas y funciones SQL
#    (ejecuta prisma/asistencia-payroll-instalar-objetos.sql)
pnpm db:instalar-objetos

# 3. Ejecutar el seeder base de Prisma (catálogos, regímenes pensionarios, parámetros y usuarios base)
pnpm db:seed
```

## 6. Carga Opcional de Datos de Prueba (Demo)

Si desea poblar la base de datos con áreas, cargos, colaboradores, contratos, horarios, marcaciones de asistencia y planillas de ejemplo para probar todos los módulos inmediatamente, elija **una** de las siguientes opciones:

### Opción A: Dataset de Prueba Estándar
Carga el conjunto de datos de prueba principal (`scripts/datosprueba.sql`) junto con los objetos SQL:

```bash
pnpm db:demo
```

### Opción B: Dataset Extendido (10 Colaboradores con Escenarios Completos)
Carga el escenario extendido ubicado en `scripts/pruebas-demo/datosprueba.sql`:

```bash
node scripts/aplicar-sql.cjs demo-10
```

## 7. Configuración del Flujo de Integración en n8n (Opcional para Boletas y Haberes)

Si va a probar la exportación de archivos bancarios (BCP / Interbank), PLAME (`.rem` / `.jor`) o el despacho de boletas de pago por correo:

1. Ingrese a `http://localhost:5678` en su navegador y complete el registro inicial de propietario de n8n.
2. Importe el archivo de flujo ubicado en `n8n/workflows/` desde el menú **Workflows -> Import from File**.
3. Active el flujo cambiando el interruptor superior derecho de **Inactive** a **Active** (modo publicado) para que el webhook `/webhook/jyp/trabajos` escuche de forma permanente sin necesidad de presionar *Execute workflow* manualmente.
4. Abra `http://localhost:8025` (Mailpit) para visualizar en tiempo real las boletas PDF cifradas y reportes enviados por correo.

## 8. Ejecución del Servidor Backend en Modo Desarrollo

Con la base de datos lista y los contenedores activos, inicie el servidor NestJS en modo `watch`:

```bash
pnpm start:dev
```

Una vez iniciado el servidor, tendrá disponibles los siguientes puntos de acceso:

* **API Base URL**: `http://localhost:3000/api/v1`
* **Documentación Interactiva Swagger (OpenAPI)**: `http://localhost:3000/api/docs`
* **Gateway WebSocket de Notificaciones**: `ws://localhost:3000/ws/notificaciones`

## 9. Comandos Útiles de Verificación y Diagnóstico

| Tarea | Comando |
| :--- | :--- |
| Ejecutar todas las pruebas unitarias | `pnpm test:unit` |
| Ejecutar pruebas del módulo `common` (incl. Notificaciones) | `pnpm test:common` |
| Ejecutar pruebas de asistencia | `pnpm test:asistencia` |
| Ejecutar pruebas de nómina | `pnpm test:nomina` |
| Verificar compilación TypeScript | `pnpm build` |
| Ver logs en vivo de n8n | `docker compose logs -f n8n` |
| Reiniciar completamente la BD desde cero (borra volúmenes) | `docker compose down -v` |
