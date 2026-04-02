import { PrismaClient } from '../generated/platform';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding platform database...');

  // ─────────────────── 1. Roles ───────────────────
  console.log('  → Creating roles...');
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'owner' },
      update: {},
      create: { name: 'owner', nameAr: 'مالك', isSystem: true },
    }),
    prisma.role.upsert({
      where: { name: 'manager' },
      update: {},
      create: { name: 'manager', nameAr: 'مدير', isSystem: true },
    }),
    prisma.role.upsert({
      where: { name: 'receptionist' },
      update: {},
      create: { name: 'receptionist', nameAr: 'استقبال', isSystem: true },
    }),
    prisma.role.upsert({
      where: { name: 'cashier' },
      update: {},
      create: { name: 'cashier', nameAr: 'كاشير', isSystem: true },
    }),
    prisma.role.upsert({
      where: { name: 'staff' },
      update: {},
      create: { name: 'staff', nameAr: 'موظفة', isSystem: true },
    }),
  ]);
  console.log(`    ✓ ${roles.length} roles created`);

  // ─────────────────── 2. Permissions ───────────────────
  console.log('  → Creating permissions...');
  const permissionData = [
    // Appointments
    { code: 'appointments.view', nameAr: 'عرض المواعيد', group: 'appointments' },
    { code: 'appointments.create', nameAr: 'إنشاء موعد', group: 'appointments' },
    { code: 'appointments.update', nameAr: 'تعديل موعد', group: 'appointments' },
    { code: 'appointments.delete', nameAr: 'حذف موعد', group: 'appointments' },
    { code: 'appointments.status', nameAr: 'تغيير حالة الموعد', group: 'appointments' },

    // Clients
    { code: 'clients.view', nameAr: 'عرض العملاء', group: 'clients' },
    { code: 'clients.create', nameAr: 'إضافة عميل', group: 'clients' },
    { code: 'clients.update', nameAr: 'تعديل عميل', group: 'clients' },
    { code: 'clients.delete', nameAr: 'حذف عميل', group: 'clients' },

    // Employees
    { code: 'employees.view', nameAr: 'عرض الموظفات', group: 'employees' },
    { code: 'employees.create', nameAr: 'إضافة موظفة', group: 'employees' },
    { code: 'employees.update', nameAr: 'تعديل موظفة', group: 'employees' },
    { code: 'employees.delete', nameAr: 'حذف موظفة', group: 'employees' },
    { code: 'employees.schedule', nameAr: 'إدارة جدول الدوام', group: 'employees' },

    // Services
    { code: 'services.view', nameAr: 'عرض الخدمات', group: 'services' },
    { code: 'services.create', nameAr: 'إضافة خدمة', group: 'services' },
    { code: 'services.update', nameAr: 'تعديل خدمة', group: 'services' },
    { code: 'services.delete', nameAr: 'حذف خدمة', group: 'services' },

    // Invoices
    { code: 'invoices.view', nameAr: 'عرض الفواتير', group: 'invoices' },
    { code: 'invoices.create', nameAr: 'إنشاء فاتورة', group: 'invoices' },
    { code: 'invoices.update', nameAr: 'تعديل فاتورة', group: 'invoices' },
    { code: 'invoices.void', nameAr: 'إلغاء فاتورة', group: 'invoices' },
    { code: 'invoices.discount', nameAr: 'إضافة خصم', group: 'invoices' },

    // Payments
    { code: 'payments.view', nameAr: 'عرض المدفوعات', group: 'payments' },
    { code: 'payments.create', nameAr: 'تسجيل دفع', group: 'payments' },
    { code: 'payments.refund', nameAr: 'استرجاع مبلغ', group: 'payments' },

    // Reports
    { code: 'reports.view', nameAr: 'عرض التقارير', group: 'reports' },
    { code: 'reports.export', nameAr: 'تصدير التقارير', group: 'reports' },

    // Coupons
    { code: 'coupons.view', nameAr: 'عرض الكوبونات', group: 'coupons' },
    { code: 'coupons.create', nameAr: 'إنشاء كوبون', group: 'coupons' },
    { code: 'coupons.update', nameAr: 'تعديل كوبون', group: 'coupons' },
    { code: 'coupons.delete', nameAr: 'حذف كوبون', group: 'coupons' },

    // Loyalty
    { code: 'loyalty.view', nameAr: 'عرض نقاط الولاء', group: 'loyalty' },
    { code: 'loyalty.adjust', nameAr: 'تعديل النقاط', group: 'loyalty' },

    // Expenses
    { code: 'expenses.view', nameAr: 'عرض المصروفات', group: 'expenses' },
    { code: 'expenses.create', nameAr: 'إضافة مصروف', group: 'expenses' },
    { code: 'expenses.update', nameAr: 'تعديل مصروف', group: 'expenses' },
    { code: 'expenses.delete', nameAr: 'حذف مصروف', group: 'expenses' },

    // Settings
    { code: 'settings.view', nameAr: 'عرض الإعدادات', group: 'settings' },
    { code: 'settings.update', nameAr: 'تعديل الإعدادات', group: 'settings' },
    { code: 'settings.users', nameAr: 'إدارة المستخدمين', group: 'settings' },
    { code: 'settings.branding', nameAr: 'تعديل الهوية البصرية', group: 'settings' },
    { code: 'settings.subscription', nameAr: 'إدارة الاشتراك', group: 'settings' },

    // Attendance
    { code: 'attendance.view', nameAr: 'عرض الحضور', group: 'attendance' },
    { code: 'attendance.manage', nameAr: 'إدارة الحضور', group: 'attendance' },
  ];

  const permissions = await Promise.all(
    permissionData.map((p) =>
      prisma.permission.upsert({
        where: { code: p.code },
        update: {},
        create: p,
      }),
    ),
  );
  console.log(`    ✓ ${permissions.length} permissions created`);

  // ─────────────────── 3. Role-Permission Mapping ───────────────────
  console.log('  → Mapping role permissions...');

  const allPermissionCodes = permissionData.map((p) => p.code);

  const managerPermissions = allPermissionCodes.filter(
    (code) => !code.startsWith('settings.subscription'),
  );

  const receptionistPermissions = [
    'appointments.view', 'appointments.create', 'appointments.update', 'appointments.status',
    'clients.view', 'clients.create', 'clients.update',
    'employees.view',
    'services.view',
    'invoices.view', 'invoices.create',
    'payments.view', 'payments.create',
  ];

  const cashierPermissions = [
    'appointments.view',
    'clients.view',
    'services.view',
    'invoices.view', 'invoices.create', 'invoices.update', 'invoices.discount',
    'payments.view', 'payments.create', 'payments.refund',
    'coupons.view',
  ];

  const staffPermissions = [
    'appointments.view',
    'clients.view',
    'services.view',
  ];

  const rolePermissionMap: Record<string, string[]> = {
    owner: allPermissionCodes,
    manager: managerPermissions,
    receptionist: receptionistPermissions,
    cashier: cashierPermissions,
    staff: staffPermissions,
  };

  for (const [roleName, permCodes] of Object.entries(rolePermissionMap)) {
    const role = roles.find((r) => r.name === roleName);
    if (!role) continue;

    for (const code of permCodes) {
      const permission = permissions.find((p) => p.code === code);
      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
  console.log('    ✓ Role-permission mappings created');

  // ─────────────────── 4. Plans ───────────────────
  console.log('  → Creating subscription plans...');
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { name: 'Basic' },
      update: {},
      create: {
        name: 'Basic',
        nameAr: 'أساسي',
        priceMonthly: 199,
        priceYearly: 1990,
        maxEmployees: 3,
        maxClients: 100,
        descriptionAr: 'الباقة الأساسية — مناسبة للصالونات الصغيرة',
        sortOrder: 1,
      },
    }),
    prisma.plan.upsert({
      where: { name: 'Pro' },
      update: {},
      create: {
        name: 'Pro',
        nameAr: 'احترافي',
        priceMonthly: 399,
        priceYearly: 3990,
        maxEmployees: 10,
        maxClients: -1,
        descriptionAr: 'الباقة الاحترافية — صالونات متوسطة مع حجز أونلاين وتقارير متقدمة',
        sortOrder: 2,
      },
    }),
    prisma.plan.upsert({
      where: { name: 'Premium' },
      update: {},
      create: {
        name: 'Premium',
        nameAr: 'متميز',
        priceMonthly: 699,
        priceYearly: 6990,
        maxEmployees: -1,
        maxClients: -1,
        descriptionAr: 'الباقة المتميزة — كل الميزات بلا حدود',
        sortOrder: 3,
      },
    }),
  ]);
  console.log(`    ✓ ${plans.length} plans created`);

  // ─────────────────── 5. Features ───────────────────
  console.log('  → Creating feature flags...');
  const featureData = [
    { code: 'services_management', nameAr: 'إدارة الخدمات', descriptionAr: 'إضافة وتعديل وحذف الخدمات والتصنيفات' },
    { code: 'client_management', nameAr: 'إدارة العملاء', descriptionAr: 'إدارة بيانات العملاء وسجل الزيارات' },
    { code: 'appointments', nameAr: 'إدارة المواعيد', descriptionAr: 'إنشاء وإدارة الحجوزات والمواعيد' },
    { code: 'pos', nameAr: 'نقطة البيع', descriptionAr: 'واجهة الكاشير وإصدار الفواتير' },
    { code: 'invoices', nameAr: 'الفواتير', descriptionAr: 'إنشاء وإدارة وطباعة الفواتير' },
    { code: 'basic_reports', nameAr: 'التقارير الأساسية', descriptionAr: 'تقارير الإيرادات والحجوزات الأساسية' },
    { code: 'online_booking', nameAr: 'الحجز الأونلاين', descriptionAr: 'صفحة حجز عامة للعملاء' },
    { code: 'advanced_reports', nameAr: 'التقارير المتقدمة', descriptionAr: 'تقارير تفصيلية مع تصدير Excel و PDF' },
    { code: 'detailed_permissions', nameAr: 'صلاحيات تفصيلية', descriptionAr: 'تخصيص صلاحيات كل دور بشكل دقيق' },
    { code: 'coupons', nameAr: 'الكوبونات', descriptionAr: 'إنشاء وإدارة كوبونات الخصم' },
    { code: 'loyalty', nameAr: 'نظام الولاء', descriptionAr: 'نقاط الولاء للعملاء (اكتساب واستبدال)' },
    { code: 'whatsapp', nameAr: 'تكامل واتساب', descriptionAr: 'إرسال إشعارات وتأكيدات عبر واتساب' },
    { code: 'multi_branch', nameAr: 'تعدد الفروع', descriptionAr: 'إدارة أكثر من فرع من لوحة تحكم واحدة' },
    { code: 'expenses', nameAr: 'إدارة المصروفات', descriptionAr: 'تتبع مصروفات الصالون' },
    { code: 'attendance', nameAr: 'الحضور والانصراف', descriptionAr: 'تسجيل حضور وانصراف الموظفات' },
  ];

  const features = await Promise.all(
    featureData.map((f) =>
      prisma.feature.upsert({
        where: { code: f.code },
        update: {},
        create: f,
      }),
    ),
  );
  console.log(`    ✓ ${features.length} features created`);

  // ─────────────────── 6. Plan-Feature Mapping ───────────────────
  console.log('  → Mapping plan features...');

  const basicFeatures = [
    'services_management', 'client_management', 'appointments',
    'pos', 'invoices', 'basic_reports', 'expenses', 'attendance',
  ];

  const proFeatures = [
    ...basicFeatures,
    'online_booking', 'advanced_reports', 'detailed_permissions',
  ];

  const premiumFeatures = [
    ...proFeatures,
    'coupons', 'loyalty', 'whatsapp', 'multi_branch',
  ];

  const planFeatureMap: Record<string, string[]> = {
    Basic: basicFeatures,
    Pro: proFeatures,
    Premium: premiumFeatures,
  };

  for (const [planName, featureCodes] of Object.entries(planFeatureMap)) {
    const plan = plans.find((p) => p.name === planName);
    if (!plan) continue;

    for (const code of featureCodes) {
      const feature = features.find((f) => f.code === code);
      if (!feature) continue;

      await prisma.planFeature.upsert({
        where: {
          planId_featureId: { planId: plan.id, featureId: feature.id },
        },
        update: {},
        create: { planId: plan.id, featureId: feature.id },
      });
    }
  }
  console.log('    ✓ Plan-feature mappings created');

  // ─────────────────── 7. Super Admin User ───────────────────
  console.log('  → Creating super admin user...');
  const adminDefaultPwd = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123456';
  const adminPassword = await bcrypt.hash(adminDefaultPwd, 12);
  await prisma.user.upsert({
    where: { email: 'admin@servi-x.com' },
    update: {},
    create: {
      fullName: 'مدير المنصة',
      email: 'admin@servi-x.com',
      phone: '+966500000000',
      passwordHash: adminPassword,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });
  console.log('    ✓ Super admin created (admin@servi-x.com)');

  console.log('\n✅ Platform database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
