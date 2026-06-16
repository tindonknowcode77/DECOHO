export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export function normalizeRole(role?: string): Role | null {
  if (!role) {
    return null;
  }

  const normalizedRole = role.toUpperCase();

  if (normalizedRole === Role.USER) {
    return Role.USER;
  }

  if (normalizedRole === Role.ADMIN) {
    return Role.ADMIN;
  }

  return null;
}
