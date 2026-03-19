import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import type { Role, Permission, RolePermission } from '../../shared/database';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';

export type RoleWithPermissions = Role & {
  rolePermissions: (RolePermission & { permission: Permission })[];
};

export interface GroupedPermissions {
  group: string;
  permissions: Permission[];
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PlatformPrismaClient) {}

  async findAll(): Promise<Role[]> {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<RoleWithPermissions> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('الدور غير موجود');
    }

    return role;
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('اسم الدور مستخدم بالفعل');
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        nameAr: dto.nameAr,
        isSystem: false,
      },
    });
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('الدور غير موجود');
    }

    if (role.isSystem) {
      throw new BadRequestException('لا يمكن تعديل الأدوار الأساسية للنظام');
    }

    if (dto.name && dto.name !== role.name) {
      const existingName = await this.prisma.role.findUnique({
        where: { name: dto.name },
      });
      if (existingName) {
        throw new ConflictException('اسم الدور مستخدم بالفعل');
      }
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
      },
    });
  }

  async remove(id: string): Promise<Role> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { tenantUsers: { take: 1 } },
    });

    if (!role) {
      throw new NotFoundException('الدور غير موجود');
    }

    if (role.isSystem) {
      throw new BadRequestException('لا يمكن حذف الأدوار الأساسية للنظام');
    }

    if (role.tenantUsers.length > 0) {
      throw new BadRequestException(
        'لا يمكن حذف هذا الدور لأنه مرتبط بمستخدمين. قم بتغيير أدوار المستخدمين أولاً',
      );
    }

    return this.prisma.role.delete({
      where: { id },
    });
  }

  async getPermissions(): Promise<GroupedPermissions[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { nameAr: 'asc' }],
    });

    const groupMap = new Map<string, Permission[]>();

    for (const permission of permissions) {
      const group = groupMap.get(permission.group);
      if (group) {
        group.push(permission);
      } else {
        groupMap.set(permission.group, [permission]);
      }
    }

    return Array.from(groupMap.entries()).map(([group, perms]) => ({
      group,
      permissions: perms,
    }));
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('الدور غير موجود');
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });

    return rolePermissions.map((rp) => rp.permission);
  }

  async setRolePermissions(
    roleId: string,
    dto: SetPermissionsDto,
  ): Promise<Permission[]> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('الدور غير موجود');
    }

    if (role.isSystem) {
      throw new BadRequestException('لا يمكن تعديل صلاحيات الأدوار الأساسية للنظام');
    }

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    });

    if (permissions.length !== dto.permissionIds.length) {
      throw new BadRequestException('بعض معرفات الصلاحيات غير صالحة');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      await tx.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      });
    });

    return this.getRolePermissions(roleId);
  }
}
