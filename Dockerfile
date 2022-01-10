FROM golang:alpine AS builder
RUN apk add --no-cache git
WORKDIR $GOPATH/src/github.com/CyCoreSystems/audimance
COPY . .
RUN go get -d -v
RUN go build -o /go/bin/app

FROM alpine
RUN apk add --no-cache ca-certificates
COPY --from=builder /go/bin/app /go/bin/app
WORKDIR /data
ENTRYPOINT ["/go/bin/app"]
