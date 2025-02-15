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
        <div v-if="loading" class="loading-spinner">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
        <div v-else>
            <h1>Graph Files</h1>
            <table>
                <thead>
                    <tr>
                        <th>Full Path</th>
                        <th>File Scanned</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="file in files" :key="file.fullPath">
                        <td>{{ file.fullPath }}</td>
                        <td :style="{ backgroundColor: file.scaned ? 'green' : 'grey', color: 'white' }">{{ file.scaned }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
export default {
    name: 'GraphDetailView',
    data() {
        return {
            files: [],
            loading: false,
            apiUrl: localStorage.getItem('apiUrl') || 'http://localhost:8080',
        }
    },
    methods: {
        async fetchGraphDetail(graphId) {
            this.loading = true;
            try {
                const response = await fetch(`${this.apiUrl}/graphSearchManagement?command=graphDetail&graphId=${graphId}`);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                this.files = data.message; // Assuming the response contains a 'files' array
            } catch (error) {
                console.error('Error fetching graph details:', error);
            } finally {
                this.loading = false;
            }
        }
    },
    created() {
        const graphId = this.$route.params.id;
        this.fetchGraphDetail(graphId);
    }
}
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>