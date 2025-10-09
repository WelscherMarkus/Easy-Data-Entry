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
COPY server/ ./
RUN go mod download
COPY --from=frontend-build /app/build ./website
RUN go build -o main .

# Stage 3: Final Image
FROM ubuntu:latest
WORKDIR /app
RUN apt-get update && apt-get install -y ca-certificates
COPY --from=backend-build /app/main .
COPY --from=backend-build /app/website ./website
EXPOSE 8080
ENV GIN_MODE=release
ENV NODE_ENV=production
CMD ["./main"]
