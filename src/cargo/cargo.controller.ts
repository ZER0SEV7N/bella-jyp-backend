import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CargoService } from './cargo.service';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { UpdateCargoDto } from './dto/update-cargo.dto';

@Controller('cargo')
export class CargoController {
  constructor(private readonly cargoService: CargoService) {}

  @Post()
  create(@Body() createCargoDto: CreateCargoDto) {
    return this.cargoService.create(createCargoDto);
  }

  @Get()
  findAll() {
    return this.cargoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cargoService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCargoDto: UpdateCargoDto) {
    return this.cargoService.update(+id, updateCargoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cargoService.remove(+id);
  }
}
