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

const { scanRepository, scanFile } = require('libs/repositoryReader');
const { uploadFolderToS3, uploadFileToS3, downloadS3Files, downloadS3File, CODE_SOURCE_BUCKET_PREFIX, CODE_PROCRESS_BUCKET_PREFIX } = require('awslibs/s3');
const { invokeSQS } = require('awslibs/sqs');
const {
    setBedrockAPIPauseTime,
    CODE_GRAPH_TABLE_STATUS_CODE_ANALYSING,
    CODE_GRAPH_TABLE_STATUS_GRAPH_CREATING
} = require('libs/constants');
const { listGraphFiles, markScaned } = require('libs/dynamodb/graphFilesTable');
const { getCodeGraph, updateCodeGraphStatus } = require('libs/dynamodb/codeGraphTable');
const { processFile } = require('libs/neptune/loadCode');

require('dotenv').config();
const bucketName = `${process.env.S3_BUCKET_NAME}`;
const codeReaderQueueUrl = process.env.CODE_READER_QUEUE_URL;
const codeDownloadQueueUrl = process.env.CODE_DOWNLOAD_QUEUE_URL;

async function processCodeRepository(uuid, subFolder, bedrockAPIPauseTime) {
    let localFolder = `/tmp/${uuid}`;
    // Download the whole repository to local.
    await downloadS3Files(bucketName, `${CODE_SOURCE_BUCKET_PREFIX}/${uuid}`, localFolder);

    if (subFolder && subFolder.length > 0) {
        localFolder += `/${subFolder}`;
    }
    if (bedrockAPIPauseTime) {
        setBedrockAPIPauseTime(bedrockAPIPauseTime);
    }

    // Use LLM to parse the file structure
    const resFolder = await scanRepository(localFolder);

    await uploadFolderToS3(bucketName, resFolder, `${CODE_PROCRESS_BUCKET_PREFIX}/${uuid}`)
}

async function processCodeBatch(uuid, allFiles, batchSize) {
    const localFolder = `/tmp/${uuid}`;
    const filesToScan = allFiles.filter(file => !file.scaned).slice(0, batchSize);

    let processedCount = 0;
    for (const file of filesToScan) {
        const filePath = file.fullPath;
        console.log(`Processing ${filePath}`);

        // Download the file from S3
        let localFilePath = await downloadS3File(bucketName, `${CODE_SOURCE_BUCKET_PREFIX}/${uuid}`, filePath, localFolder);

        // Analyse the file
        const scanResult = await scanFile(localFolder, allFiles, localFilePath);
        
        if (scanResult) {
            const { fileName, fullPath, fileContent } = scanResult;
            
            // Upload the scanned file to S3
            const result = await uploadFileToS3(bucketName, fullPath, `${CODE_PROCRESS_BUCKET_PREFIX}/${uuid}/${fileName}`);

            // Save the object info to Neptune & rag
            await processFile(uuid, JSON.parse(fileContent));

            // Update the dynamodb
            if (result) {
                await markScaned(uuid, filePath);
                processedCount++;
            }
        } else {
            // File was skipped, mark as scanned anyway
            console.log(`File ${filePath} was skipped during scanning, marking as processed`);
            await markScaned(uuid, filePath);
            processedCount++;
        }
    }

    return processedCount;
}

async function handler(event, context) {
    console.log(`event: ${JSON.stringify(event)}, context: ${JSON.stringify(context)}`);
    try {
        const messageBody = event.Records[0].body;
        if (messageBody) {
            const { uuid, subFolder, bedrockAPIPauseTime } = JSON.parse(messageBody);

            const codeGraph = await getCodeGraph(uuid);

            // Graph status safe checks.
            if (!codeGraph) {
                throw new Error('Code graph not found');
            }
            if (codeGraph.status !== CODE_GRAPH_TABLE_STATUS_CODE_ANALYSING) {
                console.log(`Code graph status is ${codeGraph.status} state, skip...`);
                return;
            }

            // Process the code graph with batch.
            let allFiles = await listGraphFiles(uuid);
            const BATCH_SIZE = 15;
            const processedCount = await processCodeBatch(uuid, allFiles, BATCH_SIZE);

            if (processedCount > 0) {
                // Load from db again and check if the code graph files are all scanned.
                allFiles = await listGraphFiles(uuid);
                const allFilesScanned = allFiles.every(file => file.scaned);
                if (allFilesScanned) {
                    await updateCodeGraphStatus(uuid, CODE_GRAPH_TABLE_STATUS_GRAPH_CREATING);
                    const sendMessageResult = await invokeSQS(codeReaderQueueUrl, {
                        uuid,
                        subFolder,
                        bedrockAPIPauseTime
                    });
                    console.log(`Message sent to ${codeReaderQueueUrl}: ${JSON.stringify(sendMessageResult)}`);
                } else {
                    const sendMessageResult = await invokeSQS(codeDownloadQueueUrl, {
                        uuid,
                        subFolder,
                        bedrockAPIPauseTime
                    });
                    console.log(`Message sent to ${codeDownloadQueueUrl}: ${JSON.stringify(sendMessageResult)}`);
                }
            } else {
                console.log('No files processed successfully, check the logic, skip the loop...');
            }

        }
    } catch (error) {
        console.error('Error:', error);
    }
}

exports.handler = handler;