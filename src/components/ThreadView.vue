<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import type { Message } from '../core/agent/types.js';

const props = defineProps<{
  thread: { id: string; title: string };
  messages: Message[];
  isLoading: boolean;
}>();

const emit = defineEmits<{
  send: [content: string];
  abort: [];
}>();

const input = ref('');
const messagesContainer = ref<HTMLElement | null>(null);

watch(() => props.messages.length, async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
});

function handleSend() {
  if (!input.value.trim() || props.isLoading) return;
  emit('send', input.value);
  input.value = '';
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div
        v-for="message in messages"
        :key="message.id"
        class="flex"
        :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[80%] rounded-lg px-4 py-2"
          :class="{
            'bg-blue-600 text-white': message.role === 'user',
            'bg-gray-800 text-gray-200': message.role === 'assistant',
            'bg-gray-700 text-gray-300': message.role === 'tool',
          }"
        >
          <div class="text-sm whitespace-pre-wrap">{{ message.content }}</div>
          <div v-if="message.toolCalls" class="mt-2 space-y-1">
            <div
              v-for="toolCall in message.toolCalls"
              :key="toolCall.id"
              class="text-xs px-2 py-1 rounded bg-gray-900/50"
            >
              <span class="font-mono text-yellow-400">{{ toolCall.tool }}</span>
              <span class="text-gray-400 ml-2">{{ JSON.stringify(toolCall.params) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading Indicator -->
      <div v-if="isLoading" class="flex justify-start">
        <div class="bg-gray-800 rounded-lg px-4 py-2">
          <div class="flex items-center gap-2 text-sm text-gray-400">
            <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            Thinking...
          </div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="border-t border-gray-800 p-4">
      <div class="flex gap-2">
        <textarea
          v-model="input"
          @keydown="handleKeydown"
          placeholder="Describe a task..."
          rows="2"
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
          :disabled="isLoading"
        />
        <div class="flex flex-col gap-2">
          <button
            v-if="!isLoading"
            @click="handleSend"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
            :disabled="!input.trim()"
          >
            Send
          </button>
          <button
            v-else
            @click="emit('abort')"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
