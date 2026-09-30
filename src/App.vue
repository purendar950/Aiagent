<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useDesktopState } from './composables/useDesktopState.js';
import Sidebar from './components/Sidebar.vue';
import ThreadView from './components/ThreadView.vue';
import ConfigPanel from './components/ConfigPanel.vue';

const state = useDesktopState();
const showConfig = ref(false);

onMounted(() => {
  state.initialize();
});

onUnmounted(() => {
  state.dispose();
});
</script>

<template>
  <div class="flex h-screen bg-gray-950 text-gray-100">
    <!-- Sidebar -->
    <Sidebar
      :threads="state.threads.value"
      :selected-thread-id="state.selectedThreadId.value"
      @select="state.selectThread"
      @new-thread="state.createThread"
      @toggle-config="showConfig = !showConfig"
    />

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header class="h-12 border-b border-gray-800 flex items-center px-4 justify-between">
        <div class="flex items-center gap-3">
          <h1 class="text-sm font-semibold text-gray-300">PerfectAgent</h1>
          <span
            class="text-xs px-2 py-0.5 rounded-full"
            :class="{
              'bg-green-900/50 text-green-400': state.status.value === 'completed',
              'bg-yellow-900/50 text-yellow-400': state.status.value === 'thinking' || state.status.value === 'executing',
              'bg-red-900/50 text-red-400': state.status.value === 'failed',
              'bg-gray-800 text-gray-400': state.status.value === 'idle',
            }"
          >
            {{ state.status.value }}
          </span>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <span>Tokens: {{ state.tokenUsage.value.total }}</span>
          <span>Cost: ${{ state.cost.value.toFixed(4) }}</span>
        </div>
      </header>

      <!-- Thread View -->
      <ThreadView
        v-if="state.selectedThread.value"
        :thread="state.selectedThread.value"
        :messages="state.messages.value"
        :is-loading="state.isLoading.value"
        @send="state.sendMessage"
        @abort="state.abort"
      />

      <!-- Empty State -->
      <div v-else class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <h2 class="text-2xl font-bold text-gray-300 mb-2">PerfectAgent</h2>
          <p class="text-gray-500 mb-6">Autonomous AI coding agent</p>
          <button
            @click="state.createThread"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
          >
            New Task
          </button>
        </div>
      </div>
    </div>

    <!-- Config Panel -->
    <ConfigPanel
      v-if="showConfig"
      :config="state.config.value"
      @update="state.updateConfig"
      @close="showConfig = false"
    />
  </div>
</template>
