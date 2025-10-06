package main

import (
	"log"
	"reflect"

	"github.com/gin-gonic/gin"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
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

	type Column struct {
		Name string `json:"name" gorm:"column:COLUMN_NAME"`
		Type string `json:"type" gorm:"column:DATA_TYPE"`
		Key  int    `json:"keyColumn" gorm:"column:IS_PRIMARY_KEY"`
	}
	type TableSchema struct {
		Columns []Column `json:"columns"`
	}

	query := `
	SELECT
		c.COLUMN_NAME,
		c.DATA_TYPE,
		CASE WHEN k.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY
	FROM INFORMATION_SCHEMA.COLUMNS c
	LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
		ON c.TABLE_NAME = k.TABLE_NAME
		AND c.COLUMN_NAME = k.COLUMN_NAME
		AND c.TABLE_SCHEMA = k.TABLE_SCHEMA
	LEFT JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
		ON k.TABLE_NAME = tc.TABLE_NAME
		AND k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
		AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
	WHERE c.TABLE_NAME = ?
	`

	var columns []Column
	err := db.Raw(query, table).Scan(&columns).Error
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

type SchemaColumn struct {
	StructName string
	DbName     string
	DbType     string
	GoType     string
	Key        bool
}

func retrieveSchema(table string) ([]SchemaColumn, error) {
	query := `
		SELECT
    		c.COLUMN_NAME AS DbName,
    		c.DATA_TYPE AS DbType,
    		CASE WHEN k.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS "Key"
		FROM INFORMATION_SCHEMA.COLUMNS c
		LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
    		ON c.TABLE_NAME = k.TABLE_NAME
    		AND c.COLUMN_NAME = k.COLUMN_NAME
    		AND c.TABLE_SCHEMA = k.TABLE_SCHEMA
		LEFT JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    		ON k.TABLE_NAME = tc.TABLE_NAME
    		AND k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    		AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
		WHERE c.TABLE_NAME = ?
	`

	var columns []SchemaColumn
	err := db.Raw(query, table).Scan(&columns).Error
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
			tags += `gorm:"column:` + col.DbName + `;primaryKey"`
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
