package main

import (
	"embed"
	"flag"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/CyCoreSystems/audimance/agenda"
	"github.com/CyCoreSystems/audimance/internal/osc"
	"github.com/CyCoreSystems/audimance/showtime"
	"github.com/labstack/echo-contrib/prometheus"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	prom "github.com/prometheus/client_golang/prometheus"
	promauto "github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/labstack/gommon/log"
	"golang.org/x/net/websocket"
)

//go:embed all:app/*
var content embed.FS

var keyFile string
var certFile string

// addr is the listen address.
var addr string

// qlabAddr is the listen address.
var qlabAddr string

// oscAddr is the destination address of the OSC server.
var oscAddr string

// oscRoomIndex is the index number of the room to be sent to the OSC server.
var oscRoomIndex int

// debug enables debug mode, which uses local files
// instead of bundled ones
var debug bool

var (
	metricRoomEntry *prom.CounterVec
)

func init() {
	metricRoomEntry = promauto.NewCounterVec(prom.CounterOpts{
		Name: "audimance_room_load",
		Help: "Total number of room loads",
	}, []string{"room"})
}

// Template contains an HTML templates for the web service
type Template struct {
	templates *template.Template
}

// Render adapts the native template to the echo web server renderer interface
func (t *Template) Render(w io.Writer, name string, data interface{}, ctx echo.Context) error {
	return t.templates.ExecuteTemplate(w, name, data)
}

// CustomContext extends the Echo context to allow for custom data
type CustomContext struct {
	echo.Context

	Agenda *agenda.Agenda

	ShowTime *showtime.Service
}

func init() {
	flag.StringVar(&addr, "addr", ":9000", "TCP Address on which to listen for web requests")
	flag.StringVar(&qlabAddr, "qlab", ":9001", "UDP Address on which to listen for QLab cues")
	flag.StringVar(&keyFile, "key", "", "TLS key")
	flag.StringVar(&certFile, "cert", "", "TLS certificate")
	flag.BoolVar(&debug, "debug", false, "enable debug logging")
	flag.StringVar(&oscAddr, "osc", "", "Address (<host>:<port>) of an OSC service to configure")
	flag.IntVar(&oscRoomIndex, "oscroom", 0, "Index number of room to be used as the OSC room")
}

func main() {
	flag.Parse()

	// Read the Agenda
	a, err := agenda.New("agenda.yaml")
	if err != nil {
		fmt.Printf("failed to read agenda: %s", err.Error())
		os.Exit(1)
	}

	// Create web server
	e := echo.New()

	// Create the showtime service
	svc := new(showtime.Service)
	svc.Echo = e
	go func() {
		err := svc.Run(qlabAddr)
		if err != nil {
			fmt.Printf("showtime service died: %s", err.Error())
			os.Exit(1)
		}
	}()

	// Attach middleware
	e.Use(func(h echo.HandlerFunc) echo.HandlerFunc {
		return func(ctx echo.Context) error {
			c := &CustomContext{
				Context:  ctx,
				Agenda:   a,
				ShowTime: svc,
			}
			return h(c)
		}
	})
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	p := prometheus.NewPrometheus("audimance", nil)
	p.Use(e)

	fList, err := content.ReadDir("app/_snowpack/pkg")
	if err != nil {
		log.Fatal("failed to read directory:", err)
	}

	for _, f := range fList {
		log.Printf("file: %s", f.Name())
	}

	if debug {
		e.Logger.SetLevel(log.DEBUG)

		for _, room := range a.Rooms {
			e.Logger.Debug("Room:", room.ID)
		}
	}

	if oscAddr != "" {
		if err := osc.SetupPositions(a, oscRoomIndex, oscAddr); err != nil {
			log.Fatalf("failed to configure OSC positions: %w", err)
		}
	}

	// Compile and attach templates
	e.Renderer = &Template{
		templates: template.Must(template.ParseGlob("views/*.html")),
	}

	// Attach handlers

	// Handle the index
	e.GET("/", func(c echo.Context) error {
		return c.Render(200, "index.html", a)
	})

	// Serve internal javascript files
	e.GET("/app/*", echo.WrapHandler(http.FileServer(http.FS(content))))

	// Serve user-supplied assets
	e.Static("/js", "js")
	e.Static("/css", "css")
	e.Static("/media", "media")

	e.GET("/admin", admin)
	e.GET("/live", live)
	e.GET("/room/:id", enterRoom)
	e.GET("/tracks/:id", roomTracks)

	// command API for manually triggering cues --
	// FIXME: this is unprotected, unauthenticated
	e.PUT("/cues/:id", triggerCue)

	// performanceTime provides a websocket connection which provides time tickers and cues based on realtime performance status
	e.GET("/ws/performanceTime", performanceTime)

	e.GET("/agenda.json", agendaJSON)

	// Listen to OS kill signals
	go func() {
		sigs := make(chan os.Signal, 1)
		signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
		<-sigs
		e.Logger.Info("exiting on signal")
		os.Exit(100)
	}()

	// If we have TLS assets, start the TLS server
	if certFile != "" && keyFile != "" {
		e.Logger.Debug("listening on 443")
		e.Logger.Fatal(e.StartTLS(":443", certFile, keyFile))
	}

	// Listen for connections
	e.Logger.Debugf("listening on %s\n", addr)
	e.Logger.Fatal(e.Start(addr))
}

func agendaJSON(c echo.Context) error {
	ctx := c.(*CustomContext)

	return ctx.JSON(200, ctx.Agenda)
}

func enterRoom(c echo.Context) error {
	ctx := c.(*CustomContext)

	// Find our room
	id := ctx.Param("id")
	var r *agenda.Room
	for _, room := range ctx.Agenda.Rooms {
		if room.ID == id {
			r = room
			break
		}
	}
	if r == nil {
		return ctx.String(http.StatusNotFound, "no such room")
	}

	data := struct {
		Announcements []*agenda.Announcement `json:"announcements"`
		Room          *agenda.Room           `json:"room"`
	}{
		Announcements: ctx.Agenda.Announcements,
		Room:          r,
	}

	metricRoomEntry.With(prom.Labels{
		"room": "spatial",
	}).Add(1)

	return ctx.Render(200, "room.html", data)
}

func triggerCue(c echo.Context) error {
	ctx := c.(*CustomContext)

	id := ctx.Param("id")

	var cue *agenda.Cue
	for _, thisCue := range ctx.Agenda.Cues {
		if thisCue.ID == id {
			cue = thisCue
		}
	}
	if cue == nil {
		return ctx.String(http.StatusNotFound, "no such cue")
	}

	ctx.ShowTime.Trigger(cue.Data)
	return ctx.String(http.StatusOK, fmt.Sprintf(`Cue "%s" triggered`, cue.Name))
}

func admin(c echo.Context) error {
	ctx := c.(*CustomContext)
	return c.Render(200, "admin.html", ctx.Agenda)
}

func live(c echo.Context) error {
	ctx := c.(*CustomContext)
	return c.Render(200, "live.html", ctx.Agenda)
}

func roomTracks(c echo.Context) error {
	ctx := c.(*CustomContext)

	// Find our room
	id := ctx.Param("id")
	var r *agenda.Room
	for _, room := range ctx.Agenda.Rooms {
		if room.ID == id {
			r = room
			break
		}
	}
	if r == nil {
		return ctx.String(http.StatusNotFound, "no such room")
	}

	data := struct {
		Announcements []*agenda.Announcement `json:"announcements"`
		Room          *agenda.Room           `json:"room"`
	}{
		Announcements: ctx.Agenda.Announcements,
		Room:          r,
	}

	metricRoomEntry.With(prom.Labels{
		"room": "tracks",
	}).Add(1)

	return ctx.Render(200, "tracks.html", data)
}

func performanceTime(c echo.Context) error {
	ctx := c.(*CustomContext)

	websocket.Handler(func(ws *websocket.Conn) {
		defer ws.Close()

		// Create a subscription to the showtime service
		sub := ctx.ShowTime.Subscribe()
		defer sub.Cancel()

		for {
			// Process announcements
			ann := <-sub.C

			err := websocket.JSON.Send(ws, ann)
			if err != nil {
				ctx.Logger().Error(fmt.Errorf("failed to send announcement: %w", err))
				break
			}
		}
	}).ServeHTTP(ctx.Response(), ctx.Request())
	return nil
}
