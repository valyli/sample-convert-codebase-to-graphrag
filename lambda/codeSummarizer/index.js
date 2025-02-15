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

const { downloadS3Files, CODE_SOURCE_BUCKET_PREFIX, CODE_PROCRESS_BUCKET_PREFIX } = require('awslibs/s3');
const { processCodeMeta } = require('libs/neptune/loadCode');
const { generateClassSummary, generatePathSummary } = require('libs/embedding/summarize');
const { setBedrockAPIPauseTime, CODE_GRAPH_TABLE_STATUS_GRAPH_CREATED } = require('libs/constants');
const { updateCodeGraphStatus } = require('libs/dynamodb/codeGraphTable');

require('dotenv').config();
const bucketName = `${process.env.S3_BUCKET_NAME}`;

async function processCodeSource(uuid) {
    let localFolder = `/tmp/source/${uuid}`;
    const processFolder = `/tmp/process/${uuid}`;
    
    await downloadS3Files(bucketName, `${CODE_SOURCE_BUCKET_PREFIX}/${uuid}`, localFolder);
    await downloadS3Files(bucketName, `${CODE_PROCRESS_BUCKET_PREFIX}/${uuid}`, processFolder);
    
    // Save the file structure to Neptune
    await processCodeMeta(uuid, processFolder);
    // Summarize the Class description and upload to Neptune and Opensearch
    await generateClassSummary(uuid, processFolder);
    // Summarize the Path description and upload to Neptune and Opensearch
    await generatePathSummary(uuid);
}

async function handler(event, context) {
    console.log(`event: ${JSON.stringify(event)}, context: ${JSON.stringify(context)}`);
    try {
        const messageBody = event.Records[0].body;
        if (messageBody) {
            const { uuid, subFolder, bedrockAPIPauseTime } = JSON.parse(messageBody);

            await processCodeSource(uuid, subFolder, bedrockAPIPauseTime);
            await updateCodeGraphStatus(uuid, CODE_GRAPH_TABLE_STATUS_GRAPH_CREATED); 
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

exports.handler = handler;