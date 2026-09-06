package it.unina.demo.service.wiki;

import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.owasp.html.PolicyFactory;
import org.owasp.html.Sanitizers;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.Comparator;

/**
 * Full implementation of WikiContentService: fetches the real rendered
 * article HTML via MediaWiki's action=parse, and uses jsoup to extract
 * both the cleaned HTML (for display) and the list of valid outgoing
 * links (for move validation) directly from the same markup — no
 * separate prop=links call needed, the HTML is the single source of
 * truth for "what's a clickable link on this page".
 *
 * Known simplification: no CSS is attached here (that's a frontend
 * concern — linking Wikipedia's real stylesheet, or styling our own).
 * This service only guarantees correct content and correct links.
 */
@Service
@RequiredArgsConstructor
public class MediaWikiContentService implements WikiContentService {

    // Wikipedia's HTML is stripped of the obviously non-content noise
    // above (stripNonContentElements), but that's a denylist, not a
    // security boundary — a vandalized or malicious page could still
    // carry event-handler attributes or other executable markup, which
    // then gets rendered via [innerHTML] on the frontend. This allowlist
    // policy is the actual XSS boundary: only known-safe formatting,
    // block, table, link, and image markup survives.
    private static final PolicyFactory WIKI_HTML_POLICY = Sanitizers.FORMATTING
            .and(Sanitizers.BLOCKS)
            .and(Sanitizers.TABLES)
            .and(Sanitizers.LINKS)
            .and(Sanitizers.IMAGES)
            .and(Sanitizers.STYLES);

    private final RestClient wikipediaRestClient;

    @Override
    @Cacheable(value = "wikiPageContent", key = "#title")
    public PageContent getPageContent(String title) {
        JsonNode response = wikipediaRestClient.get()
                .uri(uriBuilder -> uriBuilder
                        .queryParam("action", "parse")
                        .queryParam("format", "json")
                        .queryParam("prop", "text")
                        .queryParam("redirects", "1")
                        .queryParam("page", title)
                        .build())
                .retrieve()
                .body(JsonNode.class);

        JsonNode parseNode = response.get("parse");

        if (parseNode == null)
            throw new WikiPageNotFoundException(title);

        String resolvedTitle = parseNode.get("title").asString();
        String rawHtml = parseNode.path("text").path("*").asString("");

        Document document = Jsoup.parse(rawHtml);
        stripNonContentElements(document);

        Set<String> linkTitles = extractMainspaceLinkTitles(document);
        rewriteImageSources(document);

        String sanitizedHtml = WIKI_HTML_POLICY.sanitize(document.body().html());

        return new PageContent(resolvedTitle, sanitizedHtml, new ArrayList<>(linkTitles));
    }

    @Override
    public String getRandomPageTitle() {
        return getRandomPage().title();
    }

    // Edit-section pencils and reference-list "cite" backlinks are noise
    // for a reading UI and would otherwise show up as extra clickable
    // links; categories/templates/files are non-article namespaces and
    // can never be valid moves anyway.
    private void stripNonContentElements(Document document) {
        document.select("span.mw-editsection, sup.reference, .navbox, .metadata, style, script")
                .remove();
    }

    private Set<String> extractMainspaceLinkTitles(Document document) {
        Set<String> titles = new LinkedHashSet<>();
        Elements links = document.select("a[href^=/wiki/]");

        for (Element link : links) {
            String href = link.attr("href");
            String encodedTitle = href.substring("/wiki/".length());

            // Skip non-mainspace links (Category:, File:, Template:,
            // Help:, Special:, Wikipedia:, Talk:, etc.) and in-page
            // anchors on the article itself (href="/wiki/Title#Section").
            if (encodedTitle.contains(":") || encodedTitle.isBlank())
                continue;

            String decodedTitle = URLDecoder.decode(encodedTitle.split("#")[0], StandardCharsets.UTF_8)
                    .replace('_', ' ');

            titles.add(decodedTitle);
        }

        return titles;
    }

    // MediaWiki emits protocol-relative image URLs (//upload.wikimedia.org/...),
    // which resolve fine in a real browser but not when injected via
    // Angular's [innerHTML] outside of a browsing context tied to a URL scheme.
    private void rewriteImageSources(Document document) {
        for (Element img : document.select("img[src^=//]")) {
            img.attr("src", "https:" + img.attr("src"));
        }
    }

    @Override
    public List<PageSearchResult> searchPages(String query) {
        if (query == null || query.isBlank())
            return List.of();

        JsonNode response = wikipediaRestClient.get()
                .uri(uriBuilder -> uriBuilder
                        .queryParam("action", "query")
                        .queryParam("format", "json")
                        .queryParam("generator", "search")
                        .queryParam("gsrsearch", query)
                        .queryParam("gsrnamespace", "0")
                        .queryParam("gsrlimit", "8")
                        .queryParam("prop", "pageimages|extracts")
                        .queryParam("piprop", "thumbnail")
                        .queryParam("pithumbsize", "100")
                        .queryParam("exintro", "1")
                        .queryParam("explaintext", "1")
                        .queryParam("exchars", "160")
                        .build())
                .retrieve()
                .body(JsonNode.class);

        JsonNode pages = response.path("query").path("pages");
        if (!pages.isObject())
            return List.of();

        // generator=search returns pages keyed by pageid in a JSON object —
        // NOT in relevance order. Each page's "index" field is what actually
        // encodes the search rank, so results are sorted by that afterwards.
        List<RankedResult> ranked = new ArrayList<>();
        for (JsonNode page : pages) {
            ranked.add(new RankedResult(
                    page.path("index").asInt(Integer.MAX_VALUE),
                    new PageSearchResult(
                            page.path("title").asString(""),
                            page.path("thumbnail").path("source").asString(null),
                            page.path("extract").asString(""))
            ));
        }

        return ranked.stream()
                .sorted(Comparator.comparingInt(RankedResult::rank))
                .map(RankedResult::result)
                .toList();
    }

    // Local pairing of a search hit with its relevance rank, used only to
    // sort the response above — never exposed outside this method.
    private record RankedResult(int rank, PageSearchResult result) {
    }

    @Override
    public PageSearchResult getRandomPage() {
        // generator=random (instead of list=random) lets pageimages/extracts
        // ride along in the same call, same trick used in searchPages.
        JsonNode response = wikipediaRestClient.get()
                .uri(uriBuilder -> uriBuilder
                        .queryParam("action", "query")
                        .queryParam("format", "json")
                        .queryParam("generator", "random")
                        .queryParam("grnnamespace", "0")
                        .queryParam("grnfilterredir", "nonredirects")
                        .queryParam("grnminsize", "1000")
                        .queryParam("grnlimit", "1")
                        .queryParam("prop", "pageimages|extracts")
                        .queryParam("piprop", "thumbnail")
                        .queryParam("pithumbsize", "100")
                        .queryParam("exintro", "1")
                        .queryParam("explaintext", "1")
                        .queryParam("exchars", "160")
                        .build())
                .retrieve()
                .body(JsonNode.class);

        JsonNode page = response.path("query").path("pages").iterator().next();

        return new PageSearchResult(
                page.path("title").asString(""),
                page.path("thumbnail").path("source").asString(null),
                page.path("extract").asString(""));
    }
}