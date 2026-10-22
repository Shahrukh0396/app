import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthRateLimitGuard } from '../common/guards/auth-rate-limit.guard';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  ProviderTokenDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto';

@Controller('auth')
@Public()
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.auth.register({ ...dto, request });
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login({ ...dto, request });
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.auth.refresh({ ...dto, request });
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto, @Req() request: Request) {
    return this.auth.logout(dto.refreshToken, request);
  }

  @Post('google')
  google(@Body() dto: ProviderTokenDto, @Req() request: Request) {
    return this.auth.google(dto.idToken, dto.deviceId, dto.deviceName, request, dto.name);
  }

  @Post('apple')
  apple(@Body() dto: ProviderTokenDto, @Req() request: Request) {
    return this.auth.apple(dto.idToken, dto.deviceId, dto.deviceName, request, dto.name);
  }

  @Post('microsoft')
  microsoft(@Body() dto: ProviderTokenDto, @Req() request: Request) {
    return this.auth.microsoft(dto.idToken, dto.deviceId, dto.deviceName, request, dto.name);
  }

  @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }
}
