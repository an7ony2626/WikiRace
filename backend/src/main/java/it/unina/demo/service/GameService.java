package it.unina.demo.service;

import it.unina.demo.dto.request.CreateGameRequest;
import it.unina.demo.dto.request.FollowLinkRequest;
import it.unina.demo.dto.request.LeaderboardSortMode;
import it.unina.demo.dto.response.CompletedGameDetailResponse;
import it.unina.demo.dto.response.CompletedGameSummaryResponse;
import it.unina.demo.dto.response.CompletedGamesPageResponse;
import it.unina.demo.dto.response.GameStateResponse;
import it.unina.demo.dto.response.GameStepResponse;
import it.unina.demo.dto.response.LeaderboardEntryResponse;
import it.unina.demo.dto.response.LeaderboardPageResponse;
import it.unina.demo.exception.BadRequestException;
import it.unina.demo.exception.ConflictException;
import it.unina.demo.exception.DuplicateGameException;
import it.unina.demo.exception.ForbiddenException;
import it.unina.demo.entity.Game;
import it.unina.demo.entity.GameStatus;
import it.unina.demo.entity.GameStep;
import it.unina.demo.entity.User;
import it.unina.demo.repository.GameRepository;
import it.unina.demo.repository.GameStepRepository;
import it.unina.demo.repository.UserRepository;
import it.unina.demo.service.wiki.PageContent;
import it.unina.demo.service.wiki.WikiContentService;
import it.unina.demo.util.SecurityUtil;
import it.unina.demo.util.StringConstants;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GameService {

    private static final int MAX_RANDOM_PICK_ATTEMPTS = 5;

    private final GameRepository gameRepo;
    private final GameStepRepository gameStepRepo;
    private final UserRepository userRepo;
    private final WikiContentService wikiContentService;
    private final SecurityUtil securityUtil;

    @Transactional
    public GameStateResponse createGame(CreateGameRequest request) {
        User user = getCurrentUser();

        List<Game> existing = gameRepo.findByUserIdAndStatus(user.getId(), GameStatus.IN_PROGRESS);
        if (!existing.isEmpty())
            throw new ConflictException("Hai già una partita in corso");

        String requestedStart = blankToNull(request.startPageTitle());
        String requestedTarget = blankToNull(request.targetPageTitle());

        if (requestedStart != null && requestedTarget != null && requestedStart.equalsIgnoreCase(requestedTarget))
            throw new BadRequestException("La pagina di partenza e quella di arrivo devono essere diverse");

        boolean startIsRandom = requestedStart == null || Boolean.TRUE.equals(request.startWasRandom());
        boolean targetIsRandom = requestedTarget == null || Boolean.TRUE.equals(request.targetWasRandom());
        boolean isRandomChallenge = startIsRandom && targetIsRandom;

        String targetTitle = requestedTarget != null
                ? wikiContentService.getPageContent(requestedTarget).title()
                : wikiContentService.getRandomPageTitle();

        String startTitle = requestedStart != null
                ? wikiContentService.getPageContent(requestedStart).title()
                : pickRandomStartDistinctFrom(targetTitle);

        if (startTitle.equals(targetTitle))
            throw new ConflictException("Impossibile scegliere due pagine diverse, riprova");

        handleDuplicateCompletedGame(user, startTitle, targetTitle, Boolean.TRUE.equals(request.confirmReplaceExisting()));

        PageContent startPage = wikiContentService.getPageContent(startTitle);

        Game game = Game.builder()
                .user(user)
                .startPageTitle(startPage.title())
                .targetPageTitle(targetTitle)
                .status(GameStatus.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .numSteps(1)
                .isRandomChallenge(isRandomChallenge)
                .activeSeconds(0L)
                .lastResumedAt(LocalDateTime.now())
                .build();

        gameRepo.save(game);

        GameStep firstStep = GameStep.builder()
                .game(game)
                .stepNumber(1)
                .pageTitle(startPage.title())
                .visitedAt(LocalDateTime.now())
                .build();

        gameStepRepo.save(firstStep);

        return buildGameState(game, startPage, List.of(firstStep));
    }

    private void handleDuplicateCompletedGame(User user, String startTitle, String targetTitle, boolean confirmReplace) {
        gameRepo.findFirstByUserIdAndStatusAndStartPageTitleIgnoreCaseAndTargetPageTitleIgnoreCaseOrderByStartedAtDesc(
                user.getId(), GameStatus.COMPLETED, startTitle, targetTitle
        ).ifPresent(existingGame -> {
            if (!confirmReplace)
                throw new DuplicateGameException(existingGame.getId(), toMoves(existingGame.getNumSteps()));

            gameRepo.delete(existingGame);
        });
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }

    private String pickRandomStartDistinctFrom(String targetTitle) {
        String startTitle = targetTitle;
        for (int attempt = 0; attempt < MAX_RANDOM_PICK_ATTEMPTS && startTitle.equals(targetTitle); attempt++) {
            startTitle = wikiContentService.getRandomPageTitle();
        }
        return startTitle;
    }

    public GameStateResponse getCurrentGame() {
        User user = getCurrentUser();

        Game game = gameRepo.findByUserIdAndStatus(user.getId(), GameStatus.IN_PROGRESS).stream()
                .findFirst()
                .orElseThrow(() -> new EntityNotFoundException("No game currently in progress"));

        return buildGameState(game);
    }
    
    @Transactional
    public GameStateResponse followLink(Long gameId, FollowLinkRequest request) {
        User user = getCurrentUser();
        Game game = getOwnedInProgressGame(user, gameId);

        List<GameStep> steps = gameStepRepo.findByGameIdOrderByStepNumberAsc(game.getId());
        String currentTitle = steps.get(steps.size() - 1).getPageTitle();

        PageContent currentPage = wikiContentService.getPageContent(currentTitle);

        if (!currentPage.linkTitles().contains(request.clickedTitle()))
            throw new BadRequestException(
                    "'" + request.clickedTitle() + "' is not a link on the current page");

        PageContent nextPage = wikiContentService.getPageContent(request.clickedTitle());

        int nextStepNumber = game.getNumSteps() + 1;

        GameStep step = GameStep.builder()
                .game(game)
                .stepNumber(nextStepNumber)
                .pageTitle(nextPage.title())
                .visitedAt(LocalDateTime.now())
                .build();

        gameStepRepo.save(step);

        game.setNumSteps(nextStepNumber);

        if (nextPage.title().equals(game.getTargetPageTitle())) {
            bankActiveTime(game);
            game.setStatus(GameStatus.COMPLETED);
            game.setEndedAt(LocalDateTime.now());
        }

        List<GameStep> updatedSteps = new ArrayList<>(steps);
        updatedSteps.add(step);
        return buildGameState(game, nextPage, updatedSteps);
    }

    @Transactional
    public void abandonGame(Long gameId) {
        User user = getCurrentUser();
        Game game = getOwnedInProgressGame(user, gameId);

        bankActiveTime(game);
        game.setStatus(GameStatus.ABANDONED);
        game.setEndedAt(LocalDateTime.now());
    }

    // Called when the player clicks "Esci": freezes the accumulated
    // active playtime and stops the clock, without ending the game.
    @Transactional
    public void pauseGame(Long gameId) {
        User user = getCurrentUser();
        Game game = getOwnedInProgressGame(user, gameId);

        bankActiveTime(game);
    }

    // Banks the time elapsed since the clock last started running into
    // activeSeconds, then stops the clock. A no-op if already paused.
    private void bankActiveTime(Game game) {
        if (game.getLastResumedAt() == null) return;

        long delta = Duration.between(game.getLastResumedAt(), LocalDateTime.now()).getSeconds();
        game.setActiveSeconds(game.getActiveSeconds() + delta);
        game.setLastResumedAt(null);
    }

    // Called whenever the player opens the game (GET /{id}): if the
    // clock was paused, this is the moment play resumes.
    private void resumeIfPaused(Game game) {
        if (game.getStatus() == GameStatus.IN_PROGRESS && game.getLastResumedAt() == null) {
            game.setLastResumedAt(LocalDateTime.now());
        }
    }

    private long computeElapsedSeconds(Game game) {
        long banked = game.getActiveSeconds();
        if (game.getLastResumedAt() != null) {
            banked += Duration.between(game.getLastResumedAt(), LocalDateTime.now()).getSeconds();
        }
        return banked;
    }

    @Transactional
    public GameStateResponse getGameState(Long gameId) {
        User user = getCurrentUser();
        Game game = getOwnedGame(user, gameId);
        resumeIfPaused(game);
        return buildGameState(game);
    }

    public LeaderboardPageResponse getLeaderboard(
            Boolean isRandom, String requiredTargetTitle, LeaderboardSortMode sortMode, int page, int size
    ) {
        Pageable pageable = PageRequest.of(page, size);

        Page<Object[]> resultPage = sortMode == LeaderboardSortMode.GAMES_PLAYED
                ? gameRepo.findLeaderboardPageByGamesPlayed(GameStatus.COMPLETED, isRandom, requiredTargetTitle, pageable)
                : gameRepo.findLeaderboardPageByBestMoves(GameStatus.COMPLETED, isRandom, requiredTargetTitle, pageable);

        List<LeaderboardEntryResponse> entries = resultPage.getContent().stream()
                .map(row -> new LeaderboardEntryResponse(
                        (Long) row[0],
                        (String) row[1],
                        (Long) row[2],
                        toMoves(((Number) row[3]).intValue())
                ))
                .toList();

        return new LeaderboardPageResponse(
                entries, resultPage.hasNext(), findRank(sortMode, isRandom, requiredTargetTitle));
    }

    // 1-based position of the logged-in user within the full ranking, or
    // null if nobody is logged in or they have no completed game matching
    // the current filter. Unlike the page above, this needs every row to
    // locate one user's position — but that's bounded by the number of
    // distinct players, not the number of games played, and only runs at
    // all when someone is actually logged in (the common anonymous-preview
    // case, e.g. the homepage for a logged-out visitor, skips it entirely).
    private Integer findRank(LeaderboardSortMode sortMode, Boolean isRandom, String requiredTargetTitle) {
        String username = securityUtil.getCurrentUsernameOrNull();
        if (username == null) return null;

        List<Object[]> rows = sortMode == LeaderboardSortMode.GAMES_PLAYED
                ? gameRepo.findLeaderboardByGamesPlayed(GameStatus.COMPLETED, isRandom, requiredTargetTitle)
                : gameRepo.findLeaderboardByBestMoves(GameStatus.COMPLETED, isRandom, requiredTargetTitle);

        for (int i = 0; i < rows.size(); i++) {
            if (username.equals(rows.get(i)[1])) return i + 1;
        }
        return null;
    }

    private User getCurrentUser() {
        String username = securityUtil.getCurrentUsername();
        return userRepo.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException(StringConstants.USER_NOT_FOUND_MESSAGE));
    }

    private Game getOwnedGame(User user, Long gameId) {
        Game game = gameRepo.findById(gameId)
                .orElseThrow(() -> new EntityNotFoundException("Game not found: " + gameId));

        if (!game.getUser().getId().equals(user.getId()))
            throw new ForbiddenException("This game does not belong to you");

        return game;
    }

    private Game getOwnedInProgressGame(User user, Long gameId) {
        Game game = getOwnedGame(user, gameId);

        if (game.getStatus() != GameStatus.IN_PROGRESS)
            throw new ConflictException("Game is not in progress");

        return game;
    }

    // moves (clicks) = pages visited - 1. Kept as a single named
    // conversion rather than scattering "- 1" across every mapping
    // method below.
    private int toMoves(int numSteps) {
        return numSteps - 1;
    }

    private GameStateResponse buildGameState(Game game) {
        List<GameStep> steps = gameStepRepo.findByGameIdOrderByStepNumberAsc(game.getId());
        String currentTitle = steps.get(steps.size() - 1).getPageTitle();
        PageContent currentPage = wikiContentService.getPageContent(currentTitle);
        return buildGameState(game, currentPage, steps);
    }

    private GameStateResponse buildGameState(Game game, PageContent currentPage, List<GameStep> steps) {
        List<GameStepResponse> path = steps.stream()
                .map(s -> new GameStepResponse(s.getStepNumber(), s.getPageTitle()))
                .toList();

        return new GameStateResponse(
                game.getId(),
                game.getStartPageTitle(),
                game.getTargetPageTitle(),
                game.getStatus(),
                toMoves(game.getNumSteps()),
                currentPage.title(),
                currentPage.content(),
                currentPage.linkTitles(),
                path,
                computeElapsedSeconds(game)
        );
    }

    public CompletedGamesPageResponse getCompletedGames(Boolean isRandom, String requiredTargetTitle, int page, int size) {
        Page<Game> result = gameRepo.findCompletedGames(
                GameStatus.COMPLETED, isRandom, requiredTargetTitle, PageRequest.of(page, size));

        List<CompletedGameSummaryResponse> games = result.getContent().stream()
                .map(this::toSummary)
                .toList();

        return new CompletedGamesPageResponse(games, result.hasNext());
    }

    public CompletedGameDetailResponse getCompletedGameDetail(Long gameId) {
        Game game = gameRepo.findByIdWithUser(gameId)
            .filter(g -> g.getStatus() == GameStatus.COMPLETED)
            .orElseThrow(() -> new EntityNotFoundException("Completed game not found: " + gameId));

        List<GameStep> steps = gameStepRepo.findByGameIdOrderByStepNumberAsc(game.getId());

        List<GameStepResponse> path = steps.stream()
                .map(s -> new GameStepResponse(s.getStepNumber(), s.getPageTitle()))
                .toList();

        return new CompletedGameDetailResponse(
                game.getId(),
                game.getUser().getUsername(),
                game.getStartPageTitle(),
                game.getTargetPageTitle(),
                toMoves(game.getNumSteps()),
                game.getActiveSeconds(),
                game.getIsRandomChallenge(),
                path
        );
    }

    private CompletedGameSummaryResponse toSummary(Game game) {
        return new CompletedGameSummaryResponse(
                game.getId(),
                game.getUser().getUsername(),
                game.getStartPageTitle(),
                game.getTargetPageTitle(),
                toMoves(game.getNumSteps()),
                game.getActiveSeconds(),
                game.getIsRandomChallenge()
        );
    }
}