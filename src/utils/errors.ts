/**
 * Erro de dominio: a `message` é segura para ser exibida ao usuario no Discord.
 * Qualquer outro erro é tratado como falha inesperada — o usuario recebe uma
 * mensagem generica e o detalhe tecnico vai apenas para os logs.
 */
export class AppError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION');
    this.name = 'ValidationError';
  }
}

export class PermissionError extends AppError {
  constructor(message = 'Voce nao tem permissao para executar essa acao.') {
    super(message, 'PERMISSION');
    this.name = 'PermissionError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
