/** Domain errors carry a machine-readable `code` so outer layers can map them (HTTP status, agent tool result). */
export class DomainError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}
export class ValidationError extends DomainError {}
export class NotFoundError extends DomainError {}
export class ConflictError extends DomainError {}
export class UnauthorizedError extends DomainError {}
export class RateLimitError extends DomainError {}
export class NotConfiguredError extends DomainError {}
