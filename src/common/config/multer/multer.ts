import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
export const configracionMulter = {
  storage: diskStorage({
    destination: './contratos',
    filename: (req, file, cb) => {
      const nombreFile = `${Date.now()}-${randomUUID()}archivo`;
      cb(null, nombreFile);
    },
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
  limits: { filezise: 5 * 1024 * 1024 },
};
