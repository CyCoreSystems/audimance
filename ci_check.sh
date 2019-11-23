#!/bin/sh
set -e
go generate
golangci-lint run
go test -v
