<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import QRCode from "qrcode";

const props = defineProps<{
  value: string;
  label: string;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

async function render() {
  if (!canvasRef.value) {
    return;
  }

  await QRCode.toCanvas(canvasRef.value, props.value, { width: 280, margin: 2 });
}

function download() {
  if (!canvasRef.value) {
    return;
  }

  const link = document.createElement("a");
  link.download = `${props.label.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
  link.href = canvasRef.value.toDataURL("image/png");
  link.click();
}

onMounted(render);
watch(() => props.value, render);
</script>

<template>
  <div class="qr-display">
    <canvas ref="canvasRef"></canvas>
    <button class="secondary" @click="download">Download PNG</button>
  </div>
</template>

<style scoped>
.qr-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

canvas {
  border-radius: 0.75rem;
  background: white;
  padding: 0.75rem;
}
</style>
