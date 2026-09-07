export class AppError extends Error {
  public constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ConfigurationError extends AppError {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, 500, "CONFIGURATION_ERROR", options);
  }
}

export class AuthenticationError extends AppError {
  public constructor(
    message = "Authentication failed",
    options?: ErrorOptions,
  ) {
    super(message, 401, "AUTHENTICATION_FAILED", options);
  }
}

export class AuthorizationError extends AppError {
  public constructor(
    message = "Operation is not permitted",
    options?: ErrorOptions,
  ) {
    super(message, 403, "AUTHORIZATION_DENIED", options);
  }
}

export class ExternalServiceError extends AppError {
  public constructor(service: string, message: string, options?: ErrorOptions) {
    super(`${service}: ${message}`, 502, "UPSTREAM_ERROR", options);
  }
}

export class NotFoundError extends AppError {
  public constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}
