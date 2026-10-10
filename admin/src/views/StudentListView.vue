<script setup lang="ts">
import { onMounted, ref } from "vue";
import { createStudent, listStudents, type CredentialType, type Student } from "../api/students";
import { ApiError } from "../api/client";
import AdminLayout from "../components/AdminLayout.vue";
import QrDisplay from "../components/QrDisplay.vue";

const students = ref<Student[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

const newName = ref("");
const newCredentialType = ref<CredentialType>("static");
const creating = ref(false);
const createError = ref<string | null>(null);
const createdQr = ref<{ label: string; value: string } | null>(null);

async function load() {
  loading.value = true;
  loadError.value = null;

  try {
    students.value = await listStudents();
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : "Failed to load students.";
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
    const result = await createStudent(newName.value.trim(), newCredentialType.value);
    const credential = result.credential;
    createdQr.value = {
      label: result.student.fullName,
      value: credential.type === "static" ? credential.qrCode : credential.enrollmentCode,
    };
    newName.value = "";
    await load();
  } catch (error) {
    createError.value = error instanceof ApiError ? error.message : "Failed to create student.";
  } finally {
    creating.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AdminLayout>
    <h1>Students</h1>

    <section class="card create-card">
      <h2>New student</h2>
      <form @submit.prevent="handleCreate">
        <label for="fullName">Full name</label>
        <input id="fullName" v-model="newName" type="text" required />

        <label for="credentialType">Credential type</label>
        <select id="credentialType" v-model="newCredentialType">
          <option value="static">Static (printed QR)</option>
          <option value="rotating">Rotating (phone enrollment)</option>
        </select>

        <p v-if="createError" class="error-banner">{{ createError }}</p>

        <button type="submit" :disabled="creating">
          {{ creating ? "Creating..." : "Create student" }}
        </button>
      </form>

      <div v-if="createdQr" class="created-qr">
        <p>Scan to enroll {{ createdQr.label }}:</p>
        <QrDisplay :value="createdQr.value" :label="createdQr.label" />
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
          <tr v-for="student in students" :key="student.id">
            <td>{{ student.fullName }}</td>
            <td>
              <RouterLink :to="`/students/${student.id}`">View</RouterLink>
            </td>
          </tr>
          <tr v-if="students.length === 0">
            <td colspan="2">No students yet.</td>
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
</style>
