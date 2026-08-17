export enum Role {
  USER = 'USER',
  SUPPLIER = 'SUPPLIER',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export function normalizeRole(role?: string): Role | null {
  if (!role) {
    return null;
  }

  const normalizedRole = role.toUpperCase();

  if (normalizedRole === Role.USER || normalizedRole === 'CUSTOMER') {
    return Role.USER;
  }

  if (normalizedRole === Role.ADMIN) {
    return Role.ADMIN;
  }

  if (normalizedRole === Role.STAFF) {
    return Role.STAFF;
  }

  if (normalizedRole === Role.SUPER_ADMIN) {
    return Role.SUPER_ADMIN;
  }

  if (normalizedRole === Role.SUPPLIER || normalizedRole === 'STORE') {
    return Role.SUPPLIER;
  }

  return null;
}
