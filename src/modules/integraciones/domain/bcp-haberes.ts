//src/modules/integraciones/domain/bcp-haberes.ts
//Re-exporta las funciones de estructura de haberes BCP para compatibilidad con el ejecutor n8n (`n8n/tareas/exportar.cjs`).
export { cuentaAbono, cabeceraBanco, cabeceraBcp, detalleBcp } from './banco-haberes';
