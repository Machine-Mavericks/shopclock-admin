<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { attendanceExportUrl, listCurrentlyPunchedIn, type CurrentlyPunchedIn } from "../api/attendance";
import { togglePunch } from "../api/users";
import { ApiError } from "../api/client";
import AdminLayout from "../components/AdminLayout.vue";

const entries = ref<CurrentlyPunchedIn[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);
const now = ref(Date.now());
const punchingOutId = ref<number | null>(null);
const punchError = ref<string | null>(null);

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
    loadError.value = error instanceof ApiError ? error.message : "Failed to load currently punched in users.";
  } finally {
    loading.value = false;
  }
}

function elapsed(timeIn: number): string {
  const totalMinutes = Math.max(0, Math.round((now.value - timeIn) / 60000));
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

async function handlePunchOut(userId: number) {
  punchError.value = null;
  punchingOutId.value = userId;

  try {
    await togglePunch(userId);
    await load();
  } catch (error) {
    punchError.value = error instanceof ApiError ? error.message : "Failed to punch out user.";
  } finally {
    punchingOutId.value = null;
  }
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
      <p v-if="punchError" class="error-banner">{{ punchError }}</p>
      <table v-if="!loading && !loadError">
        <thead>
          <tr>
            <th>Name</th>
            <th>Time in</th>
            <th>Elapsed</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.userId">
            <td>{{ entry.fullName }}</td>
            <td>{{ new Date(entry.timeIn).toLocaleTimeString() }}</td>
            <td>{{ elapsed(entry.timeIn) }}</td>
            <td>
              <button
                class="secondary"
                :disabled="punchingOutId === entry.userId"
                @click="handlePunchOut(entry.userId)"
              >
                {{ punchingOutId === entry.userId ? "Punching out..." : "Punch out" }}
              </button>
            </td>
          </tr>
          <tr v-if="entries.length === 0">
            <td colspan="4">Nobody is currently punched in.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="card export-card">
      <h2>Export daily attendance</h2>
      <p class="hint">Download a PDF attendance sheet for a given day, in your local timezone ({{ timeZone }}).</p>
      <div class="export-controls">
        <label for="exportDate">Date</label>
        <input id="exportDate" v-model="exportDate" type="date" />
        <a class="button-like" :href="attendanceExportUrl(exportDate, timeZone)">Download PDF</a>
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
