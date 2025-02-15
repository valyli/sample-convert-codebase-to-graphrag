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

const fs = require('fs');
const path = require('path');
const { findFiles } = require('../utils/utils');
const { invokeCommand } = require('../bedrock/runtime');
const { upsertPathDescription } = require('../neptune/loadCode');
const { upsertPathMetaRag, upsertClassMetaRag } = require('./codeMetaRag');
const { classDescriptionSummaryPrompt, pathDescriptionSummaryPrompt } = require('../bedrock/prompt');

const SUMMARY_FILE = '/tmp/summary.json';
const TO_BE_FILLED = '<To_be_filled/>';

async function generateClassSummary(graphId, pathRoot) {
    console.log(`Summary the meta data from the path at: ${pathRoot}`);
    const data = { 'Packages': {} };

    const files = await findFiles(pathRoot);
    for (const file of files) {
        console.log(`Loading file: ${file}`);
        const fileContent = fs.readFileSync(file, 'utf8');
        try {
            const fileJson = JSON.parse(fileContent);
            const path = fileJson.Class.Path;
            const className = fileJson.Class.Name;
            const descriptionObj = fileJson.Class.Properties ? fileJson.Class.Properties.find(prop => 'description' in prop) : null;
            const description = descriptionObj ? descriptionObj.description : '';

            // Generate the data tree with the path.
            generateDataTree(path, data);

            // Generate the Class data obj
            const classObj = dataFactory.generateClassObj(description);
            if (fileJson.Functions) {
                fileJson.Functions.map((func) => {
                    const funcName = func.Name;
                    const descriptionObj = func.Properties.find(prop => 'description' in prop);
                    const description = descriptionObj ? descriptionObj.description : '';
                    classObj.Functions[funcName] = description;
                });
            }

            // Refine the class description according to the functions.
            const classDescription = await invokeCommand(classDescriptionSummaryPrompt, [
                {
                    role: "user",
                    content: JSON.stringify(classObj, null, 2)
                }
            ]);
            classObj.description = classDescription;

            // Update the Open search db.
            await upsertClassMetaRag(graphId, className, path, classDescription);

            // Add the Class data obj to the data tree
            putClassObj(data, path, className, classObj);
        } catch (error) {
            console.error(`Error parsing file ${file}: ${error}`);
            console.error('Stack trace:', error.stack);
        }
    }

    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(data, null, 2));
}

async function generatePathSummary(graphId) {
    try {
        const data = JSON.parse(fs.readFileSync(SUMMARY_FILE));

        // There should be only 1 root in the data tree.
        const root = Object.keys(data.Packages)[0];
        await pathDescriptionSummary(graphId, data.Packages[root], root, root);

        fs.writeFileSync(SUMMARY_FILE, JSON.stringify(data, null, 2));

    } catch (error) {
        console.error(`Error parsing file ${SUMMARY_FILE}: ${error}`);
        console.error('Stack trace:', error.stack);
    }

}

// Recursion to generate data tree
function generateDataTree(path, parent) {
    const pathParts = path.split('/');
    const firstPart = pathParts[0];
    const restPart = pathParts.slice(1).join('/');

    if (!parent.Packages[firstPart]) {
        const result = dataFactory.generatePackageObj(TO_BE_FILLED);
        parent.Packages[firstPart] = result;
    }

    const secondPart = pathParts[1];
    if (secondPart) {
        generateDataTree(restPart, parent.Packages[firstPart]);
    }

    return;
}

// Loop and find the target class path and insert the classObj
function putClassObj(dataTree, path, className, classObj) {
    const pathParts = path.split('/');

    let classPackage = dataTree;
    for (const part of pathParts) {
        classPackage = classPackage.Packages[part];
    }
    classPackage.Classes[className] = classObj;
}

// Recur function to refine a path tree.
async function pathDescriptionSummary(graphId, data, fullPath, name) {
    console.log('Recurring call to path: ' + fullPath);
    if (data.description && data.description !== TO_BE_FILLED) {
        return data.description;
    }

    // Path summary does not exist, use LLM to refine its sub packages and classes.
    const subPackages = data.Packages;
    const classes = data.Classes;
    let llmParams = `This is a folder named ${fullPath}, below are the sub pathes and classes's description:\n`;

    for (const [key, subPackage] of Object.entries(subPackages)) {
        
        const pathDescription = await pathDescriptionSummary(graphId, subPackage, `${fullPath}/${key}`, key);
        llmParams += `Sub path ${fullPath}/${key}: ${pathDescription}\n`;
    }
    for (const [key, classObj] of Object.entries(classes)) {
        llmParams += `Sub class ${fullPath}/${key}: ${classObj.description}\n`;
    };

    llmParams += `Please summarize the folder's functionality. And please keep it as simple as possible.\n`

    // Refine the path description according to its contents.
    const pathDescription = await invokeCommand(pathDescriptionSummaryPrompt, [
        {
            role: "user",
            content: llmParams
        }
    ]);

    data.description = pathDescription;
    await upsertPathDescription(graphId, name, fullPath, pathDescription);
    await upsertPathMetaRag(graphId, name, fullPath, pathDescription);
    return pathDescription;
}

class DataFactory {
    generateClassObj(description) {
        const result = {};
        result.description = description;
        result.Functions = {};

        return result;
    }

    generatePackageObj(description) {
        const result = {};
        result.description = description;
        result.Packages = {};
        result.Classes = {};

        return result;
    }
}

const dataFactory = new DataFactory();

module.exports = { generateClassSummary, generatePathSummary };