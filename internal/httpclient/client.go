package httpclient

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	maxRetries = 8
	maxBackoff = 60 * time.Second
)

// Default is the shared HTTP client used by scrapers.
var Default = &Client{HTTP: &http.Client{Timeout: 30 * time.Second}, Verbose: false}

// Client wraps an http.Client with retry logic.
type Client struct {
	HTTP    *http.Client
	Verbose bool // when true, PostFormJSON logs URL, method and params before each request
}

// FetchHTML performs a GET request and returns the raw response body.
// Optional headers are added to the request.
func (c *Client) FetchHTML(rawURL string, headers map[string]string) ([]byte, error) {
	return c.doWithRetry(func() (*http.Response, error) {
		req, err := http.NewRequest("GET", rawURL, nil)
		if err != nil {
			return nil, err
		}
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		return c.HTTP.Do(req)
	}, rawURL)
}

// FetchJSON performs a GET request and decodes the JSON response into dest.
// Retries with exponential backoff on transient errors and rate limiting.
func (c *Client) FetchJSON(rawURL string, dest any) error {
	body, err := c.doWithRetry(func() (*http.Response, error) {
		return c.HTTP.Get(rawURL)
	}, rawURL)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(body, dest); err != nil {
		return fmt.Errorf("unmarshal %s: %w", rawURL, err)
	}
	return nil
}

// PostFormJSON performs a POST with form-encoded data and decodes the JSON response into dest.
// Retries with exponential backoff on transient errors and rate limiting.
// When c.Verbose is true, it logs the URL and form params before sending.
func (c *Client) PostFormJSON(rawURL string, formData url.Values, dest any) error {
	if c.Verbose {
		log.Printf("[http] POST %s params=%s", rawURL, formData.Encode())
	}
	body, err := c.doWithRetry(func() (*http.Response, error) {
		req, err := http.NewRequest("POST", rawURL, strings.NewReader(formData.Encode()))
		if err != nil {
			return nil, err
		}
		req.Header.Set("content-type", "application/x-www-form-urlencoded; charset=UTF-8")
		return c.HTTP.Do(req)
	}, rawURL)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(body, dest); err != nil {
		return fmt.Errorf("unmarshal %s: %w", rawURL, err)
	}
	return nil
}

func (c *Client) doWithRetry(do func() (*http.Response, error), rawURL string) ([]byte, error) {
	var lastErr error
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff with jitter: 1s, 2s, 4s, 8s... + random 0–500ms
			sleep := time.Duration(1<<uint(attempt-1))*time.Second + time.Duration(rand.Intn(500))*time.Millisecond
			if sleep > maxBackoff {
				sleep = maxBackoff
			}
			log.Printf("[backoff] attempt %d for %s, sleeping %v", attempt+1, rawURL, sleep)
			time.Sleep(sleep)
		}

		resp, err := do()
		if err != nil {
			lastErr = err
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("read body %s: %w", rawURL, err)
			continue
		}

		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusServiceUnavailable {
			lastErr = fmt.Errorf("rate limited (HTTP %d) on %s", resp.StatusCode, rawURL)
			continue
		}
		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("HTTP %d for %s", resp.StatusCode, rawURL)
			continue
		}
		return body, nil
	}
	return nil, fmt.Errorf("exhausted %d retries for %s: %w", maxRetries, rawURL, lastErr)
}
