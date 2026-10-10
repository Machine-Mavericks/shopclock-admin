<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  addFluxerAdminId,
  createLocalAdmin,
  listAdmins,
  removeFluxerAdminId,
  setLocalAdminDisabled,
  type AdminsOverview,
} from "../api/admins";
import { ApiError } from "../api/client";
import AdminLayout from "../components/AdminLayout.vue";

const overview = ref<AdminsOverview>({ local: [], fluxer: [] });
const loading = ref(true);
const loadError = ref<string | null>(null);

const newUsername = ref("");
const newPassword = ref("");
const creatingAdmin = ref(false);
const createAdminError = ref<string | null>(null);

const newFluxerId = ref("");
const newFluxerLabel = ref("");
const addingFluxerId = ref(false);
const addFluxerIdError = ref<string | null>(null);

async function load() {
  loading.value = true;
  loadError.value = null;

  try {
    overview.value = await listAdmins();
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : "Failed to load admins.";
  } finally {
    loading.value = false;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

async function handleCreateAdmin() {
  createAdminError.value = null;

  if (!newUsername.value.trim() || newPassword.value.length < 8) {
    createAdminError.value = "Username is required and password must be at least 8 characters.";
    return;
  }

  creatingAdmin.value = true;

  try {
    await createLocalAdmin(newUsername.value.trim(), newPassword.value);
    newUsername.value = "";
    newPassword.value = "";
    await load();
  } catch (error) {
    createAdminError.value = error instanceof ApiError ? error.message : "Failed to create admin.";
  } finally {
    creatingAdmin.value = false;
  }
}

async function handleToggleDisabled(id: number, disabled: boolean) {
  try {
    await setLocalAdminDisabled(id, disabled);
    await load();
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : "Failed to update admin.";
  }
}

async function handleAddFluxerId() {
  addFluxerIdError.value = null;

  if (!newFluxerId.value.trim()) {
    addFluxerIdError.value = "Fluxer ID is required.";
    return;
  }

  addingFluxerId.value = true;

  try {
    await addFluxerAdminId(newFluxerId.value.trim(), newFluxerLabel.value.trim() || null);
    newFluxerId.value = "";
    newFluxerLabel.value = "";
    await load();
  } catch (error) {
    addFluxerIdError.value = error instanceof ApiError ? error.message : "Failed to add Fluxer ID.";
  } finally {
    addingFluxerId.value = false;
  }
}

async function handleRemoveFluxerId(id: number) {
  try {
    await removeFluxerAdminId(id);
    await load();
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : "Failed to remove Fluxer ID.";
  }
}

onMounted(load);
</script>

<template>
  <AdminLayout>
    <h1>Admins</h1>

    <p v-if="loading">Loading...</p>
    <p v-else-if="loadError" class="error-banner">{{ loadError }}</p>

    <template v-else>
      <section class="card">
        <h2>Local admins</h2>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Created</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="admin in overview.local" :key="admin.id">
              <td>{{ admin.username }}</td>
              <td>{{ formatDate(admin.createdAt) }}</td>
              <td>{{ admin.disabled ? "Disabled" : "Active" }}</td>
              <td>
                <button class="secondary" @click="handleToggleDisabled(admin.id, !admin.disabled)">
                  {{ admin.disabled ? "Enable" : "Disable" }}
                </button>
              </td>
            </tr>
            <tr v-if="overview.local.length === 0">
              <td colspan="4">No local admins yet.</td>
            </tr>
          </tbody>
        </table>

        <form class="add-form" @submit.prevent="handleCreateAdmin">
          <label for="newUsername">Username</label>
          <input id="newUsername" v-model="newUsername" type="text" required />

          <label for="newPassword">Password</label>
          <input id="newPassword" v-model="newPassword" type="password" minlength="8" required />

          <p v-if="createAdminError" class="error-banner">{{ createAdminError }}</p>

          <button type="submit" :disabled="creatingAdmin">
            {{ creatingAdmin ? "Creating..." : "Create admin" }}
          </button>
        </form>
      </section>

      <section class="card">
        <h2>Fluxer admin IDs</h2>
        <p class="hint">Fluxer users with one of these IDs are allowed to log in as an admin.</p>
        <table>
          <thead>
            <tr>
              <th>Fluxer ID</th>
              <th>Label</th>
              <th>Added by</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in overview.fluxer" :key="entry.id">
              <td>{{ entry.fluxerId }}</td>
              <td>{{ entry.label ?? "--" }}</td>
              <td>{{ entry.addedBy ?? "--" }}</td>
              <td>{{ formatDate(entry.createdAt) }}</td>
              <td>
                <button class="secondary" @click="handleRemoveFluxerId(entry.id)">Remove</button>
              </td>
            </tr>
            <tr v-if="overview.fluxer.length === 0">
              <td colspan="5">No Fluxer IDs added yet.</td>
            </tr>
          </tbody>
        </table>

        <form class="add-form" @submit.prevent="handleAddFluxerId">
          <label for="newFluxerId">Fluxer ID</label>
          <input id="newFluxerId" v-model="newFluxerId" type="text" required />

          <label for="newFluxerLabel">Label (optional)</label>
          <input id="newFluxerLabel" v-model="newFluxerLabel" type="text" />

          <p v-if="addFluxerIdError" class="error-banner">{{ addFluxerIdError }}</p>

          <button type="submit" :disabled="addingFluxerId">
            {{ addingFluxerId ? "Adding..." : "Add Fluxer ID" }}
          </button>
        </form>
      </section>
    </template>
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

.add-form {
  display: grid;
  gap: 0.5rem;
  max-width: 24rem;
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border);
}

.add-form label {
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>
