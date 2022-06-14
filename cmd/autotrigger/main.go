package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/CyCoreSystems/audimance/agenda"
)

var cueName string
var interval time.Duration
var baseURL string

func init() {
	flag.DurationVar(&interval, "r", 3*time.Minute, "repeat interval")
	flag.StringVar(&cueName, "c", "", "name of cue to be triggered")
	flag.StringVar(&baseURL, "u", "http://localhost:3000", "base URL")
}

func main() {
	flag.Parse()

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, os.Kill)
	defer cancel()

	if cueName == "" {
		log.Fatalln("cue name must be set")
	}

	cueID, err := findCue(cueName)
	if err != nil {
		log.Fatalln("failed to find cue: %s", err.Error())
	}

	if err := trigger(cueID); err != nil {
		log.Printf("failed to trigger cue: %s", err.Error())
	} else {
		log.Printf("triggered cue %s (%s)", cueName, cueID)
	}

	for {
		select {
		case <-ctx.Done():
			os.Exit(0)
		case <-time.After(interval):
			if err := trigger(cueID); err != nil {
				log.Printf("failed to trigger cue: %s", err.Error())
			} else {
				log.Printf("triggered cue %s (%s)", cueName, cueID)
			}
		}
	}
}

func findCue(cueName string) (string, error) {
	resp, err := http.Get(fmt.Sprintf("%s/agenda.json", baseURL))
	if err != nil {
		return "", fmt.Errorf("failed to retrieve agenda: %w", err)
	}

	defer resp.Body.Close()

	var a agenda.Agenda

	if err := json.NewDecoder(resp.Body).Decode(&a); err != nil {
		return "", fmt.Errorf("failed to decode agenda: %w", err)
	}

	for _, c := range a.Cues {
		if c.Name == cueName {
			return c.ID, nil
		}

		// Handle cases where the user passes the ID instaed of the name
		if c.ID == cueName {
			return c.ID, nil
		}
	}

	return "", fmt.Errorf("cue %q not found in agenda", cueName)
}

func trigger(cueID string) error {
	req, err := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/cues/%s", baseURL, cueID), nil)
	if err != nil {
		return fmt.Errorf("failed to construct PUT request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("non-200 OK response: %s", resp.Status)
	}

	return nil
}
