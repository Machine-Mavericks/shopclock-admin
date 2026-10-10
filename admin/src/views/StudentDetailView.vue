<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import {
  getSessions,
  getStudent,
  regenerateCredential,
  type Credential,
  type CredentialType,
  type Session,
  type StudentDetail,
} from "../api/students";
import { ApiError } from "../api/client";
import AdminLayout from "../components/AdminLayout.vue";
import QrDisplay from "../components/QrDisplay.vue";

const props = defineProps<{ id: string }>();

const detail = ref<StudentDetail | null>(null);
const sessions = ref<Session[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

const credentialType = ref<CredentialType>("static");
const regenerateSecret = ref("");
const regenerating = ref(false);
const regenerateError = ref<string | null>(null);
const qr = ref<{ label: string; credential: Credential } | null>(null);

function studentId(): number {
  return Number(props.id);
}

async function load() {
  loading.value = true;
  loadError.value = null;
  qr.value = null;

  try {
    const [detailResult, sessionsResult] = await Promise.all([
      getStudent(studentId()),
      getSessions(studentId()),
    ]);
    detail.value = detailResult;
    sessions.value = sessionsResult;
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : "Failed to load student.";
  } finally {
    loading.value = false;
  }
}

async function handleRegenerate() {
  regenerateError.value = null;
  regenerating.value = true;

  try {
    const trimmedSecret = regenerateSecret.value.trim();
    const result = await regenerateCredential(
      studentId(),
      credentialType.value,
      trimmedSecret.length > 0 ? trimmedSecret : undefined,
    );
    qr.value = {
      label: result.student.fullName,
      credential: result.credential,
    };
    regenerateSecret.value = "";
  } catch (error) {
    regenerateError.value = error instanceof ApiError ? error.message : "Failed to regenerate credential.";
  } finally {
    regenerating.value = false;
  }
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString();
}

onMounted(load);
watch(() => props.id, load);
</script>

<template>
  <AdminLayout>
    <RouterLink to="/">&larr; Back to roster</RouterLink>

    <p v-if="loading">Loading...</p>
    <p v-else-if="loadError" class="error-banner">{{ loadError }}</p>

    <template v-else-if="detail">
      <h1>{{ detail.student.fullName }}</h1>
      <p class="status">
        Status:
        <span :class="detail.punchedIn ? 'status-in' : 'status-out'">
          {{ detail.punchedIn ? "Punched in" : "Punched out" }}
        </span>
      </p>

      <section class="card">
        <h2>Regenerate credential</h2>
        <p class="hint">Revokes the current credential of this type and issues a new one.</p>
        <form @submit.prevent="handleRegenerate">
          <label for="credentialType">Credential type</label>
          <select id="credentialType" v-model="credentialType">
            <option value="static">Static (printed QR)</option>
            <option value="rotating">Rotating (phone enrollment)</option>
          </select>

          <template v-if="credentialType === 'static'">
            <label for="regenerateSecret">Custom secret (optional)</label>
            <input id="regenerateSecret" v-model="regenerateSecret" type="text" placeholder="Leave blank to auto-generate" />
          </template>

          <p v-if="regenerateError" class="error-banner">{{ regenerateError }}</p>

          <button type="submit" :disabled="regenerating">
            {{ regenerating ? "Regenerating..." : "Regenerate QR" }}
          </button>
        </form>

        <div v-if="qr" class="created-qr">
          <QrDisplay
            :value="qr.credential.type === 'static' ? qr.credential.qrCode : qr.credential.enrollmentCode"
            :label="qr.label"
          />

          <dl v-if="qr.credential.type === 'rotating'" class="credential-details">
            <dt>Credential ID</dt>
            <dd><code>{{ qr.credential.id }}</code></dd>
            <dt>Secret</dt>
            <dd><code>{{ qr.credential.secret }}</code></dd>
          </dl>

          <dl v-else class="credential-details">
            <dt>QR text</dt>
            <dd><code>{{ qr.credential.qrCode }}</code></dd>
          </dl>
        </div>
      </section>

      <section class="card">
        <h2>Sessions</h2>
        <table>
          <thead>
            <tr>
              <th>Time in</th>
              <th>Time out</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="session in sessions" :key="session.id">
              <td>{{ formatTime(session.timeIn) }}</td>
              <td>{{ session.timeOut ? formatTime(session.timeOut) : "Active" }}</td>
            </tr>
            <tr v-if="sessions.length === 0">
              <td colspan="2">No sessions yet.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </AdminLayout>
</template>

<style scoped>
h1 {
  margin-bottom: 0;
}

.status {
  color: var(--text-muted);
}

.status-in {
  color: #4ade80;
}

.status-out {
  color: var(--text-muted);
}

.hint {
  color: var(--text-muted);
  font-size: 0.9rem;
}

form {
  display: grid;
  gap: 0.5rem;
  max-width: 24rem;
}

label {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.created-qr {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border);
}

.credential-details {
  margin: 1rem 0 0;
  width: 100%;
  max-width: 24rem;
}

.credential-details dt {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.credential-details dd {
  margin: 0.15rem 0 0.75rem;
}

.credential-details code {
  display: block;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 4%);
  word-break: break-all;
  font-size: 0.85rem;
}

section + section {
  margin-top: 1.5rem;
}
</style>
