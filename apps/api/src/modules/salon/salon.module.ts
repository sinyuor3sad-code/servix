import { Module } from '@nestjs/common';
import { SalonInfoModule } from './salon-info/salon-info.module';
import { ServicesModule } from './services/services.module';
import { EmployeesModule } from './employees/employees.module';
import { ClientsModule } from './clients/clients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { InvoicesModule } from './invoices/invoices.module';
import { CouponsModule } from './coupons/coupons.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { ExpensesModule } from './expenses/expenses.module';
import { AttendanceModule } from './attendance/attendance.module';
import { SettingsModule } from './settings/settings.module';
import { ReportsModule } from './reports/reports.module';
import { BookingModule } from './booking/booking.module';
import { AccountModule } from './account/account.module';

@Module({
  imports: [
    SalonInfoModule,
    ServicesModule,
    EmployeesModule,
    ClientsModule,
    AppointmentsModule,
    InvoicesModule,
    CouponsModule,
    LoyaltyModule,
    ExpensesModule,
    AttendanceModule,
    SettingsModule,
    ReportsModule,
    BookingModule,
    AccountModule,
  ],
})
export class SalonModule {}
