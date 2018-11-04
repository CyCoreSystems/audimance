package main

//go:generate esc -o static.go -ignore \.map$ app

import (
	"flag"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/CyCoreSystems/audimance/agenda"
	"github.com/CyCoreSystems/audimance/showtime"
	"github.com/davecgh/go-spew/spew"
	"github.com/labstack/echo"
	"github.com/labstack/echo/middleware"
	"github.com/labstack/gommon/log"
	"github.com/mattn/echo-livereload"
	"github.com/pkg/errors"
	"golang.org/x/net/websocket"
)

var keyFile string
var certFile string

// addr is the listen address
var addr string

// qlabAddr is the listen address
var qlabAddr string

// debug enables debug mode, which uses local files
// instead of bundled ones
var debug bool

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
}

func main() {
	flag.Parse()

	// Read the Agenda
	a, err := agenda.New("agenda.yaml")
	if err != nil {
		fmt.Printf("failed to read agenda: %s", err.Error())
		os.Exit(1)
	}

	if debug {
		spew.Dump(a)
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

	if debug {
		e.Logger.SetLevel(log.DEBUG)
		e.Use(livereload.LiveReload())
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
	e.GET("/app/*.js", echo.WrapHandler(http.FileServer(FS(false))))

	// Serve user-supplied assets
	e.Static("/js", "js")
	e.Static("/css", "css")
	e.Static("/media", "media")

	e.GET("/admin", admin)
	e.GET("/live", live)
	e.GET("/room/:id", enterRoom)
	e.GET("/tracks/:id", roomTracks)

	e.PUT("/cues/:id", triggerCue)

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
	return c.Render(200, "live.html", nil)
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
				ctx.Logger().Error(errors.Wrap(err, "failed to send announcement"))
				break
			}
		}
	}).ServeHTTP(ctx.Response(), ctx.Request())
	return nil
}
