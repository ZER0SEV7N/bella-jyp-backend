//src/common/config/multer/multer.ts
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

/**
 * Configuración de Multer para la carga de archivos en el módulo de contratos.
 * Esta configuración define el almacenamiento, el filtrado de archivos y los límites de tamaño para los archivos cargados.
 * Los archivos se almacenan en la carpeta './contratos' y se les asigna un nombre único basado en la fecha y un UUID.
 * Solo se permiten archivos PDF y Word, y el tamaño máximo permitido es de 5 MB.
 */
export const configracionMulter: any = {
  storage: diskStorage({
    destination: './contratos',
    filename: (req, file, cb) => {
      const nombreFile = `${Date.now()}-${randomUUID()}-${extname(file.originalname)}`;
      cb(null, nombreFile);
    }
  }),
  fileFilter: (req, file, cb) => {
    const tipos_file = [
      'application/pdf',
      'application/msword', // Para archivos antiguos .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!tipos_file.includes(file.mimetype)) {
      return cb(new BadRequestException('El archivo debe ser pdf o word'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
};
