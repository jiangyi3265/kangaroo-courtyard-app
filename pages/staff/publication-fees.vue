<template>
	<view class="k-page"
		><k-topbar title="任务发布费用" back /><view class="fee-body">
			<view class="rule"
				><text class="heading">{{
					config.enabled === '1' ? '当前每条 ¥' + yuan(config.amountFen) : '当前免费发布'
				}}</text
				><text>提交时确认单价，审核上架后计费。同一任务修改、恢复上架沿用原费用。</text
				><text>实际付款后由平台核对并登记收款，可在下方查看状态和凭证编号。</text></view
			>
			<view v-if="error" class="notice"
				><text>{{ error }}</text
				><button @click="load">重新加载</button></view
			>
			<text v-if="loading" class="empty">正在加载…</text
			><text v-else-if="!rows.length" class="empty">还没有任务发布费用记录</text>
			<view v-for="f in rows" :key="f.feeId" class="fee"
				><view class="row"
					><text class="title">{{ f.title }}</text
					><text class="fee__state">{{ states[f.status] }}</text></view
				><view class="row"
					><text>任务 {{ f.jobId }}</text
					><text class="amount">¥{{ yuan(f.amountFen) }}</text></view
				><text class="muted">{{ f.createTime }}</text
				><text v-if="f.receiptNo" class="muted">收款凭证 {{ f.receiptNo }}</text
				><text v-if="f.note" class="muted">{{ f.note }}</text></view
			>
			<view v-if="total > 20" class="row"
				><button :disabled="page === 1 || loading" @click="changePage(-1)">上一页</button
				><text>{{ page }}</text
				><button :disabled="page * 20 >= total || loading" @click="changePage(1)">
					下一页
				</button></view
			>
		</view></view
	>
</template>
<script setup>
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { get } from '@/common/request.js'
import { ensureSession, currentStaffStoreId } from '@/common/experience.js'
import { yuan } from '@/common/ui.js'
const config = ref({}),
	rows = ref([]),
	page = ref(1),
	total = ref(0),
	loading = ref(false),
	error = ref('')
const states = {
	pending: '待审核计费',
	due: '待付款',
	paid: '已收款',
	free: '免费发布',
	waived: '已减免',
	void: '未上架，已作废'
}
let storeId
let loadGeneration = 0
async function load() {
	const generation = ++loadGeneration
	loading.value = true
	error.value = ''
	try {
		await ensureSession()
		const r = await get('/app/staff/publication-fees', {
			storeId: storeId || currentStaffStoreId(),
			pageNum: page.value
		})
		if (generation !== loadGeneration) return
		config.value = r.data.config
		rows.value = r.data.rows
		total.value = r.data.total
	} catch (e) {
		if (generation === loadGeneration) error.value = e.message || '加载失败，请重试'
	} finally {
		if (generation === loadGeneration) loading.value = false
	}
}
function changePage(step) {
	page.value += step
	load()
}
onLoad((q) => {
	storeId = q.storeId
})
onShow(load)
</script>
<style scoped>
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边、不加阴影），页边距 12、卡片之间 8；
   顶上的计费说明是一张很浅的暖色卡；每条费用一张白卡，金额用主色；颜色都换成主题变量。文字、金额、状态原样不动 */
.k-page {
	--k-bg: #f7f5f2;
	background: #f7f5f2;
}
.k-page :deep(.k-navbar__title) {
	font-family: var(--k-sans);
	font-size: 16px;
	font-weight: 600;
}
.fee-body {
	padding: 8px 12px calc(24px + var(--k-safe-bottom));
}
.rule {
	padding: 12px;
	background: linear-gradient(180deg, #fff8ee, var(--k-paper));
	border-radius: 12px;
}
.rule text {
	display: block;
	font-size: 12px;
	line-height: 1.7;
	color: var(--k-muted);
}
.rule .heading {
	font-size: 16px;
	font-weight: 700;
	line-height: 22px;
	margin-bottom: 6px;
	color: var(--k-ink);
}
.fee {
	margin-top: 8px;
	padding: 12px;
	border-radius: 12px;
	background: var(--k-paper);
}
.row {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	align-items: center;
	margin: 0 0 6px;
	font-size: 12px;
	color: var(--k-ink2);
}
.title {
	min-width: 0;
	font-size: 14px;
	font-weight: 600;
	line-height: 20px;
	color: var(--k-ink);
	overflow-wrap: anywhere;
}
.muted {
	display: block;
	font-size: 11px;
	color: var(--k-muted);
	line-height: 1.7;
}
/* 价格（11-18 第二轮精修）：18 / 700 暖棕，等宽数字 */
.amount {
	flex-shrink: 0;
	font-size: 18px;
	font-weight: 700;
	color: var(--k-red);
	font-variant-numeric: tabular-nums;
}
/* 状态（待付款 / 已收款 / 已减免 / 未上架，已作废）：中性小标签，一眼看出是状态 */
.fee__state {
	flex-shrink: 0;
	height: 17px;
	padding: 0 5px;
	border-radius: 4px;
	background: #f5f1eb;
	font-size: 10px;
	font-weight: 500;
	line-height: 17px;
	color: var(--k-ink2);
	white-space: nowrap;
}
/* 空状态 / 读取中：白卡里居中，14 / 500 二级墨，上下留白 28 */
.empty {
	display: block;
	margin-top: 8px;
	padding: 28px 16px;
	border-radius: 12px;
	background: var(--k-paper);
	text-align: center;
	font-size: 14px;
	font-weight: 500;
	line-height: 1.6;
	color: var(--k-ink2);
}
.notice {
	margin-top: 8px;
	padding: 12px;
	border-radius: 12px;
	background: var(--k-alert-soft);
	font-size: 13px;
	color: var(--k-alert);
}
/* 重新加载、上一页 / 下一页：白底细边的胶囊，点击高度仍是 44 */
button {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 16px;
	border: 1px solid var(--k-red-line);
	border-radius: 999px;
	background: var(--k-paper);
	font-size: 13px;
	color: var(--k-red-deep);
	min-height: 44px;
}
button[disabled] {
	opacity: 0.45;
}
.notice button {
	margin-top: 8px;
}
.fee-body > .row {
	margin: 12px 0 0;
	font-size: 13px;
}
</style>
