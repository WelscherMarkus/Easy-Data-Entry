# Stage 1: Build React Frontend
FROM node:latest AS frontend-build
WORKDIR /app
COPY website/package.json website/package-lock.json ./
RUN npm install
COPY website/ ./
RUN npm run build

# Stage 2: Build Go Backend
FROM golang:latest AS backend-build
WORKDIR /app
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
COPY --from=frontend-build /app/build ./website
RUN go build -o main main.go

# Stage 3: Final Image
FROM ubuntu:latest
WORKDIR /app
COPY --from=backend-build /app/main .
COPY --from=backend-build /app/website ./website
EXPOSE 8080
CMD ["./main"]
