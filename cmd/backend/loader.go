package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/redis/go-redis/v9"
)

const (
	redisKeyAthletePrefix = "athlete:"
	redisKeyAthleteNames  = "athletes:names"
	redisKeyYears         = "years"
	redisKeyResultsPrefix = "results:"

	pipelineBatch = 500
	loaderWorkers = 16
)

// Load loads all aggregated data into Redis.
// The athlete index is loaded synchronously so the API is ready immediately.
// Competition result files are loaded in a background goroutine.
func (s *Server) Load(ctx context.Context) error {
	indexDir := filepath.Join(s.aggregatedDir, "_index")

	log.Printf("Loading athlete index from %s...", indexDir)
	n, err := s.loadIndex(ctx, indexDir)
	if err != nil {
		return fmt.Errorf("index load: %w", err)
	}
	log.Printf("Indexed %d athletes", n)

	if err := s.buildSearchCache(ctx); err != nil {
		return fmt.Errorf("search cache: %w", err)
	}
	log.Printf("Search cache ready (%d entries)", len(s.searchCache))

	go func() {
		log.Println("Background: loading competition result files...")
		n, err := s.loadResults(context.Background())
		if err != nil {
			log.Printf("Background results error: %v", err)
		} else {
			log.Printf("Background: loaded %d result files", n)
		}
	}()

	return nil
}

// indexWork is a parsed athlete index entry ready to be written to Redis.
type indexWork struct {
	key     string
	data    []byte
	athlete AthleteIndex
}

// loadIndex reads all files in the _index directory, writes each athlete to
// Redis and populates the auxiliary keys (years, event hashes, event→athlete sets).
func (s *Server) loadIndex(ctx context.Context, indexDir string) (int, error) {
	entries, err := os.ReadDir(indexDir)
	if err != nil {
		return 0, fmt.Errorf("reading %s: %w", indexDir, err)
	}

	workCh := make(chan indexWork, 2000)

	// Fan-out: read and parse files in parallel.
	go func() {
		var wg sync.WaitGroup
		sem := make(chan struct{}, loaderWorkers)
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			name := e.Name()
			sem <- struct{}{}
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() { <-sem }()

				key := strings.TrimSuffix(name, ".json")
				data, err := os.ReadFile(filepath.Join(indexDir, name))
				if err != nil {
					return
				}
				var athlete AthleteIndex
				if err := json.Unmarshal(data, &athlete); err != nil {
					return
				}
				workCh <- indexWork{key: key, data: data, athlete: athlete}
			}()
		}
		wg.Wait()
		close(workCh)
	}()

	// Single consumer: accumulate commands in a pipeline and flush every pipelineBatch.
	count := 0
	pipe := s.rdb.Pipeline()

	for w := range workCh {
		pipe.Set(ctx, redisKeyAthletePrefix+w.key, w.data, 0)
		pipe.ZAdd(ctx, redisKeyAthleteNames, redis.Z{
			Score:  0,
			Member: strings.ToUpper(w.athlete.Name) + "\x00" + w.key,
		})

		for _, f := range w.athlete.Files {
			parts := strings.SplitN(f.Path, "/", 3)
			if len(parts) < 2 {
				continue
			}
			year, eventDir := parts[0], parts[1]
			pipe.SAdd(ctx, redisKeyYears, year)
			evJSON, _ := json.Marshal(EventInfo{Dir: eventDir, Name: f.Competition, Date: f.Date})
			pipe.HSetNX(ctx, "year:"+year+":events", eventDir, string(evJSON))
			pipe.SAdd(ctx, "event:"+year+":"+eventDir+":athletes", w.key)
		}

		count++
		if count%pipelineBatch == 0 {
			if _, err := pipe.Exec(ctx); err != nil {
				log.Printf("Pipeline warning at %d: %v", count, err)
			}
			pipe = s.rdb.Pipeline()
			if count%20000 == 0 {
				log.Printf("  indexed %d athletes...", count)
			}
		}
	}

	if _, err := pipe.Exec(ctx); err != nil {
		log.Printf("Final pipeline warning: %v", err)
	}

	return count, nil
}

// buildSearchCache populates the in-memory search cache from the Redis sorted set.
func (s *Server) buildSearchCache(ctx context.Context) error {
	var cache []SearchEntry
	var cursor uint64

	for {
		// ZScan returns alternating [member, score, member, score, ...].
		items, next, err := s.rdb.ZScan(ctx, redisKeyAthleteNames, cursor, "*", 10000).Result()
		if err != nil {
			return err
		}
		for i := 0; i < len(items); i += 2 {
			parts := strings.SplitN(items[i], "\x00", 2)
			if len(parts) == 2 {
				cache = append(cache, SearchEntry{Name: parts[0], Key: parts[1]})
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}

	s.searchMu.Lock()
	s.searchCache = cache
	s.searchMu.Unlock()
	return nil
}

// loadResults walks the year/event directories and stores each athlete result
// file in Redis under keys: results:{year}:{event_dir}:{athlete_key}.
func (s *Server) loadResults(ctx context.Context) (int, error) {
	yearEntries, err := os.ReadDir(s.aggregatedDir)
	if err != nil {
		return 0, err
	}

	var total atomic.Int64
	var wg sync.WaitGroup
	sem := make(chan struct{}, loaderWorkers)

	for _, yearEntry := range yearEntries {
		if !yearEntry.IsDir() || yearEntry.Name() == "_index" {
			continue
		}
		year := yearEntry.Name()
		yearDir := filepath.Join(s.aggregatedDir, year)

		eventEntries, err := os.ReadDir(yearDir)
		if err != nil {
			log.Printf("Error reading year dir %s: %v", yearDir, err)
			continue
		}

		for _, eventEntry := range eventEntries {
			if !eventEntry.IsDir() {
				continue
			}
			eventDir := eventEntry.Name()
			eventPath := filepath.Join(yearDir, eventDir)

			sem <- struct{}{}
			wg.Add(1)
			go func(year, eventDir, eventPath string) {
				defer wg.Done()
				defer func() { <-sem }()

				athleteFiles, err := os.ReadDir(eventPath)
				if err != nil {
					return
				}

				pipe := s.rdb.Pipeline()
				n := 0
				for _, af := range athleteFiles {
					if af.IsDir() || !strings.HasSuffix(af.Name(), ".json") {
						continue
					}
					athleteKey := strings.TrimSuffix(af.Name(), ".json")
					data, err := os.ReadFile(filepath.Join(eventPath, af.Name()))
					if err != nil {
						continue
					}
					pipe.Set(ctx, redisKeyResultsPrefix+year+":"+eventDir+":"+athleteKey, data, 0)
					n++
					if n%pipelineBatch == 0 {
						pipe.Exec(ctx)
						pipe = s.rdb.Pipeline()
					}
				}
				if n > 0 {
					pipe.Exec(ctx)
				}
				total.Add(int64(n))
			}(year, eventDir, eventPath)
		}
	}

	wg.Wait()
	return int(total.Load()), nil
}
