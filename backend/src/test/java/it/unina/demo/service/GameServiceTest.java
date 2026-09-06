package it.unina.demo.service;

import it.unina.demo.dto.request.FollowLinkRequest;
import it.unina.demo.dto.request.LeaderboardSortMode;
import it.unina.demo.dto.response.CompletedGameDetailResponse;
import it.unina.demo.dto.response.GameStateResponse;
import it.unina.demo.dto.response.LeaderboardEntryResponse;
import it.unina.demo.dto.response.LeaderboardPageResponse;
import it.unina.demo.entity.Game;
import it.unina.demo.entity.GameStatus;
import it.unina.demo.entity.GameStep;
import it.unina.demo.entity.User;
import it.unina.demo.exception.BadRequestException;
import it.unina.demo.exception.ForbiddenException;
import it.unina.demo.repository.GameRepository;
import it.unina.demo.repository.GameStepRepository;
import it.unina.demo.repository.UserRepository;
import it.unina.demo.service.wiki.PageContent;
import it.unina.demo.service.wiki.WikiContentService;
import it.unina.demo.util.SecurityUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import static org.mockito.Mockito.lenient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GameServiceTest {

    @Mock
    private GameRepository gameRepo;
    @Mock
    private GameStepRepository gameStepRepo;
    @Mock
    private UserRepository userRepo;
    @Mock
    private WikiContentService wikiContentService;
    @Mock
    private SecurityUtil securityUtil;

    @InjectMocks
    private GameService gameService;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .username("alice")
                .email("alice@example.com")
                .passwordHash("hash")
                .createdAt(LocalDateTime.now())
                .build();

        lenient().when(securityUtil.getCurrentUsername()).thenReturn("alice");
        lenient().when(userRepo.findByUsername("alice")).thenReturn(Optional.of(user));
    }

    @Test
    void getCurrentGame_returnsExistingGame_whenInProgress() {
        Game existing = inProgressGame();
        GameStep existingStep = stepOf(existing, 1, "Napoli");

        when(gameRepo.findByUserIdAndStatus(1L, GameStatus.IN_PROGRESS)).thenReturn(List.of(existing));
        when(gameStepRepo.findByGameIdOrderByStepNumberAsc(42L)).thenReturn(List.of(existingStep));
        when(wikiContentService.getPageContent("Napoli"))
                .thenReturn(new PageContent("Napoli", "Napoli is a city...", List.of("Unina")));

        GameStateResponse response = gameService.getCurrentGame();

        assertEquals(42L, response.gameId());
    }

    @Test
    void getCurrentGame_throwsNotFound_whenNoneInProgress() {
        when(gameRepo.findByUserIdAndStatus(1L, GameStatus.IN_PROGRESS)).thenReturn(List.of());

        assertThrows(jakarta.persistence.EntityNotFoundException.class, () -> gameService.getCurrentGame());
    }

    @Test
    void followLink_validMoveReachingTarget_completesGame() {
        Game game = inProgressGame();
        GameStep firstStep = stepOf(game, 1, "Napoli");

        when(gameRepo.findById(42L)).thenReturn(Optional.of(game));
        when(gameStepRepo.findByGameIdOrderByStepNumberAsc(42L)).thenReturn(List.of(firstStep));
        when(wikiContentService.getPageContent("Napoli"))
                .thenReturn(new PageContent("Napoli", "...", List.of("Unina", "Campania")));
        when(wikiContentService.getPageContent("Unina"))
                .thenReturn(new PageContent("Unina", "...", List.of("Napoli")));

        GameStateResponse response = gameService.followLink(42L, new FollowLinkRequest("Unina"));

        assertEquals(GameStatus.COMPLETED, response.status());
        assertEquals(1, response.moves());
        assertEquals("Unina", response.currentPageTitle());
    }

    @Test
    void followLink_clickedTitleNotOnCurrentPage_throwsBadRequest() {
        Game game = inProgressGame();
        GameStep firstStep = stepOf(game, 1, "Napoli");

        when(gameRepo.findById(42L)).thenReturn(Optional.of(game));
        when(gameStepRepo.findByGameIdOrderByStepNumberAsc(42L)).thenReturn(List.of(firstStep));
        when(wikiContentService.getPageContent("Napoli"))
                .thenReturn(new PageContent("Napoli", "...", List.of("Campania")));

        assertThrows(BadRequestException.class,
                () -> gameService.followLink(42L, new FollowLinkRequest("Unina")));

        verify(gameStepRepo, never()).save(any(GameStep.class));
    }

    @Test
    void followLink_gameOwnedByAnotherUser_throwsForbidden() {
        User otherUser = User.builder().id(2L).username("bob").email("b@x.com")
                .passwordHash("h").createdAt(LocalDateTime.now()).build();

        Game game = Game.builder()
                .id(42L)
                .user(otherUser)
                .startPageTitle("Napoli")
                .targetPageTitle("Unina")
                .status(GameStatus.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .numSteps(1)
                .build();

        when(gameRepo.findById(42L)).thenReturn(Optional.of(game));

        assertThrows(ForbiddenException.class,
                () -> gameService.followLink(42L, new FollowLinkRequest("Unina")));
    }

    @Test
    void abandonGame_setsStatusAbandoned() {
        Game game = inProgressGame();
        when(gameRepo.findById(42L)).thenReturn(Optional.of(game));

        gameService.abandonGame(42L);

        assertEquals(GameStatus.ABANDONED, game.getStatus());
        assertTrue(game.getEndedAt() != null);
    }

    @Test
    void getLeaderboard_mapsRepositoryRowsToResponses() {
        Object[] row = {1L, "alice", 3L, 5};
        Page<Object[]> page = new PageImpl<>(List.<Object[]>of(row));
        when(gameRepo.findLeaderboardPageByBestMoves(eq(GameStatus.COMPLETED), isNull(), isNull(), any(Pageable.class)))
                .thenReturn(page);

        LeaderboardPageResponse leaderboard =
                gameService.getLeaderboard(null, null, LeaderboardSortMode.BEST_MOVES, 0, 10);

        assertEquals(1, leaderboard.entries().size());
        // row's MIN(numSteps) is 5 pages visited -> 4 moves (clicks).
        assertEquals(new LeaderboardEntryResponse(1L, "alice", 3L, 4), leaderboard.entries().get(0));
    }

    @Test
    void getCompletedGameDetail_returnsPath_whenGameIsCompleted() {
        Game game = Game.builder()
                .id(42L)
                .user(user)
                .startPageTitle("Napoli")
                .targetPageTitle("Unina")
                .status(GameStatus.COMPLETED)
                .startedAt(LocalDateTime.of(2026, 1, 1, 10, 0))
                .endedAt(LocalDateTime.of(2026, 1, 1, 10, 2))
                .numSteps(2)
                .isRandomChallenge(true)
                .activeSeconds(120L)
                .build();

        GameStep step1 = stepOf(game, 1, "Napoli");
        GameStep step2 = stepOf(game, 2, "Unina");

        when(gameRepo.findByIdWithUser(42L)).thenReturn(Optional.of(game));
        when(gameStepRepo.findByGameIdOrderByStepNumberAsc(42L)).thenReturn(List.of(step1, step2));

        CompletedGameDetailResponse response = gameService.getCompletedGameDetail(42L);

        assertEquals("alice", response.username());
        assertEquals(2, response.path().size());
        assertEquals(120L, response.totalTimeSeconds());
    }

    @Test
    void getCompletedGameDetail_throwsNotFound_whenGameIsNotCompleted() {
        Game game = inProgressGame();
        when(gameRepo.findByIdWithUser(42L)).thenReturn(Optional.of(game));

        assertThrows(jakarta.persistence.EntityNotFoundException.class,
                () -> gameService.getCompletedGameDetail(42L));
    }

    private Game inProgressGame() {
        return Game.builder()
                .id(42L)
                .user(user)
                .startPageTitle("Napoli")
                .targetPageTitle("Unina")
                .status(GameStatus.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .numSteps(1)
                .activeSeconds(0L)
                .build();
    }

    private GameStep stepOf(Game game, int stepNumber, String pageTitle) {
        return GameStep.builder()
                .id((long) stepNumber)
                .game(game)
                .stepNumber(stepNumber)
                .pageTitle(pageTitle)
                .visitedAt(LocalDateTime.now())
                .build();
    }
}