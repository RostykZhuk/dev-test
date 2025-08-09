// Custom SSE error base class
export class SSEError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string, statusCode = 500) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Specific error types
export class ClientNotFoundError extends SSEError {
  constructor(clientId: string) {
    super(`Client ${clientId} not found`, "CLIENT_NOT_FOUND", 404);
  }
}

export class ConnectionLimitError extends SSEError {
  constructor(limit: number) {
    super(
      `Connection limit of ${limit} exceeded`,
      "CONNECTION_LIMIT_EXCEEDED",
      429,
    );
  }
}

export class InvalidEventError extends SSEError {
  constructor(reason: string) {
    super(`Invalid event: ${reason}`, "INVALID_EVENT", 400);
  }
}

export class AuthenticationError extends SSEError {
  constructor() {
    super("Authentication required", "AUTHENTICATION_REQUIRED", 401);
  }
}

// Error handler utility
export const handleSSEError = (error: unknown): Response => {
  console.error("SSE Error:", error);

  if (error instanceof SSEError) {
    return new Response(
      JSON.stringify({
        error: error.code,
        message: error.message,
      }),
      {
        status: error.statusCode,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Default error response
  return new Response(
    JSON.stringify({
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    },
  );
};
