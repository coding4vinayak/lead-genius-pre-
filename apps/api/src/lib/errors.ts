import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(resource: string) {
    return new AppError(404, `${resource} not found`);
  }

  static validation(message: string, details?: unknown) {
    return new AppError(400, message, details);
  }

  static conflict(message: string) {
    return new AppError(409, message);
  }

  static internal(message = 'Internal server error') {
    return new AppError(500, message);
  }
}

export function handlePrismaError(error: unknown): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return AppError.notFound('Resource');
    if (error.code === 'P2002') return AppError.conflict('Resource already exists');
  }
  if (error instanceof AppError) return error;
  return AppError.internal();
}
