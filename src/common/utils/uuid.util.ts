//src/common/utils/uuid.util.ts
//Genera un UUIDv7 para identificar de manera única los registros en la base de datos
import { v7 as uuidv7 } from 'uuid';

export class IdentityGenerator {
  /**
   * Genera un UUIDv7 ordenado cronológicamente.
   * Obligatorio para cualquier nuevo registro antes de enviarlo a Prisma.
   */
  static generateId(): string {
    return uuidv7();
  }
}