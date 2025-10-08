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
   
  <div class="graph-detail-view">
    <div class="header">
      <h1>Code Graph Detail</h1>
      <p class="graph-id">Graph ID: {{ graphId }}</p>
    </div>

    <div v-if="loading" class="loading-spinner">
      <div class="spinner"></div>
      <p>Loading graph data...</p>
    </div>

    <div v-else class="content">
      <!-- Search Section -->
      <div class="search-section">
        <h2>Search Code Graph</h2>
        <div class="search-form">
          <div class="form-group">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Search for classes, functions, or packages..." 
              class="search-input"
              @keyup.enter="handleSearch"
            >
          </div>
          <div class="form-group">
            <select v-model="selectedCategory" class="category-select">
              <option value="path_metadata">Package</option>
              <option value="class_metadata">Class</option>
              <option value="function_metadata">Function</option>
            </select>
          </div>
          <button @click="handleSearch" class="search-btn" :disabled="!searchQuery.trim()">Search</button>
        </div>
      </div>

      <!-- Search Results -->
      <div v-if="searchResults" class="search-results">
        <h3>Search Results</h3>
        <div v-if="searchResults.length === 0" class="no-results">
          No results found for "{{ searchQuery }}"
        </div>
        <div v-else class="results-list">
          <div v-for="(result, index) in searchResults" :key="index" class="result-item">
            <div class="result-header">
              <h4>{{ result._source.name }}</h4>
              <span class="result-score">Score: {{ result._score.toFixed(2) }}</span>
            </div>
            <div class="result-details">
              <p><strong>Path:</strong> {{ result._source.path }}</p>
              <p v-if="result._source.summary"><strong>Summary:</strong> {{ result._source.summary }}</p>
              <p v-if="result._source.file_extension"><strong>Type:</strong> {{ result._source.file_extension }}</p>
            </div>
            
            <!-- Function-specific details -->
            <div v-if="selectedCategory === 'function_metadata' && (result.caller || result.callto)" class="function-relations">
              <div v-if="result.caller && result.caller.length > 0" class="callers">
                <h5>Called by:</h5>
                <ul>
                  <li v-for="caller in result.caller" :key="caller['callee.full_classname'] + caller['callee.name']">
                    {{ caller['callee.full_classname'] }}.{{ caller['callee.name'] }}
                  </li>
                </ul>
              </div>
              <div v-if="result.callto && result.callto.length > 0" class="callees">
                <h5>Calls:</h5>
                <ul>
                  <li v-for="callee in result.callto" :key="callee['callee.full_classname'] + callee['callee.name']">
                    {{ callee['callee.full_classname'] }}.{{ callee['callee.name'] }}
                  </li>
                </ul>
              </div>
            </div>

            <!-- Class-specific details -->
            <div v-if="selectedCategory === 'class_metadata' && result.relatedClasses && result.relatedClasses.length > 0" class="class-relations">
              <h5>Related Classes:</h5>
              <ul>
                <li v-for="relatedClass in result.relatedClasses" :key="relatedClass.path + relatedClass.name">
                  {{ relatedClass.path }}.{{ relatedClass.name }} ({{ relatedClass.fileExtension }})
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Graph Files Section -->
      <div class="graph-files-section">
        <h2>Graph Files</h2>
        <div v-if="graphFiles && graphFiles.length > 0" class="files-list">
          <div v-for="file in graphFiles" :key="file.fullPath" class="file-item">
            <div class="file-info">
              <span class="file-path">{{ file.fullPath }}</span>
              <span class="file-status" :class="file.scanned ? 'scanned' : 'pending'">
                {{ file.scanned ? 'Processed' : 'Pending' }}
              </span>
            </div>
          </div>
        </div>
        <div v-else class="no-files">
          No files found for this graph.
        </div>
      </div>

      <!-- Graph Statistics -->
      <div class="graph-stats">
        <h2>Graph Statistics</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Total Files:</span>
            <span class="stat-value">{{ graphFiles ? graphFiles.length : 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Processed Files:</span>
            <span class="stat-value">{{ processedFilesCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Search Results:</span>
            <span class="stat-value">{{ searchResults ? searchResults.length : 0 }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'GraphDetailView',
  data() {
    return {
      graphId: this.$route.params.id,
      loading: true,
      apiUrl: localStorage.getItem('apiUrl') || 'https://zkbt0wdjh6.execute-api.us-east-1.amazonaws.com/prod',
      searchQuery: '',
      selectedCategory: 'class_metadata',
      searchResults: null,
      graphFiles: []
    }
  },
  computed: {
    processedFilesCount() {
      return this.graphFiles ? this.graphFiles.filter(file => file.scanned).length : 0
    }
  },
  mounted() {
    this.fetchGraphDetails()
  },
  methods: {
    async fetchGraphDetails() {
      this.loading = true
      try {
        const response = await axios.get(`${this.apiUrl}/graphSearchManagement?command=graphDetail&graphId=${this.graphId}`)
        this.graphFiles = response.data.message || []
      } catch (error) {
        console.error('Error fetching graph details:', error)
        this.graphFiles = []
      } finally {
        this.loading = false
      }
    },
    async handleSearch() {
      if (!this.searchQuery.trim()) return
      
      try {
        const response = await axios.get(
          `${this.apiUrl}/searchCodeGraph?command=queryGraph&index=${this.selectedCategory}&query=${encodeURIComponent(this.searchQuery)}`
        )
        this.searchResults = response.data.responseBody || []
      } catch (error) {
        console.error('Error searching graph:', error)
        this.searchResults = []
      }
    }
  }
}
</script>

<style scoped>
.graph-detail-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 30px;
  text-align: center;
}

.header h1 {
  color: #333;
  margin-bottom: 10px;
}

.graph-id {
  color: #666;
  font-size: 0.9em;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.content {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.search-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
}

.search-section h2 {
  margin-bottom: 15px;
  color: #333;
}

.search-form {
  display: flex;
  gap: 10px;
  align-items: end;
  flex-wrap: wrap;
}

.form-group {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.category-select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.search-btn {
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.search-btn:hover:not(:disabled) {
  background-color: #0056b3;
}

.search-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.search-results {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
}

.search-results h3 {
  margin-bottom: 15px;
  color: #333;
}

.no-results {
  text-align: center;
  color: #666;
  padding: 20px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.result-item {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 15px;
  background: #fafafa;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.result-header h4 {
  margin: 0;
  color: #007bff;
}

.result-score {
  background: #e9ecef;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  color: #666;
}

.result-details p {
  margin: 5px 0;
  font-size: 0.9em;
}

.function-relations, .class-relations {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #ddd;
}

.function-relations h5, .class-relations h5 {
  margin: 10px 0 5px 0;
  color: #555;
}

.callers, .callees {
  margin-bottom: 10px;
}

.function-relations ul, .class-relations ul {
  margin: 5px 0;
  padding-left: 20px;
}

.function-relations li, .class-relations li {
  font-size: 0.85em;
  color: #666;
  margin: 2px 0;
}

.graph-files-section {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
}

.graph-files-section h2 {
  margin-bottom: 15px;
  color: #333;
}

.files-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 4px solid #007bff;
}

.file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-path {
  font-family: monospace;
  font-size: 0.9em;
  color: #333;
}

.file-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: bold;
}

.file-status.scanned {
  background: #d4edda;
  color: #155724;
}

.file-status.pending {
  background: #fff3cd;
  color: #856404;
}

.no-files {
  text-align: center;
  color: #666;
  padding: 20px;
}

.graph-stats {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
}

.graph-stats h2 {
  margin-bottom: 15px;
  color: #333;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.stat-label {
  font-weight: bold;
  color: #555;
}

.stat-value {
  font-size: 1.2em;
  font-weight: bold;
  color: #007bff;
}
</style>