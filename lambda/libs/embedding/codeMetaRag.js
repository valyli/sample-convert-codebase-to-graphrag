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

const { Client } = require('@opensearch-project/opensearch');
const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { invokeEmbedding } = require('../bedrock/runtime');
const axios = require('axios');

const {
    PATH_META_DATA,
    CLASS_META_DATA,
    FUNC_META_DATA
} = require('../constants');

require('dotenv').config();
const host = `https://${process.env.OPENSEARCH_DNS}`;
const region = process.env.REGION;

let client = null;

async function initClient() {
    if (!client) {
        const credentials = await defaultProvider()();

        client = new Client({
            ...AwsSigv4Signer({
                region: region,
                service: 'es',
                credentials,
            }),
            node: host,
        });
    }
}


// 创建索引
async function createIndex(indexName) {
    await initClient();

    const indexBody = {
        settings: {
            index: {
                knn: true
            }
        },
        mappings: {
            properties: {
                graphId: { type: 'text' },
                name: { type: 'text' },
                path: { type: 'text' },
                description: { type: 'text' },
                description_vector: {
                    "type": "knn_vector",
                    "dimension": 1024,
                    "method": {
                        "name": "hnsw",
                        "engine": "nmslib",
                        "parameters": {
                            "ef_construction": 128,
                            "m": 24
                        }
                    }
                }
            }
        }
    };

    try {
        const { body: indexExists } = await client.indices.exists({ index: indexName });
        if (!indexExists) {
            await client.indices.create({
                index: indexName,
                body: indexBody
            });
        }
    } catch (error) {
        console.error(`An error occurred while creating/checking the index: ${error}`);
        throw error;
    }
}

// 使用upsert插入或更新数据
async function upsertDocuments(operations) {
    await initClient();

    try {
        const { body: bulkResponse } = await client.bulk({ refresh: true, body: operations });
        if (bulkResponse.errors) {
            console.error('Bulk upsert operation encountered errors:', JSON.stringify(bulkResponse));
            console.log(operations);
        }
    } catch (error) {
        console.error(`An error occurred during bulk upsert: ${error}`);
        console.error('Stack trace:', error.stack);
    }
}

// 语意查询
// 执行语义搜索
async function semanticSearch(indexName, vector, size = 5) {
    await initClient();

    try {
        const response = await client.search({
            index: indexName,
            body: {
                query: {
                    knn: {
                        description_vector: {
                            vector,
                            k: size
                        }
                    }
                },
                _source: {
                    excludes: ['description_vector']
                },
                size
            }
        });

        return response.body.hits.hits;
    } catch (error) {
        console.error(`An error occurred during semantic search: ${error}`);
        console.error(error.stack);
    }

    return [];
}

async function deleteIndex(indexName) {
    await initClient();

    try {
        const { body: indexExists } = await client.indices.exists({ index: indexName });
        if (indexExists) {
            await client.indices.delete({ index: indexName });
            console.log(`Index ${indexName} deleted successfully`);
        } else {
            console.log(`Index ${indexName} does not exist`);
        }
    } catch (error) {
        console.error(`An error occurred while deleting the index: ${error}`);
    }
}

async function deleteItemsByGraphId(indexName, graphId) {
    await initClient();

    const params = {
        index: indexName,
        body: {
            query: {
                match: {
                    graphId: graphId
                }
            }
        }
    };
    try {
        await client.deleteByQuery(params);
    } catch (error) {
        console.error(`An error occurred while deleting the index with graphId${graphId}: ${error}`);
    }
}

async function upsertPathMetaRag(graphId, name, path, description) {
    const indexName = PATH_META_DATA;
    await createIndex(indexName);
    const description_vector = await invokeEmbedding(description);

    const operations = [];
    operations.push(
        { update: { _index: indexName, _id: `${graphId}/${path}` } },
        {
            doc:
            {
                graphId,
                name,
                path,
                description,
                description_vector
            },
            doc_as_upsert: true
        }
    );
    await upsertDocuments(operations);
}


async function upsertClassMetaRag(graphId, name, path, description) {
    const indexName = CLASS_META_DATA;
    await createIndex(indexName);
    const description_vector = await invokeEmbedding(description);

    const operations = [];
    operations.push(
        { update: { _index: indexName, _id: `${graphId}/${path}/${name}` } },
        {
            doc:
            {
                graphId,
                name,
                path,
                description,
                description_vector
            },
            doc_as_upsert: true
        }
    );
    await upsertDocuments(operations);
}

/**
 * Path/ClassName is the unique id.
 */
async function upsertClassMetaRagFromDocument(graphId, documents) {
    const indexName = CLASS_META_DATA;
    await createIndex(indexName);

    const operations = [];
    for (const classObj of documents) {
        if (!classObj.Class || !classObj.Class.Properties || !classObj.Class.Path || !classObj.Class.Name) {
            continue;
        }
        const descriptionObj = classObj.Class.Properties.find(prop => 'description' in prop);
        const description = descriptionObj ? descriptionObj.description : classObj.Class.Name;
        const description_vector = await invokeEmbedding(description);

        operations.push(
            { update: { _index: indexName, _id: `${graphId}/${classObj.Class.Path}/${classObj.Class.Name}` } },
            {
                doc:
                {
                    graphId,
                    name: classObj.Class.Name,
                    path: classObj.Class.Path,
                    description,
                    description_vector
                },
                doc_as_upsert: true
            }
        );
    }

    if (operations.length > 0) {
        await upsertDocuments(operations);
    }
}

/**
 * 
 *  Path/ClassName/FunctionName is the unique id.
 */
async function upsertFunctionMetaRagFromDocument(graphId, documents) {
    const indexName = FUNC_META_DATA;
    await createIndex(indexName);

    for (let i = 0; i < documents.length; i++) {
        const classObj = documents[i];
        const fullClassName = `${classObj.Class.Path}/${classObj.Class.Name}`;

        if (!classObj.Class.Path || !classObj.Class.Name) {
            continue;
        }

        // Look through all the functions within the class.
        const operations = [];
        for (const functionObj of classObj.Functions) {
            if (!functionObj.Properties || !functionObj.Name) {
                continue;
            }

            const descriptionObj = functionObj.Properties.find(prop => 'description' in prop);
            const description = descriptionObj ? descriptionObj.description : functionObj.Name;
            const description_vector = await invokeEmbedding(description);

            operations.push(
                { update: { _index: indexName, _id: `${graphId}/${fullClassName}/${functionObj.Name}` } },
                {
                    doc:
                    {
                        graphId,
                        name: functionObj.Name,
                        path: fullClassName,
                        description,
                        description_vector
                    },
                    doc_as_upsert: true
                }
            );
        }

        if (operations.length > 0) {
            await upsertDocuments(operations);
        }
    };
}

module.exports = {
    semanticSearch,
    upsertClassMetaRagFromDocument,
    upsertFunctionMetaRagFromDocument,
    upsertPathMetaRag,
    upsertClassMetaRag,
    deleteIndex,
    deleteItemsByGraphId
};