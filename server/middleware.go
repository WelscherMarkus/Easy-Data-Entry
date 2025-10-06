package main

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func reactMiddleware() gin.HandlerFunc {
	return func(context *gin.Context) {
		switch {
		case strings.HasPrefix(context.Request.URL.Path, "/api"):
			context.Next()
		case strings.HasPrefix(context.Request.URL.Path, "/static"):
			context.File("./website" + context.Request.URL.Path)
			context.Abort()
		case context.Request.URL.Path == "/favicon.ico":
			http.ServeFile(context.Writer, context.Request, "website/favicon.ico")
			context.Abort()
		default:
			log.Println(context.Request.URL.Path)
			log.Println(context.Request.Method)
			log.Println("Serving React App")

			context.File("./website/index.html")
			context.Abort()
			return
		}

	}
}
