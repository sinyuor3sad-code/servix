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
import { CommitmentsModule } from './commitments/commitments.module';
import { ShiftsModule } from './shifts/shifts.module';
import { HealingModule } from './healing/healing.module';
import { InventoryModule } from './inventory/inventory.module';
import { ClientDnaModule } from './client-dna/client-dna.module';
import { ZatcaModule } from './zatca/zatca.module';
import { MarketingModule } from './marketing/marketing.module';
import { DynamicPricingModule } from './dynamic-pricing/dynamic-pricing.module';

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
    CommitmentsModule,
    ShiftsModule,
    HealingModule,
    InventoryModule,
    ClientDnaModule,
    ZatcaModule,
    MarketingModule,
    DynamicPricingModule,
  ],
})
export class SalonModule {}
