package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/redis/go-redis/v9"
)

var (
	yearRe    = regexp.MustCompile(`^\d{4}$`)
	safeKeyRe = regexp.MustCompile(`^[a-z0-9_]+$`)
)

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// GET /health
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := s.rdb.Ping(r.Context()).Err(); err != nil {
		writeError(w, 503, "redis unavailable")
		return
	}
	writeJSON(w, map[string]string{"status": "ok"})
}

// GET /api/years
func (s *Server) handleYears(w http.ResponseWriter, r *http.Request) {
	years, err := s.rdb.SMembers(r.Context(), redisKeyYears).Result()
	if err != nil {
		writeError(w, 500, "redis error")
		return
	}
	sort.Strings(years)
	writeJSON(w, years)
}

// GET /api/events/{year}
func (s *Server) handleListEvents(w http.ResponseWriter, r *http.Request) {
	year := r.PathValue("year")
	if !yearRe.MatchString(year) {
		writeError(w, 400, "invalid year")
		return
	}

	eventsMap, err := s.rdb.HGetAll(r.Context(), "year:"+year+":events").Result()
	if err != nil {
		writeError(w, 500, "redis error")
		return
	}

	events := make([]EventInfo, 0, len(eventsMap))
	for _, v := range eventsMap {
		var ev EventInfo
		if err := json.Unmarshal([]byte(v), &ev); err == nil {
			events = append(events, ev)
		}
	}
	sort.Slice(events, func(i, j int) bool {
		return events[i].Name < events[j].Name
	})
	writeJSON(w, events)
}

// GET /api/events/{year}/{event}/athletes
func (s *Server) handleEventAthletes(w http.ResponseWriter, r *http.Request) {
	year := r.PathValue("year")
	event := r.PathValue("event")
	if !yearRe.MatchString(year) || !safeKeyRe.MatchString(event) {
		writeError(w, 400, "invalid parameters")
		return
	}

	ctx := r.Context()
	athleteKeys, err := s.rdb.SMembers(ctx, "event:"+year+":"+event+":athletes").Result()
	if err != nil || len(athleteKeys) == 0 {
		writeJSON(w, []AthleteInfo{})
		return
	}

	athletes, err := s.fetchAthleteInfos(ctx, athleteKeys)
	if err != nil {
		writeError(w, 500, "redis error")
		return
	}
	sort.Slice(athletes, func(i, j int) bool {
		return athletes[i].Name < athletes[j].Name
	})
	writeJSON(w, athletes)
}

// GET /api/athletes?page=1&limit=50
func (s *Server) handleAllAthletes(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	offset := int64((page - 1) * limit)

	ctx := r.Context()
	members, err := s.rdb.ZRange(ctx, redisKeyAthleteNames, offset, offset+int64(limit)-1).Result()
	if err != nil {
		writeError(w, 500, "redis error")
		return
	}

	keys := make([]string, 0, len(members))
	for _, m := range members {
		parts := strings.SplitN(m, "\x00", 2)
		if len(parts) == 2 {
			keys = append(keys, parts[1])
		}
	}

	athletes, err := s.fetchAthleteInfos(ctx, keys)
	if err != nil {
		writeError(w, 500, "redis error")
		return
	}

	total, _ := s.rdb.ZCard(ctx, redisKeyAthleteNames).Result()
	writeJSON(w, map[string]any{
		"page":     page,
		"limit":    limit,
		"total":    total,
		"athletes": athletes,
	})
}

// GET /api/athletes/search?q=fragment
func (s *Server) handleSearchAthletes(w http.ResponseWriter, r *http.Request) {
	q := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("q")))
	if len(q) < 2 {
		writeJSON(w, []AthleteInfo{})
		return
	}

	s.searchMu.RLock()
	cache := s.searchCache
	s.searchMu.RUnlock()

	matchedKeys := make([]string, 0, 20)
	for _, entry := range cache {
		if strings.Contains(entry.Name, q) {
			matchedKeys = append(matchedKeys, entry.Key)
			if len(matchedKeys) >= 20 {
				break
			}
		}
	}

	athletes, err := s.fetchAthleteInfos(r.Context(), matchedKeys)
	if err != nil {
		writeError(w, 500, "redis error")
		return
	}
	writeJSON(w, athletes)
}

// GET /api/athletes/{id}/stats
func (s *Server) handleAthleteStats(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !safeKeyRe.MatchString(id) {
		writeError(w, 400, "invalid id")
		return
	}

	ctx := r.Context()
	raw, err := s.rdb.Get(ctx, redisKeyAthletePrefix+id).Result()
	if err == redis.Nil {
		writeError(w, 404, "athlete not found")
		return
	}
	if err != nil {
		writeError(w, 500, "redis error")
		return
	}

	var athlete AthleteIndex
	if err := json.Unmarshal([]byte(raw), &athlete); err != nil {
		writeError(w, 500, "parse error")
		return
	}

	stats := AthleteStats{
		Key:         id,
		Name:        athlete.Name,
		YearOfBirth: athlete.YearOfBirth,
		Sex:         athlete.Sex,
		Society:     athlete.Society,
		Records:     []StatRecord{},
	}

	for _, f := range athlete.Files {
		parts := strings.SplitN(f.Path, "/", 3)
		if len(parts) < 3 {
			continue
		}
		year, eventDir, filename := parts[0], parts[1], parts[2]
		athleteFileKey := strings.TrimSuffix(filepath.Base(filename), ".json")

		// Try Redis first; fall back to disk if the result hasn't been loaded yet.
		resultRaw, err := s.rdb.Get(ctx, redisKeyResultsPrefix+year+":"+eventDir+":"+athleteFileKey).Result()
		if err == redis.Nil {
			data, readErr := os.ReadFile(filepath.Join(s.aggregatedDir, f.Path))
			if readErr != nil {
				continue
			}
			resultRaw = string(data)
		} else if err != nil {
			continue
		}

		var result AthleteResult
		if err := json.Unmarshal([]byte(resultRaw), &result); err != nil {
			continue
		}

		stats.Records = append(stats.Records, StatRecord{
			Competition: f.Competition,
			Date:        f.Date,
			Year:        year,
			EventDir:    eventDir,
			Results:     result.Results,
		})
	}

	writeJSON(w, stats)
}

// fetchAthleteInfos batch-fetches AthleteInfo for a slice of index keys via MGET.
func (s *Server) fetchAthleteInfos(ctx context.Context, keys []string) ([]AthleteInfo, error) {
	if len(keys) == 0 {
		return []AthleteInfo{}, nil
	}
	redisKeys := make([]string, len(keys))
	for i, k := range keys {
		redisKeys[i] = redisKeyAthletePrefix + k
	}
	vals, err := s.rdb.MGet(ctx, redisKeys...).Result()
	if err != nil {
		return nil, err
	}
	out := make([]AthleteInfo, 0, len(keys))
	for i, v := range vals {
		if v == nil {
			continue
		}
		var idx AthleteIndex
		if err := json.Unmarshal([]byte(v.(string)), &idx); err != nil {
			continue
		}
		out = append(out, AthleteInfo{
			Key:         keys[i],
			Name:        idx.Name,
			YearOfBirth: idx.YearOfBirth,
			Sex:         idx.Sex,
			Society:     idx.Society,
		})
	}
	return out, nil
}
