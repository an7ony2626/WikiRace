package it.unina.demo.repository;

import it.unina.demo.entity.Game;
import it.unina.demo.entity.GameStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GameRepository extends JpaRepository<Game, Long> {

    List<Game> findByUserIdAndStatus(Long userId, GameStatus status);

    Optional<Game> findFirstByUserIdAndStatusAndStartPageTitleIgnoreCaseAndTargetPageTitleIgnoreCaseOrderByStartedAtDesc(
            Long userId, GameStatus status, String startPageTitle, String targetPageTitle
    );

    @Query("""
            SELECT g FROM Game g
            JOIN FETCH g.user
            WHERE g.status = :status
            AND (:isRandom IS NULL OR g.isRandomChallenge = :isRandom)
            AND (:requiredTargetTitle IS NULL OR LOWER(g.targetPageTitle) = LOWER(CAST(:requiredTargetTitle AS string)))
            ORDER BY g.startedAt DESC
            """)
    Page<Game> findCompletedGames(
            @Param("status") GameStatus status,
            @Param("isRandom") Boolean isRandom,
            @Param("requiredTargetTitle") String requiredTargetTitle,
            Pageable pageable
    );

    @Query("""
            SELECT g FROM Game g
            JOIN FETCH g.user
            WHERE g.id = :id
            """)
    Optional<Game> findByIdWithUser(@Param("id") Long id);

    @Query("""
            SELECT g.user.id, g.user.username, COUNT(g), MIN(g.numSteps)
            FROM Game g
            WHERE g.status = :status
            AND (:isRandom IS NULL OR g.isRandomChallenge = :isRandom)
            AND (:requiredTargetTitle IS NULL OR LOWER(g.targetPageTitle) = LOWER(CAST(:requiredTargetTitle AS string)))
            GROUP BY g.user.id, g.user.username
            ORDER BY MIN(g.numSteps) ASC, COUNT(g) DESC
            """)
    List<Object[]> findLeaderboardByBestMoves(
            @Param("status") GameStatus status,
            @Param("isRandom") Boolean isRandom,
            @Param("requiredTargetTitle") String requiredTargetTitle
    );

    @Query("""
            SELECT g.user.id, g.user.username, COUNT(g), MIN(g.numSteps)
            FROM Game g
            WHERE g.status = :status
            AND (:isRandom IS NULL OR g.isRandomChallenge = :isRandom)
            AND (:requiredTargetTitle IS NULL OR LOWER(g.targetPageTitle) = LOWER(CAST(:requiredTargetTitle AS string)))
            GROUP BY g.user.id, g.user.username
            ORDER BY COUNT(g) DESC, MIN(g.numSteps) ASC
            """)
    List<Object[]> findLeaderboardByGamesPlayed(
            @Param("status") GameStatus status,
            @Param("isRandom") Boolean isRandom,
            @Param("requiredTargetTitle") String requiredTargetTitle
    );

    // Paginated counterparts of the two queries above, used for the
    // displayed page of the leaderboard (LIMIT/OFFSET at the DB layer,
    // same pattern as findCompletedGames) instead of materializing every
    // matching player and slicing the list in Java. An explicit countQuery
    // is required here — Spring Data can't safely auto-derive a COUNT from
    // a GROUP BY aggregation query.
    @Query(value = """
            SELECT g.user.id, g.user.username, COUNT(g), MIN(g.numSteps)
            FROM Game g
            WHERE g.status = :status
            AND (:isRandom IS NULL OR g.isRandomChallenge = :isRandom)
            AND (:requiredTargetTitle IS NULL OR LOWER(g.targetPageTitle) = LOWER(CAST(:requiredTargetTitle AS string)))
            GROUP BY g.user.id, g.user.username
            ORDER BY MIN(g.numSteps) ASC, COUNT(g) DESC
            """,
            countQuery = """
            SELECT COUNT(DISTINCT g.user.id)
            FROM Game g
            WHERE g.status = :status
            AND (:isRandom IS NULL OR g.isRandomChallenge = :isRandom)
            AND (:requiredTargetTitle IS NULL OR LOWER(g.targetPageTitle) = LOWER(CAST(:requiredTargetTitle AS string)))
            """)
    Page<Object[]> findLeaderboardPageByBestMoves(
            @Param("status") GameStatus status,
            @Param("isRandom") Boolean isRandom,
            @Param("requiredTargetTitle") String requiredTargetTitle,
            Pageable pageable
    );

    @Query(value = """
            SELECT g.user.id, g.user.username, COUNT(g), MIN(g.numSteps)
            FROM Game g
            WHERE g.status = :status
            AND (:isRandom IS NULL OR g.isRandomChallenge = :isRandom)
            AND (:requiredTargetTitle IS NULL OR LOWER(g.targetPageTitle) = LOWER(CAST(:requiredTargetTitle AS string)))
            GROUP BY g.user.id, g.user.username
            ORDER BY COUNT(g) DESC, MIN(g.numSteps) ASC
            """,
            countQuery = """
            SELECT COUNT(DISTINCT g.user.id)
            FROM Game g
            WHERE g.status = :status
            AND (:isRandom IS NULL OR g.isRandomChallenge = :isRandom)
            AND (:requiredTargetTitle IS NULL OR LOWER(g.targetPageTitle) = LOWER(CAST(:requiredTargetTitle AS string)))
            """)
    Page<Object[]> findLeaderboardPageByGamesPlayed(
            @Param("status") GameStatus status,
            @Param("isRandom") Boolean isRandom,
            @Param("requiredTargetTitle") String requiredTargetTitle,
            Pageable pageable
    );
}