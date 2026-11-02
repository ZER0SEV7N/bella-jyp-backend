//src/workers/calculo-masivo/calcular-planilla.worker.ts
import { calcularPlanilla } from '../../modules/payroll/planillas/domain/calcular-planilla';
import type { EntradaPlanilla } from '../../modules/payroll/planillas/domain/planilla.types';

//Este hilo solo recibe datos, calcula y devuelve cadenas decimales. No importa NestJS ni Prisma.
export default function ejecutarCalculo(entrada: EntradaPlanilla) { return calcularPlanilla(entrada); }
