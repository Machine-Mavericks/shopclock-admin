<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createUser, listUsers, type Credential, type CredentialType, type User, type UserRole } from "../api/users";
import { ApiError } from "../api/client";
import AdminLayout from "../components/AdminLayout.vue";
import QrDisplay from "../components/QrDisplay.vue";

const props = defineProps<{ role: UserRole }>();

const roleLabel = computed(() => (props.role === "mentor" ? "Mentor" : "Student"));
const roleLabelPlural = computed(() => (props.role === "mentor" ? "Mentors" : "Students"));

const users = ref<User[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

const visibleUsers = computed(() => users.value.filter((user) => user.role === props.role));

const newName = ref("");
const newCredentialType = ref<CredentialType>("static");
const newSecret = ref("");
const creating = ref(false);
const createError = ref<string | null>(null);
const createdQr = ref<{ label: string; credential: Credential } | null>(null);

async function load() {
  loading.value = true;
  loadError.value = null;

  try {
    users.value = await listUsers();
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : "Failed to load users.";
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  createError.value = null;
  createdQr.value = null;

  if (!newName.value.trim()) {
    createError.value = "Full name is required.";
    return;
  }

  creating.value = true;

  try {
    const trimmedSecret = newSecret.value.trim();
    const result = await createUser(
      newName.value.trim(),
      props.role,
      newCredentialType.value,
      trimmedSecret.length > 0 ? trimmedSecret : undefined,
    );
    createdQr.value = {
      label: result.user.fullName,
      credential: result.credential,
    };
    newName.value = "";
    newSecret.value = "";
    await load();
  } catch (error) {
    createError.value = error instanceof ApiError ? error.message : "Failed to create user.";
  } finally {
    creating.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AdminLayout>
    <h1>{{ roleLabelPlural }}</h1>

    <section class="card create-card">
      <h2>New {{ roleLabel.toLowerCase() }}</h2>
      <form @submit.prevent="handleCreate">
        <label for="fullName">Full name</label>
        <input id="fullName" v-model="newName" type="text" required />

        <label for="credentialType">Credential type</label>
        <select id="credentialType" v-model="newCredentialType">
          <option value="rotating">Rotating (phone enrollment)</option>
          <option value="static">Static (printed QR)</option>
        </select>

        <template v-if="newCredentialType === 'static'">
          <label for="newSecret">Custom secret (optional)</label>
          <input id="newSecret" v-model="newSecret" type="text" placeholder="Leave blank to auto-generate" />
        </template>

        <p v-if="createError" class="error-banner">{{ createError }}</p>

        <button type="submit" :disabled="creating">
          {{ creating ? "Creating..." : `Create ${roleLabel.toLowerCase()}` }}
        </button>
      </form>

      <div v-if="createdQr" class="created-qr">
        <p>Scan to enroll {{ createdQr.label }}:</p>
        <QrDisplay
          :value="createdQr.credential.type === 'static' ? createdQr.credential.qrCode : createdQr.credential.enrollmentCode"
          :label="createdQr.label"
        />

        <dl v-if="createdQr.credential.type === 'rotating'" class="credential-details">
          <dt>Credential ID</dt>
          <dd><code>{{ createdQr.credential.id }}</code></dd>
          <dt>Secret</dt>
          <dd><code>{{ createdQr.credential.secret }}</code></dd>
        </dl>

        <dl v-else class="credential-details">
          <dt>QR text</dt>
          <dd><code>{{ createdQr.credential.qrCode }}</code></dd>
        </dl>
      </div>
    </section>

    <section class="card">
      <h2>Roster</h2>
      <p v-if="loading">Loading...</p>
      <p v-else-if="loadError" class="error-banner">{{ loadError }}</p>
      <table v-else>
        <thead>
          <tr>
            <th>Name</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in visibleUsers" :key="user.id">
            <td>{{ user.fullName }}</td>
            <td>
              <RouterLink :to="`/users/${user.id}`">View</RouterLink>
            </td>
          </tr>
          <tr v-if="visibleUsers.length === 0">
            <td colspan="2">No {{ roleLabelPlural.toLowerCase() }} yet.</td>
          </tr>
        </tbody>
      </table>
    </section>
  </AdminLayout>
</template>

<style scoped>
h1 {
  margin-top: 0;
}

.create-card {
  margin-bottom: 1.5rem;
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
</style>
