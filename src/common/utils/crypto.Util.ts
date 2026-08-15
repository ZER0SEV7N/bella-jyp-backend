//src/common/utils/crypto.Util.ts
import * as crypto from 'node:crypto';
import { InternalServerErrorException } from '@nestjs/common';

/**
 * Utilidad criptográfica para el cifrado/descrifrado seguro en reposo de datos financieros.
 * Utiliza el algoritmo AES-256-GCM (Galois/Counter Mode) proveido por OpenSSL/C++
 * La llave maestra se encuentra en la variable de entorno FINANCIAL_DATA_ENCRYPTION_KEY.
 */
export class CryptoUtil {
    private static readonly ALGORITHM = 'aes-256-gcm';
    private static readonly IV_LENGTH = 12; // Longitud recomendada para GCM
    private static readonly AUTH_TAG_LENGTH = 16; // Longitud del tag de autenticación

    /**
     * Metodo estatico que obtiene y deriva la clave maestra de cifrado
     * usando SHA-256 para asegurar que tenga la longitud correcta de 32 bytes.
     */
    private static getMasterKey(): Buffer {
        const secret = process.env.FINANCIAL_DATA_ENCRYPTION_KEY;
        //Verificar que la llave maestra esté definida en las variables de entorno
        if(!secret)
            throw new InternalServerErrorException('CRITICO: No se encuentra definida la llave maestra de cifrado en las variables de entorno (FINANCIAL_DATA_ENCRYPTION_KEY).');

        //Derivar la llave maestra usando SHA-256 para asegurar que tenga la longitud correcta de 32 bytes
        return crypto.createHash('sha256').update(secret).digest();
    }

    /**
     * Metodo para encriptar un texto plano usando AES-256-GCM.
     * @param plainText El texto plano a encriptar.
     * @returns Formato estructurado: "enc:v1:{ivHex}:{authTagHex}:{cipherTextHex}"
     */
    static encrypt(plaintext: string | null | undefined): string | null {
        if(!plaintext) return null;

        try{
            const key = this.getMasterKey();
            const iv = crypto.randomBytes(this.IV_LENGTH);
            const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv, { authTagLength: this.AUTH_TAG_LENGTH });
            
            let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
            encrypted += cipher.final('hex');

            const authTag = cipher.getAuthTag().toString('hex');
            const ivHex = iv.toString('hex');

            return `enc:v1:${ivHex}:${authTag}:${encrypted}`;
        } catch (error) {
            throw new InternalServerErrorException('Fallo de encriptación al intentar proteger datos financieros sensibles.', error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Metodo para desencriptar un valor cifrado en formato "enc:v1:{ivHex}:{authTagHex}:{ciphertextHex}".
     * Si el valor no posee el prefijo "enc:v1:", retorna el valor original (tolerancia a migración/texto plano).
     */
    static decrypt(cipherText: string | null | undefined): string | null {
        if(!cipherText) return null;

        //Si el texto no esta cifrado en formato v1, retornar el valor original (tolerancia a migración/texto plano)
        if(!cipherText.startsWith('enc:v1:')) return cipherText;

        try{
            const parts = cipherText.split(':');
            if(parts.length !== 5) throw new Error('Formato de texto cifrado inválido.');

            const [, , ivHex, authTadHex, encryptedHex] = parts;
            const key = this.getMasterKey();
            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTadHex, 'hex');

            const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv, { authTagLength: this.AUTH_TAG_LENGTH });
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encryptedHex, 'hex', 'utf-8');
            decrypted += decipher.final('utf-8');

            return decrypted;
        } catch (error) {
            throw new InternalServerErrorException('Fallo al desencriptar dato financiero. La clave de cifrado o los datos fueron alterados.', error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Metodo para enmacarar un dato financiero sensible,
     * mostrando solo los últimos 4 caracteres y reemplazando el resto con asteriscos.
     * @param value El dato financiero sensible a enmascarar.
     * @param visibleCount La cantidad de caracteres visibles al final del dato (por defecto 4).
     * @returns El dato enmascarado, o null si el dato es nulo o indefinido.
     */
    static mask(value: string | null | undefined, visibleCount = 4): string | null {
        if(!value) return null;

        const cleanValue = this.decrypt(value) || value; //Si el valor está cifrado, desencriptarlo primero
        if(cleanValue.length <= visibleCount) return '****'; //Si el valor es más corto que visibleCount, enmascarar todo
        const hidden = '*'.repeat(cleanValue.length - visibleCount);
        return `${hidden}${cleanValue.slice(-visibleCount)}`;
    }
}
