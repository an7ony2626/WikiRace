package it.unina.demo.controller;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import it.unina.demo.dto.response.WikiSearchResultResponse;
import it.unina.demo.service.wiki.PageSearchResult;
import it.unina.demo.service.wiki.WikiContentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// Requires authentication (default rule in SecurityConfig): pages are only
// picked from the new-game form, which is shown to logged-in players only,
// so there's no reason to expose a public proxy to Wikipedia's API.
@RestController
@RequestMapping("/api/wiki")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class WikiController {

    private final WikiContentService wikiContentService;

    @GetMapping("/search")
    public List<WikiSearchResultResponse> search(@RequestParam("q") String query) {
        return wikiContentService.searchPages(query).stream()
                .map(r -> new WikiSearchResultResponse(r.title(), r.thumbnailUrl(), r.extract()))
                .toList();
    }

    @GetMapping("/random")
    public WikiSearchResultResponse random() {
        PageSearchResult result = wikiContentService.getRandomPage();
        return new WikiSearchResultResponse(result.title(), result.thumbnailUrl(), result.extract());
    }
}