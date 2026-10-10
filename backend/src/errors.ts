export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function allow(role: string, roles: string[]) {
  if (!roles.includes(role))
    throw new ApiError(
      403,
      "FORBIDDEN",
      "You do not have permission for this action",
    );
}
export function percentage(present: number, total: number) {
  return total ? Math.round((present / total) * 100) : 0;
}
