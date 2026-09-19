/**
 * Teams / RBAC — mirrors the salo-run dashboard's team management on
 * `/api/remote/team/**` (web parity: TeamController.java).
 *
 * Every endpoint is owner-only at the controller layer. Mobile mirrors
 * that gate: the screens only render when `me.isOwner === true` and
 * fall back to a "members can't manage the team" notice otherwise.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ApiError, ID } from '@/types';

type Raw = Record<string, unknown>;

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

export type PermissionDef = { name: string; description?: string };
export type PermissionsCatalog = {
  categories: Record<string, PermissionDef[]>;
  total: number;
};

export type TeamRole = {
  id: ID;
  name: string;
  description?: string;
  permissions: string[];
};

export type TeamMember = {
  id: ID;
  email: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  active: boolean;
  role?: { id: ID; name: string };
  invitedAt?: string;
  lastLogin?: string;
};

export type MePermissions = {
  isOwner: boolean;
  organizationId?: ID;
  organizationName?: string;
  roleId?: ID;
  roleName?: string;
  permissions: string[];
  mustChangePassword?: boolean;
};

// ────── Catalog ──────────────────────────────────────────────────────────

export async function getPermissionsCatalog(): Promise<PermissionsCatalog> {
  const res = await api.get<ApiEnvelope<Raw>>('/team/permissions');
  const d = (res?.data ?? {}) as Raw;
  const cats: Record<string, PermissionDef[]> = {};
  const raw = (d.categories ?? {}) as Record<string, Raw[]>;
  for (const [cat, defs] of Object.entries(raw)) {
    cats[cat] = (Array.isArray(defs) ? defs : []).map((p) => ({
      name: String(p.name ?? ''),
      description: str(p.description),
    })).filter((p) => p.name);
  }
  return { categories: cats, total: typeof d.total === 'number' ? d.total : 0 };
}

// ────── Roles ────────────────────────────────────────────────────────────

function mapRole(r: Raw): TeamRole {
  return {
    id: String(r.id ?? ''),
    name: str(r.name) ?? 'Role',
    description: str(r.description),
    permissions: Array.isArray(r.permissions)
      ? (r.permissions as unknown[]).map(String)
      : [],
  };
}

export async function listRoles(): Promise<TeamRole[]> {
  const res = await api.get<ApiEnvelope<Raw>>('/team/roles');
  const d = (res?.data ?? {}) as Raw;
  const items = Array.isArray(d.roles) ? (d.roles as Raw[]) : [];
  return items.map(mapRole).filter((r) => r.id);
}

export async function createRole(input: {
  name: string;
  description?: string;
  permissions: string[];
}): Promise<TeamRole> {
  const res = await api.post<ApiEnvelope<Raw>>('/team/roles', input);
  const d = (res?.data ?? {}) as Raw;
  return mapRole((d.role ?? {}) as Raw);
}

export async function updateRole(
  roleId: string,
  input: { name?: string; description?: string; permissions?: string[] },
): Promise<TeamRole> {
  const res = await api.put<ApiEnvelope<Raw>>(
    `/team/roles/${encodeURIComponent(roleId)}`,
    input,
  );
  const d = (res?.data ?? {}) as Raw;
  return mapRole((d.role ?? {}) as Raw);
}

export async function deleteRole(roleId: string): Promise<void> {
  await api.delete(`/team/roles/${encodeURIComponent(roleId)}`);
}

// ────── Members ──────────────────────────────────────────────────────────

function mapMember(r: Raw): TeamMember {
  const role = (r.role ?? null) as Raw | null;
  return {
    id: String(r.id ?? ''),
    email: str(r.email) ?? '',
    firstName: str(r.firstName),
    lastName: str(r.lastName),
    department: str(r.department),
    active: r.active === true,
    role: role
      ? { id: String(role.id ?? ''), name: str(role.name) ?? 'Role' }
      : undefined,
    invitedAt: str(r.invitedAt),
    lastLogin: str(r.lastLogin),
  };
}

export async function listMembers(): Promise<TeamMember[]> {
  const res = await api.get<ApiEnvelope<Raw>>('/team/users');
  const d = (res?.data ?? {}) as Raw;
  const items = Array.isArray(d.users) ? (d.users as Raw[]) : [];
  return items.map(mapMember).filter((m) => m.id);
}

export async function inviteMember(input: {
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  department?: string;
}): Promise<TeamMember> {
  const res = await api.post<ApiEnvelope<Raw>>('/team/users', input);
  // A refusal (address already on the team, seat limit reached, role gone)
  // is HTTP 200 with action:0. Mapping the empty payload returned a blank
  // member and the owner went back to the list believing an invite was sent.
  if (res?.action !== 1) {
    throw {
      status: 400,
      message: res?.message || 'Could not send that invitation.',
    } satisfies ApiError;
  }
  const d = (res?.data ?? {}) as Raw;
  return mapMember((d.user ?? {}) as Raw);
}

export async function updateMember(
  memberId: string,
  input: { roleId?: string; department?: string; active?: boolean },
): Promise<TeamMember> {
  const res = await api.put<ApiEnvelope<Raw>>(
    `/team/users/${encodeURIComponent(memberId)}`,
    input,
  );
  const d = (res?.data ?? {}) as Raw;
  return mapMember((d.user ?? {}) as Raw);
}

export async function deactivateMember(memberId: string): Promise<void> {
  await api.post(`/team/users/${encodeURIComponent(memberId)}/deactivate`);
}

export async function activateMember(memberId: string): Promise<void> {
  await api.post(`/team/users/${encodeURIComponent(memberId)}/activate`);
}

export async function removeMember(memberId: string): Promise<void> {
  await api.delete(`/team/users/${encodeURIComponent(memberId)}`);
}

// ────── Self ────────────────────────────────────────────────────────────

export async function getMyPermissions(): Promise<MePermissions> {
  const res = await api.get<ApiEnvelope<Raw>>('/team/me/permissions');
  const d = (res?.data ?? {}) as Raw;
  return {
    isOwner: d.isOwner === true,
    organizationId: str(d.organizationId),
    organizationName: str(d.organizationName),
    roleId: str(d.roleId),
    roleName: str(d.roleName),
    permissions: Array.isArray(d.permissions) ? (d.permissions as unknown[]).map(String) : [],
    mustChangePassword: d.mustChangePassword === true,
  };
}
