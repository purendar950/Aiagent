<script setup lang="ts">
import type { AgentConfig } from '../core/agent/types.js';

const props = defineProps<{
  config: AgentConfig;
}>();

const emit = defineEmits<{
  update: [config: Partial<AgentConfig>];
  close: [];
}>();

function updateConfig(key: keyof AgentConfig, value: any) {
  emit('update', { [key]: value });
}
</script>

<template>
  <div class="w-80 border-l border-gray-800 bg-gray-900 overflow-y-auto">
    <div class="p-4">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold">Settings</h2>
        <button @click="emit('close')" class="text-gray-400 hover:text-gray-200">✕</button>
      </div>

      <!-- Mode -->
      <div class="mb-4">
        <label class="block text-sm text-gray-400 mb-1">Execution Mode</label>
        <select
          :value="props.config.mode"
          @change="updateConfig('mode', ($event.target as HTMLSelectElement).value)"
          class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
        >
          <option value="autonomous">Autonomous</option>
          <option value="supervised">Supervised</option>
          <option value="interactive">Interactive</option>
        </select>
      </div>

      <!-- Reasoning -->
      <div class="mb-4">
        <label class="block text-sm text-gray-400 mb-1">Reasoning Depth</label>
        <select
          :value="props.config.reasoning"
          @change="updateConfig('reasoning', ($event.target as HTMLSelectElement).value)"
          class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
        >
          <option value="fast">Fast</option>
          <option value="standard">Standard</option>
          <option value="deep">Deep</option>
        </select>
      </div>

      <!-- Sandbox -->
      <div class="mb-4">
        <label class="block text-sm text-gray-400 mb-1">Sandbox Mode</label>
        <select
          :value="props.config.sandboxMode"
          @change="updateConfig('sandboxMode', ($event.target as HTMLSelectElement).value)"
          class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
        >
          <option value="none">None (Full Access)</option>
          <option value="workspace">Workspace Only</option>
          <option value="strict">Strict (Read-only)</option>
        </select>
      </div>

      <!-- Max Iterations -->
      <div class="mb-4">
        <label class="block text-sm text-gray-400 mb-1">Max Iterations</label>
        <input
          type="number"
          :value="props.config.maxIterations"
          @input="updateConfig('maxIterations', parseInt(($event.target as HTMLInputElement).value))"
          class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          min="1"
          max="50"
        />
      </div>

      <!-- Toggles -->
      <div class="space-y-3">
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            :checked="props.config.autoTest"
            @change="updateConfig('autoTest', ($event.target as HTMLInputElement).checked)"
            class="rounded"
          />
          <span class="text-sm">Auto-run tests</span>
        </label>

        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            :checked="props.config.autoLint"
            @change="updateConfig('autoLint', ($event.target as HTMLInputElement).checked)"
            class="rounded"
          />
          <span class="text-sm">Auto-lint</span>
        </label>

        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            :checked="props.config.autoFormat"
            @change="updateConfig('autoFormat', ($event.target as HTMLInputElement).checked)"
            class="rounded"
          />
          <span class="text-sm">Auto-format</span>
        </label>

        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            :checked="props.config.learningEnabled"
            @change="updateConfig('learningEnabled', ($event.target as HTMLInputElement).checked)"
            class="rounded"
          />
          <span class="text-sm">Enable learning</span>
        </label>

        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            :checked="props.config.proactiveEnabled"
            @change="updateConfig('proactiveEnabled', ($event.target as HTMLInputElement).checked)"
            class="rounded"
          />
          <span class="text-sm">Proactive suggestions</span>
        </label>
      </div>
    </div>
  </div>
</template>
