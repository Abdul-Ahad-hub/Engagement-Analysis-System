import { HttpStatus } from '@nestjs/common';
import { AppException } from './App.Exceptions';

/** Thrown when incoming frame payload fails validation beyond basic DTO checks. */
export class FrameValidationException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super(
      'FRAME_VALIDATION_FAILED',
      'The submitted frame failed validation.',
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

/** Thrown when a requested engagement record cannot be found. */
export class FrameNotFoundException extends AppException {
  constructor(id: string) {
    super(
      'FRAME_NOT_FOUND',
      `No engagement record found for id ${id}.`,
      HttpStatus.NOT_FOUND,
    );
  }
}

/** Thrown when the downstream deep learning model call fails or times out. */
export class ModelInferenceException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super(
      'MODEL_INFERENCE_FAILED',
      'The engagement model failed to process the frame.',
      HttpStatus.BAD_GATEWAY,
      details,
    );
  }
}

/** Thrown when the repository layer fails to persist or read data. */
export class PersistenceException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super(
      'PERSISTENCE_FAILED',
      'A data persistence error occurred.',
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}


export class TemporaryStorageException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super(
      'TEMPORARY_STORAGE_FAILED',
      'A temporary storage error occurred.',
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}