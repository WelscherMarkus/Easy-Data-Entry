package main

import (
	"log"
	"os"
	"reflect"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var metadataLogger = logger.New(
	log.New(os.Stdout, "\r\n", log.LstdFlags),
	logger.Config{
		SlowThreshold:             10 * time.Second,
		LogLevel:                  logger.Warn,
		IgnoreRecordNotFoundError: false,
		Colorful:                  true,
	},
)

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

	type DbColumn struct {
		Name       string `json:"name" gorm:"column:DbName"`
		DbType     string `json:"db_type" gorm:"column:DbType"`
		Key        int    `json:"keyColumn" gorm:"column:Key"`
		ForeignKey string `json:"foreignKey" gorm:"column:ForeignKey"`
	}
	type Column struct {
		Name       string `json:"name"`
		Type       string `json:"type"`
		Key        bool   `json:"key"`
		Filter     bool   `json:"filterable"`
		ForeignKey string `json:"foreignKeyName" gorm:"column:ForeignKey"`
	}
	type TableSchema struct {
		Columns []Column `json:"columns"`
	}

	query := `
	SELECT 
		c.COLUMN_NAME                                                                AS DbName,
       	c.DATA_TYPE                                                                  AS DbType,
       	CASE WHEN tc.CONSTRAINT_TYPE = 'PRIMARY KEY' THEN 1 ELSE 0 END     AS "Key",
       	CASE WHEN tc.CONSTRAINT_TYPE = 'FOREIGN KEY' THEN k.CONSTRAINT_NAME END AS ForeignKey
	FROM INFORMATION_SCHEMA.COLUMNS c
         LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
                   ON c.TABLE_NAME = k.TABLE_NAME
                       AND c.COLUMN_NAME = k.COLUMN_NAME
                       AND c.TABLE_SCHEMA = k.TABLE_SCHEMA
         LEFT JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                   ON k.TABLE_NAME = tc.TABLE_NAME
                       AND k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
                       AND k.TABLE_SCHEMA = tc.TABLE_SCHEMA
                       AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'FOREIGN KEY')
	WHERE c.TABLE_NAME = ?
	`

	var dbColumns []DbColumn
	err := db.Raw(query, table).Scan(&dbColumns).Error
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	var columns []Column
	for _, dbCol := range dbColumns {
		var column Column
		column.Name = dbCol.Name
		column.Type = dbCol.DbType
		column.Key = dbCol.Key == 1
		column.ForeignKey = dbCol.ForeignKey

		switch dbCol.DbType {
		case "int", "bigint", "smallint", "tinyint", "decimal", "numeric", "float", "real", "money", "smallmoney":
			column.Type = "number"
		case "char", "varchar", "text", "nchar", "nvarchar", "ntext":
			column.Type = "text"
		}

		switch dbCol.DbType {
		case "int", "varchar":
			column.Filter = true
		default:
			column.Filter = false
		}

		columns = append(columns, column)
	}

	schema := TableSchema{Columns: columns}
	c.JSON(200, schema)
}

type SchemaColumn struct {
	StructName string
	DbName     string
	DbType     string
	GoType     string
	ForeignKey string
	Key        bool
}

func retrieveSchema(table string) ([]SchemaColumn, error) {
	query := `
		SELECT
    		c.COLUMN_NAME AS DbName,
    		c.DATA_TYPE AS DbType,
    		MAX(CASE WHEN tc.CONSTRAINT_TYPE = 'PRIMARY KEY' THEN 1 ELSE 0 END) AS "Key",
    		MAX(CASE WHEN tc.CONSTRAINT_TYPE = 'FOREIGN KEY' THEN k.CONSTRAINT_NAME END) AS ForeignKey
		FROM INFORMATION_SCHEMA.COLUMNS c
		LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
    		ON c.TABLE_NAME = k.TABLE_NAME
    		AND c.COLUMN_NAME = k.COLUMN_NAME
    		AND c.TABLE_SCHEMA = k.TABLE_SCHEMA
		LEFT JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    		ON k.TABLE_NAME = tc.TABLE_NAME
    		AND k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    		AND k.TABLE_SCHEMA = tc.TABLE_SCHEMA
    		AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'FOREIGN KEY')
		WHERE c.TABLE_NAME = ?
		GROUP BY c.COLUMN_NAME, c.DATA_TYPE;
	`

	var columns []SchemaColumn
	err := db.Session(&gorm.Session{Logger: metadataLogger}).Raw(query, table).Scan(&columns).Error
	if err != nil {
		return nil, err
	}

	for i, col := range columns {
		columns[i].StructName = cases.Title(language.English).String(col.DbName)

		columns[i].Key = col.Key

		switch col.DbType {
		case "int", "bigint", "smallint", "tinyint", "decimal", "numeric", "float", "real", "money", "smallmoney":
			columns[i].GoType = "int"
		case "char", "varchar", "text", "nchar", "nvarchar", "ntext":
			columns[i].GoType = "string"
		default:
			columns[i].GoType = "interface{}"
		}
	}

	return columns, nil
}

type FkMapping struct {
	ReferencedTable  string
	ReferencedColumn string
}

var foreignKeyCache = make(map[string]FkMapping)

func cacheForeignKeys(foreignKeyName string) FkMapping {
	if cachedFk, ok := foreignKeyCache[foreignKeyName]; ok {
		return cachedFk

	} else {
		fkMap, err := retrieveForeignKeys(foreignKeyName)
		if err != nil {
			log.Println("Error retrieving foreign keys:", err)
			return FkMapping{}
		}
		foreignKeyCache[foreignKeyName] = fkMap
		return fkMap
	}
}

func retrieveForeignKeys(foreignKeyName string) (FkMapping, error) {
	query := `
	SELECT
    	fk.CONSTRAINT_NAME AS FOREIGN_KEY_NAME,
    	fk.TABLE_NAME AS FOREIGN_TABLE,
    	fk.COLUMN_NAME AS FOREIGN_COLUMN,
    	pk.TABLE_NAME AS REFERENCED_TABLE,
    	pk.COLUMN_NAME AS REFERENCED_COLUMN
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE fk
	JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    	ON fk.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
	JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE pk
    	ON pk.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME
    	AND pk.ORDINAL_POSITION = fk.ORDINAL_POSITION
	WHERE fk.CONSTRAINT_NAME = ?;
	`

	type ForeignKey struct {
		ForeignKeyName   string `gorm:"column:FOREIGN_KEY_NAME"`
		ForeignTable     string `gorm:"column:FOREIGN_TABLE"`
		ForeignColumn    string `gorm:"column:FOREIGN_COLUMN"`
		ReferencedTable  string `gorm:"column:REFERENCED_TABLE"`
		ReferencedColumn string `gorm:"column:REFERENCED_COLUMN"`
	}

	var foreignKeys ForeignKey
	result := db.Session(&gorm.Session{Logger: metadataLogger}).Raw(query, foreignKeyName).Find(&foreignKeys)
	if result.Error != nil {
		return FkMapping{}, result.Error
	}

	fkMap := FkMapping{
		ReferencedTable:  foreignKeys.ReferencedTable,
		ReferencedColumn: foreignKeys.ReferencedColumn,
	}

	return fkMap, nil
}

func retrievePrimaryKeyValues(data interface{}) map[string]interface{} {
	resultMap := make(map[string]interface{})

	val := reflect.ValueOf(data).Elem()
	typ := val.Type()

	for i := 0; i < val.NumField(); i++ {
		field := typ.Field(i)
		gormTags := parseGormTag(field.Tag)
		if _, ok := gormTags["primaryKey"]; ok {
			columnName := gormTags["column"]
			resultMap[columnName] = val.Field(i).Interface()
		}

	}

	return resultMap
}

func isColumnNameValid(table string, column string) bool {
	columns, err := retrieveSchema(table)
	if err != nil {
		return false
	}

	validColumns := make(map[string]bool)
	for _, col := range columns {
		validColumns[col.DbName] = true
	}

	if _, ok := validColumns[column]; ok {
		return true
	}

	return false
}

func convertGormStructToMap(data interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	val := reflect.ValueOf(data).Elem()
	typ := val.Type()

	for i := 0; i < val.NumField(); i++ {
		field := typ.Field(i)
		gormTags := parseGormTag(field.Tag)
		columnName := gormTags["column"]
		result[columnName] = val.Field(i).Interface()
	}
	return result
}

func parseGormTag(tag reflect.StructTag) map[string]string {
	result := make(map[string]string)
	gormTag := tag.Get("gorm")
	parts := strings.Split(gormTag, ";")
	for _, part := range parts {
		if kv := strings.SplitN(part, ":", 2); len(kv) == 2 {
			result[kv[0]] = kv[1]
		} else if part != "" {
			result[part] = ""
		}
	}
	return result
}

var schemaCache = make(map[string]reflect.Type)

func getStructSchema(table string) reflect.Type {
	var genStructType reflect.Type
	if cachedType, ok := schemaCache[table]; ok {
		genStructType = cachedType
	} else {
		genStructType = createStructTypeBasedOnSchema(table).(reflect.Type)
		schemaCache[table] = genStructType
	}
	return genStructType
}

func createStructTypeBasedOnSchema(table string) reflect.Type {
	columns, err := retrieveSchema(table)
	if err != nil {
		log.Fatal(err)
	}

	var structFields []reflect.StructField
	for _, col := range columns {
		var fieldType reflect.Type
		switch col.GoType {
		case "int":
			fieldType = reflect.TypeOf(0)
		case "string":
			fieldType = reflect.TypeOf("")
		default:
			fieldType = reflect.TypeOf(new(interface{})).Elem()
		}

		tags := `json:"` + col.DbName + `"`
		if col.Key {
			tags += `gorm:"column:` + col.DbName + `;primaryKey;autoIncrement:false"`
		} else {
			tags += `gorm:"column:` + col.DbName + `"`
		}

		structField := reflect.StructField{
			Name: col.StructName,
			Type: fieldType,
			Tag:  reflect.StructTag(tags),
		}
		structFields = append(structFields, structField)
	}

	genStruct := reflect.StructOf(structFields)

	return genStruct
}
