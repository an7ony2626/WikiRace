package it.unina.demo.dto.response;

// The JWT itself never appears here — it's set as an httpOnly cookie by
// AuthController instead, so client-side JS never has read access to it.
public record AuthResponse(String username) {
}
