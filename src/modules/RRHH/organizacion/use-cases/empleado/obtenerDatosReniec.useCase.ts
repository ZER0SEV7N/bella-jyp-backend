import { BadRequestException, Injectable } from "@nestjs/common";
import { ReniecAdapter } from "../../services/reniec.adapter";
@Injectable()
export class ObtenerDatosReniecUseCase{
    constructor(
        private readonly recienAdapter: ReniecAdapter,
    ){}
    /**
     * funcion de vlaidar si el dni esta disponible o no.
     * @param nro_documento - parametro de entrar que es nro del documento.
     * @returns un josn para retorna los datos como nombre, apellidos.
    */
    async execute(nro_documento:string){
        if (!/^\d{8}$/.test(nro_documento)) {
            throw new BadRequestException("El DNI tiene menos de 8 digitos") 
        }
        
        // Llamada al adaptador de Reniec para consultar los datos del ciudadano por su DNI
        const datosCiudadano = await this.recienAdapter.consultarDni(nro_documento);
        return{
            nombre: datosCiudadano.nombre,
            apellido_materno: datosCiudadano.apellido_materno,
            apellido_paterno: datosCiudadano.apellido_paterno
        } 
    }
}