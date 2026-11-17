<template>
	<view class="k-page travel-products">
		<k-topbar title="旅游产品" back />
		<view class="travel-body">
			<view class="filters"
				><input
					v-model="cityInput"
					placeholder="目的地城市，留空查看全国"
					maxlength="32"
					confirm-type="search"
					@confirm="search"
				/><button @click="search" :disabled="loading">查找</button></view
			>
			<view v-if="error" class="empty"
				><text>{{ error }}</text
				><button @click="load">重新加载</button></view
			>
			<text v-else-if="loading" class="empty">正在加载旅游产品…</text>
			<text v-else-if="!rows.length" class="empty">{{
				city ? '这个城市暂时没有上架的旅游产品' : '旅游产品准备中，上架后会在这里展示'
			}}</text>
			<view
				v-for="item in rows"
				:key="item.activityId"
				class="product"
				hover-class="k-press"
				@click="open(item)"
			>
				<image v-if="item.img" :src="absUrl(item.img)" mode="aspectFill" class="cover" />
				<view class="product-copy"
					><text class="title">{{ item.title }}</text
					><text class="meta">{{ item.city }} · {{ item.timeText }}</text
					><text class="meta">集合地点 {{ item.place }}</text
					><view class="price-row"
						><text class="price"
							>{{ item.priceText }}{{ item.feeKind === 'paid' ? '/人' : '' }}</text
						><text class="meta">{{ item.feeModeLabel }}</text></view
					><text class="meta">{{
						item.full
							? '名额已满'
							: '剩余 ' + Math.max(0, item.capacity - item.count) + ' 个名额'
					}}</text></view
				>
			</view>
			<view v-if="total > 20" class="pagination"
				><button :disabled="page === 1 || loading" @click="changePage(-1)">上一页</button
				><text>{{ page }}</text
				><button :disabled="page * 20 >= total || loading" @click="changePage(1)">
					下一页
				</button></view
			>
		</view>
	</view>
</template>
<script setup>
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { get } from '@/common/request.js'
import { absUrl } from '@/common/upload.js'
const cityInput = ref(''),
	city = ref(''),
	page = ref(1),
	total = ref(0),
	rows = ref([]),
	loading = ref(false),
	error = ref('')
let generation = 0
async function load() {
	const request = ++generation
	loading.value = true
	error.value = ''
	try {
		const r = await get('/app/activities/travel', { city: city.value, pageNum: page.value })
		if (request !== generation) return
		rows.value = r.data.rows
		total.value = r.data.total
	} catch (e) {
		if (request === generation) error.value = e.message || '加载失败，请重试'
	} finally {
		if (request === generation) loading.value = false
	}
}
function search() {
	city.value = cityInput.value.trim()
	page.value = 1
	load()
}
function changePage(step) {
	page.value += step
	load()
}
function open(item) {
	uni.navigateTo({ url: '/pages/community/activity?s=3&id=' + item.activityId })
}
onLoad((q) => {
	cityInput.value = q.city || ''
	city.value = cityInput.value
})
onShow(load)
</script>
<style scoped>
.travel-body {
	padding: 16px 18px 40px;
}
.filters {
	display: flex;
	gap: 10px;
	align-items: center;
	margin-bottom: 20px;
}
.filters input {
	flex: 1;
	min-width: 0;
	background: white;
	border-radius: 8px;
	padding: 0 12px;
	font-size: 15px;
	height: 48px;
	min-height: 48px;
}
.filters button {
	flex: 0 0 56px;
	width: 56px;
	padding: 0;
}
.filters button,
button {
	font-size: 14px;
	line-height: 44px;
	background: #eee6da;
	color: #64482f;
}
.product {
	background: #fff;
	border-radius: 12px;
	overflow: hidden;
	margin-bottom: 20px;
}
.cover {
	width: 100%;
	height: 200px;
}
.product-copy {
	padding: 18px;
}
.title {
	display: block;
	font-size: 19px;
	font-weight: 600;
	margin-bottom: 10px;
}
.meta {
	display: block;
	font-size: 13px;
	line-height: 1.8;
	color: #777;
}
.price-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 14px;
}
.price {
	font-size: 19px;
	color: #956335;
}
.empty {
	display: block;
	padding: 50px 10px;
	color: #777;
	line-height: 1.8;
	text-align: center;
}
.pagination {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
</style>
