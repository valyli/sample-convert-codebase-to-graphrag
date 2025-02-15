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

const { invokeCommand } = require('./bedrock/runtime');
const { systemPrompt } = require('./bedrock/prompt');
const fs = require('fs');
const path = require('path');
const { findFiles } = require('./utils/utils');

const resFolder = '/tmp/res';

async function generateClassMeta(repoFileStructure, fileName, classContent) {
    const messages = [
        {
            role: "user",
            content: `Given the the file structure of the repository: \n ${repoFileStructure}.
            \nPlease analyse the file: ${fileName} and its content: 
            \n<code>\n${classContent}.\n</code>
            \nGenerate the JSON reponse according to the instructions.`
        }
    ]
    return await invokeCommand(systemPrompt, messages);
}

async function scanRepository(repositoryRoot) {
    const files = await findFiles(repositoryRoot);
    console.log(files);
    const filesWithRelativePath = files.map(file => path.relative(repositoryRoot, file));

    for (const file of files) {
        try {
            const fileName = path.basename(file);
            if (fileName.includes('ignore') || fileName === 'package.json') {
                console.log(`Skip ${file}.`);
                continue;
            }

            const fileNameToSave = path.relative(repositoryRoot, file).replace(/[/.]/g, '-') + '.json';
            console.log(`Processing ${file} and save it as ${fileNameToSave}`);
            const classContent = fs.readFileSync(file, 'utf8');
            const classMeta = await generateClassMeta(filesWithRelativePath.join('\n'), path.relative(repositoryRoot, file), classContent);

            const filePath = path.join(resFolder, fileNameToSave);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, classMeta);
        } catch (err) {
            console.error(`Error processing file ${file}: ${err}`);
            console.error(err.stack);
        }
    }

    return resFolder;
}

async function scanFile(localRepositoryRoot, fileStructure, file) {
    const fileName = path.basename(file);
    if (fileName.includes('ignore') || fileName === 'package.json') {
        console.log(`Skip ${file}.`);
        return null;
    }

    const fileNameToSave = path.relative(localRepositoryRoot, file).replace(/[/.]/g, '-') + '.json';
    console.log(`Processing ${file} and save it as ${fileNameToSave}`);

    try {
        const classContent = fs.readFileSync(file, 'utf8');
        const classMeta = await generateClassMeta(fileStructure.join('\n'), path.relative(localRepositoryRoot, file), classContent);

        const filePath = path.join(resFolder, fileNameToSave);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, classMeta);

        return { fileName: fileNameToSave, fullPath: filePath };
    } catch (err) {
        console.error(`Error processing file ${file}: ${err}`);
        console.error(err.stack);
        return null;
    }
}

module.exports = { scanRepository, scanFile }