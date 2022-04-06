#!/bin/sh

npm run build
go generate
go build
go install

