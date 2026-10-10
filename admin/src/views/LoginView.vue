<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fluxerLoginUrl } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const submitting = ref(false);
const localError = ref<string | null>(null);

const notAllowedError = computed(() => route.query.error === "not_allowed");

async function handleLocalLogin() {
  localError.value = null;
  submitting.value = true;

  try {
    await auth.loginWithPassword(username.value, password.value);
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/";
    router.push(redirect);
  } catch (error) {
    localError.value = error instanceof ApiError ? error.message : "Something went wrong. Try again.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="login-screen">
    <div class="card login-card">
      <h1>ShopClock Admin</h1>

      <p v-if="notAllowedError" class="error-banner">
        Your Fluxer account is not authorized for admin access.
      </p>

      <a class="fluxer-button" :href="fluxerLoginUrl()">Log in with Fluxer</a>

      <div class="divider"><span>or</span></div>

      <form @submit.prevent="handleLocalLogin">
        <label for="username">Username</label>
        <input id="username" v-model="username" type="text" autocomplete="username" required />

        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" required />

        <p v-if="localError" class="error-banner">{{ localError }}</p>

        <button type="submit" :disabled="submitting">
          {{ submitting ? "Logging in..." : "Log in" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-screen {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-card {
  width: min(100%, 24rem);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  text-align: center;
}

.fluxer-button {
  display: block;
  text-align: center;
  padding: 0.65rem 1rem;
  border-radius: 0.6rem;
  background: var(--accent);
  color: var(--text);
  text-decoration: none;
  font-weight: 600;
}

.fluxer-button:hover {
  background: var(--accent-hover);
}

.divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>
