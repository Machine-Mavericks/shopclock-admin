<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();

async function handleLogout() {
  await auth.logout();
  router.push({ name: "login" });
}
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <RouterLink to="/" class="brand">ShopClock Admin</RouterLink>
      <div class="account" v-if="auth.admin">
        <span class="username">{{ auth.admin.username }}</span>
        <span class="provider-badge">{{ auth.admin.provider }}</span>
        <button class="secondary" @click="handleLogout">Log out</button>
      </div>
    </header>
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.brand {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text);
  text-decoration: none;
}

.account {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.username {
  font-weight: 600;
}

.provider-badge {
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 1rem;
}

.content {
  flex: 1;
  padding: 1.5rem;
  max-width: 64rem;
  width: 100%;
  margin: 0 auto;
}
</style>
