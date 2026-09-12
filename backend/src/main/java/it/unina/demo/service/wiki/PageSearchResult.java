package it.unina.demo.service.wiki;

// Implementation-agnostic search hit: title to start a game with,
// thumbnail for the picker UI, extract as a short preview snippet.
public record PageSearchResult(
        String title,
        String thumbnailUrl,
        String extract
) {
}