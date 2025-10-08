const gremlin = require('gremlin');

const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
const Graph = gremlin.structure.Graph;

// Neptune连接配置
const neptuneEndpoint = 'wss://code-graph-neptune-cluster.cluster-cwf02g4c6rbh.us-east-1.neptune.amazonaws.com:8182/gremlin';

async function queryNeptune() {
    const dc = new DriverRemoteConnection(neptuneEndpoint);
    const graph = new Graph();
    const g = graph.traversal().withRemote(dc);
    
    try {
        console.log('连接到Neptune...');
        
        // 查询所有顶点
        console.log('\n=== 所有顶点 ===');
        const vertices = await g.V().limit(10).valueMap().toList();
        console.log('顶点数量:', vertices.length);
        vertices.forEach((v, i) => {
            console.log(`顶点 ${i+1}:`, JSON.stringify(v, null, 2));
        });
        
        // 查询所有边
        console.log('\n=== 所有边 ===');
        const edges = await g.E().limit(10).valueMap().toList();
        console.log('边数量:', edges.length);
        edges.forEach((e, i) => {
            console.log(`边 ${i+1}:`, JSON.stringify(e, null, 2));
        });
        
        // 查询图的基本统计
        console.log('\n=== 图统计 ===');
        const vertexCount = await g.V().count().next();
        const edgeCount = await g.E().count().next();
        console.log('总顶点数:', vertexCount.value);
        console.log('总边数:', edgeCount.value);
        
    } catch (error) {
        console.error('查询错误:', error);
    } finally {
        await dc.close();
    }
}

queryNeptune();
