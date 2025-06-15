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

const { uploadFolderToS3, CODE_SOURCE_BUCKET_PREFIX } = require('awslibs/s3');
const { invokeSQS } = require('awslibs/sqs');
const gitDownloader = require('download-git-repo');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const { saveCodeGraphItem, updateCodeGraphStatus } = require('libs/dynamodb/codeGraphTable');
const { saveGraphFileItems, listGraphFiles, markScaned } = require('libs/dynamodb/graphFilesTable');
const {
    CODE_GRAPH_TABLE_STATUS_CODE_ANALYSING
} = require('libs/constants');

const bucketName = `${process.env.S3_BUCKET_NAME}`;
const queueUrl = process.env.CODE_DOWNLOAD_QUEUE_URL;


function getRepositoryDetails(gitUrl) {
    // Remove the protocol part (e.g., https://) and the .git extension
    const cleanedUrl = gitUrl.replace(/^https?:\/\/|\.git$/g, '');

    const urlParts = cleanedUrl.split('/');
    const repositoryOwner = urlParts[1];
    const repositoryName = urlParts[2];

    return { repositoryOwner, repositoryName };
}

async function downloadCode(uuid, gitUrl, branch) {
    console.log(`Downloading code from repository: ${gitUrl} and branch: ${branch}`);
    const { repositoryOwner, repositoryName } = getRepositoryDetails(gitUrl);
    const gitUrlWithBranch = `${repositoryOwner}/${repositoryName}#${branch}`;

    const tmpDir = '/tmp';
    const downloadDir = path.join(tmpDir, uuid);

    return new Promise((resolve, reject) => {
        gitDownloader(gitUrlWithBranch, downloadDir, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ downloadDir });
            }
        });
    })
}

async function handler(event, context) {
    try {
        const { httpMethod, queryStringParameters } = event;
        if (httpMethod === 'POST') {
            const gitUrl = queryStringParameters.gitUrl;
            const branch = queryStringParameters.branch;

            if (!gitUrl || !branch || gitUrl.length === 0 || branch.length === 0) {
                throw new Error('Missing required parameters');
            }

            const subFolder = queryStringParameters.subFolder;
            const bedrockAPIPauseTime = queryStringParameters.bedrockAPIPauseTime;

            const uuid = uuidv4();
            // Create the code graph record in DB.
            await saveCodeGraphItem(uuid, gitUrl, branch, subFolder, '', new Date().toISOString());

            // Download the code
            const { downloadDir } = await downloadCode(uuid, gitUrl, branch);
            console.log(`Upload ${downloadDir} to ${bucketName}/${CODE_SOURCE_BUCKET_PREFIX}/${uuid}`);
            const files = await uploadFolderToS3(bucketName, downloadDir, `${CODE_SOURCE_BUCKET_PREFIX}/${uuid}`, subFolder);
            
            // Update the code graph status in DB.
            await saveGraphFileItems(uuid, files);
            await updateCodeGraphStatus(uuid, CODE_GRAPH_TABLE_STATUS_CODE_ANALYSING);

            const sendMessageResult = await invokeSQS(queueUrl, {
                uuid,
                subFolder,
                bedrockAPIPauseTime
            });
            console.log('Message sent to SQS:', sendMessageResult);

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
                message: 'Code Downloader succeed.'
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