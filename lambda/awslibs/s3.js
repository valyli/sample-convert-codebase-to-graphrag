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

const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');
const minimatch = require('minimatch').minimatch;

const s3Client = new S3Client();

const CODE_SOURCE_BUCKET_PREFIX = 'code_source';
const CODE_PROCRESS_BUCKET_PREFIX = 'code_process';

async function uploadFileToS3(bucketName, filePath, key) {
    console.log(`Uploading ${filePath} to ${bucketName}/${key}`);
    const fileStream = fs.createReadStream(filePath);
    const uploadParams = {
        Bucket: bucketName,
        Body: fileStream,
        Key: key,
    };

    try {
        const data = await s3Client.send(new PutObjectCommand(uploadParams));
        console.log(`File uploaded successfully. ${filePath}`);
        return true;
    } catch (err) {
        console.log('Error', err);
        return false;
    }
}

async function uploadFolderToS3(bucketName, downloadDir, bucketPrefix = '', fileMatcher) {
    const fileList = getFileListFromFolder(downloadDir);
    const relativePaths = fileList.map(file => path.relative(downloadDir, file));
    let filteredFiles = relativePaths.filter(file => minimatch(file, fileMatcher));

    // Exlcude the test codes.
    filteredFiles = filteredFiles.filter(file => !file.includes('src/test'));

    for (const file of filteredFiles) {
        const filePath = path.join(downloadDir, file);
        const key = path.join(bucketPrefix, file);
        await uploadFileToS3(bucketName, filePath, key);
    }

    return filteredFiles;
}

function getFileListFromFolder(folderPath) {
    const files = fs.readdirSync(folderPath);
    let result = [];

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            result = result.concat(getFileListFromFolder(filePath));
        } else {
            result.push(filePath);
        }
    }

    return result;
}

// Download a single file from S3
async function downloadS3File(bucketName, folderPath, filePath, localPath) {
    console.log(`Downloading ${bucketName}/${folderPath}/${filePath} and save it as ${localPath}/${filePath}`);
    const localFilePath = path.join(localPath, filePath);
    const getObjectParams = {
        Bucket: bucketName,
        Key: path.join(folderPath, filePath),
    };    
    const getObjectCommand = new GetObjectCommand(getObjectParams);
    const response = await s3Client.send(getObjectCommand);

    fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
    const fileStream = fs.createWriteStream(localFilePath);
    
    await new Promise((resolve, reject) => {
        response.Body.pipe(fileStream)
            .on('finish', resolve)
            .on('error', reject);
    });

    return localFilePath;
}

// Download the whole folder from S3.
async function downloadS3Files(bucketName, folderPath, localPath) {
    const listParams = {
        Bucket: bucketName,
        Prefix: folderPath,
    };

    const listObjectsCommand = new ListObjectsV2Command(listParams);
    const listResponse = await s3Client.send(listObjectsCommand);

    if (!listResponse.Contents) {
        console.log(`No objects found in ${bucketName}/${folderPath}`);
        return;
    }

    for (const object of listResponse.Contents) {
        const objectKey = object.Key;
        const downloadPath = path.join(localPath, objectKey.replace(folderPath, ""));

        const getObjectParams = {
            Bucket: bucketName,
            Key: objectKey,
        };

        const getObjectCommand = new GetObjectCommand(getObjectParams);
        const response = await s3Client.send(getObjectCommand);

        fs.mkdirSync(path.dirname(downloadPath), { recursive: true });
        const fileStream = fs.createWriteStream(downloadPath);
        
        await new Promise((resolve, reject) => {
            response.Body.pipe(fileStream)
                .on('finish', resolve)
                .on('error', reject);
        });
    }
}

module.exports = {
    uploadFolderToS3,
    uploadFileToS3,
    downloadS3Files,
    downloadS3File,
    CODE_SOURCE_BUCKET_PREFIX,
    CODE_PROCRESS_BUCKET_PREFIX
};