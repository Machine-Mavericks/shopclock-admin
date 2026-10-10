<script setup lang="ts"></script>

<template>
  <div class="not-found">
    <div class="card">
      <h1>404</h1>
      <p>Page not found.</p>
      <RouterLink to="/">Go home</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
