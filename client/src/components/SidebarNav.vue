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
   
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>Code Graph Search</h2>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-item" :class="{ active: currentPage === 'listgraphs' }" @click="navigateTo('Listgraphs')">
        View Graphs
      </div>
      <div class="nav-item" :class="{ active: currentPage === 'create' }" @click="navigateTo('Create')">
        Create Graph
      </div>
      <div class="nav-item" :class="{ active: currentPage === 'search' }" @click="navigateTo('Search')">
        Search
      </div>
      <div class="nav-item" :class="{ active: currentPage === 'update' }" @click="navigateTo('Update')">
        Update Graph
      </div>
      <div class="nav-item" :class="{ active: currentPage === 'settings' }" @click="navigateTo('Settings')">
        Settings
      </div>
      
    </nav>
  </div>
</template>

<script>
export default {
  name: 'SidebarNav',
  props: {
    currentPage: {
      type: String,
      required: true
    }
  },
  methods: {
    navigateTo(page) {
      this.$router.push({ name: page });
    }
  }
}
</script>

<style scoped>
.sidebar {
  width: 200px;
  background-color: #2c3e50;
  color: white;
  padding: 20px 0;
  position: fixed;
  height: 100vh;
  left: 0;
  top: 0;
}

.sidebar-header {
  padding: 0 20px;
  margin-bottom: 20px;
}

.nav-item {
  padding: 15px 20px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.nav-item:hover {
  background-color: #34495e;
}

.nav-item.active {
  background-color: #3498db;
}
</style>
