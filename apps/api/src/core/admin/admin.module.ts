import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TenantsModule } from '../tenants/tenants.module';
import { TwoFactorService } from '../auth/two-factor.service';
import { TwoFactorBackupCodeService } from '../auth/two-factor-backup-code.service';

@Module({
  imports: [JwtModule.register({}), TenantsModule],
  controllers: [AdminController],
  // V-43: TwoFactorService is dual-provided here (it's also in AuthModule).
  // It's a zero-dependency, stateless RFC-6238 TOTP calculator, so a second
  // instance is harmless. Chosen over a @Global TwoFactorModule wrapper to
  // keep the change localized — no AuthModule edit, no new module file, and
  // no AdminModule↔AuthModule circular-import risk. Same no-circular outcome
  // the @Global option targeted (Phase A decision 2).
  // V-42: TwoFactorBackupCodeService dual-provided here too (stateless, shares
  // the singleton PlatformPrismaClient) so the admin 2FA-verify path can accept
  // backup codes.
  providers: [AdminService, TwoFactorService, TwoFactorBackupCodeService],
  exports: [AdminService],
})
export class AdminModule {}
