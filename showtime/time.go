package showtime

import (
	"net"
	"sync"
	"time"

	"github.com/labstack/echo"
	"github.com/pkg/errors"
)

const subscriptionBufferSize = 5

const maxUDPMessageSize = 512

var minUpdateInterval = time.Duration(2) * time.Second

// Time describes the time at which the last Cue occurred
type Time struct {

	// Cue indicates the last-triggered performance cue
	Cue string

	// Received indicates the timestamp at which the last-triggered cue was received
	Received time.Time
}

// An Announcement is a notification of a change in the showtime.  It can be an incremental time notification or a cue notification
type Announcement struct {

	// Cause indicates the reason for the announcement.  Valid reasons are "periodic" and "cue"
	Cause string `json:"cause"`

	// TimePoints lists the TimePoints (cues and their time offsets) which have been received so far, in order of appearance.
	TimePoints []*TimePoint `json:"time_points"`
}

// TimePoint describes a point in performance time, which can be exported
// to the web clients.  It uses an offset rather than a timestamp so that web
// clients need not be time-synchronized to the server.
type TimePoint struct {

	// Cue indicates the last-triggered performance cue
	Cue string `json:"cue"`

	// Offset indicates the number of seconds since the last cue was triggered
	Offset float64 `json:"offset"`
}

func (t *Time) OffsetSeconds() float64 {
	return time.Since(t.Received).Seconds()
}

// Now returns the current point in performance time
func (t *Time) Now() *TimePoint {
	return &TimePoint{
		Cue:    t.Cue,
		Offset: t.OffsetSeconds(),
	}
}

type Service struct {
	Echo *echo.Echo

	// Times records the Cues as they are received
	Times []*Time

	subs []*Subscription

	mu sync.Mutex

	closed bool
}

// Subscribe registers a subscription to receive showtime announcements
func (s *Service) Subscribe() *Subscription {
	sub := newSubscription(s)
	s.add(sub)
	return sub
}

func (s *Service) add(sub *Subscription) {
	s.mu.Lock()
	s.subs = append(s.subs, sub)
	s.mu.Unlock()
}

func (s *Service) remove(sub *Subscription) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, si := range s.subs {
		if sub == si {
			// Subs are pointers, so we have to explicitly remove them
			// to prevent memory leaks
			s.subs[i] = s.subs[len(s.subs)-1] // replace the current with the end
			s.subs[len(s.subs)-1] = nil       // remove the end
			s.subs = s.subs[:len(s.subs)-1]   // lop off the end
			return
		}
	}
}

// Execute the showtime service
func (s *Service) Run(qlabAddr string) error {

	cue := make(chan string)
	defer close(cue)

	addr, err := net.ResolveUDPAddr("udp", qlabAddr)
	if err != nil {
		return errors.Wrap(err, "failed to parse cue listener address")
	}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return errors.Wrap(err, "failed to listen on UDP port")
	}
	defer conn.Close()
	go s.processUDP(conn, cue)

	// Tick on a periodic interval
	ticker := time.NewTicker(minUpdateInterval)
	defer ticker.Stop()

	// Notify each subscriber when an update occurs
	for {
		select {
		case <-ticker.C:
			s.notify("periodic")
		case <-cue:
			s.notify("cue")
		}
	}
}

func (s *Service) notify(cause string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Construct announcement
	var points []*TimePoint
	for _, t := range s.Times {
		points = append(points, t.Now())
	}

	ann := &Announcement{
		Cause:      cause,
		TimePoints: points,
	}

	for _, sub := range s.subs {
		select {
		case sub.C <- ann:
		default: // never block
		}
	}
}

func (s *Service) processUDP(conn *net.UDPConn, cue chan string) {
	for {
		buf := make([]byte, maxUDPMessageSize)
		n, err := conn.Read(buf)
		if err != nil {
			// TODO: handle failure; reconnect
			s.Echo.Logger.Error(errors.Wrap(err, "failed to read from UDP port"))
			return
		}

		recv := string(buf[0:n])
		s.Echo.Logger.Debugf("received message from QLab: %s", recv)

		// Update the showtime Time
		s.mu.Lock()
		s.Times = append(s.Times, &Time{
			Cue:      recv,
			Received: time.Now(),
		})
		s.mu.Unlock()

		cue <- string(buf)
	}
}

// Subscription represents a subscription to showtime announcements
type Subscription struct {
	C      chan *Announcement
	closed bool
	mu     sync.Mutex

	svc *Service
}

func newSubscription(svc *Service) *Subscription {
	return &Subscription{
		C:   make(chan *Announcement, subscriptionBufferSize),
		svc: svc,
	}
}

// Cancel cancels the subscription and removes it from
// the service
func (s *Subscription) Cancel() {
	if s == nil {
		return
	}

	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}
	s.closed = true
	s.mu.Unlock()

	if s.svc != nil {
		s.svc.remove(s)
	}

	if s.C != nil {
		close(s.C)
	}
}
