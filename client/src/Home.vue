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
   
    <div id="app">
      <div class="main-content">
        <CreateView v-if="currentPage === 'create'" />
        <SearchView v-else-if="currentPage === 'search'" />
        <UpdateView v-else-if="currentPage === 'update'" />
        <SettingsView v-else-if="currentPage === 'settings'" />
        <ListGraphView v-else-if="currentPage === 'listgraphs'" />
      </div>
    </div>
  </template>
  
  <script>
  import CreateView from './views/CreateView.vue'
  import SearchView from './views/SearchView.vue'
  import UpdateView from './views/UpdateView.vue'
  import SettingsView from './views/SettingsView.vue'
  import ListGraphView from './views/ListGraphView.vue';
  
  export default {
    name: 'App',
    components: {
      CreateView,
      SearchView,
      UpdateView,
      SettingsView,
      ListGraphView
    },
    data() {
      return {
        currentPage: 'listgraphs'
      }
    },
    methods: {
      changePage(page) {
        this.currentPage = page
      }
    }
  }
  </script>
  
  <style>
  #app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: #2c3e50;
    display: flex;
    min-height: 100vh;
  }
  
  .main-content {
    flex: 1;
    margin-left: 200px; /* Matches sidebar width */
    padding: 20px;
    width: calc(100% - 200px); /* Ensure content doesn't overlap */
    box-sizing: border-box;
  }
  </style>
  