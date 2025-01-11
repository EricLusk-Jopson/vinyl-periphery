export type RoleTransformer = (roles: string[]) => string[];
export type SingleRoleTransformer = (role: string) => string;
export type Pipeline = (roles: string[]) => string[];
