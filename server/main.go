package main

import (
	"log"
	"reflect"
	"strconv"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var db *gorm.DB
var schemaCache = make(map[string]reflect.Type)

func main() {
	var err error

	loadConfig()

	db, err = connectToDatabase()
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
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

	tableApi := api.Group("/tables/:table")

	tableApi.GET("/schema", getSchema)

	tableApi.GET("/data", getData)
	tableApi.POST("/query", dataQuery)

	tableApi.GET("/odata", odataEndpoint)
	tableApi.POST("/data", createData)
	tableApi.PUT("/data", updateData)
	tableApi.DELETE("/data", deleteData)

	tableApi.GET("/count", getCount)

	return router
}

func generateFilterStatement(field string, filterType string, value interface{}, endValue interface{}) (interface{}, interface{}, interface{}) {
	switch filterType {
	case "equals":
		return field + " = ?", value, nil
	case "notEqual":
		return field + " != ?", value, nil
	case "greaterThan":
		return field + " > ?", value, nil
	case "lessThan":
		return field + " < ?", value, nil
	case "greaterThanOrEqual":
		return field + " >= ?", value, nil
	case "lessThanOrEqual":
		return field + " <= ?", value, nil
	case "contains":
		return field + " LIKE ?", "%" + value.(string) + "%", nil
	case "inRange":
		return field + " BETWEEN ? AND ?", value, endValue
	case "blank":
		return field + " IS NULL", nil, nil
	case "notBlank":
		return field + " IS NOT NULL", nil, nil
	}

	return nil, nil, nil

}

func dataQuery(c *gin.Context) {
	type QueryRequest struct {
		Limit   int `json:"limit"`
		Offset  int `json:"offset"`
		Filters []struct {
			Field      string      `json:"field"`
			Type       string      `json:"type"`
			Filter     interface{} `json:"filter"`
			FilterTo   interface{} `json:"filterTo"`
			Operator   string      `json:"operator"`
			Conditions []struct {
				Filter interface{} `json:"filter"`
				Type   string      `json:"type"`
			}
		} `json:"filters"`
	}

	var req QueryRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	table := c.Param("table")
	stmt := db.Table(table)

	limit := req.Limit
	if limit == 0 {
		limit = 100
	}
	offset := req.Offset

	for _, filter := range req.Filters {
		if !isColumnNameValid(table, filter.Field) {
			c.JSON(400, gin.H{"error": "Invalid column name in filter: " + filter.Field})
			return
		}
	}

	for _, filter := range req.Filters {
		if filter.Operator == "OR" {
			stmt = stmt.
				Where(generateFilterStatement(filter.Field, filter.Conditions[0].Type, filter.Conditions[0].Filter, filter.FilterTo)).
				Or(generateFilterStatement(filter.Field, filter.Conditions[1].Type, filter.Conditions[1].Filter, filter.FilterTo))
		} else {
			stmt = stmt.Where(generateFilterStatement(filter.Field, filter.Type, filter.Filter, filter.FilterTo))
		}
	}

	genStructType := getStructSchema(table)
	sliceType := reflect.SliceOf(genStructType)
	data := reflect.New(sliceType).Interface()

	var count int64
	result := stmt.Count(&count)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": result.Error.Error()})
		return
	}

	stmt = stmt.Limit(limit).Offset(offset)
	result = stmt.Find(data)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(200, gin.H{
		"data":  data,
		"count": count,
	})

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

	genStructType := getStructSchema(table)
	sliceType := reflect.SliceOf(genStructType)
	data := reflect.New(sliceType).Interface()

	err = db.Table(table).Limit(limit).Offset(offset).Find(data).Error
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, data)
}

func odataEndpoint(c *gin.Context) {
	table := c.Param("table")
	stmt := db.Table(table)

	genStructType := getStructSchema(table)
	sliceType := reflect.SliceOf(genStructType)
	data := reflect.New(sliceType).Interface()

	limitStr := c.DefaultQuery("$top", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid limit parameter"})
		return
	}

	offsetStr := c.DefaultQuery("$skip", "0")
	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid offset parameter"})
		return
	}

	filter := c.Query("$filter")
	if filter == "" {
		result := stmt.Limit(limit).Offset(offset).Find(data)
		if result.Error != nil {
			c.JSON(500, gin.H{"error": result.Error.Error()})
			return
		}

		c.JSON(200, data)
		return
	}

	filers := strings.Split(filter, " and ")
	conditions := make(map[string][]map[string]interface{})

	for _, f := range filers {
		parts := strings.SplitN(f, " ", 3)

		if len(parts) == 3 {
			if !isColumnNameValid(table, parts[0]) {
				c.JSON(400, gin.H{"error": "Invalid column name in filter: " + parts[0]})
				return
			}

			condition := map[string]interface{}{
				parts[0]: strings.Trim(parts[2], "'"),
			}

			conditions[parts[1]] = append(conditions[parts[1]], condition)
		}
	}

	equalConditions, exists := conditions["eq"]
	if exists {
		for _, cond := range equalConditions {
			stmt = stmt.Where(cond)
		}
	}

	notEqualConditions, exists := conditions["ne"]
	if exists {
		for _, cond := range notEqualConditions {
			stmt = stmt.Not(cond)
		}
	}

	greaterConditions, exists := conditions["gt"]
	if exists {
		for _, cond := range greaterConditions {
			for k, v := range cond {
				stmt = stmt.Where(k+" > ?", v)
			}
		}
	}

	lesserConditions, exists := conditions["lt"]
	if exists {
		for _, cond := range lesserConditions {
			for k, v := range cond {
				stmt = stmt.Where(k+" < ?", v)
			}
		}
	}

	greaterEqualConditions, exists := conditions["ge"]
	if exists {
		for _, cond := range greaterEqualConditions {
			for k, v := range cond {
				stmt = stmt.Where(k+" >= ?", v)
			}
		}
	}

	lesserEqualConditions, exists := conditions["le"]
	if exists {
		for _, cond := range lesserEqualConditions {
			for k, v := range cond {
				stmt = stmt.Where(k+" <= ?", v)
			}
		}
	}

	likeConditions, exists := conditions["like"]
	if exists {
		for _, cond := range likeConditions {
			for k, v := range cond {
				stmt = stmt.Where(k+" LIKE ?", v)
			}
		}
	}

	result := stmt.Limit(limit).Offset(offset).Find(data)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(200, data)

}

func createData(c *gin.Context) {
	table := c.Param("table")

	genStructType := getStructSchema(table)
	structData := reflect.New(genStructType).Interface()

	if err := c.BindJSON(structData); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	data := convertGormStructToMap(structData)

	result := db.Table(table).Create(&data)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "success"})
}

func updateData(c *gin.Context) {
	table := c.Param("table")

	genStructType := getStructSchema(table)
	structData := reflect.New(genStructType).Interface()

	if err := c.BindJSON(structData); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	data := convertGormStructToMap(structData)
	primaryKeys := retrievePrimaryKeyValues(structData)

	log.Println("Upserting data:", data)

	result := db.Table(table).Where(primaryKeys).Updates(data)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "success"})
}

func deleteData(c *gin.Context) {
	table := c.Param("table")

	genStructType := getStructSchema(table)
	structData := reflect.New(genStructType).Interface()

	if err := c.BindJSON(structData); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	primaryKeys := retrievePrimaryKeyValues(structData)

	result := db.Table(table).Where(primaryKeys).Delete(nil)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "deleted"})
}

func getCount(c *gin.Context) {
	table := c.Param("table")
	var count int64
	result := db.Table(table).Count(&count)
	if result.Error != nil {
		c.JSON(500, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(200, gin.H{"count": count})
}
