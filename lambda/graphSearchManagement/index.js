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

const { dropByGraphId } = require('libs/neptune/loadCode');
const { deleteIndex, deleteItemsByGraphId } = require('libs/embedding/codeMetaRag');
const {
    PATH_META_DATA,
    CLASS_META_DATA,
    FUNC_META_DATA,
} = require('libs/constants');
const { saveCodeGraphItem, listCodeGraphs, markDelete } = require('libs/dynamodb/codeGraphTable');
const { saveGraphFileItems, listGraphFiles, markScaned } = require('libs/dynamodb/graphFilesTable');
const uuidv4 = require('uuid').v4;


async function handler(event, context) {
    try {
        const { httpMethod, queryStringParameters } = event;
        let result;
        if (httpMethod === 'GET'){
            const command = queryStringParameters.command;
            if (!command || command.length === 0) {
                throw new Error('Missing commmand parameter.');
            }

            if (command === 'listGraphs') {
                result = await listCodeGraphs();
                
            } else if (command === 'graphDetail') {
                const graphId = queryStringParameters.graphId;
                if (!graphId || graphId.length === 0) {
                    throw new Error('Missing required parameters');
                }
                result = await listGraphFiles(graphId);
            } else {
                throw new Error('Invalid HTTP method');
            }
        }
        else if (httpMethod === 'POST') {
            const command = queryStringParameters.command;
            const graphId = queryStringParameters.graphId;

            if (!command || command.length === 0 || !graphId || graphId.length === 0) {
                throw new Error('Missing commmand parameter.');
            }

            if (command === 'clearGraph') {
                await dropByGraphId(graphId);
                await deleteItemsByGraphId(PATH_META_DATA, graphId);
                await deleteItemsByGraphId(CLASS_META_DATA, graphId);
                await deleteItemsByGraphId(FUNC_META_DATA, graphId);
                await markDelete(graphId);

            } else if (command === 'createGraph') {
                const gitUrl = queryStringParameters.gitUrl;
                const branch = queryStringParameters.branch;
                const subFolder = queryStringParameters.subFolder;
                const fileFilter = queryStringParameters.fileFilter;
                const currentTime = new Date().toISOString();

                if (!gitUrl || !branch || gitUrl.length === 0 || branch.length === 0) {
                    throw new Error('Missing required parameters');
                }
                const graphId = uuidv4();
                await saveCodeGraphItem(
                    graphId,
                    gitUrl,
                    branch,
                    subFolder,
                    fileFilter,
                    currentTime
                );

                const fileList = [
                    'README.md',
                    'path1/path2/main.java',
                    'path1/path3/main.js',
                    'path1/path4/main.txt',
                ]
                await saveGraphFileItems(graphId, fileList);

            } else if (command === 'fileScanned') {
                const graphId = queryStringParameters.graphId;
                const fullPath = queryStringParameters.fullPath;
                if (!graphId || graphId.length === 0 || !fullPath || fullPath.length === 0) {
                    throw new Error('Missing required parameters');
                }
                await markScaned(graphId, fullPath);
            } else {
                throw new Error('Invalid HTTP method');
            }

        } else {
            throw new Error('Invalid HTTP method');
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            body: JSON.stringify({
                message: result || 'Operation succeed.'
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Internal server error',
                error: error.message
            })
        };
    }
}

exports.handler = handler;