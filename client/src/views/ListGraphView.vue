<template>
  <!-- 
   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
   SPDX-License-Identifier: MIT-0
 
   Permission is hereby granted, free of charge, to any person obtaining a copy of this
   software and associated documentation files (the "Software"), to deal in the Software
   without restriction, including without limitation the rights to use, copy, modify,
   merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
   permit persons to whom the Software is furnished to do so.
  
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
   INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
   PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
   HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
   OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. -->
   
  <div>
    <div v-if="showDialog" class="dialog-overlay">
      <div class="dialog">
        <div class="dialog-header">
          <h2>API Response</h2>
          <button @click="closeDialog" class="close-button">&times;</button>
        </div>
        <div class="dialog-content">
          <pre>{{ apiResponse }}</pre>
        </div>
      </div>
    </div>
    <div v-if="loading" class="loading-spinner">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
    <div v-else>
      <h2>Graphs</h2>
      <table>
        <thead>
          <tr>
            <th>Github URL</th>
            <th>Branch</th>
            <th>File Filter</th>
            <th>Update Time</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="graph in graphs" :key="graph.id">
            <td class="fixed-width">{{ graph.gitUrl }}</td>
            <td>{{ graph.branch }}</td>
            <td>{{ graph.subFolder }}</td>
            <td>{{ graph.updateTime }}</td>
            <td :style="{ backgroundColor: getStatusColor(graph.status) }">{{ graph.status }}</td>
            <td>
              <button v-if="graph.status !== 'GRAPH_CREATED'" class="button" @click="viewFileList(graph.id)"> File List </button>
              <button v-else class="button" @click="viewGraph(graph.id)"> View Graph </button>
              <button class="button" @click="deleteGraph(graph.id)"> Delete </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
export default {
  data() {
    return {
      loading: false,
      graphs: [],
      apiUrl: localStorage.getItem('apiUrl') || 'http://localhost:8080',
      showDialog: false,
      apiResponse: '',
    };
  },
  mounted() {
    this.fetchGraphs();
  },
  methods: {
    async fetchGraphs() {
      this.loading = true;
      try {
        const response = await fetch(`${this.apiUrl}/graphSearchManagement?command=listGraphs`);
        const data = await response.json();
        this.graphs = data.message; // Adjust this based on the actual structure of the response
      } catch (error) {
        console.error('Error fetching graphs:', error);
      } finally {
        this.loading = false;
      }
    },
    viewFileList(id) {
      this.$router.push(`/graphFiles/${id}`);
    },
    viewGraph(id) {
      this.$router.push(`/graphDetail/${id}`);
    },
    async deleteGraph(id) {
      this.loading = true;

      axios.post(`${this.apiUrl}/graphSearchManagement?command=clearGraph&graphId=${id}`).then(response => {
        this.apiResponse = 'Graph deleted response: ' + response.data.message;
        this.showDialog = true;
        this.loading = false;
      }).catch(error => {
        console.error('Error fetching API response:', error);
        this.apiResponse = error;
        this.showDialog = true;
        this.loading = false;
      });
    },
    closeDialog() {
      this.showDialog = false;
      this.fetchGraphs();
    }
  },
  computed: {
    getStatusColor() {
      return function (status) {
        switch (status) {
          case 'CODE_ANALYSING':
            return 'lightgreen';
          case 'GRAPH_CREATING':
            return 'lightblue';
          case 'GRAPH_CREATED':
            return 'yellow';
          default:
            return 'lightgrey';
        }
      }
    }
  }
};
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #ddd;
  padding: 8px;
}

th {
  background-color: #f2f2f2;
}

.fixed-width {
  width: 300px;
  /* Set your desired width */
  word-wrap: break-word;
  /* Enable wrapping */
  overflow-wrap: break-word;
  /* For better compatibility */
}

.loading-spinner {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-spinner .spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
}

.dialog {
  background-color: #fff;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.close-button {
  background-color: #fff;
  border: none;
  padding: 10px;
  font-size: 18px;
  cursor: pointer;
}

.close-button:hover {
  background-color: #f2f2f2;
}

.dialog-content {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 10px;
  background-color: #f9f9f9;
}

.dialog-content pre {
  white-space: pre-wrap;
}

.button {
  width: 120px; /* Set a fixed width */
  padding: 10px; /* Add padding for better appearance */
  margin: 5px; /* Add some margin between buttons */
  border: none; /* Remove default border */
  border-radius: 5px; /* Rounded corners */
  background-color: white; /* Button color */
  color: black; /* Text color */
  cursor: pointer; /* Pointer cursor on hover */
}

.button:hover {
  background-color: #0056b3; /* Darker shade on hover */
}
</style>