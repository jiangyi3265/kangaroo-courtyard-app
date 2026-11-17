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
					><text>{{ states[f.status] }}</text></view
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
.fee-body {
	padding: 18px;
}
.rule {
	padding: 18px;
	background: #f4eee3;
	border-radius: 10px;
}
.rule text {
	display: block;
	font-size: 14px;
	line-height: 1.8;
	color: #6d5944;
}
.rule .heading {
	font-size: 20px;
	font-weight: 600;
	margin-bottom: 10px;
}
.fee {
	padding: 20px 0;
	border-bottom: 1px solid #e9e1d6;
}
.row {
	display: flex;
	justify-content: space-between;
	gap: 14px;
	align-items: center;
	margin: 8px 0;
	font-size: 14px;
}
.title {
	font-size: 17px;
	font-weight: 600;
}
.muted {
	display: block;
	font-size: 13px;
	color: #777;
	line-height: 1.8;
}
.amount {
	font-size: 20px;
	color: #926036;
}
.empty {
	display: block;
	padding: 50px 0;
	text-align: center;
	color: #777;
}
.notice {
	padding: 16px;
	background: #fff0e3;
}
button {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 12px;
	font-size: 14px;
	min-height: 44px;
}
</style>
