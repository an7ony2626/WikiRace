package it.unina.demo.service.utilityservice;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import it.unina.demo.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.util.Date;
import java.util.function.Function;

@Service
public class JwtService {

    @Value("${JWT_KEY}")
    private String key;

    // Name of the httpOnly cookie the frontend's JWT is carried in.
    public static final String COOKIE_NAME = "wikirace_jwt";

    // Single source of truth for token lifetime — AuthController's
    // cookie Max-Age must match this, or the cookie could outlive (or
    // expire before) the token it carries.
    public static final Duration TOKEN_TTL = Duration.ofHours(12);

    // Fails at startup with an actionable message instead of a bare 500 on
    // the first login: the key must be Base64 and decode to >= 256 bits.
    @PostConstruct
    void validateKey() {
        try {
            getSignInKey();
        } catch (RuntimeException e) {
            throw new IllegalStateException(
                    "JWT_KEY is invalid: it must be a Base64 string of at least 32 bytes "
                            + "(generate one with `openssl rand -base64 48`). Cause: " + e.getMessage(), e);
        }
    }

    public String generateToken(User user) {
        return Jwts.builder()
                .subject(user.getUsername())
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + TOKEN_TTL.toMillis()))
                .signWith(getSignInKey())
                .compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSignInKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(key);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}