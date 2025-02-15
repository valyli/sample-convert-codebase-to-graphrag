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

const { saveItems, scanItems, updateItem, getItem } = require('./client');

const {
    CODE_GRAPH_TABLE,
    CODE_GRAPH_TABLE_COLUMN_DELETED,
    CODE_GRAPH_TABLE_COLUMN_STATUS,
    CODE_GRAPH_TABLE_COLUMN_UPDATE_TIME,
    CODE_GRAPH_TABLE_COLUMN_FILE_FILTER,
    CODE_GRAPH_TABLE_COLUMN_BRANCH,
    CODE_GRAPH_TABLE_COLUMN_SUBFOLDER,
    CODE_GRAPH_TABLE_COLUMN_GITURL,
    CODE_GRAPH_TABLE_COLUMN_ID,

    CODE_GRAPH_TABLE_STATUS_CODE_DOWNLOADING
} = require('../constants');

async function saveCodeGraphItem(id, gitUrl, branch, subFolder, fileFilter, updateTime) {
    const items = [
        {
            PutRequest: {
                Item: {
                    [CODE_GRAPH_TABLE_COLUMN_ID]: { S: id },
                    [CODE_GRAPH_TABLE_COLUMN_GITURL]: { S: gitUrl },
                    [CODE_GRAPH_TABLE_COLUMN_BRANCH]: { S: branch },
                    [CODE_GRAPH_TABLE_COLUMN_SUBFOLDER]: { S: subFolder },
                    [CODE_GRAPH_TABLE_COLUMN_FILE_FILTER]: { S: fileFilter },
                    [CODE_GRAPH_TABLE_COLUMN_UPDATE_TIME]: { S: updateTime },
                    [CODE_GRAPH_TABLE_COLUMN_STATUS]: { S: CODE_GRAPH_TABLE_STATUS_CODE_DOWNLOADING },
                },
            },
        },
    ];
    return saveItems(CODE_GRAPH_TABLE, items);
}

async function listCodeGraphs(limit = 20, exclusiveStartKey = null) {
    const result = await scanItems(CODE_GRAPH_TABLE);
    if (result.$metadata && result.$metadata.httpStatusCode === 200) {
        const regularArray = dbResultItemsToRegularArray(result.Items);
        // Remove deleted items
        const filteredArray = regularArray.filter(item => !item[CODE_GRAPH_TABLE_COLUMN_DELETED]);
        return filteredArray;
    }
    return [];
}

async function getCodeGraph(id) {
    const result = await getItem(CODE_GRAPH_TABLE,
        {
            [CODE_GRAPH_TABLE_COLUMN_ID]: { S: id }
        }
    );
    if (result.$metadata && result.$metadata.httpStatusCode === 200) {
        const regularArray = dbResultItemsToRegularArray([result.Item]);
        return regularArray[0];
    }
    return null;
}

async function updateCodeGraphStatus(id, status) {
    return await updateItem(CODE_GRAPH_TABLE,
        {
            [CODE_GRAPH_TABLE_COLUMN_ID]: { S: id },
        },
        "SET #status = :status",
        {
            ":status": { S: status },
        },
        {
            "#status": CODE_GRAPH_TABLE_COLUMN_STATUS
        }
    )
}

async function markDelete(id) {
    return await updateItem(CODE_GRAPH_TABLE,
        {
            [CODE_GRAPH_TABLE_COLUMN_ID]: { S: id },
        },
        "SET #deleted = :deleted",
        {
            ":deleted": { BOOL: true },
        },
        {
            "#deleted": CODE_GRAPH_TABLE_COLUMN_DELETED
        }
    )
}

function dbResultItemsToRegularArray(dbResultItems) {
    const regularArray = dbResultItems.map(obj => {
        const newObj = {};
        for (const [key, value] of Object.entries(obj)) {
            newObj[key] = value.S || value.N || value.BOOL;
        }
        return newObj;
    });
    return regularArray;
}

module.exports = { saveCodeGraphItem, listCodeGraphs, getCodeGraph, updateCodeGraphStatus, markDelete }