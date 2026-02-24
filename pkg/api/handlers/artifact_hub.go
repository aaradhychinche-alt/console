// Package handlers provides HTTP handlers for the console API.
package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

const (
	artifactHubBase     = "https://artifacthub.io/api/v1"
	artifactHubCacheTTL = 5 * time.Minute
)

// ArtifactHubStats holds the aggregated stats from Artifact Hub.
type ArtifactHubStats struct {
	RepositoryCount int    `json:"repositoryCount"`
	PackageCount    int    `json:"packageCount"`
	Health          string `json:"health"` // "healthy" | "degraded"
	LastCheckedAt   string `json:"lastCheckedAt"`
}

// ArtifactHubHandler proxies requests to the Artifact Hub public API and
// caches results server-side to avoid CORS restrictions and rate limits.
type ArtifactHubHandler struct {
	httpClient *http.Client

	mu        sync.Mutex // single mutex guards cache + inflight; avoids stampede
	cache     *ArtifactHubStats
	cacheExp  time.Time
	inflight  bool          // true while a fetch is in progress
	inflightC chan struct{} // closed when the inflight fetch completes
}

// NewArtifactHubHandler creates a new handler with a shared HTTP client.
func NewArtifactHubHandler() *ArtifactHubHandler {
	return &ArtifactHubHandler{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// GetStats returns aggregated Artifact Hub stats (repository and package counts).
// Results are cached for 5 minutes. Concurrent callers on a cold/expired cache
// coalesce: only one fetch runs at a time; the rest wait for it to finish.
func (h *ArtifactHubHandler) GetStats(c *fiber.Ctx) error {
	for {
		h.mu.Lock()

		// Cache hit — serve immediately.
		if h.cache != nil && time.Now().Before(h.cacheExp) {
			result := *h.cache
			h.mu.Unlock()
			return c.JSON(result)
		}

		// Another goroutine is already fetching — wait for it, then re-check.
		if h.inflight {
			ch := h.inflightC
			h.mu.Unlock()
			<-ch
			continue // re-enter loop to read the freshly populated cache
		}

		// We are the designated fetcher.
		h.inflight = true
		h.inflightC = make(chan struct{})
		h.mu.Unlock()

		stats, err := h.fetchStats()

		h.mu.Lock()
		h.inflight = false
		ch := h.inflightC
		if err == nil {
			h.cache = stats
			h.cacheExp = time.Now().Add(artifactHubCacheTTL)
		}
		h.mu.Unlock()

		close(ch) // wake up any waiters

		if err != nil {
			return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
				"error": fmt.Sprintf("failed to fetch Artifact Hub data: %v", err),
			})
		}
		return c.JSON(*stats)
	}
}

func (h *ArtifactHubHandler) fetchStats() (*ArtifactHubStats, error) {
	type fetchResult struct {
		total int
		err   error
	}

	// Context controls the HTTP requests: both goroutines abort as soon as
	// the 5-second deadline fires, so they never leak into the background.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	reposCh := make(chan fetchResult, 1)
	pkgsCh := make(chan fetchResult, 1)

	go func() {
		total, err := h.getSearchTotal(ctx, artifactHubBase+"/repositories/search?limit=1")
		reposCh <- fetchResult{total: total, err: err}
	}()
	go func() {
		total, err := h.getSearchTotal(ctx, artifactHubBase+"/packages/search?limit=1")
		pkgsCh <- fetchResult{total: total, err: err}
	}()

	// Both channels are buffered (size 1). The goroutines will send and exit
	// promptly whether they succeed, error, or are cancelled by the context —
	// so these plain receives are guaranteed to complete within ~5 s.
	reposResult := <-reposCh
	pkgsResult := <-pkgsCh

	// If both sub-requests fail, surface a real error so the cache is not
	// populated with zeros and the frontend sees a 502 error state.
	if reposResult.err != nil && pkgsResult.err != nil {
		return nil, fmt.Errorf("repositories: %v; packages: %v", reposResult.err, pkgsResult.err)
	}

	health := "healthy"
	if reposResult.err != nil || pkgsResult.err != nil {
		health = "degraded"
	}

	return &ArtifactHubStats{
		RepositoryCount: reposResult.total,
		PackageCount:    pkgsResult.total,
		Health:          health,
		LastCheckedAt:   time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// getSearchTotal reads the Pagination-Total-Count HTTP response header returned
// by the Artifact Hub API. The header is present on both /repositories/search
// and /packages/search. Decoding the JSON body is intentionally avoided:
// the repositories endpoint returns a bare JSON array, and the packages
// endpoint returns { "packages": [...] } — neither has a "pagination" wrapper
// that could be decoded generically into a shared struct.
func (h *ArtifactHubHandler) getSearchTotal(ctx context.Context, url string) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	// Always drain the body so the underlying TCP connection can be reused.
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}

	raw := resp.Header.Get("Pagination-Total-Count")
	if raw == "" {
		return 0, fmt.Errorf("missing Pagination-Total-Count header from %s", url)
	}
	total, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("invalid Pagination-Total-Count %q from %s: %w", raw, url, err)
	}
	return total, nil
}
