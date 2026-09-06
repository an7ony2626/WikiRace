package it.unina.demo.dto.request;

import jakarta.validation.constraints.Size;

public record CreateGameRequest(
        @Size(max = 255) String startPageTitle,
        @Size(max = 255) String targetPageTitle,
        Boolean startWasRandom,
        Boolean targetWasRandom,
        Boolean confirmReplaceExisting
) {
}
