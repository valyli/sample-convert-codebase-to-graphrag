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

const gremlin = require('gremlin');
const {
    process: {
        merge,
        direction,
        cardinality,
        t: {
            id,
            label
        }
    }
} = require('gremlin');
const {
    TYPE_PATH,
    TYPE_CLASS,
    TYPE_FUNCTION,
    TYPE_ENUM,
    EDGE_CONTAINS,
    EDGE_CALL,
    EDGE_EXTENDS
} = require('../constants')
const { findFiles } = require('../utils/utils');
const fs = require('fs');
const { upsertFunctionMetaRagFromDocument, upsertClassMetaRagFromDocument } = require('../embedding/codeMetaRag');
const __ = gremlin.process.statics;
const traversal = gremlin.process.AnonymousTraversalSource.traversal;
const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;

require('dotenv').config();
const dbURL = `wss://${process.env.PRIVATE_NEPTUNE_DNS}:${process.env.PRIVATE_NEPTUNE_PORT}/gremlin`;
const g = traversal().withRemote(new DriverRemoteConnection(dbURL));


/**
 * Store the {fullPath, pathObj} pair
 */
const mPathObjMap = new Map();

/**
 * Store the {path/class_name, classObj} pair
 */
const mClassObjMap = new Map();
/**
 * Store the {fullClassName/function_name, functionObj} pair
 */
const mFunctionObjMap = new Map();

/**
 * Store the {fullClassName/enum_name, enumObj} pair
 */
const mEnumObjMap = new Map();


async function processCodeMeta(graphId, pathRoot) {
    console.log(`Graph id: ${graphId}, Root path at: ${pathRoot}`);
    const files = await findFiles(pathRoot);
    for (const file of files) {
        console.log(`Loading file: ${file}`);
        const fileContent = fs.readFileSync(file, 'utf8');
        try {
            await processFile(graphId, JSON.parse(fileContent));
        } catch (error) {
            console.error(`An error occurred during bulk upsert: ${error}`);
        }
    }
}


async function processFile(graphId, classObjList) {
    // If type of classObjList is Array
    if (!Array.isArray(classObjList)) {
        classObjList = new Array(classObjList);
    }
    await upsertClassGraph(graphId, classObjList);

    // Save the class & function rag.
    await upsertClassMetaRagFromDocument(graphId, classObjList);
    await upsertFunctionMetaRagFromDocument(graphId, classObjList);
}

async function upsertClassGraph(graphId, classObjList) {
    for (const classObj of classObjList) {
        if (!classObj.Class || !classObj.Class.Name || !classObj.Class.Path) {
            continue;
        }
        const fullClassName = `${classObj.Class.Path}/${classObj.Class.Name}`;
        console.log(`Processing on Class: ${fullClassName}`);

        // Upsert the Path Obj.
        await upsertPath(graphId, classObj.Class.Path);

        // Upsert the class Obj.
        const classPropertyMap = classObj.Class.Properties ? new Map(classObj.Class.Properties.flatMap(obj => Object.entries(obj))) : new Map();
        await upsertClass(graphId, classObj.Class.Name, classObj.Class.Path, classObj.Class.FileExtension, classPropertyMap);
        await upsertEdge(EDGE_CONTAINS, mPathObjMap.get(classObj.Class.Path), mClassObjMap.get(fullClassName));
        if (classPropertyMap.get("extends") != null) {
            const parentClass = classPropertyMap.get("extends");
            await upsertEdge(EDGE_EXTENDS, mClassObjMap.get(fullClassName), mClassObjMap.get(parentClass));
        }

        // Upsert the function Obj and upsert the edge with the class.
        if (classObj.Functions) {
            for (const functionObj of classObj.Functions) {
                console.log(`Processing on functions: ${functionObj.Name}`);
                const functionPropertyMap = functionObj.Properties ? new Map(functionObj.Properties.flatMap(obj => Object.entries(obj))) : new Map();
                await upsertFunction(graphId, functionObj.Name, fullClassName, functionPropertyMap);
                await upsertEdge(EDGE_CONTAINS, mClassObjMap.get(fullClassName), mFunctionObjMap.get(`${fullClassName}/${functionObj.Name}`));
            }
        }

        // Upsert the enum Obj and upsert the edge with class.
        if (classObj.Enums) {
            for (const enumObj of classObj.Enums) {
                console.log(`Processing on enums: ${enumObj.Name}`);
                const enumPropertyMap = enumObj.Properties ? new Map(enumObj.Properties.flatMap(obj => Object.entries(obj))) : new Map();
                await upsertEnum(graphId, enumObj.Name, fullClassName, enumPropertyMap);
                await upsertEdge(EDGE_CONTAINS, mClassObjMap.get(fullClassName), mEnumObjMap.get(`${fullClassName}/${enumObj.Name}`));
            }
        }

        // Upsert the inner dependencies.
        if (classObj.InnerDependencies) {
            for (const call of classObj.InnerDependencies) {
                console.log(`Processing on inner dependency from ${fullClassName}/${call.From} to ${call.ToType} ${fullClassName}/${call.ToName}`);
                let toObj;
                if (call.ToType == TYPE_FUNCTION) {
                    toObj = mFunctionObjMap.get(`${fullClassName}/${call.ToName}`);
                } else if (call.ToType == TYPE_ENUM) {
                    toObj = mEnumObjMap.get(`${fullClassName}/${call.ToName}`);
                }
                if (toObj) {
                    await upsertEdge(EDGE_CALL, mFunctionObjMap.get(`${fullClassName}/${call.From}`), toObj);
                }
            }
        }

        // Upsert the outer dependencies.
        if (classObj.OuterDependencies) {
            for (const call of classObj.OuterDependencies) {
                if (!fullClassName || !call || !call.From || !call.To || !call.To.Path || !call.To.ClassName || !call.To.Type || !call.To.Name) {
                    continue;
                }
                console.log(`Processing on outer dependency from ${fullClassName}/${call.From} to ${call.To.Type} ${call.To.Path}/${call.To.ClassName}/${call.To.Name}`);
                await upsertPath(graphId, call.To.Path);
                await upsertClass(graphId, call.To.ClassName, call.To.Path, classObj.Class.FileExtension, new Map());
                await upsertEdge(EDGE_CONTAINS, mPathObjMap.get(call.To.Path), mClassObjMap.get(`${call.To.Path}/${call.To.ClassName}`));

                if (call.To.Type == TYPE_FUNCTION) {
                    await upsertFunction(graphId, call.To.Name, `${call.To.Path}/${call.To.ClassName}`, new Map());
                    await upsertEdge(EDGE_CONTAINS, mClassObjMap.get(`${call.To.Path}/${call.To.ClassName}`), mFunctionObjMap.get(`${call.To.Path}/${call.To.ClassName}/${call.To.Name}`));
                    await upsertEdge(EDGE_CALL, mFunctionObjMap.get(`${fullClassName}/${call.From}`), mFunctionObjMap.get(`${call.To.Path}/${call.To.ClassName}/${call.To.Name}`));
                } else if (call.To.Type == TYPE_ENUM) {
                    await upsertEnum(graphId, call.To.Name, `${call.To.Path}/${call.To.ClassName}`, new Map());
                    await upsertEdge(EDGE_CONTAINS, mClassObjMap.get(`${call.To.Path}/${call.To.ClassName}`), mEnumObjMap.get(`${call.To.Path}/${call.To.ClassName}/${call.To.Name}`));
                    await upsertEdge(EDGE_CALL, mFunctionObjMap.get(`${fullClassName}/${call.From}`), mEnumObjMap.get(`${call.To.Path}/${call.To.ClassName}/${call.To.Name}`));
                }
            }
        }
    }
}


async function upsertPath(graphId, fullPath) {
    const paths = fullPath.split('/');

    let parentPath = '';
    let currentPath = '';
    for (let i = 0; i < paths.length; i++) {
        const name = paths[i];
        currentPath += `${name}`;
        if (!name || name.length == 0) {
            continue;
        }
        let result = g.V().hasLabel(TYPE_PATH).has('graphId', graphId).has('full_path', currentPath).fold().coalesce(
            __.unfold(),
            __.addV(TYPE_PATH).
                property(cardinality.single, 'graphId', graphId).
                property(cardinality.single, 'name', name).
                property(cardinality.single, 'full_path', currentPath)
        )
        result = await result.next();
        mPathObjMap.set(currentPath, result.value);

        if (parentPath.length > 0) {
            upsertEdge(EDGE_CONTAINS, mPathObjMap.get(parentPath), mPathObjMap.get(currentPath));
        }
        parentPath = currentPath;
        currentPath += '/';
    }
}

async function upsertPathDescription(graphId, name, fullPath, description) {
    console.log(`Upserting path description: ${name}, ${fullPath}`);
    await g.V().hasLabel(TYPE_PATH).has('graphId', graphId).has('full_path', fullPath).fold().coalesce(
        __.unfold().
            property(cardinality.single, 'description', description),
        __.addV(TYPE_PATH).
            property(cardinality.single, 'graphId', graphId).
            property(cardinality.single, 'name', name).
            property(cardinality.single, 'full_path', fullPath).
            property(cardinality.single, 'description', description)
    ).next();
}

async function upsertClass(graphId, name, path, fileExtension, params = new Map()) {
    let result = g.V().hasLabel(TYPE_CLASS).has('graphId', graphId).has('name', name).has('path', path).fold().coalesce(
        __.unfold(),
        __.addV(TYPE_CLASS).
            property(cardinality.single, 'graphId', graphId).
            property(cardinality.single, 'name', name).
            property(cardinality.single, 'path', path).
            property(cardinality.single, 'file_extension', fileExtension)
    )
    for (const [key, value] of params) {
        const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
        result = result.property(cardinality.single, key, stringValue);
    }
    result = await result.next();
    mClassObjMap.set(`${path}/${name}`, result.value);
}

async function upsertFunction(graphId, name, fullClassName, params = new Map()) {
    let result = g.V().hasLabel(TYPE_FUNCTION).has('graphId', graphId).has('name', name).has('full_classname', fullClassName).fold().coalesce(
        __.unfold(),
        __.addV(TYPE_FUNCTION).
            property(cardinality.single, 'graphId', graphId).
            property(cardinality.single, 'name', name).
            property(cardinality.single, 'full_classname', fullClassName)
    )
    for (const [key, value] of params) {
        const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
        result = result.property(cardinality.single, key, stringValue);
    }
    result = await result.next();
    mFunctionObjMap.set(`${fullClassName}/${name}`, result.value);
}

async function upsertEnum(graphId, name, fullClassName, params = new Map()) {
    let result = g.V().hasLabel(TYPE_ENUM).has('graphId', graphId).has('name', name).has('full_classname', fullClassName).fold().coalesce(
        __.unfold(),
        __.addV(TYPE_ENUM).
            property(cardinality.single, 'graphId', graphId).
            property(cardinality.single, 'name', name).
            property(cardinality.single, 'full_classname', fullClassName)
    )
    for (const [key, value] of params) {
        const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
        result = result.property(cardinality.single, key, stringValue);
    }
    result = await result.next();
    mEnumObjMap.set(`${fullClassName}/${name}`, result.value);
}

async function upsertEdge(type, fromObj, toObj) {
    if (!fromObj || !toObj) return;
    const result = await g.V().hasId(fromObj.id).coalesce(
        __.outE(type).where(__.inV().hasId(toObj.id)),
        __.addE(type).to(__.V().hasId(toObj.id))
    ).next();
}

async function dropByGraphId(graphId) {  
    await g.V().has('graphId', graphId).bothE().drop().iterate();
    await g.V().has('graphId', graphId).drop().iterate();
}

module.exports = { processCodeMeta, upsertPathDescription, dropByGraphId, processFile }