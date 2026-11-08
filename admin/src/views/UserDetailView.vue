<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  getSessions,
  getUser,
  regenerateCredential,
  setUserRole,
  togglePunch,
  type Credential,
  type CredentialType,
  type Session,
  type UserDetail,
  type UserRole,
} from "../api/users";
import { ApiError } from "../api/client";
import AdminLayout from "../components/AdminLayout.vue";
import QrDisplay from "../components/QrDisplay.vue";

const props = defineProps<{ id: string }>();

const detail = ref<UserDetail | null>(null);
const sessions = ref<Session[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

const roleDraft = ref<UserRole>("student");
const savingRole = ref(false);
const roleError = ref<string | null>(null);

const punching = ref(false);
const punchError = ref<string | null>(null);

const credentialType = ref<CredentialType>("rotating");
const regenerateSecret = ref("");
const regenerating = ref(false);
const regenerateError = ref<string | null>(null);
const qr = ref<{ label: string; credential: Credential } | null>(null);

function userId(): number {
  return Number(props.id);
}

const rosterLink = computed(() => (detail.value?.user.role === "mentor" ? "/mentors" : "/"));
const rosterLabel = computed(() => (detail.value?.user.role === "mentor" ? "Mentors" : "Students"));

async function load() {
  loading.value = true;
  loadError.value = null;
  qr.value = null;

  try {
    const [detailResult, sessionsResult] = await Promise.all([
      getUser(userId()),
      getSessions(userId()),
    ]);
    detail.value = detailResult;
    sessions.value = sessionsResult;
    roleDraft.value = detailResult.user.role;
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : "Failed to load user.";
  } finally {
    loading.value = false;
  }
}

async function handleSaveRole() {
  roleError.value = null;
  savingRole.value = true;

  try {
    const updated = await setUserRole(userId(), roleDraft.value);
    if (detail.value) {
      detail.value.user = updated;
    }
  } catch (error) {
    roleError.value = error instanceof ApiError ? error.message : "Failed to update role.";
  } finally {
    savingRole.value = false;
  }
}

async function handleTogglePunch() {
  punchError.value = null;
  punching.value = true;

  try {
    await togglePunch(userId());
    await load();
  } catch (error) {
    punchError.value = error instanceof ApiError ? error.message : "Failed to update punch status.";
  } finally {
    punching.value = false;
  }
}

async function handleRegenerate() {
  regenerateError.value = null;
  regenerating.value = true;

  try {
    const trimmedSecret = regenerateSecret.value.trim();
    const result = await regenerateCredential(
      userId(),
      credentialType.value,
      trimmedSecret.length > 0 ? trimmedSecret : undefined,
    );
    qr.value = {
      label: result.user.fullName,
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
    <RouterLink :to="rosterLink">&larr; Back to {{ rosterLabel }}</RouterLink>

    <p v-if="loading">Loading...</p>
    <p v-else-if="loadError" class="error-banner">{{ loadError }}</p>

    <template v-else-if="detail">
      <h1>{{ detail.user.fullName }}</h1>
      <p class="status">
        Status:
        <span :class="detail.punchedIn ? 'status-in' : 'status-out'">
          {{ detail.punchedIn ? "Punched in" : "Punched out" }}
        </span>
        <button class="secondary punch-button" :disabled="punching" @click="handleTogglePunch">
          {{ punching ? "Updating..." : detail.punchedIn ? "Punch out" : "Punch in" }}
        </button>
      </p>
      <p v-if="punchError" class="error-banner">{{ punchError }}</p>

      <section class="card">
        <h2>Role</h2>
        <form @submit.prevent="handleSaveRole">
          <label for="roleDraft">Tag as</label>
          <select id="roleDraft" v-model="roleDraft">
            <option value="student">Student</option>
            <option value="mentor">Mentor</option>
          </select>

          <p v-if="roleError" class="error-banner">{{ roleError }}</p>

          <button type="submit" :disabled="savingRole || roleDraft === detail.user.role">
            {{ savingRole ? "Saving..." : "Save role" }}
          </button>
        </form>
      </section>

      <section class="card">
        <h2>Regenerate credential</h2>
        <p class="hint">Revokes the current credential of this type and issues a new one.</p>
        <form @submit.prevent="handleRegenerate">
          <label for="credentialType">Credential type</label>
          <select id="credentialType" v-model="credentialType">
            <option value="rotating">Rotating (phone enrollment)</option>
            <option value="static">Static (printed QR)</option>
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
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-in {
  color: #4ade80;
}

.status-out {
  color: var(--text-muted);
}

.punch-button {
  font-size: 0.85rem;
  padding: 0.35rem 0.75rem;
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
