package it.unina.demo.service;

import it.unina.demo.dto.request.LoginRequest;
import it.unina.demo.dto.request.RegisterRequest;
import it.unina.demo.entity.User;
import it.unina.demo.exception.ConflictException;
import it.unina.demo.exception.UnauthorizedException;
import it.unina.demo.repository.UserRepository;
import it.unina.demo.service.utilityservice.JwtService;
import it.unina.demo.util.StringConstants;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepo;
    private final PasswordEncoder encoder;
    private final JwtService jwtService;

    @Transactional
    public AuthResult register(RegisterRequest request) {
        if (userRepo.existsByUsername(request.username()))
            throw new ConflictException(StringConstants.USERNAME_TAKEN_MESSAGE);

        if (userRepo.existsByEmail(request.email()))
            throw new ConflictException(StringConstants.EMAIL_TAKEN_MESSAGE);

        User user = User.builder()
                .username(request.username())
                .email(request.email())
                .passwordHash(encoder.encode(request.rawPassword()))
                .createdAt(LocalDateTime.now())
                .build();

        userRepo.save(user);

        return new AuthResult(jwtService.generateToken(user), user.getUsername());
    }

    public AuthResult login(LoginRequest request) {
        User user = userRepo.findByUsername(request.username())
                .orElseThrow(() -> new UnauthorizedException(StringConstants.INVALID_CREDENTIALS_MESSAGE));

        if (!encoder.matches(request.rawPassword(), user.getPasswordHash()))
            throw new UnauthorizedException(StringConstants.INVALID_CREDENTIALS_MESSAGE);

        return new AuthResult(jwtService.generateToken(user), user.getUsername());
    }
}
