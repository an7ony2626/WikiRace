package it.unina.demo.config;

import io.jsonwebtoken.JwtException;
import it.unina.demo.service.utilityservice.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        final String jwt = extractToken(request);

        if (jwt != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                authenticate(jwt, request);
            } catch (JwtException | IllegalArgumentException e) {
                // Malformed, expired, or tampered token: proceed unauthenticated
                // instead of letting the exception escape the filter chain —
                // filters run before @ControllerAdvice ever sees anything, so
                // an uncaught exception here becomes a raw 500 instead of the
                // clean 401 that downstream authorization rules would produce.
                log.debug("Ignoring invalid JWT: {}", e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }

    private void authenticate(String jwt, HttpServletRequest request) {
        String username = jwtService.extractUsername(jwt);
        if (username == null) return;

        UserDetails userDetails = userDetailsService.loadUserByUsername(username);

        if (jwtService.isTokenValid(jwt, userDetails)) {
            UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities());
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);
        }
    }

    // The JWT cookie is the primary path (used by the frontend); the
    // Authorization header is still supported as a fallback so Swagger
    // UI's "Authorize" button keeps working for manual API testing.
    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;

        for (Cookie cookie : cookies) {
            if (JwtService.COOKIE_NAME.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }
}
