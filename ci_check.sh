#!/bin/sh
set -e
dep ensure
go generate
golangci-lint run
go test -v
