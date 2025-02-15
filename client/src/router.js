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


import { createRouter, createWebHistory } from 'vue-router';

const routes = [
    {
        path: '/listgraphs',
        name: 'Listgraphs',
        component: () => import('./views/ListGraphView.vue'), // Lazy load the component
    },
    {
        path: '/create',
        name: 'Create',
        component: () => import('./views/CreateView.vue'), // Lazy load the component
    },
    {
        path: '/search',
        name: 'Search',
        component: () => import('./views/SearchView.vue'), // Lazy load the component
    },
    {
        path: '/update',
        name: 'Update',
        component: () => import('./views/UpdateView.vue'), // Lazy load the component
    },
    {
        path: '/settings',
        name: 'Settings',
        component: () => import('./views/SettingsView.vue'), // Lazy load the component
    },
    {
        path: '/graphFiles/:id',
        name: 'GraphFiles',
        component: () => import('./views/GraphFileListView.vue'), // Lazy load the component
    },
    {
        path: '/graphDetail/:id',
        name: 'GraphDetail',
        component: () => import('./views/GraphDetailView.vue'), // Lazy load the component
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;