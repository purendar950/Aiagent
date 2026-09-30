<script setup lang="ts">
defineProps<{
  threads: Array<{ id: string; title: string; createdAt: number }>;
  selectedThreadId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
  newThread: [];
  toggleConfig: [];
}>();
</script>

<template>
  <aside class="w-64 border-r border-gray-800 flex flex-col bg-gray-900">
    <!-- New Task Button -->
    <div class="p-3">
      <button
        @click="emit('newThread')"
        class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
      >
        + New Task
      </button>
    </div>

    <!-- Thread List -->
    <div class="flex-1 overflow-y-auto">
      <div
        v-for="thread in threads"
        :key="thread.id"
        @click="emit('select', thread.id)"
        class="px-3 py-2 cursor-pointer hover:bg-gray-800 transition-colors"
        :class="{ 'bg-gray-800': thread.id === selectedThreadId }"
      >
        <div class="text-sm text-gray-200 truncate">{{ thread.title }}</div>
        <div class="text-xs text-gray-500">{{ new Date(thread.createdAt).toLocaleDateString() }}</div>
      </div>
    </div>

    <!-- Config Button -->
    <div class="p-3 border-t border-gray-800">
      <button
        @click="emit('toggleConfig')"
        class="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
      >
        Settings
      </button>
    </div>
  </aside>
</template>
