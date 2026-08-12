import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for all domain/business exceptions in the application.
 * Extends HttpException so Nest's default handling still works,
 * but adds a stable `errorCode` for clients/frontend to branch on
 * without parsing message strings.
 */
export class AppException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ errorCode, message, details }, status);
  }
}