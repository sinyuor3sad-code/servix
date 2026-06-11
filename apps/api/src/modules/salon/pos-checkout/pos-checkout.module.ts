import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from '../../../shared/config/jwt.config';
import { PosCheckoutController } from './pos-checkout.controller';
import { PosCheckoutService } from './pos-checkout.service';
import { ManagerOverrideService } from './manager-override.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(jwtConfig)],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.accessSecret') || '',
      }),
    }),
  ],
  controllers: [PosCheckoutController],
  providers: [PosCheckoutService, ManagerOverrideService],
  exports: [PosCheckoutService],
})
export class PosCheckoutModule {}
