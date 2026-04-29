import {
  Controller,
  Get, Patch,
  Param, Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { RequestWithUser } from '../auth/interfaces/jwt-payload.interface';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Request() req: RequestWithUser) {
    return this.usersService.findById(req.user.userId);
  }

  @Patch('me')
  updateMe(@Request() req: RequestWithUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateById(req.user.userId, dto);
  }

  @Get(':id')
  getUser(@Param('id') id: string, @Request() req: RequestWithUser) {
    if (req.user.userId !== id) {
      throw new ForbiddenException('Access denied');
    }
    return this.usersService.findById(id);
  }
}
