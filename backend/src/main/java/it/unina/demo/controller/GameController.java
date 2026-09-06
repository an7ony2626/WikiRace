package it.unina.demo.controller;

import it.unina.demo.dto.request.CreateGameRequest;
import it.unina.demo.dto.request.FollowLinkRequest;
import it.unina.demo.dto.request.GameFilterMode;
import it.unina.demo.dto.request.LeaderboardSortMode;
import it.unina.demo.dto.request.UpdateGameStatusRequest;
import it.unina.demo.dto.response.CompletedGameDetailResponse;
import it.unina.demo.dto.response.CompletedGamesPageResponse;
import it.unina.demo.dto.response.GameStateResponse;
import it.unina.demo.dto.response.LeaderboardPageResponse;
import it.unina.demo.entity.GameStatus;
import it.unina.demo.exception.BadRequestException;
import it.unina.demo.service.GameService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;

@RestController
@RequestMapping("/api/games")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class GameController {

    private static final int DEFAULT_COMPLETED_PAGE_SIZE = 10;
    private static final int DEFAULT_LEADERBOARD_PAGE_SIZE = 10;

    private final GameService gameService;

    @GetMapping("/current")
    public GameStateResponse getCurrentGame() {
        return gameService.getCurrentGame();
    }

    @SecurityRequirements
    @GetMapping("/leaderboard")
    public LeaderboardPageResponse getLeaderboard(
            @RequestParam(defaultValue = "ALL") GameFilterMode mode,
            @RequestParam(defaultValue = "BEST_MOVES") LeaderboardSortMode sortBy,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + DEFAULT_LEADERBOARD_PAGE_SIZE) int size
    ) {
        return gameService.getLeaderboard(mode.toIsRandomChallenge(), mode.toRequiredTargetTitle(), sortBy, page, size);
    }

    @GetMapping("/{id}")
    public GameStateResponse getGame(@PathVariable Long id) {
        return gameService.getGameState(id);
    }


    @PostMapping("/{id}/moves")
    public ResponseEntity<GameStateResponse> followLink(
            @PathVariable Long id,
            @Valid @RequestBody FollowLinkRequest request
    ) {
        GameStateResponse game = gameService.followLink(id, request);
        URI location = URI.create("/api/games/" + id + "/moves/" + game.moves());
        return ResponseEntity.created(location).body(game);
    }

    // Partial update of the game resource's status. Only ABANDONED is a
    // valid client-initiated transition (COMPLETED only happens as a
    // side effect of reaching the target via /moves).
    @PatchMapping("/{id}")
    public GameStateResponse updateGameStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateGameStatusRequest request
    ) {
        if (request.status() != GameStatus.ABANDONED)
            throw new BadRequestException("Only transitioning a game to ABANDONED is supported");

        gameService.abandonGame(id);
        return gameService.getGameState(id);
    }

    @SecurityRequirements
    @GetMapping("/completed")
    public CompletedGamesPageResponse getCompletedGames(
            @RequestParam(defaultValue = "ALL") GameFilterMode mode,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + DEFAULT_COMPLETED_PAGE_SIZE) int size
    ) {
        return gameService.getCompletedGames(mode.toIsRandomChallenge(), mode.toRequiredTargetTitle(), page, size);
    }

    @SecurityRequirements
    @GetMapping("/completed/{id}")
    public CompletedGameDetailResponse getCompletedGame(@PathVariable Long id) {
        return gameService.getCompletedGameDetail(id);
    }

    @PostMapping("/{id}/pause")
    public ResponseEntity<Void> pauseGame(@PathVariable Long id) {
        gameService.pauseGame(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    public ResponseEntity<GameStateResponse> createGame(@Valid @RequestBody CreateGameRequest request) {
        GameStateResponse game = gameService.createGame(request);
        return ResponseEntity.created(URI.create("/api/games/" + game.gameId())).body(game);
    }
}