<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { attendanceExportUrl, listCurrentlyPunchedIn, type CurrentlyPunchedIn } from "../api/attendance";
import { ApiError } from "../api/client";
import AdminLayout from "../components/AdminLayout.vue";

const entries = ref<CurrentlyPunchedIn[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);
const now = ref(Date.now());

let tickHandle: ReturnType<typeof setInterval> | undefined;

function todayLocalDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const exportDate = ref(todayLocalDate());

async function load() {
  loading.value = true;
  loadError.value = null;

  try {
    entries.value = await listCurrentlyPunchedIn();
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : "Failed to load currently punched in students.";
  } finally {
    loading.value = false;
  }
}

function elapsed(timeIn: number): string {
  const totalMinutes = Math.max(0, Math.round((now.value - timeIn) / 60000));
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

onMounted(() => {
  load();
  tickHandle = setInterval(() => {
    now.value = Date.now();
  }, 30000);
});

onUnmounted(() => {
  if (tickHandle) {
    clearInterval(tickHandle);
  }
});
</script>

<template>
  <AdminLayout>
    <h1>Attendance</h1>

    <section class="card">
      <h2>Currently punched in</h2>
      <p v-if="loading">Loading...</p>
      <p v-else-if="loadError" class="error-banner">{{ loadError }}</p>
      <table v-else>
        <thead>
          <tr>
            <th>Name</th>
            <th>Time in</th>
            <th>Elapsed</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.studentId">
            <td>{{ entry.fullName }}</td>
            <td>{{ new Date(entry.timeIn).toLocaleTimeString() }}</td>
            <td>{{ elapsed(entry.timeIn) }}</td>
          </tr>
          <tr v-if="entries.length === 0">
            <td colspan="3">Nobody is currently punched in.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="card export-card">
      <h2>Export daily attendance</h2>
      <p class="hint">Download a PDF attendance sheet for a given day.</p>
      <div class="export-controls">
        <label for="exportDate">Date</label>
        <input id="exportDate" v-model="exportDate" type="date" />
        <a class="button-like" :href="attendanceExportUrl(exportDate)">Download PDF</a>
      </div>
    </section>
  </AdminLayout>
</template>

<style scoped>
h1 {
  margin-top: 0;
}

section + section {
  margin-top: 1.5rem;
}

.hint {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.export-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.export-controls label {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.button-like {
  display: inline-block;
  padding: 0.6rem 1.1rem;
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  background: var(--accent);
  color: var(--text);
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.button-like:hover {
  background: var(--accent-hover);
}
</style>
