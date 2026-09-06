// Mirrors backend DTOs 1:1 (it.unina.demo.dto.request / .response).
// Field names must match exactly — no mapping layer on this side.

export interface LoginRequest {
  username: string;
  rawPassword: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  rawPassword: string;
}

// The JWT itself never appears here — the backend sets it as an
// httpOnly cookie, so client-side JS never has read access to it.
export interface AuthResponse {
  username: string;
}
