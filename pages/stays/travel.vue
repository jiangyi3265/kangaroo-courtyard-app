<template>
	<view class="k-page travel-products" :class="$userSurface">
		<k-topbar title="旅游产品" back />
		<view class="travel-body">
			<view class="filters"
				><k-icon name="search" :size="16" color="muted" /><input
					v-model="cityInput"
					placeholder="目的地城市，留空查看全国"
					maxlength="32"
					confirm-type="search"
					@confirm="search"
				/><button @click="search" :disabled="loading">查找</button></view
			>
			<view v-if="error" class="empty"
				><view class="r3-empty-ic"><k-icon name="circle-alert" :size="28" color="red" /></view><text>{{ error }}</text
				><button @click="load">重新加载</button></view
			>
			<text v-else-if="loading" class="empty">正在加载旅游产品…</text>
			<view v-else-if="!rows.length" class="empty"
				><view class="r3-empty-ic"><k-icon name="map" :size="28" color="red" /></view><text>{{
				city ? '这个城市暂时没有上架的旅游产品' : '旅游产品准备中，上架后会在这里展示'
			}}</text></view>
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
	background: var(--k-paper);
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

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底 + 纯白卡；搜索框 36 高、「查找」是暖棕小胶囊，其余按钮是白底细棕边的小胶囊；
   产品卡 12 圆角、字收小一档。功能和文字一样不少；上面的规则保留不动，这里统一用 .travel-products 开头的规则盖过去。 */
.travel-products {
	--k-bg: #f7f5f2;
	background: var(--k-page);
}
.travel-products .travel-body {
	padding: 8px 12px 32px;
}
.travel-products .filters {
	gap: 8px;
	margin-bottom: 8px;
}
.travel-products .filters input {
	height: 36px;
	min-height: 36px;
	padding: 0 12px;
	border-radius: 18px;
	background: var(--k-paper);
	font-size: 13px;
}
.travel-products button {
	border-radius: 18px;
	background: var(--k-paper);
	color: var(--k-red-deep);
	font-size: 13px;
	line-height: 36px;
}
.travel-products button::after {
	border: 1px solid var(--k-red-line);
	border-radius: 36px;
}
.travel-products button[disabled] {
	opacity: 0.5;
}
.travel-products .filters button {
	flex: 0 0 60px;
	width: 60px;
	background: linear-gradient(135deg, #b5814d, #8e5e33);
	color: var(--k-paper);
	font-size: 12px;
	font-weight: 600;
}
.travel-products .filters button::after {
	border: 0;
}
.travel-products .product {
	margin-bottom: 8px;
	border-radius: 12px;
}
.travel-products .cover {
	height: 176px;
}
.travel-products .product-copy {
	padding: 10px 12px 12px;
}
.travel-products .title {
	margin-bottom: 4px;
	color: var(--k-ink);
	font-size: 15px;
	font-weight: 600;
	line-height: 21px;
}
.travel-products .meta {
	color: var(--k-muted);
	font-size: 12px;
	line-height: 18px;
}
.travel-products .price-row {
	margin-top: 8px;
}
.travel-products .price {
	color: var(--k-red-deep);
	font-size: 16px;
	font-weight: 700;
}
.travel-products .empty {
	padding: 40px 12px;
	color: var(--k-muted);
	font-size: 13px;
}
.travel-products .empty button {
	width: 120px;
	margin: 12px auto 0;
}
.travel-products .pagination {
	margin-top: 4px;
	color: var(--k-muted);
	font-size: 13px;
}
.travel-products .pagination button {
	width: 96px;
	margin: 0;
}
/* 2026-11-18 看图复查：搜索条和订房首页、房源列表一个样子 —— 整条是一个 36 高的白色胶囊，「查找」小钮嵌在胶囊右边里面
   （看上去 28 高，四周 4px 透明边撑着，可点范围还是 36） */
.travel-products .filters {
	gap: 0;
	height: 36px;
	border-radius: 18px;
	background: var(--k-paper);
}
.travel-products .filters input {
	background: transparent;
}
.travel-products .filters button {
	box-sizing: border-box;
	height: 36px;
	border: 4px solid transparent;
	background: linear-gradient(135deg, #b5814d, #8e5e33) padding-box;
	line-height: 28px;
}
/* 2026-11-18 第二轮精修：没有产品 / 加载中 / 出错时的提示放进白卡（上下 28）；产品卡标题 14 / 600；价格 18 / 700 暖棕、数字等宽 */
.travel-products .empty {
	margin-bottom: 8px;
	padding: 28px 12px;
	border-radius: 12px;
	background: var(--k-paper);
	line-height: 1.6;
}
.travel-products .title {
	font-size: 14px;
	line-height: 20px;
}
.travel-products .price {
	color: var(--k-red);
	font-size: 18px;
	font-variant-numeric: tabular-nums;
}
/* 2026-11-18 第三轮：搜索条左边补 16 号放大镜（和订房首页、房源列表一样）；空状态 / 出错放 56 浅棕方块 + 32 号图标，标题 14 / 500 */
.travel-products .filters { display: flex; align-items: center; gap: 6px; height: 40px; padding: 2px 2px 2px 12px; border-radius: 20px; background: var(--k-paper); box-sizing: border-box; }
.travel-products .filters > .k-icon { flex: 0 0 auto; }
.travel-products .filters input { flex: 1 1 auto; min-width: 0; height: 36px; min-height: 36px; padding: 0; background: transparent; }
.travel-products .filters button { height: 36px; line-height: 36px; }
.travel-products .empty { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.travel-products .r3-empty-ic { width: 56px; height: 56px; margin-bottom: 6px; border-radius: 16px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
/* 11-18 第五轮返修：「查找」按钮去掉透明边框撑出的偏移，文字在按钮正中（高 32，小程序同样生效）。 */
.travel-products .filters button { flex: 0 0 60px; width: 60px; height: 32px; margin: 0 2px 0 0; padding: 0; border: 0; border-radius: 16px; background: var(--k-grad-brown); line-height: 32px; text-align: center; }
/* <<R6-BEGIN>> */
/* 11-18 第四轮：搜索条 36 高，「查找」改文字按钮 13/600 暖棕 + 竖分隔线（和订房首页、首页一样）；
   整页只有空 / 出错时不套白卡，直接放在页面底上、往下挪到约四分之一屏处。 */
.travel-products .filters { height: 36px; padding: 0 0 0 12px; border-radius: 18px; }
.travel-products .filters input { height: 36px; min-height: 36px; }
.travel-products .filters button { position: relative; flex: 0 0 auto; width: auto; height: 36px; margin: 0; padding: 0 14px 0 13px; border: 0; border-radius: 0 18px 18px 0; background: transparent; color: var(--k-red); font-size: 13px; font-weight: 600; line-height: 36px; }
.travel-products .filters button::after { border: 0; }
.travel-products .filters button::before { content: ''; position: absolute; left: 0; top: 11px; bottom: 11px; width: 1px; background: var(--k-line2); transform: scaleX(.5); }
.travel-products .empty { margin: 84px 0 8px; padding: 0 16px; border-radius: 0; background: transparent; gap: 0; }
.travel-products .empty .r3-empty-ic { margin-bottom: 12px; }
.travel-products .empty > text { max-width: 260px; color: var(--k-ink); font-size: 14px; font-weight: 500; line-height: 20px; text-align: center; }
/* 11-19 微信实拍返修：空状态文字和增值服务、核销码页一样用 ink2；「查找」前的竖线改 1px × 16（看得见），和字隔 12。 */
.travel-products .empty > text { color: var(--k-ink2); }
.travel-products .filters button { padding-left: 12px; }
.travel-products .filters button::before { top: 10px; bottom: 10px; transform: none; }
/* <<R6-END>> */
</style>
