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

const { getFunctionCaller, getFunctionCallee, getRelatedClasses } = require('libs/neptune/readWithCypher');
const { semanticSearch } = require('libs/embedding/codeMetaRag');
const { invokeEmbedding } = require('libs/bedrock/runtime');

const { FUNC_META_DATA, CLASS_META_DATA } = require('libs/constants');

async function handler(event, context) {
    try {
        const { httpMethod, queryStringParameters } = event;
        let responseBody;
        if (httpMethod === 'GET') {
            const command = queryStringParameters.command;
            switch (command) {
                case 'pathSummary':
                    responseBody = 'In development...';
                    break;
                case 'queryGraph':
                    const index_name = queryStringParameters.index;
                    const queryContent = queryStringParameters.query;
                    console.log(`index_name: ${index_name}, queryContent: ${queryContent}`);

                    const vector = await invokeEmbedding(queryContent);
                    const results = await semanticSearch(index_name, queryContent, vector, 5);

                    console.log(`results: ${JSON.stringify(results, null, 2)}`);
                    if (index_name === FUNC_META_DATA) {
                        for (const result of results) {
                            result.caller = await getFunctionCaller(result._source.path, result._source.name);
                            result.callto = await getFunctionCallee(result._source.path, result._source.name);
                        }
                    } else if (index_name === CLASS_META_DATA) {
                        for (const result of results) {
                            result.relatedClasses = await getRelatedClasses(result._source.path, result._source.name);
                        }
                    }
                    responseBody = results;
                    break;
                default:
                    responseBody = 'Unsupported command';
            }
        } else {
            throw new Error('Invalid HTTP method');
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            body: JSON.stringify({
                responseBody
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