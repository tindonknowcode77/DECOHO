import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { normalizeRole, Role } from '../enums/roles.enum';

type RequestUser = {
  role?: string;
  roles?: string[];
};

type RequestWithUser = Request & {
  user?: RequestUser;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userRoles = this.getUserRoles(request.user);

    const hasRequiredRole = requiredRoles.some((requiredRole) =>
      userRoles.includes(requiredRole),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }

  private getUserRoles(user?: RequestUser): Role[] {
    const roles = [user?.role, ...(user?.roles ?? [])];

    return roles
      .map((role) => normalizeRole(role))
      .filter((role): role is Role => role !== null);
  }
}
