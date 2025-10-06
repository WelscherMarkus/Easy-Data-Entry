package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/spf13/viper"
	"gorm.io/gorm"
)

var db *gorm.DB

func main() {
	var err error

	loadConfig()

	db, err = connectToDatabase()
	if err != nil {
		return
	}

	router := gin.Default()

	router.Use(reactMiddleware())
	router.Use(cors.Default())

	api := router.Group("/api")

	api.GET("/tables", getTables)
	api.GET("/tables/:table/schema", getSchema)
	api.GET("/tables/:table/data", getData)

	err = router.Run(":8080")
	if err != nil {
		log.Fatal(err)
	}

}

func getTables(c *gin.Context) {
	var tables []string
	err := db.Raw("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'").Scan(&tables).Error
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, tables)
}

func getSchema(c *gin.Context) {
	table := c.Param("table")

	type Column struct {
		Name string `json:"name" gorm:"column:COLUMN_NAME"`
		Type string `json:"type" gorm:"column:DATA_TYPE"`
	}
	type TableSchema struct {
		Columns []Column `json:"columns"`
	}

	var columns []Column
	err := db.Raw("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?", table).Scan(&columns).Error
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	for i, col := range columns {
		switch col.Type {
		case "int", "bigint", "smallint", "tinyint", "decimal", "numeric", "float", "real", "money", "smallmoney":
			columns[i].Type = "number"
		case "char", "varchar", "text", "nchar", "nvarchar", "ntext":
			columns[i].Type = "text"
		}
	}

	schema := TableSchema{Columns: columns}
	c.JSON(200, schema)
}

func getData(c *gin.Context) {
	table := c.Param("table")

	var data []map[string]interface{}
	err := db.Table(table).Limit(100).Find(&data).Error
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, data)
}

func loadConfig() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No Environment file found")
	}

	viper.AutomaticEnv()
	viper.SetDefault("PORT", "1433")
}
