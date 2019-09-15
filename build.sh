#!/bin/sh

if [ "$(which esc)" == "" ]; then
   go get -u github.com/mjibson/esc
fi

go generate
go build
go install

