/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const {
    DynamoDBClient,
    BatchWriteItemCommand,
    ScanCommand, QueryCommand,
    UpdateItemCommand,
    GetItemCommand
} = require("@aws-sdk/client-dynamodb");

const ddbClient = new DynamoDBClient();

async function saveItems(tableName, items) {

    const params = {
        RequestItems: {
            [tableName]: items,
        }
    };

    const batchWriteItemCommand = new BatchWriteItemCommand(params);
    const result = await ddbClient.send(batchWriteItemCommand);

    return result;
}

async function scanItems(tableName) {
    const params = {
        TableName: tableName
    };
    const command = new ScanCommand(params);
    const result = await ddbClient.send(command);
    return result;
}

async function getItem(tableName, key) {
    const params = {
        TableName: tableName,
        Key: key
    };
    const command = new GetItemCommand(params);
    const result = await ddbClient.send(command);
    return result;
}

async function queryItems(tableName, inputParams = {}) {
    const { Limit = undefined, ExclusiveStartKey = null, KeyConditionExpression = undefined, ExpressionAttributeValues = undefined } = inputParams;
    const params = {
        TableName: tableName,
        Limit,
        ExclusiveStartKey,
        KeyConditionExpression,
        ExpressionAttributeValues
    }

    const command = new QueryCommand(params);
    const result = await ddbClient.send(command);
    return result;
}

async function updateItem(tableName, key, updateExpression, expressionAttributeValues, expressionAttributeNames) {
    const params = {
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames
    }
    const command = new UpdateItemCommand(params);
    const result = await ddbClient.send(command);
    return result;
}

module.exports = {
    saveItems,
    scanItems,
    getItem,
    queryItems,
    updateItem
}