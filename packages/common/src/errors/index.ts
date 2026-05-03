// CloudError class hierarchy for typed domain error propagation
export class CloudError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'CloudError';
  }
}

export class NotFoundError extends CloudError {
  constructor(resource: string, id?: string) {
    super('NOT_FOUND', id ? `${resource} '${id}' not found` : `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends CloudError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends CloudError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends CloudError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends CloudError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 422);
    this.name = 'ValidationError';
  }
}

export class PlanLimitError extends CloudError {
  constructor(resource: string) {
    super('PLAN_LIMIT_EXCEEDED', `Plan limit exceeded for ${resource}. Please upgrade.`, 402);
    this.name = 'PlanLimitError';
  }
}
