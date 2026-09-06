package it.unina.demo.service;

// Internal carrier between AuthService and AuthController: the raw JWT
// never appears in AuthResponse (the public DTO) since it's set as an
// httpOnly cookie by the controller instead of being returned in the body.
public record AuthResult(String token, String username) {
}
