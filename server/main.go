package main

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-contrib/cors"
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

func main() {

	router := gin.Default()

	router.Use(reactMiddleware())
	router.Use(cors.Default())

	api := router.Group("/api")

	api.GET("/tables", getTables)
	api.GET("/tables/:table/schema", getSchema)

	err := router.Run(":8080")
	if err != nil {
		log.Fatal(err)
	}

}

func getTables(c *gin.Context) {
	c.JSON(200, []string{"table1", "table2", "table3"})
}

func getSchema(c *gin.Context) {
	//table := c.Param("table")
	schema := map[string]interface{}{
		"columns": []map[string]string{
			{"name": "id", "dataType": "number"},
			{"name": "name", "dataType": "text"},
			{"name": "created_at", "dataType": "dateString"},
		},
	}
	c.JSON(200, schema)
}

func getData(c *gin.Context) {
	//table := c.Param("table")
	data := []map[string]interface{}{
		{"id": 1, "name": "Alice", "created_at": "2023-01-01"},
		{"id": 2, "name": "Bob", "created_at": "2023-01-02"},
		{"id": 3, "name": "Charlie", "created_at": "2023-01-03"},
	}
	c.JSON(200, data)
}
