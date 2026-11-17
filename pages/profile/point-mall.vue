<template>
	<view class="k-page point-mall">
		<k-topbar title="积分商城" back />
		<view class="mall-body">
			<view class="mall-heading"
				><view
					><text class="balance">{{ balance ?? '—' }}</text
					><text class="muted"> 可用积分</text></view
				><button @click="switchTab(tab === 'goods' ? 'orders' : 'goods')">
					{{ tab === 'goods' ? '兑换记录' : '逛商城' }}
				</button></view
			>
			<view v-if="error" class="notice"
				><text>{{ error }}</text
				><button @click="load">重新加载</button></view
			>
			<text v-if="loading" class="empty">正在加载…</text>
			<template v-else-if="tab === 'goods'">
				<text v-if="!rows.length" class="empty">商品准备中，上架后可在这里兑换。</text>
				<view v-for="g in rows" :key="g.goodsId" class="goods">
					<image v-if="g.cover" :src="absUrl(g.cover)" mode="aspectFill" class="cover" />
					<text class="title">{{ g.title }}</text
					><text class="description">{{ g.description }}</text>
					<text class="muted">{{
						g.deliveryMode === 'shipping'
							? '快递配送，运费已包含'
							: '到店领取 · ' + g.pickupPlace
					}}</text>
					<view class="mall-heading"
						><text class="price">{{ g.pointsCost }} 积分</text
						><text class="muted">剩余 {{ g.stock }} 件</text></view
					>
					<button class="primary" :disabled="!g.stock || busy" @click="choose(g)">
						{{ g.stock ? '兑换一件' : '已兑完' }}
					</button>
				</view>
			</template>
			<template v-else>
				<text v-if="!rows.length" class="empty">还没有兑换记录</text>
				<view v-for="o in rows" :key="o.orderId" class="goods">
					<view class="mall-heading"
						><text class="title">{{ o.title }}</text
						><text class="status">{{ states[o.status] }}</text></view
					>
					<text class="muted">兑换编号 {{ o.orderId }} · {{ o.pointsCost }} 积分</text>
					<text class="muted">{{ o.createTime }}</text>
					<text class="description">{{ o.recipient }} {{ o.phone }}</text>
					<text class="description">{{
						o.deliveryMode === 'shipping' ? o.address : '领取地点 ' + o.pickupPlace
					}}</text>
					<text v-if="o.trackingNo" class="description" @click="copy(o.trackingNo)"
						>{{ o.carrier }} {{ o.trackingNo }} · 复制单号</text
					>
					<text v-if="o.handleNote" class="muted">{{ o.handleNote }}</text>
					<button
						v-if="o.status === 'pending'"
						:disabled="busy"
						@click="command(o, 'cancel')"
					>
						取消兑换并退回积分
					</button>
					<button
						v-if="o.status === 'shipped'"
						class="primary"
						:disabled="busy"
						@click="command(o, 'receive')"
					>
						确认收货
					</button>
				</view>
			</template>
			<view v-if="total > 20" class="pagination"
				><button :disabled="page === 1 || loading" @click="changePage(-1)">上一页</button
				><text>{{ page }}</text
				><button :disabled="page * 20 >= total || loading" @click="changePage(1)">
					下一页
				</button></view
			>
			<view v-if="selected" class="shade" @click="closeForm"
				><view class="redeem-form" @click.stop>
					<view class="mall-heading"
						><text class="title">兑换 {{ selected.title }}</text
						><button :disabled="busy" @click="closeForm">关闭</button></view
					>
					<text class="price">扣除 {{ selected.pointsCost }} 积分 · 1件</text>
					<text class="muted">{{
						selected.deliveryMode === 'shipping'
							? '请核对收货信息，商品寄出前可取消兑换。'
							: '领取地点 ' + selected.pickupPlace
					}}</text>
					<text class="label">领取人姓名</text
					><input v-model="form.recipient" maxlength="40" placeholder="填写真实姓名" />
					<text class="label">联系电话</text
					><input
						v-model="form.phone"
						type="text"
						maxlength="24"
						placeholder="方便联系配送或领取"
					/>
					<template v-if="selected.deliveryMode === 'shipping'"
						><text class="label">收货地址</text
						><textarea
							v-model="form.address"
							maxlength="300"
							placeholder="省市区、街道和门牌号"
						/>
					</template>
					<text v-if="submitError" class="notice">{{ submitError }}</text>
					<button
						class="primary"
						:loading="busy"
						:disabled="
							busy ||
							!form.recipient.trim() ||
							!form.phone.trim() ||
							(selected.deliveryMode === 'shipping' && form.address.trim().length < 5)
						"
						@click="redeem"
					>
						确认兑换
					</button>
				</view></view
			>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get, post } from '@/common/request.js'
import { absUrl } from '@/common/upload.js'
import { modal } from '@/common/ui.js'

const tab = ref('goods'),
	rows = ref([]),
	balance = ref(null),
	total = ref(0),
	page = ref(1)
const loading = ref(false),
	busy = ref(false),
	error = ref(''),
	submitError = ref(''),
	selected = ref(null)
const form = ref({ recipient: '', phone: '', address: '' })
const states = {
	pending: '待发货 / 领取',
	shipped: '已发货',
	completed: '已完成',
	cancelled: '已取消并退还积分'
}
let requestKey = ''
let loadGeneration = 0

async function load() {
	const generation = ++loadGeneration
	loading.value = true
	error.value = ''
	try {
		const [catalog, account] = await Promise.all([
			get('/app/point-mall/' + tab.value, { pageNum: page.value }),
			get('/app/point-mall/balance')
		])
		if (generation !== loadGeneration) return
		rows.value = catalog.data.rows
		total.value = catalog.data.total
		balance.value = account.data.balance
	} catch (e) {
		if (generation === loadGeneration) error.value = e.message || '加载失败，请重试'
	} finally {
		if (generation === loadGeneration) loading.value = false
	}
}
function switchTab(value) {
	if (loading.value || busy.value) return
	tab.value = value
	page.value = 1
	load()
}
function changePage(step) {
	page.value += step
	load()
}
function choose(goods) {
	selected.value = goods
	submitError.value = ''
	requestKey = 'mall_' + Date.now() + '_' + Math.random().toString(36).slice(2)
}
function closeForm() {
	if (!busy.value) selected.value = null
}
async function redeem() {
	if (busy.value || !selected.value) return
	busy.value = true
	submitError.value = ''
	try {
		await post('/app/point-mall/goods/' + selected.value.goodsId + '/redeem', {
			...form.value,
			requestKey,
			pointsCost: selected.value.pointsCost
		})
		selected.value = null
		tab.value = 'orders'
		page.value = 1
		await load()
	} catch (e) {
		submitError.value = e.message || '提交失败，请重试。同一次提交会保留兑换编号。'
	} finally {
		busy.value = false
	}
}
async function command(order, action) {
	if (busy.value) return
	const confirm = await modal(
		action === 'cancel' ? '取消兑换' : '确认收货',
		action === 'cancel'
			? '取消后将退回 ' + order.pointsCost + ' 积分。'
			: '请确认已经收到商品。'
	)
	if (!confirm.confirm) return
	busy.value = true
	error.value = ''
	try {
		await post('/app/point-mall/orders/' + order.orderId + '/' + action, {})
		await load()
	} catch (e) {
		error.value = e.message || '操作失败，请重试'
	} finally {
		busy.value = false
	}
}
function copy(value) {
	uni.setClipboardData({ data: value })
}
onShow(load)
</script>

<style scoped lang="scss">
.mall-body {
	padding: 18px 18px 40px;
}
.mall-heading {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 12px;
	margin: 8px 0 16px;
}
.balance {
	font-size: 32px;
	font-weight: 600;
}
.muted {
	display: block;
	color: var(--k-muted, #777);
	font-size: 13px;
	line-height: 1.7;
}
.goods {
	padding: 18px 0;
	border-bottom: 1px solid #e6e0d6;
}
.cover {
	width: 100%;
	height: 190px;
	border-radius: 12px;
	margin-bottom: 12px;
}
.title {
	font-size: 18px;
	font-weight: 600;
	display: block;
}
.description {
	display: block;
	white-space: pre-wrap;
	font-size: 15px;
	line-height: 1.7;
	margin: 10px 0;
}
.price {
	font-size: 18px;
	color: #926036;
}
.status {
	font-size: 13px;
	color: #926036;
	flex-shrink: 0;
}
button {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 12px;
	font-size: 14px;
	min-height: 44px;
	margin: 8px 0;
	border-radius: 8px;
	background: #f3eee5;
	color: #4c3b2c;
}
button::after {
	border: 0;
}
.primary {
	background: #93633f;
	color: white;
	min-height: 48px;
}
.primary[disabled] {
	opacity: 0.5;
}
.empty {
	display: block;
	text-align: center;
	padding: 56px 8px;
	color: #777;
}
.notice {
	display: block;
	padding: 12px;
	background: #fff1e7;
	color: #8b4225;
	font-size: 14px;
	line-height: 1.6;
}
.pagination {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 20px;
}
.shade {
	position: fixed;
	inset: 0;
	background: #0007;
	z-index: 80;
	display: flex;
	align-items: flex-end;
}
.redeem-form {
	width: 100%;
	box-sizing: border-box;
	max-height: 85vh;
	overflow-y: auto;
	background: #fffdf8;
	padding: 20px 20px calc(20px + env(safe-area-inset-bottom));
	border-radius: 16px 16px 0 0;
}
.label {
	display: block;
	margin: 16px 0 6px;
	font-size: 14px;
}
input,
textarea {
	box-sizing: border-box;
	width: 100%;
	background: #f3f0ea;
	border-radius: 6px;
	padding: 12px;
	font-size: 16px;
	min-height: 48px;
}
textarea {
	height: 88px;
}
</style>
