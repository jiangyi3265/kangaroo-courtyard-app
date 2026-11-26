<template>
	<view class="k-page point-mall" :class="$userSurface">
		<k-topbar title="积分商城" back />
		<view class="mall-body">
			<view class="mall-heading"
				><view
					><text class="balance">{{ balance ?? '—' }}</text
					><text class="muted"> 可用积分</text></view
				><button @click="switchTab(tab === 'goods' ? 'orders' : 'goods')">
					{{ tab === 'goods' ? '兑换记录' : '逛商城' }}<k-icon name="chevron-right" :size="12" color="red" />
				</button></view
			>
			<view v-if="error" class="notice"
				><text>{{ error }}</text
				><button @click="load">重新加载</button></view
			>
			<text v-if="loading" class="empty">正在加载…</text>
			<template v-else-if="!loadFailed && tab === 'goods'">
				<view v-if="!rows.length" class="empty empty--card"><view class="empty__ico"><k-icon name="gift" :size="32" color="red" /></view><text class="empty__title">商品准备中，上架后可在这里兑换。</text></view>
				<!-- 11-18 第三轮：商品两列排（1:1 照片、标题一行、说明两行、积分 + 剩余同一行），每张卡底部一颗 32 高浅底小按钮（一屏不再排着好几颗实心大按钮） -->
				<view class="goods-grid">
				<view v-for="g in rows" :key="g.goodsId" class="goods">
					<image v-if="g.cover" :src="absUrl(g.cover)" mode="aspectFill" class="cover" />
					<view v-else class="cover cover--empty"><k-icon name="gift" :size="32" color="red" /></view>
					<text class="title">{{ g.title }}</text
					><text class="description">{{ g.description }}</text>
					<text class="muted">{{
						g.deliveryMode === 'shipping'
							? '快递配送，运费已包含'
							: '到店领取 · ' + g.pickupPlace
					}}</text>
					<view class="goods__foot">
					<view class="mall-heading"
						><text class="price">{{ g.pointsCost }} 积分</text
						><text class="muted">剩余 {{ g.stock }} 件</text></view
					>
					<button class="primary" :disabled="!g.stock || busy" @click="choose(g)">
						{{ g.stock ? '兑换一件' : '已兑完' }}
					</button>
					</view>
				</view>
				</view>
			</template>
			<template v-else-if="!loadFailed">
				<text class="mall-sec">兑换记录</text>
				<view v-if="!rows.length" class="empty empty--card"><view class="empty__ico"><k-icon name="receipt-text" :size="32" color="red" /></view><text class="empty__title">还没有兑换记录</text></view>
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
						>{{ o.carrier }} {{ o.trackingNo }}<text class="copy-link"> · 复制单号</text></text
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
import { get, getToken, post } from '@/common/request.js'
import { absUrl } from '@/common/upload.js'
import { modal } from '@/common/ui.js'

const tab = ref('goods'),
	rows = ref([]),
	balance = ref(null),
	total = ref(0),
	page = ref(1)
const loading = ref(false),
	loadFailed = ref(false),
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
let sessionToken = getToken()

async function load() {
	const generation = ++loadGeneration
	const token = getToken()
	if (token !== sessionToken) {
		sessionToken = token
		selected.value = null
		form.value = { recipient: '', phone: '', address: '' }
		submitError.value = ''
		requestKey = ''
	}
	loading.value = true
	loadFailed.value = false
	rows.value = []
	total.value = 0
	balance.value = null
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
		if (generation === loadGeneration) {
			loadFailed.value = true
			error.value = e.message || '加载失败，请重试'
		}
	} finally {
		if (generation === loadGeneration) loading.value = false
	}
}
function switchTab(value) {
	if (loading.value || busy.value) return
	tab.value = value
	page.value = 1
	return load()
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
	busy.value = true
	error.value = ''
	try {
		const confirm = await modal(
			action === 'cancel' ? '取消兑换' : '确认收货',
			action === 'cancel'
				? '取消后将退回 ' + order.pointsCost + ' 积分。'
				: '请确认已经收到商品。'
		)
		if (!confirm.confirm) return
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

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底，每件商品 / 每条兑换记录一张白卡（12 圆角、不描边不加阴影），字和按钮收小一档。
   功能和文字不变：兑换记录 / 逛商城切换、兑换一件、取消兑换、确认收货、翻页、兑换表单都在；积分数字和状态文案不动；输入框 44 高、字 15。 */
.point-mall {
	--k-bg: var(--k-page);
	background: var(--k-page);
}
.point-mall :deep(.k-navbar__title) {
	font-family: var(--k-sans);
	font-size: 16px;
	font-weight: 600;
}
.mall-body {
	padding: 8px 12px 40px;
}
.mall-heading {
	margin: 4px 2px 10px;
}
.mall-heading > button {
	min-height: 36px;
	margin: 0;
	padding: 0 14px;
	border: 1px solid var(--k-red-line);
	background: var(--k-paper);
	color: var(--k-red-deep);
	font-size: 12px;
}
.balance {
	font-family: var(--k-sans);
	font-size: 24px;
	font-weight: 700;
	color: var(--k-ink);
}
.muted {
	font-size: 12px;
	line-height: 1.6;
}
.goods {
	margin-top: 8px;
	padding: 12px;
	border-bottom: 0;
	border-radius: 12px;
	background: var(--k-paper);
}
.goods .mall-heading {
	margin: 6px 0 2px;
}
/* 2026-11-18 评审修正：顶部「可用积分 + 兑换记录」放进一张浅暖色卡（和「我的会员权益」里的积分卡同一组暖色），不再光秃秃摆在灰底上；商品卡、兑换表单里的同名行不受影响 */
.mall-body > .mall-heading {
	margin: 0 0 8px;
	padding: 12px;
	border-radius: 12px;
	background: linear-gradient(105deg, #faebd0, #f0d8ac);
}
.mall-body > .mall-heading .balance {
	color: #5e3d1f;
}
.mall-body > .mall-heading .muted {
	color: #7a5a22;
}
.mall-body > .mall-heading > button {
	border-color: rgba(122, 90, 34, 0.32);
	background: rgba(255, 255, 255, 0.6);
	color: #7a5a22;
}
.cover {
	height: 160px;
	border-radius: 8px;
	margin-bottom: 10px;
}
.title {
	font-size: 14px;
	line-height: 20px;
}
.description {
	margin: 6px 0;
	font-size: 13px;
	line-height: 1.65;
	color: var(--k-ink2);
}
.price {
	font-size: 15px;
	font-weight: 700;
	color: var(--k-red-deep);
}
.status {
	padding: 0 6px;
	border-radius: 4px;
	background: var(--k-ochre-soft);
	color: var(--k-ochre-deep);
	font-size: 11px;
	font-weight: 500;
	line-height: 18px;
}
button {
	min-height: 40px;
	margin: 8px 0 0;
	border-radius: 999px;
	background: var(--k-fill);
	color: var(--k-ink2);
	font-size: 13px;
}
.primary {
	min-height: 40px;
	background: linear-gradient(135deg, #b5814d, #8e5e33);
	color: var(--k-paper);
	font-weight: 600;
}
/* 11-18 第二轮：不可点的按钮保留原配色、整体变淡 .45（不再是冷灰块）；微信给 button[disabled] 自带灰底灰字，这里写全颜色盖回去 */
.primary[disabled] {
	background: linear-gradient(135deg, #b5814d, #8e5e33);
	color: var(--k-paper);
	opacity: 0.45;
}
button[disabled]:not(.primary) {
	background-color: var(--k-fill);
	color: var(--k-ink2);
	opacity: 0.45;
}
.mall-heading > button[disabled] {
	background-color: var(--k-paper);
	color: var(--k-red-deep);
}
/* 商品卡 / 兑换记录卡里的按钮：卡片内主操作 36 高、圆角 18、字 13（兑换表单底部的「确认兑换」仍 44） */
.goods button {
	min-height: 36px;
	border-radius: 18px;
	font-size: 13px;
}
.balance {
	font-variant-numeric: tabular-nums;
}
.status {
	padding: 0 5px;
	font-size: 10px;
	line-height: 17px;
}
/* 没有商品 / 没有兑换记录 / 加载中：白卡里居中的一句灰字 */
.empty {
	margin-top: 8px;
	padding: 28px 12px;
	border-radius: 12px;
	background: var(--k-paper);
	color: var(--k-muted);
	font-size: 12px;
	line-height: 1.6;
}
.notice {
	border-radius: 12px;
	font-size: 13px;
}
.pagination {
	margin-top: 12px;
}
.shade {
	background: rgba(58, 50, 43, 0.45);
}
.redeem-form {
	padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
	background: var(--k-paper);
}
.redeem-form .mall-heading {
	margin: 0 0 6px;
}
.redeem-form .primary {
	min-height: 44px;
	margin-top: 14px;
	font-size: 15px;
}
.label {
	margin: 12px 0 6px;
	font-size: 13px;
}
input,
textarea {
	background: var(--k-page);
	border-radius: 10px;
	font-size: 15px;
	min-height: 44px;
}
/* 11-18 返修：出错提示里的「重新加载」原来是整行灰块，改成和其他页一样的 32 高次按钮小胶囊（白底细棕边深棕字），
   宽度跟着字走、左边和出错文字对齐；上下各 6 的透明边，点按高度 44 */
.notice > button {
	width: fit-content;
	height: 44px;
	min-height: 44px;
	margin: 2px 0 -6px -6px;
	padding: 0 16px;
	border: 6px solid transparent;
	border-radius: 22px;
	background: var(--k-paper) padding-box;
	box-shadow: inset 0 0 0 1px var(--k-red-line);
	color: var(--k-red-deep);
	font-size: 13px;
	font-weight: 500;
	box-sizing: border-box;
}
/* 11-18 第三轮（主人：页面不精致）：
   1) 页边距 16；顶部积分卡：数字 28 / 700 等宽，「兑换记录 / 逛商城」是 28 高的白色半透明小胶囊（不描边），不再比卡里的字还重；
   2) 商品两列：照片 1:1、圆角 8；标题 14 / 600 一行，说明 12 灰两行，配送方式 11 灰一行；积分 15 / 700 暖棕 + 剩余 11 灰；
      底部「兑换一件」32 高浅底深棕小按钮（已兑完整体变淡）；
   3) 空状态：白卡居中，56 浅棕方块 + 32 号线性图标，说明 12 灰 */
.mall-body {
	padding-left: 16px;
	padding-right: 16px;
}
.mall-body > .mall-heading {
	padding: 16px;
}
.mall-body > .mall-heading .balance {
	font-size: 28px;
	font-weight: 700;
	line-height: 34px;
}
.mall-body > .mall-heading > button {
	height: 28px;
	min-height: 28px;
	padding: 0 12px;
	border: 0;
	border-radius: 14px;
	background: rgba(255, 255, 255, 0.7);
	color: var(--k-red-deep);
	font-size: 12px;
	font-weight: 500;
	line-height: 28px;
}
.goods-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
	margin-top: 8px;
}
.goods-grid > .goods {
	display: flex;
	flex-direction: column;
	min-width: 0;
	margin: 0;
	padding: 8px 8px 10px;
}
.goods-grid .cover {
	width: 100%;
	height: auto;
	aspect-ratio: 1 / 1;
	margin: 0 0 8px;
	border-radius: 8px;
}
.goods-grid .cover--empty {
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--k-red-soft);
}
.goods-grid .title {
	padding: 0 4px;
	font-size: 14px;
	font-weight: 600;
	line-height: 20px;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.goods-grid .description {
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
	margin: 2px 0 0;
	padding: 0 4px;
	white-space: normal;
	font-size: 12px;
	line-height: 17px;
	color: var(--k-ink2);
}
.goods-grid .goods > .muted {
	margin-top: 4px;
	padding: 0 4px;
	font-size: 11px;
	line-height: 16px;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.goods-grid .mall-heading {
	flex-wrap: wrap;
	align-items: baseline;
	gap: 0 6px;
	margin: auto 0 0;
	padding: 6px 4px 0;
}
.goods-grid .price {
	font-size: 15px;
	font-weight: 700;
	line-height: 21px;
	color: var(--k-red);
	font-variant-numeric: tabular-nums;
}
.goods-grid .mall-heading .muted {
	font-size: 11px;
	line-height: 16px;
}
.goods-grid .goods > button {
	height: 32px;
	min-height: 32px;
	margin: 8px 0 0;
	border-radius: 16px;
	background: var(--k-red-soft);
	color: var(--k-red-deep);
	font-size: 13px;
	font-weight: 500;
}
.empty--card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 32px 16px 28px;
}
.empty__ico {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 56px;
	height: 56px;
	margin-bottom: 12px;
	border-radius: 16px;
	background: var(--k-red-soft);
}
.empty--card > text {
	font-size: 12px;
	line-height: 1.6;
	color: var(--k-muted);
}
@media (max-width: 359px) {
	.goods-grid .mall-heading {
		flex-direction: column;
		align-items: flex-start;
	}
}
/* 11-18 第三轮返修：
   · 商品卡：照片贴满卡顶（只留上方 12 圆角），下面内容统一左右 12，按钮也缩到 12 —— 卡里只有一条左线；标题最多两行，说明一行；
   · 积分大卡到商品网格 16，和商品卡之间的 8 分开；
   · 兑换记录：商品信息下面一道发丝线，收件信息 13 / 400 二级墨、行距 8；「复制单号」是暖棕 12 号文字按钮；
   · 空状态：14 / 500 标题 + 12 号说明，和草稿箱、关注页一个样子 */
.goods-grid { margin-top: 16px; }
.goods-grid > .goods { padding: 0 0 12px; overflow: hidden; }
.goods-grid .cover { margin: 0 0 10px; border-radius: 12px 12px 0 0; }
.goods-grid .title, .goods-grid .description, .goods-grid .goods > .muted, .goods-grid .mall-heading { padding-left: 12px; padding-right: 12px; }
.goods-grid .title { display: block; max-height: 40px; white-space: normal; text-overflow: clip; overflow: hidden; }
.goods-grid .description { -webkit-line-clamp: 1; }
.goods-grid .goods > button { margin: 10px 12px 0; }
.mall-body > .goods > .muted + .description { position: relative; margin-top: 10px; padding-top: 10px; }
.mall-body > .goods > .muted + .description::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
.mall-body > .goods > .description { font-size: 13px; font-weight: 400; line-height: 20px; color: var(--k-ink2); }
.mall-body > .goods > .description + .description { margin-top: 8px; }
.copy-link { margin-left: 4px; font-size: 12px; font-weight: 500; color: var(--k-red); }
.empty--card > .empty__title { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.empty--card > .empty__title + text { margin-top: 4px; }
/* 11-18 返修（第 2 轮）：
   · 商品标题一行、超出省略（和下面的说明、配送行一样都是一行），同一排两张卡的结构一样高、按钮在一条线上；
   · 「已兑完」：浅灰底（--k-line）+ 灰字 12 / 500，不再整体变淡到几乎看不见；
   · 兑换记录里的按钮（确认收货 / 取消兑换）：卡内右对齐、32 高的小胶囊，不再是满宽 40 高的渐变大按钮压过上面的积分卡 */
.goods-grid .title { max-height: none; white-space: nowrap; text-overflow: ellipsis; }
.goods-grid .goods > button[disabled] { opacity: 1; background: var(--k-line); color: var(--k-muted); font-size: 12px; font-weight: 500; }
.mall-body > .goods > button { display: flex; align-items: center; justify-content: center; width: auto; max-width: max-content; height: 32px; min-height: 32px; margin: 12px 0 0 auto; padding: 0 16px; border-radius: 16px; font-size: 13px; font-weight: 500; line-height: 32px; }
.mall-body > .goods > button.primary { background: var(--k-red); color: var(--k-paper); }
.mall-body > .goods > button.primary[disabled] { background: var(--k-red); color: var(--k-paper); }
/* 11-18 第三轮返修（第 3 轮）：
   · 积分卡到下面的内容一律 20（商品、空状态、加载中、兑换记录都一样）；
   · 兑换记录视图积分卡下面有区块标题「兑换记录」（16 / 700，下 12），一看就知道在看哪一页；
   · 商品卡：「兑换一件」缩成 28 高小胶囊放在积分右边（积分下面一行是剩余件数），一屏不再排着四颗满宽按钮；说明 12 号最多两行（两行高度固定，同排卡一样高）。
     320 宽放不下时按钮在积分下面占满卡宽，仍是 28 高。 */
.goods-grid, .mall-body > .empty, .mall-body > .empty--card { margin-top: 20px; }
.mall-sec { display: block; margin: 20px 2px 12px; font-size: 16px; font-weight: 700; line-height: 22px; color: var(--k-ink); }
.mall-sec + .goods, .mall-sec + .empty--card { margin-top: 0; }
.goods-grid .description { -webkit-line-clamp: 2; height: 34px; }
.goods__foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin-top: auto; padding: 8px 12px 0; }
.goods-grid .goods__foot .mall-heading { flex-direction: column; align-items: flex-start; gap: 0; min-width: 0; margin: 0; padding: 0; }
.goods-grid .goods__foot > button { flex: 0 0 auto; width: auto; height: 28px; min-height: 28px; margin: 0; padding: 0 12px; border-radius: 14px; font-size: 12px; font-weight: 500; line-height: 28px; }
.goods-grid > .goods { padding-bottom: 12px; }
@media (max-width: 359px) {
	.goods__foot { flex-direction: column; align-items: stretch; gap: 8px; }
	.goods-grid .goods__foot .mall-heading { flex-direction: column; align-items: flex-start; }
}
.goods-grid .goods__foot > button.primary { background: var(--k-red-soft); color: var(--k-red-deep); }
.goods-grid .goods__foot > button.primary[disabled] { opacity: 1; background: var(--k-line); color: var(--k-muted); }
/* 11-18 第三轮返修（第 4 轮）：积分卡离顶栏 12（和钱包、设置、关注、订阅一样）；区块标题「兑换记录」和卡片同一条左线（页边 16）；
   兑换状态标签 11 / 500、18 高；「· 复制单号」前面不再多空 4，圆点两边一样宽 */
.mall-body { padding-top: 12px; }
.mall-sec { margin-left: 0; margin-right: 0; }
.mall-body .status { height: 18px; padding: 0 6px; font-size: 11px; font-weight: 500; line-height: 18px; }
.copy-link { margin-left: 0; }
/* 11-18 第三轮返修（第 5 轮）：商品标题最多两行（「小院明信片一套（6 张）」不再断在括号里）；同排两张卡按格子行等高，积分和按钮仍压在卡底 */
.goods-grid .title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; max-height: 40px; white-space: normal; text-overflow: clip; overflow: hidden; }
/* 11-18 第四轮（高级感）：积分卡去掉渐变底，做成页头 —— 大数字 32 / 700 等宽 +「可用积分」12 灰，左对齐；
   右边「兑换记录 / 逛商城」改成 13 / 500 暖棕文字链接 + 12 号箭头（不再是白胶囊）。整页只有积分数字一个焦点。
   商品为空时不套卡：一整句「商品准备中，上架后可在这里兑换。」14 / 500 二级墨居中，放在屏高约 1/3 处。 */
.mall-body > .mall-heading { align-items: flex-end; min-height: 72px; padding: 8px 0 4px; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.mall-body > .mall-heading .balance { font-size: 32px; font-weight: 700; line-height: 40px; color: var(--k-ink); font-variant-numeric: tabular-nums; }
.mall-body > .mall-heading .muted { font-size: 12px; line-height: 17px; color: var(--k-muted); }
.mall-body > .mall-heading > button { display: flex; align-items: center; gap: 2px; height: 32px; min-height: 32px; margin: 0 0 4px; padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--k-red-deep); font-size: 13px; font-weight: 500; line-height: 32px; }
.mall-body > .mall-heading > button::after { border: 0; }
.mall-body > .empty--card { margin-top: 72px; padding: 0 16px; border-radius: 0; background: transparent; }
.mall-body > .empty--card > .empty__title { max-width: 264px; font-size: 14px; font-weight: 500; line-height: 1.6; color: var(--k-ink2); text-align: center; }
.mall-sec + .empty--card { margin-top: 0; padding: 32px 16px; border-radius: 12px; background: var(--k-paper); }
/* 11-18 第四轮返修：领取说明（「到店领取 · 平潭袋鼠小院前台」）最多两行，地点不再被省略或贴着卡边；320 宽商品说明最多三行；标题、说明、领取说明只在标点、空格处折行（「手冲」「小院」不再被拆开） */
.goods-grid .goods > .muted { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; white-space: normal; overflow: hidden; text-overflow: clip; overflow-wrap: anywhere; }
.goods-grid .title, .goods-grid .description, .goods-grid .goods > .muted { word-break: keep-all; overflow-wrap: anywhere; }
@media (max-width: 359px) {
	.goods-grid .description { -webkit-line-clamp: 3; height: 51px; }
}
/* 11-19 微信实拍返修：页头单独成一块 —— 下面留 16 再一道发丝线；「兑换记录 / 逛商城」顶对齐，和大数字那一行的中线对齐（数字行 40 高、链接 32 高，上 4）；
   空状态离上一个元素 88（和团队报表、消息提醒的整页状态同一个位置） */
.mall-body > .mall-heading { position: relative; align-items: flex-start; padding-bottom: 16px; }
.mall-body > .mall-heading::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 100%; }
.mall-body > .mall-heading > button { align-self: flex-start; margin: 4px 0 0; }
.mall-body > .empty--card { margin-top: 88px; }
</style>
