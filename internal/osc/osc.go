package osc

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/CyCoreSystems/audimance/agenda"
	"github.com/hypebeast/go-osc/osc"
)

// SetupPositions configures the given OSC service with the positions of sources from the given Agenda.
func SetupPositions(a *agenda.Agenda, roomIndex int, svc string) error {
	r := a.Rooms[roomIndex]

	if len(r.Sources) > 32 {
		return fmt.Errorf("too many sources (%d); only 32 channels allowed", len(r.Sources))
	}

	svcPieces := strings.Split(svc, ":")
	if len(svcPieces) != 2 {
		return fmt.Errorf("failed to parse OSC service address as <host>:<port>")
	}

	svcPort, err := strconv.Atoi(svcPieces[1])
	if err != nil {
		return fmt.Errorf("failed to parse port %q as an integer: %w", svcPieces[1], err)
		}

		if svcPort < 0 || svcPort > 65535 {
		return fmt.Errorf("invalid port number %q", svcPort)
		}

	client := osc.NewClient(svcPieces[0], svcPort)

	for n, s := range r.Sources {
		msg := osc.NewMessage(fmt.Sprintf("/channel/%d/position", n+1))
		msg.Append(s.Location.X)
		msg.Append(s.Location.Y)
		
		if err := client.Send(msg); err != nil {
			return fmt.Errorf("failed to set position of source %d (channel %d): %w", n, n+1, err)
		}
	}

	return nil
}
