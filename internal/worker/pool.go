package worker

import "sync"

// RunPool starts n workers that consume jobs from ch, calling fn for each.
// It blocks until all jobs are processed and all workers have exited.
func RunPool[T any](n int, ch <-chan T, fn func(T)) {
	var wg sync.WaitGroup
	for range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range ch {
				fn(j)
			}
		}()
	}
	wg.Wait()
}

// RunPoolCounted starts n workers that consume jobs from ch, calling fn for each.
// fn must return true on success and false on failure.
// It blocks until all jobs are processed and returns the number of failures.
func RunPoolCounted[T any](n int, ch <-chan T, fn func(T) bool) int {
	var wg sync.WaitGroup
	var mu sync.Mutex
	failures := 0
	for range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range ch {
				if !fn(j) {
					mu.Lock()
					failures++
					mu.Unlock()
				}
			}
		}()
	}
	wg.Wait()
	return failures
}

// Semaphore is a counting semaphore backed by a buffered channel.
// It limits the number of goroutines executing concurrently.
type Semaphore chan struct{}

// NewSemaphore returns a Semaphore that allows at most n concurrent acquisitions.
func NewSemaphore(n int) Semaphore { return make(Semaphore, n) }

// Acquire blocks until a slot is available.
func (s Semaphore) Acquire() { s <- struct{}{} }

// Release frees a slot.
func (s Semaphore) Release() { <-s }
