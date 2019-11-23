package main

import (
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// Create web server
	e := echo.New()
	e.Pre(middleware.HTTPSRedirect())

	e.Logger.Debug("listening on :80")

	e.Logger.Fatal(e.Start(":80"))
}
