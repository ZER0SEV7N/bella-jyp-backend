//shared-contracts/src/auth/auth.schema.ts
//Esquema de autenticación para la validación de datos
//Utilizara Zod para la validación de datos
import { z } from 'zod';

//Tipos de documentos válidos
const TipoDocumentoEnum = z.enum(['DNI', 'CE', 'PASAPORTE', 'PTP']);
const RolUsuarioEnum = z.enum(['ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE', 'EMPLEADO']);

//Esquema para el login
export const LoginSchema = z.object({
    tipo_documento: TipoDocumentoEnum.default('DNI'),
    nro_documento: z.string().toUpperCase(),
    password: z.string().min(8, 'Credenciales inválidas'),
}).superRefine((data, ctx) => {
    //Validacion estricta del nro_documento segun el tipo de documento
    switch (data.tipo_documento) {
        case 'DNI': //Validar que el DNI tenga exactamente 8 dígitos numéricos
            if (!/^\d{8}$/.test(data.nro_documento)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'El DNI debe contener exactamente 8 dígitos numéricos.',
                    path: ['nro_documento'],
                });
            }
            break;

        case 'CE': //Validar que el CE tenga exactamente 9 dígitos numéricos
            if (!/^\d{9}$/.test(data.nro_documento)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'El CE debe contener exactamente 9 dígitos numéricos.',
                    path: ['nro_documento'],
                });
            }
            break;

        case 'PASAPORTE': //Validar que el pasaporte tenga entre 6 y 9 caracteres alfanuméricos
            if (!/^[A-Z0-9]{6,9}$/.test(data.nro_documento)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'El pasaporte debe contener entre 6 y 9 caracteres alfanuméricos.',
                    path: ['nro_documento'],
                });
            }
            break;

        case 'PTP': //Validar que el PTP tenga exactamente 9 dígitos numéricos
            if (!/^\d{9}$/.test(data.nro_documento)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'El PTP debe contener exactamente 9 dígitos numéricos.',
                    path: ['nro_documento'],
                });
            }
            break;
    }
});
//Tipo de dato para el login    
export type LoginDTO = z.infer<typeof LoginSchema>;

//Esquema para el provisionamiento de un nuevo usuario
export const ProvisionarUsuarioSchema = z.object({
    tipo_documento: TipoDocumentoEnum.default('DNI'),
    nro_documento: z.string().toUpperCase(),
    email: z.string().email('El correo electrónico no es válido').optional().or(z.literal('')),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    rol: RolUsuarioEnum.default('EMPLEADO'),
    empleado_id: z.string().uuid('ID de empleado inválido').optional(),
})
//Tipo de dato para el provisionamiento de un nuevo usuario
export type ProvisionarUsuarioDTO = z.infer<typeof ProvisionarUsuarioSchema>;