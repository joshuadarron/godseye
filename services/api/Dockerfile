FROM golang:1.22-alpine AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /godseye ./cmd/server

FROM alpine:3.19

RUN apk add --no-cache ca-certificates

COPY --from=build /godseye /godseye

EXPOSE 8080

ENTRYPOINT ["/godseye"]
