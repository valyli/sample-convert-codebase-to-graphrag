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

const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const { sleep } = require("../utils/utils");
const { BEDROCK_API_PAUSE_TIME } = require("../constants");
const { ThrottlingException } = require("@aws-sdk/client-bedrock-runtime");

require('dotenv').config();
const client = new BedrockRuntimeClient({
    endpoint: `https://${process.env.PRIVATE_BEDROCK_DNS}`
});
const { ACCOUNT_ID, REGION } = process.env;
const bedrockClaude37ModelId = `arn:aws:bedrock:${REGION}:${ACCOUNT_ID}:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0`;

async function invokeCommand(systemPrompt, messages) {
    const params = {
        modelId: bedrockClaude37ModelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 40000,
            system: systemPrompt,
            messages
        }),
    };

    try {
        const command = new InvokeModelCommand(params);
        const response = await client.send(command);

        // 解析响应
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        return responseBody.content[0].text;
    } catch (error) {
        if (error instanceof ThrottlingException) {
            await sleep(BEDROCK_API_PAUSE_TIME);
            console.log(`Bedrock ThrottlingException, Sleep for ${BEDROCK_API_PAUSE_TIME} milli-seconds and retry...`);
            return await invokeCommand(systemPrompt, messages);
        } else {
            console.error("Error invoking Bedrock:", error);
            throw error;
        }
    }
}

async function invokeEmbedding(message) {
    try {
        const command = new InvokeModelCommand({
            modelId: "cohere.embed-multilingual-v3",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                texts: [message],
                input_type: "search_document"
            })
        });
        const response = await client.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        return responseBody.embeddings[0];
    } catch (error) {
        if (error instanceof ThrottlingException) {
            await sleep(BEDROCK_API_PAUSE_TIME);
            console.log(`Sleep for ${BEDROCK_API_PAUSE_TIME} milli-seconds and retry...`);
            return await invokeEmbedding(message);
        } else {
            throw error;
        }
    }
}

module.exports = { invokeCommand, invokeEmbedding }