package it.unina.demo.controller;

import it.unina.demo.dto.request.LoginRequest;
import it.unina.demo.dto.request.RegisterRequest;
import it.unina.demo.dto.response.AuthResponse;
import it.unina.demo.service.AuthResult;
import it.unina.demo.service.AuthService;
import it.unina.demo.service.utilityservice.JwtService;
import it.unina.demo.util.SecurityUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final SecurityUtil securityUtil;

    // Whether the JWT cookie carries Secure + SameSite=None (required for
    // the cross-origin prod deployment) or the relaxed dev defaults
    // (plain http on localhost can't accept a Secure cookie at all).
    @Value("${cookie.secure}")
    private boolean cookieSecure;

    @Value("${cookie.samesite}")
    private String cookieSameSite;

    // Registration creates a new User resource: 201 Created.
    // No Location header — there's no GET /api/users/{id} endpoint yet
    // to point at, and adding one just for this would be speculative.
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResult result = authService.register(request);
        return withJwtCookie(ResponseEntity.status(201), result.token())
                .body(new AuthResponse(result.username()));
    }

    // Login doesn't create anything, it's an operation that produces a
    // token: 200 OK, not 201.
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResult result = authService.login(request);
        return withJwtCookie(ResponseEntity.ok(), result.token())
                .body(new AuthResponse(result.username()));
    }

    // Clears the JWT cookie. The frontend can no longer read or delete
    // an httpOnly cookie itself, so a real round trip is required —
    // there is no client-side equivalent of the old localStorage.removeItem.
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        ResponseCookie expired = ResponseCookie.from(JwtService.COOKIE_NAME, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(0)
                .build();

        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, expired.toString())
                .build();
    }

    // Resolves the current session from the JWT cookie, which JS can't
    // read directly. Protected by the default security rule (anyRequest
    // authenticated) — an invalid/missing cookie never reaches this method,
    // it gets a 401 from the filter chain first.
    @GetMapping("/me")
    public AuthResponse me() {
        return new AuthResponse(securityUtil.getCurrentUsername());
    }

    private ResponseEntity.BodyBuilder withJwtCookie(ResponseEntity.BodyBuilder builder, String token) {
        ResponseCookie cookie = ResponseCookie.from(JwtService.COOKIE_NAME, token)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(JwtService.TOKEN_TTL)
                .build();

        return builder.header(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
