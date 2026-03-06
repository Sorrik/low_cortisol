import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { RequestWithUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('users')
@UseGuards(JwtAuthGuard) // все роуты в этом контроллере защищены
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/me — данные текущего пользователя
  @Get('me')
  getMe(@Request() req: RequestWithUser) {
    return this.usersService.findById(req.user.userId);
  }

  // GET /users/:id — данные по ID (только свой профиль)
  @Get(':id')
  getUser(@Param('id') id: string, @Request() req: RequestWithUser) {
    // пользователь может смотреть только свой профиль
    if (req.user.userId !== id) {
      throw new ForbiddenException('Access denied');
    }
    return this.usersService.findById(id);
  }
}
