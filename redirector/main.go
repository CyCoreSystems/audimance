package main

import (
	"github.com/labstack/echo"
	"github.com/labstack/echo/middleware"
)

func main() {
	// Create web server
   e := echo.New()
   e.Pre(middleware.HTTPSRedirect())

   e.Logger.Debug("listening on :80")

   e.Logger.Fatal(e.Start(":80"))
}

