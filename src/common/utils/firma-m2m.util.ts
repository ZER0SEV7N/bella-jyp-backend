//src/common/utils/firma-m2m.util.ts
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Utilidad para generar y verificar firmas HMAC utilizando SHA256.
 * Esta utilidad se utilizara para firmar y verificar mensajes entre servicios M2M (Machine to Machine).
 * Principalmente para la comunicación entre el backend de Bella y los servicios externos como n8n.
 */

/**
 * Función para canonicalizar un objeto JSON. 
 * Esto asegura que el objeto se convierta en una cadena de texto de manera consistente, lo cual es crucial para la generación de firmas HMAC.
 * @param valor - El valor que se desea canonicalizar. Puede ser cualquier tipo de dato.
 * @return Una cadena de texto que representa el valor canonicalizado.
 */
export function jsonCanonicalize(valor: unknown): string {
    //Si el valor es un array, 
    //se convierte en una cadena de texto con los elementos canonicalizados y separados por comas, encerrados entre corchetes.
    if(Array.isArray(valor))
        return `[${valor.map(jsonCanonicalize).join(',')}]`;

    //si el valor es un objeto o diferente a null, 
    //se obtiene un array de sus claves, se ordenan alfabéticamente y se construye una cadena de texto con las claves y los valores canonicalizados, 
    //separados por comas y encerrados entre llaves.
    if(valor !== null && typeof valor === 'object') {
        const registro = valor as Record<string, unknown>;
        return `{${Object.keys(registro)
            .filter((k) => registro[k] !== undefined) //Filtra las claves cuyo valor no sea undefined
            .sort((a, b) => a.localeCompare(b)) //Ordena las claves alfabéticamente
            .map((k) => `${JSON.stringify(k)}:${jsonCanonicalize(registro[k])}`) //Canonicaliza cada valor
            .join(',')}}`; //Une las claves y valores canonicalizados en una cadena de texto
    }
    return JSON.stringify(valor); //Si el valor es un tipo primitivo, se convierte directamente a una cadena de texto JSON
}

/**
 * Funcion para generar una firma HMAC utilizando SHA256.
 * La firma se genera a partir de un secreto compartido y un 
 * mensaje que se construye a partir del método HTTP, la ruta, el instante, el nonce y el cuerpo de la solicitud.
 * Se requiere muchos parametros para asegurar que la firma sea única y segura para cada solicitud.
 * @param secreto - El secreto compartido utilizado para generar la firma HMAC.
 * @param metodo - El método HTTP de la solicitud (por ejemplo, GET, POST, PUT, DELETE).
 * @param ruta - La ruta de la solicitud (por ejemplo, /api/v1/resource).
 * @param instante - El instante de tiempo en que se realiza la solicitud, generalmente en formato ISO 8601.
 * @param nonce - Un valor único que se utiliza para prevenir ataques de repetición. Debe ser diferente para cada solicitud.
 * @param cuerpo - El cuerpo de la solicitud, que puede ser cualquier tipo de dato. Se canonicaliza antes de generar la firma.
 */
export function firmarM2M(secreto: string, metodo: string, ruta:string, instante: string, nonce: string, cuerpo: unknown): string {
    if(secreto.length < 32)
        throw new RangeError('La llave HMAC debe tener al menos 32 caracteres.');

    //Se genera un hash SHA256 del cuerpo canonicalizado de la solicitud. 
    //Esto asegura que el cuerpo de la solicitud se incluya en la firma de manera consistente.
    const digest = createHash('sha256').update(jsonCanonicalize(cuerpo)).digest('hex');

    //Se genera la firma HMAC utilizando el secreto compartido y el mensaje 
    //construido a partir del método, la ruta, el instante, el nonce y el digest del cuerpo.
    return createHmac('sha256', secreto)
        .update(`${metodo.toUpperCase()}\n${ruta}\n${instante}\n${nonce}\n${digest}`)
        .digest('hex');
}

/**
 * Funcion para verificar una firma HMAC utilizando SHA256.
 * La verificación se realiza comparando la firma esperada con la firma recibida de manera segura, 
 * utilizando una comparación de tiempo constante para prevenir ataques de temporización.
 * @param esperada - La firma HMAC esperada, generada a partir del secreto compartido y los parámetros de la solicitud.
 * @param recibida - La firma HMAC recibida, que se desea verificar. Debe ser una cadena de 64 caracteres hexadecimales.
 * @returns - Un valor booleano que indica si la firma recibida es válida (true) o no (false).
 */
export function verificarFirmaM2M(esperada: string, recibida: string): boolean {
    //Se verifica que la firma recibida sea una cadena de 64 caracteres hexadecimales.
    if (!/^[a-f0-9]{64}$/.test(recibida)) 
        return false;
    
    //Se realiza una comparación de tiempo constante entre la firma esperada y la firma recibida,
    return timingSafeEqual(
        Buffer.from(esperada, 'hex'),
        Buffer.from(recibida, 'hex')
    );
}
