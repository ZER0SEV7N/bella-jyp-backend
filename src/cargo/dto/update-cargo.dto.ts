import { PartialType } from '@nestjs/mapped-types';
import { CreateCargoDto } from './create-cargo.dto';

export class UpdateCargoDto extends PartialType(CreateCargoDto) {}
