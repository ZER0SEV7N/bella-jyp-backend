//src/common/utils/crypto.Util.ts
import * as crypto from 'node:crypto';
import { InternalServerErrorException } from '@nestjs/common';

/**
 * Utilidad criptográfica para el cifrado/descrifrado seguro en reposo de datos financieros.
 * Utiliza el algoritmo AES-256-GCM (Galois/Counter Mode) proveido por OpenSSL/C++
 * La llave maestra se encuentra en la variable de entorno FINANCIAL_DATA_ENCRYPTION_KEY.
 */
export class CryptoUtil {
  
    /**
     * Metodo estatico que encripta un valor opcional.
     * Si el valor es undefined, retorna undefined.
     * Si el valor es null o una cadena vacía, retorna null.
     * De lo contrario, encripta el valor y retorna el resultado.
     * @param valor - El valor opcional a encriptar.
     * @returns El valor encriptado, null o undefined según corresponda.
     */
    static encryptOptional(valor?: string | null): string | null | undefined {
        if (valor === undefined) return undefined;
        if (!valor || valor.trim() === '') return null;
        return this.encrypt(valor.trim());
    }

    private static readonly ALGORITHM = 'aes-256-gcm'; // Algoritmo de cifrado simétrico AES-256 en modo GCM (Galois/Counter Mode)
    private static readonly IV_LENGTH = 12; // Longitud recomendada para GCM
    private static readonly AUTH_TAG_LENGTH = 16; // Longitud del tag de autenticación

    /**
     * Metodo estatico que obtiene y deriva la clave maestra de cifrado
     * usando SHA-256 para asegurar que tenga la longitud correcta de 32 bytes.
     */
    private static getMasterKey(): Buffer {
        const secret = process.env.FINANCIAL_DATA_ENCRYPTION_KEY;
        //Verificar que la llave maestra esté definida en las variables de entorno
        if (!secret)
        throw new InternalServerErrorException(
            'CRITICO: No se encuentra definida la llave maestra de cifrado en las variables de entorno (FINANCIAL_DATA_ENCRYPTION_KEY).'
        );

        //Derivar la llave maestra usando SHA-256 para asegurar que tenga la longitud correcta de 32 bytes
        return crypto.createHash('sha256').update(secret).digest();
    }

    /**
     * Metodo para encriptar un texto plano usando AES-256-GCM.
     * @param plainText El texto plano a encriptar.
     * @returns Formato estructurado: "enc:v1:{ivHex}:{authTagHex}:{cipherTextHex}"
     */
    static encrypt(plaintext: string | null | undefined): string | null {
        if (!plaintext) return null;

        try {
            //Generar un vector de inicialización (IV) aleatorio para cada encriptación
            const key = this.getMasterKey();
            const iv = crypto.randomBytes(this.IV_LENGTH);
            const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv, { authTagLength: this.AUTH_TAG_LENGTH });

            //Encriptar el texto plano y obtener el tag de autenticación
            let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
            
            //Finalizar el proceso de encriptación y obtener el resultado en hexadecimal
            encrypted += cipher.final('hex');

            //Obtener el tag de autenticación y convertirlo a hexadecimal
            const authTag = cipher.getAuthTag().toString('hex');
            
            //Convertir el IV a hexadecimal para incluirlo en el resultado
            const ivHex = iv.toString('hex');

            //Retornar el resultado en el formato estructurado
            return `enc:v1:${ivHex}:${authTag}:${encrypted}`;
        } catch (error) {
            throw new InternalServerErrorException(
                'Fallo de encriptación al intentar proteger datos financieros sensibles.',
                error instanceof Error ? error.message : String(error)
            );  
        }
    }

    /**
     * Metodo para desencriptar un valor cifrado en formato "enc:v1:{ivHex}:{authTagHex}:{ciphertextHex}".
     * Si el valor no posee el prefijo "enc:v1:", retorna el valor original (tolerancia a migración/texto plano).
     */
    static decrypt(cipherText: string | null | undefined): string | null {
        //Si el valor es nulo o indefinido, retornar null
        if (!cipherText) return null;

        //Si el texto no esta cifrado en formato v1, retornar el valor original (tolerancia a migración/texto plano)
        if (!cipherText.startsWith('enc:v1:')) return cipherText;

        try {

            //Separar el texto cifrado en sus componentes: prefijo, versión, IV, tag de autenticación y texto cifrado
            const parts = cipherText.split(':');
            if (parts.length !== 5) 
                throw new Error('Formato de texto cifrado inválido.');

            //Extraer el IV, tag de autenticación y texto cifrado en hexadecimal
            const [, , ivHex, authTadHex, encryptedHex] = parts;

            //Obtener la clave maestra de cifrado y convertir el IV y el tag de autenticación de hexadecimal a Buffer
            const key = this.getMasterKey();

            //Convertir el IV y el tag de autenticación de hexadecimal a Buffer
            const iv = Buffer.from(ivHex, 'hex');

            //Convertir el tag de autenticación de hexadecimal a Buffer
            const authTag = Buffer.from(authTadHex, 'hex');

            //Crear un objeto Decipher para desencriptar el texto cifrado usando AES-256-GCM
            const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv, { authTagLength: this.AUTH_TAG_LENGTH });
            
            //Establecer el tag de autenticación en el objeto Decipher para verificar la integridad del texto cifrado
            decipher.setAuthTag(authTag);

            //Desencriptar el texto cifrado y convertirlo de hexadecimal a UTF-8
            let decrypted = decipher.update(encryptedHex, 'hex', 'utf-8');
            
            //Finalizar el proceso de desencriptación y obtener el resultado en UTF-8
            decrypted += decipher.final('utf-8');

            //Retornar el texto desencriptado
            return decrypted;
        } catch (error) {
            throw new InternalServerErrorException(
                'Fallo al desencriptar dato financiero. La clave de cifrado o los datos fueron alterados.',
                error instanceof Error ? error.message : String(error)
            );
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
        if (!value) return null;

        const cleanValue = this.decrypt(value) || value; //Si el valor está cifrado, desencriptarlo primero
        if (cleanValue.length <= visibleCount) return '****'; //Si el valor es más corto que visibleCount, enmascarar todo
        const hidden = '*'.repeat(cleanValue.length - visibleCount);
        return `${hidden}${cleanValue.slice(-visibleCount)}`;
    }
}
