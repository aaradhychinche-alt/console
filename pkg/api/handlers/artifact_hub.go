// Package handlers provides HTTP handlers for the console API.
package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
	LastSyncTime    string `json:"lastSyncTime"`
}

// artifactHubSearchResponse is the typed shape of the Artifact Hub
// /repositories/search and /packages/search responses.
// Only the pagination.total field is consumed; all other fields are ignored.
type artifactHubSearchResponse struct {
	Pagination struct {
		Total int `json:"total"`
	} `json:"pagination"`
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
		resp *artifactHubSearchResponse
		err  error
	}

	// Context controls the HTTP requests: both goroutines abort as soon as
	// the 5-second deadline fires, so they never leak into the background.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	reposCh := make(chan fetchResult, 1)
	pkgsCh := make(chan fetchResult, 1)

	go func() {
		data, err := h.getSearchResponse(ctx, artifactHubBase+"/repositories/search?limit=1")
		reposCh <- fetchResult{resp: data, err: err}
	}()
	go func() {
		data, err := h.getSearchResponse(ctx, artifactHubBase+"/packages/search?limit=1")
		pkgsCh <- fetchResult{resp: data, err: err}
	}()

	// Both channels are buffered (size 1). The goroutines will send and exit
	// promptly whether they succeed, error, or are cancelled by the context —
	// so these plain receives are guaranteed to complete within ~5 s.
	reposResult := <-reposCh
	pkgsResult := <-pkgsCh

	health := "healthy"
	if reposResult.err != nil || pkgsResult.err != nil {
		health = "degraded"
	}

	repositoryCount := 0
	if reposResult.err == nil && reposResult.resp != nil {
		repositoryCount = reposResult.resp.Pagination.Total
	}

	packageCount := 0
	if pkgsResult.err == nil && pkgsResult.resp != nil {
		packageCount = pkgsResult.resp.Pagination.Total
	}

	return &ArtifactHubStats{
		RepositoryCount: repositoryCount,
		PackageCount:    packageCount,
		Health:          health,
		LastSyncTime:    time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func (h *ArtifactHubHandler) getSearchResponse(ctx context.Context, url string) (*artifactHubSearchResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Drain body so the underlying TCP connection can be reused.
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}

	var result artifactHubSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}
