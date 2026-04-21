package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/redis/go-redis/v9"
)

// SearchEntry is a compact entry held in the in-memory autocomplete cache.
type SearchEntry struct {
	Key  string // normalised index key, e.g. "rossi_mario"
	Name string // upper-cased athlete name, e.g. "MARIO ROSSI"
}

// Server holds shared state for the HTTP service.
type Server struct {
	rdb           *redis.Client
	aggregatedDir string

	searchMu    sync.RWMutex
	searchCache []SearchEntry
}

func main() {
	redisAddr := envOr("REDIS_ADDR", "localhost:6379")
	aggregatedDir := envOr("AGGREGATED_DIR", "aggregated")
	port := envOr("PORT", "8090")

	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})

	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis ping failed: %v", err)
	}
	log.Printf("Connected to Redis at %s", redisAddr)

	s := &Server{rdb: rdb, aggregatedDir: aggregatedDir}

	// if err := s.Load(ctx); err != nil {
	// 	log.Fatalf("Load failed: %v", err)
	// }

	if err := s.buildSearchCache(ctx); err != nil {
		log.Fatalf("buildSearchCache failed: %v", err)
	}
	log.Printf("Search cache ready (%d entries)", len(s.searchCache))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /api/years", s.handleYears)
	mux.HandleFunc("GET /api/events/{year}", s.handleListEvents)
	mux.HandleFunc("GET /api/events/{year}/{event}/athletes", s.handleEventAthletes)
	mux.HandleFunc("GET /api/athletes", s.handleAllAthletes)
	mux.HandleFunc("GET /api/athletes/search", s.handleSearchAthletes)
	mux.HandleFunc("GET /api/athletes/{id}/stats", s.handleAthleteStats)
	mux.HandleFunc("GET /api/records", s.handleRecordsIndex)
	mux.HandleFunc("GET /api/records/{vasca}/{championship}/{gender}", s.handleRecords)

	// Auth routes — initiate and complete OAuth flows.
	mux.HandleFunc("GET /api/auth/google", s.handleGoogleLogin)
	mux.HandleFunc("GET /api/auth/google/callback", s.handleGoogleCallback)
	mux.HandleFunc("GET /api/auth/apple", s.handleAppleLogin)
	mux.HandleFunc("POST /api/auth/apple/callback", s.handleAppleCallback)
	// Protected: requires a valid Bearer session JWT.
	mux.Handle("GET /api/auth/me", authMiddleware(http.HandlerFunc(s.handleMe)))

	log.Printf("Listening on :%s", port)
	if err := http.ListenAndServe(":"+port, corsMiddleware(mux)); err != nil {
		log.Fatalf("ListenAndServe: %v", err)
	}
}

// corsMiddleware adds permissive CORS headers so a browser frontend can call the API.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
