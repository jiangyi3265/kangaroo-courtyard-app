<template>
  <view v-if="images.length" class="comment-images">
    <image v-for="(url,i) in images" :key="url" :src="absUrl(url)" mode="aspectFill" @click.stop="preview(i)" />
  </view>
</template>
<script setup>
import { absUrl } from '@/common/upload.js'
const props = defineProps({ images: { type: Array, default: () => [] } })
const preview = i => uni.previewImage({ urls: props.images.map(absUrl), current: absUrl(props.images[i]) })
</script>
<style scoped>
.comment-images{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.comment-images image{width:72px;height:72px;border-radius:8px;background:var(--k-paper2)}
</style>
