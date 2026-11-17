<template>
	<view
		class="ww-hero"
		:class="{ 'ww-hero--compact': compact }"
	>
		<image class="ww-hero__background" :src="courtyard" mode="aspectFill" />
		<view class="ww-hero__cast">
			<view class="ww-hero__actor"><ww-sprite :index="0" /></view>
			<view class="ww-hero__actor ww-hero__actor--seer"><ww-sprite :index="1" /></view>
			<view class="ww-hero__actor"><ww-sprite :index="2" flip /></view>
		</view>
		<view class="ww-hero__shade" />
		<view class="ww-hero__text">
			<text class="ww-hero__title">{{ title }}</text>
			<text v-if="subtitle" class="ww-hero__subtitle">{{ subtitle }}</text>
			<slot />
		</view>
	</view>
</template>
<script setup>
import WwSprite from './ww-sprite.vue'
import courtyard from '../static/courtyard.jpg'
defineProps({ title: String, subtitle: String, compact: Boolean })
</script>
<style scoped>
.ww-hero {
	position: relative;
	height: 330px;
	overflow: hidden;
	border-radius: 20px;
}
.ww-hero__background {
	position: absolute;
	width: 100%;
	height: 100%;
	left: 0;
	top: 0;
}
.ww-hero__cast {
	position: absolute;
	inset: 35px -8px 50px;
	display: flex;
	align-items: flex-end;
	z-index: 1;
}
.ww-hero__actor {
	width: 35%;
	height: 220px;
}
.ww-hero__actor--seer {
	position: relative;
	z-index: 1;
	margin: 0 -4%;
	width: 42%;
	height: 245px;
}
.ww-hero__shade {
	position: absolute;
	inset: 35% 0 0;
	background: linear-gradient(transparent, rgba(25, 55, 41, 0.96));
	z-index: 2;
}
.ww-hero__text {
	position: absolute;
	bottom: 20px;
	left: 20px;
	right: 20px;
	text-align: center;
	color: #fff5df;
	z-index: 3;
}
.ww-hero__title {
	display: block;
	font-size: 30px;
	font-weight: 700;
	letter-spacing: 1px;
}
.ww-hero__subtitle {
	display: block;
	margin: 6px 0 16px;
	font-size: 14px;
}
.ww-hero--compact {
	height: 235px;
	border-radius: 20px 20px 0 0;
}
.ww-hero--compact .ww-hero__cast {
	inset: 5px 0 25px;
}
.ww-hero--compact .ww-hero__actor {
	height: 200px;
}
.ww-hero--compact .ww-hero__actor--seer {
	height: 220px;
}
.ww-hero--compact .ww-hero__title {
	font-size: 24px;
}
.ww-hero--compact .ww-hero__text {
	bottom: 12px;
}
.ww-hero--compact .ww-hero__subtitle {
	margin-bottom: 0;
}
</style>
