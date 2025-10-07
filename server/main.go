package main

import (
	"log"
	"reflect"
	"strconv"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var db *gorm.DB

func main() {
	var err error

	loadConfig()

	db, err = connectToDatabase()
	if err != nil {
		return
	}

	err = initRouter().Run(":8080")
	if err != nil {
		log.Fatal(err)
	}

}

func initRouter() *gin.Engine {
	router := gin.Default()

	router.Use(reactMiddleware())
	router.Use(cors.Default())

	api := router.Group("/api")

	api.GET("/tables", getTables)
	api.GET("/tables/:table/schema", getSchema)

	api.GET("/tables/:table/data", getData)
	api.POST("/tables/:table/data", upsertData)
	api.DELETE("/tables/:table/data", deleteData)

	return router
}

func getData(c *gin.Context) {
	table := c.Param("table")

	limitStr := c.DefaultQuery("limit", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid limit parameter"})
		return
	}

	offsetStr := c.DefaultQuery("offset", "0")
	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid offset parameter"})
		return
	}

	var data []map[string]interface{}
	err = db.Table(table).Limit(limit).Offset(offset).Find(&data).Error
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, data)
}

func upsertData(c *gin.Context) {
	table := c.Param("table")

	genStructType := createStructTypeBasedOnSchema(table).(reflect.Type)
	data := reflect.New(genStructType).Interface()

	if err := c.BindJSON(data); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	result := db.Table(table).Clauses(clause.OnConflict{UpdateAll: true}).Create(data)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "success"})
}

func deleteData(c *gin.Context) {
	table := c.Param("table")

	genStructType := createStructTypeBasedOnSchema(table).(reflect.Type)
	data := reflect.New(genStructType).Interface()

	if err := c.BindJSON(data); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	result := db.Table(table).Delete(data)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "deleted"})
}
