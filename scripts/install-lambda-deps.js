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

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const lambdaDir = path.join(__dirname, '..', 'lambda');

// Function to recursively find package.json files
function findPackageJsonDirs(dir) {
    const results = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            if (fs.existsSync(path.join(fullPath, 'package.json'))) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

// Find all directories containing package.json
const packageDirs = findPackageJsonDirs(lambdaDir);

console.log(packageDirs);

// Install dependencies in each directory
console.log('Installing dependencies in Lambda projects...');
for (const dir of packageDirs) {
    console.log(`\nInstalling dependencies in ${path.relative(process.cwd(), dir)}`);
    try {
        execSync('npm install', { cwd: dir, stdio: 'inherit' });
    } catch (error) {
        console.error(`Error installing dependencies in ${dir}:`, error.message);
    }
}
