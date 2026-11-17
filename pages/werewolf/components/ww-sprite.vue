<template>
	<view
		class="ww-sprite"
		:class="{ 'ww-sprite--flip': flip, 'ww-sprite--chair': index === 10 }"
	>
		<image class="ww-sprite__atlas" :src="atlas" :style="position" mode="scaleToFill" />
	</view>
</template>
<script setup>
import { computed } from 'vue'
import atlas from '../static/characters.png'
const props = defineProps({ index: { type: Number, default: 0 }, flip: Boolean })
const position = computed(() => ({
	left: -(props.index % 4) * 100 + '%',
	top: -Math.floor(props.index / 4) * 100 + '%'
}))
</script>
<style scoped>
.ww-sprite {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	pointer-events: none;
}
.ww-sprite__atlas {
	position: absolute;
	width: 400%;
	height: 300%;
	max-width: none;
}
.ww-sprite--flip {
	transform: scaleX(-1);
}
.ww-sprite--chair {
	clip-path: inset(0 7% 0 0);
}
</style>
