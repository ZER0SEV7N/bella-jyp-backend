//src/common/utils/uuid.util.ts
//Genera un UUIDv7 para identificar de manera única los registros en la base de datos
import { randomBytes } from 'node:crypto';

export class IdentityGenerator {
  /**
   * Genera un UUIDv7 ordenado cronológicamente.
   * Obligatorio para cualquier nuevo registro antes de enviarlo a Prisma.
   */
  static generateId(): string {
    const value = randomBytes(16);
    const timestamp = Date.now();

    //Timestamp de 48 bits (milisegundos Unix)
    value[0] = Math.floor(timestamp / 0x100000000) & 0xff;
    value[1] = Math.floor(timestamp / 0x10000) & 0xff;
    value[2] = Math.floor(timestamp / 0x100) & 0xff;
    value[3] = timestamp & 0xff;
    value[4] = Math.floor((timestamp % 1000) / 16) & 0xff;
    value[5] = (timestamp % 16) & 0x0f;

    //Ajustar los 4 bits más significativos del octeto 6 a Versión 7 (0b0111)
    value[6] = (value[6] & 0x0f) | 0x70;

    //Ajustar los 2 bits más significativos del octeto 8 a Variante RFC 4122/9562 (0b10)
    value[8] = (value[8] & 0x3f) | 0x80;

    const hex = value.toString('hex');
    return (
      `${hex.slice(0, 8)}-` +
      `${hex.slice(8, 12)}-` +
      `${hex.slice(12, 16)}-` +
      `${hex.slice(16, 20)}-` +
      `${hex.slice(20, 32)}`
    );
  }
}
