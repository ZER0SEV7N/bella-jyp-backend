//test/common/utils/crypto.util.spec.ts
import { InternalServerErrorException } from '@nestjs/common';
import { CryptoUtil } from '@/common/utils/crypto.Util';

describe('CyptoUtil - Pruebas Unitarias de Cifrado AES-256-GCM', () => {
    const ORIGINAL_ENV = process.env;
    const TEST_MASTER_KEY = 'jyp_financial_master_key_super_secret_32_bytes_2026!';

    //Configurar la variable de entorno antes de cada prueba
    beforeEach(() => {
        jest.resetModules(); //Limpiar el cache de módulos para que las variables de entorno se recarguen
        process.env = { ...ORIGINAL_ENV };
        process.env.FINANCIAL_DATA_ENCRYPTION_KEY = TEST_MASTER_KEY;
    })

    afterAll(() => process.env = ORIGINAL_ENV); //Restaurar las variables de entorno originales después de todas las pruebas

    describe('encrypyt() - Encriptacion de los datos financieros sensibles', () => {
        it('Debe retornar null si el valor de entrada es null, undefined o cadena vacia', () => {
            //Assert
            expect(CryptoUtil.encrypt(null)).toBeNull();
            expect(CryptoUtil.encrypt(undefined)).toBeNull();
            expect(CryptoUtil.encrypt('')).toBeNull();
        })

        it('Debe ciffrar una cadena y retornar el formato estructurado "enc:v1:{ivHex}:{authTagHex}:{cipherTextHex}"', () => {
            //arrange
            const plainText = '191-12345678-0-12';

            //Act
            const encrypted = CryptoUtil.encrypt(plainText);

            //Assert
            expect(encrypted).not.toBeNull();
            expect(encrypted).toMatch(/^enc:v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i);
        });

        it('Debe generar ciphertexts distintos para el mismo texto plano debido a vectores de inicializacion (IV) aleatorios', () => {
            //Arrange:
            const plainText = '002-191-00123456780123-88';

            //Act:
            const encrypted1 = CryptoUtil.encrypt(plainText);
            const encrypted2 = CryptoUtil.encrypt(plainText);

            expect(encrypted1).not.toEqual(encrypted2); //Los ciphertexts deben ser distintos
        });

        it('Debe lanzar InternalServerErrorException si la variable de entorno de clave maestra no está configurada', () => {
            //Arrange: Eliminar la variable de entorno de clave maestra
            delete process.env.FINANCIAL_DATA_ENCRYPTION_KEY;
            delete process.env.JWT_ACCESS_SECRET;

            //Act & Assert
            expect(() => CryptoUtil.encrypt('Dato Sensible')).toThrow(InternalServerErrorException);
        });
    });

    describe('decrypt() - Desencriptacion y Validacion de Integridad', () => {
        it('Debe retornar null si la entrada es null o undefined', () => {
            //Assert
            expect(CryptoUtil.decrypt(null)).toBeNull();
            expect(CryptoUtil.decrypt(undefined)).toBeNull();
        });

        it('Debe retornar el valor original si no posee el prefijo enc:v1: (Soporte de retrocompatibilidad / texto plano)', () => {
            //Arrange
            const plainText = '191-98765432-0-11';

            //Act
            const result = CryptoUtil.decrypt(plainText);

            //Asserc
            expect(result).toEqual(plainText);
        });

        it('Debe desencriptar correctamente un payload cifrado valido', () => {
            //Arrange
            const originalText = '002-191-00987654321012-99';
            const encrypted = CryptoUtil.encrypt(originalText);

            //Act
            const decrypted = CryptoUtil.decrypt(encrypted);

            //Assert
            expect(decrypted).toBe(originalText);
        });

        it('Debe detectar alteración de datos (Tamper Detection) y lanzar error de autenticación si se corrompe el authTag', () => {
            //Arrange
            const originalText = 'Cuenta CTS: 191-000111222-1';
            const encrypted = CryptoUtil.encrypt(originalText)!;

            //Act
            //Corromper el authTag del ciphertext para simular manipulación de datos
            const parts = encrypted.split(':');
            parts[3] = 'f'.repeat(32); //Alterar el AuthTag de OpenSSL
            const corruptedEncrypted = parts.join(':');

            //Assert
            expect(() => CryptoUtil.decrypt(corruptedEncrypted)).toThrow(InternalServerErrorException);
        });
        
        it('Debe lanzar error si el formato del token cifrado no tiene la estructura esperada', () => {
            //Arrange
            const invalidFormatCipherText = 'enc:v1:invalidformat';

            //Act & Assert
            expect(() => CryptoUtil.decrypt(invalidFormatCipherText)).toThrow(InternalServerErrorException);
        });

        it('Debe fallar al desencriptar si la clave maestra es diferente a la clave con la que se cifro', () => {
            //Arrange
            const plainText = 'SueldoConfidencial_15000.00';
            const encrypted = CryptoUtil.encrypt(plainText);

            //Act
            //Cambiar la clave maestra para simular un entorno diferente
            process.env.FINANCIAL_DATA_ENCRYPTION_KEY = 'otra_clave_maestra_diferente_2026_super_secreta';

            //Assert
            expect(() => CryptoUtil.decrypt(encrypted)).toThrow(InternalServerErrorException);
        });
    });

     describe('mask() - Enmascaramiento de Datos Financieros para Vistas', () => {
        it('Debe retornar null si la entrada es null o undefined', () => {
            expect(CryptoUtil.mask(null)).toBeNull();
            expect(CryptoUtil.mask(undefined)).toBeNull();
        });

        it('Debe enmascarar un texto plano mostrando únicamente los últimos 4 caracteres', () => {
            //Arrange
            const cci = '0021910012345678012388'; // 22 caracteres
            
            //Act
            const masked = CryptoUtil.mask(cci, 4);

            //Assert
            expect(masked).toBe('******************12388'.slice(0, 18) + '012388'.slice(-4));
            expect(masked?.endsWith('12388'.slice(-4))).toBeTruthy();
        });

        it('Debe desencriptar y enmascarar un dato cifrado en un solo paso', () => {
            //Arrange
            const cuenta = '191-12345678-0-12'; // 17 caracteres
            
            //Act
            const encrypted = CryptoUtil.encrypt(cuenta);
            const masked = CryptoUtil.mask(encrypted, 4);

            //Assert
            expect(masked).toBe('*************0-12');
        });

        it('Debe retornar **** si la longitud del valor es menor o igual a los caracteres visibles requeridos', () => {
            //Assert
            expect(CryptoUtil.mask('123', 4)).toBe('****');
            expect(CryptoUtil.mask('1234', 4)).toBe('****');
        });
    });
})