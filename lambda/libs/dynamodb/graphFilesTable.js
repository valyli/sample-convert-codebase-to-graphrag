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

const { saveItems, queryItems, updateItem } = require('./client');

const {
    GRAPH_FILES_TABLE,
    GRAPH_FILES_TABLE_COLUMN_GRAPH_ID,
    GRAPH_FILES_TABLE_COLUMN_FULL_PATH,
    GRAPH_FILES_TABLE_COLUMN_SCANED,
} = require('../constants');
const path = require('path');
const minimatch = require('minimatch').minimatch;


async function saveGraphFileItems(graphId, downloadDir, fileList, fileMatcher) {
    const batchSize = 25;

    const relativePaths = fileList.map(file => path.relative(downloadDir, file));
    const filteredFiles = relativePaths.filter(file => minimatch(file, fileMatcher));

    for (let i = 0; i < filteredFiles.length; i += batchSize) {
        const items = filteredFiles.slice(i, i + batchSize).map(file => {
            return {
                PutRequest: {
                    Item: {
                        [GRAPH_FILES_TABLE_COLUMN_GRAPH_ID]: { S: graphId },
                        [GRAPH_FILES_TABLE_COLUMN_FULL_PATH]: { S: file },
                        [GRAPH_FILES_TABLE_COLUMN_SCANED]: { BOOL: false },
                    },
                },
            };
        });
        console.log(`Saving batch from index ${i} to ${i + batchSize}`);
        await saveItems(GRAPH_FILES_TABLE, items);
    }
}

async function markScaned(graphId, fullPath) {
    console.log(`Marking ${graphId} ${fullPath} as scaned`);
    return await updateItem(GRAPH_FILES_TABLE,
        {
            [GRAPH_FILES_TABLE_COLUMN_GRAPH_ID]: { S: graphId },
            [GRAPH_FILES_TABLE_COLUMN_FULL_PATH]: { S: fullPath },
        },
        "SET #scaned = :scaned",
        {
            ":scaned": { BOOL: true },
        },
        {
            "#scaned": GRAPH_FILES_TABLE_COLUMN_SCANED
        }
    )
}

async function listGraphFiles(graphId, limit = undefined, exclusiveStartKey = null) {
    const params = {
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        KeyConditionExpression: `graphId = :graphId`,
        ExpressionAttributeValues: { ':graphId': { S: graphId } }
    }
    const result = await queryItems(GRAPH_FILES_TABLE, params);
    if (result.$metadata && result.$metadata.httpStatusCode === 200) {
        const regularArray = result.Items.map(obj => {
            const newObj = {};
            for (const [key, value] of Object.entries(obj)) {
                newObj[key] = value.S || value.N || value.BOOL;
            }
            return newObj;
        });
        return regularArray;
    }
    return [];
}

module.exports = {
    saveGraphFileItems,
    listGraphFiles,
    markScaned
}
// const fileList = [
//     '.idea/misc.xml',
//     '.idea/modules.xml',
//     '.idea/uiDesigner.xml',
//     '.idea/vcs.xml',
//     'linterest.iml',
//     '.env',
//     '.gitignore',
//     'out/artifacts/Linterest_war_exploded/META-INF/MANIFEST.MF',
//     'pom.xml',
//     'src/main/java/com/linterest/Constants.java',
//     'src/main/java/com/linterest/GuiceInstance.java',
//     'src/main/java/com/linterest/GuiceListener.java',
//     'src/main/java/com/linterest/HibernateUtil.java',
//     'src/main/java/com/linterest/annotation/CacheEnabled.java',
//     'src/main/java/com/linterest/annotation/UserSession.java',
//     'src/main/java/com/linterest/dto/ImageDto.java'
//   ]

// const fileMatcher = 'com/linterest/dto/ImageDto.java';
// const filteredFiles = fileList.filter(file => minimatch(file, fileMatcher));

// console.log(filteredFiles);


