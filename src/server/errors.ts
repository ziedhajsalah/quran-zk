export class AppError extends Error {}
export function fail(message: string): never {
  throw new AppError(message)
}
