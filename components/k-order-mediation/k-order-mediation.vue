<template>
	<view v-if="existingCaseId || eligible || reason" class="order-mediation"><k-button v-if="existingCaseId || eligible" type="secondary" block round icon="scale" :label="existingCaseId ? '查看调解进度' : '纠纷调解'" @click="open" /><text v-if="existingCaseId" class="order-mediation__note">{{ existingCaseStatus === 'closed' ? '调解已结束，可查看处理记录与结果' : '已提交调解，可查看进度或补充材料' }}</text><text v-else-if="reason" class="order-mediation__note">{{ reason }}</text></view>
</template>
<script setup>
import { ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/common/request.js'
import { go } from '@/common/screen.js'
const props = defineProps({
	orderType: { type: String, required: true },
	orderId: { type: [String, Number], default: null },
	merchant: { type: Boolean, default: false }
})
const eligible = ref(false)
const existingCaseId = ref(0), existingCaseStatus = ref('')
// 调解已结案（服务端 eligible=false 带 reason）：不给按钮，写一句原因
const reason = ref('')
let generation = 0
async function check() {
	const type = props.orderType,
		id = props.orderId
	const request = ++generation
	eligible.value = false
	existingCaseId.value = 0
	existingCaseStatus.value = ''
	reason.value = ''
	if (!id) return
	try {
		const r = await get('/app/governance/order', { type, id })
		if (request === generation) {
			eligible.value = r.data?.eligible === true
			existingCaseId.value = Number(r.data?.existingCaseId) || 0
			existingCaseStatus.value = String(r.data?.existingCaseStatus || '')
			reason.value = eligible.value ? '' : String(r.data?.reason || '')
		}
	} catch (e) {
		/* 订单是否符合调解范围由服务端判断。 */
	}
}
watch(() => [props.orderType, props.orderId], check, { immediate: true })
onShow(check)
function open() {
	if (existingCaseId.value) return go('/pages/governance/mediation?id=' + existingCaseId.value)
	go(
			'/pages/governance/mediation?orderType=' +
			encodeURIComponent(props.orderType) +
			'&orderId=' +
			encodeURIComponent(props.orderId) +
			(props.merchant ? '&orderRole=merchant' : '')
	)
}
</script>
<style scoped>
.order-mediation {
	margin: 12px 18px;
}
.order-mediation__note {
	display: block;
	text-align: center;
	font-size: 12px;
	line-height: 1.6;
	color: var(--k-muted);
}
</style>
