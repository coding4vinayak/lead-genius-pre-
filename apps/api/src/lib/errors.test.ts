import { describe, it, expect, vi } from 'vitest';
import { AppError, handlePrismaError } from './errors.js';
import { Prisma } from '@prisma/client';

describe('AppError', () => {
  it('should create error with status code and message', () => {
    const err = new AppError(400, 'Bad request');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Bad request');
    expect(err.name).toBe('AppError');
  });

  it('should create not found error', () => {
    const err = AppError.notFound('Lead');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Lead not found');
  });

  it('should create validation error with details', () => {
    const details = [{ field: 'email', message: 'Invalid email' }];
    const err = AppError.validation('Validation failed', details);
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual(details);
  });

  it('should create validation error without details', () => {
    const err = AppError.validation('Validation failed');
    expect(err.statusCode).toBe(400);
    expect(err.details).toBeUndefined();
  });

  it('should create conflict error', () => {
    const err = AppError.conflict('Resource already exists');
    expect(err.statusCode).toBe(409);
  });

  it('should create internal error with default message', () => {
    const err = AppError.internal();
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('Internal server error');
  });

  it('should create internal error with custom message', () => {
    const err = AppError.internal('Custom internal error');
    expect(err.message).toBe('Custom internal error');
  });
});

describe('handlePrismaError', () => {
  function makePrismaError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('Prisma error', { code, clientVersion: '6.5.0' });
  }

  it('should handle P2025 not found', () => {
    const result = handlePrismaError(makePrismaError('P2025'));
    expect(result).toBeInstanceOf(AppError);
    expect(result.statusCode).toBe(404);
    expect(result.message).toBe('Resource not found');
  });

  it('should handle P2002 conflict', () => {
    const result = handlePrismaError(makePrismaError('P2002'));
    expect(result).toBeInstanceOf(AppError);
    expect(result.statusCode).toBe(409);
    expect(result.message).toBe('Resource already exists');
  });

  it('should return AppError as-is', () => {
    const original = AppError.notFound('Test');
    const result = handlePrismaError(original);
    expect(result).toBe(original);
  });

  it('should return 500 for unknown prisma error codes', () => {
    const result = handlePrismaError(makePrismaError('P2020'));
    expect(result.statusCode).toBe(500);
  });

  it('should return 500 for non-prisma errors', () => {
    const result = handlePrismaError(new Error('Some error'));
    expect(result.statusCode).toBe(500);
  });
});
