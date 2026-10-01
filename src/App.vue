<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useDesktopState } from './composables/useDesktopState.js';
import Sidebar from './components/Sidebar.vue';
import ThreadView from './components/ThreadView.vue';
import ConfigPanel from './components/ConfigPanel.vue';

const state = useDesktopState();
const showConfig = ref(false);
const showSidebar = ref(false);
const isMobile = ref(false);

function checkMobile() {
  isMobile.value = window.innerWidth < 768;
  if (!isMobile.value) showSidebar.value = false;
}

onMounted(() => {
  state.initialize();
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  state.dispose();
  window.removeEventListener('resize', checkMobile);
});

function selectThread(id: string) {
  state.selectThread(id);
  if (isMobile.value) showSidebar.value = false;
}

function toggleConfig() {
  showConfig.value = !showConfig.value;
  if (showConfig.value && isMobile.value) showSidebar.value = false;
}
</script>

<template>
  <div class="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
    <!-- Mobile Sidebar Overlay -->
    <div
      v-if="isMobile && showSidebar"
      class="fixed inset-0 bg-black/60 z-40"
      @click="showSidebar = false"
    />

    <!-- Sidebar -->
    <Sidebar
      :threads="state.threads.value"
      :selected-thread-id="state.selectedThreadId.value"
      :class="[
        isMobile ? 'fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-200' : 'w-64 flex-shrink-0',
        isMobile && !showSidebar ? '-translate-x-full' : 'translate-x-0'
      ]"
      @select="selectThread"
      @new-thread="state.createThread"
      @toggle-config="toggleConfig"
    />

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden min-w-0">
      <!-- Header -->
      <header class="h-14 border-b border-gray-800 flex items-center px-3 gap-2 flex-shrink-0">
        <!-- Mobile menu button -->
        <button
          v-if="isMobile"
          @click="showSidebar = !showSidebar"
          class="p-2 hover:bg-gray-800 rounded-lg"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        <div class="flex items-center gap-2 flex-1 min-w-0">
          <h1 class="text-sm font-semibold text-gray-300 truncate">PerfectAgent</h1>
          <span
            class="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
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
        <div class="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
          <span class="hidden sm:inline">Tokens: {{ state.tokenUsage.value.total }}</span>
          <span class="hidden sm:inline">Cost: ${{ state.cost.value.toFixed(4) }}</span>
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
      <div v-else class="flex-1 flex items-center justify-center p-4">
        <div class="text-center">
          <h2 class="text-xl sm:text-2xl font-bold text-gray-300 mb-2">PerfectAgent</h2>
          <p class="text-gray-500 mb-6 text-sm sm:text-base">Autonomous AI coding agent</p>
          <button
            @click="state.createThread"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
          >
            New Task
          </button>
        </div>
      </div>
    </div>

    <!-- Config Panel Overlay (Mobile) -->
    <div
      v-if="showConfig && isMobile"
      class="fixed inset-0 bg-black/60 z-40"
      @click="showConfig = false"
    />

    <!-- Config Panel -->
    <div
      v-if="showConfig"
      :class="[
        isMobile ? 'fixed inset-y-0 right-0 z-50 w-full max-w-sm' : 'w-80 flex-shrink-0'
      ]"
    >
      <ConfigPanel
        :config="state.config.value"
        @update="state.updateConfig"
        @close="showConfig = false"
      />
    </div>
  </div>
</template>
