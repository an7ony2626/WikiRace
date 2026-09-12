package it.unina.demo.dto.response;

public record WikiSearchResultResponse(
        String title,
        String thumbnailUrl,
        String extract
) {
}