<template>
  <view class="k-page ae-page">
    <k-topbar title="导出到店名单" back />
    <view class="k-body k-pad-bottom ae-body">
      <text class="ae-lead">选好时间就能导出：姓名、身份证号、手机号、去哪家、开始和结束时间，订票、买保险直接用。</text>

      <!-- 一键选时间 -->
      <view class="ae-section"><text>选择时间</text><text class="ae-meta">按开始时间（到店日期）筛</text></view>
      <view class="ae-chips">
        <view v-for="r in RANGES" :key="r.key" class="ae-chip" :class="{ on: rangeKey === r.key }" role="button" hover-class="k-press-s" @click="pickRange(r.key)"><text>{{ r.label }}</text></view>
      </view>
      <view v-if="rangeKey === 'custom'" class="ae-custom">
        <view class="ae-date" role="button" hover-class="k-press-s" @click="picking = 'from'"><text>开始</text><text>{{ customFrom || '选择日期' }}</text><k-icon name="calendar-days" :size="18" color="ink" /></view>
        <view class="ae-date" role="button" hover-class="k-press-s" @click="picking = 'to'"><text>结束</text><text>{{ customTo || '选择日期' }}</text><k-icon name="calendar-days" :size="18" color="ink" /></view>
      </view>
      <text v-if="range" class="ae-range">{{ rangeText(range.from, range.to) }}</text>

      <!-- 名单范围、门店 -->
      <view class="ae-section"><text>名单范围</text></view>
      <view class="ae-chips">
        <view v-for="o in SCOPES" :key="o.key" class="ae-chip" :class="{ on: scope === o.key }" role="button" hover-class="k-press-s" @click="pickScope(o.key)"><text>{{ o.label }}</text></view>
      </view>
      <view v-if="stores.length > 1" class="ae-store" role="button" hover-class="k-press-s" @click="pickStore"><text>门店</text><text>{{ storeLabel }}</text><k-icon name="chevron-down" :size="16" color="ink" /></view>

      <!-- 预览（证件号、手机号都打码） -->
      <view class="ae-card">
        <view v-if="state === 'loading'" class="ae-empty"><text>正在统计名单…</text></view>
        <view v-else-if="state === 'failed'" class="ae-empty"><text>{{ error }}</text><k-button type="outline" size="md" label="重新统计" @click="loadPreview" /></view>
        <view v-else-if="state === 'idle'" class="ae-empty"><text>先选一个时间</text></view>
        <template v-else>
          <view class="ae-total"><text class="ae-total__num">{{ preview.count }}</text><text>人</text><text v-if="preview.missingId" class="ae-missing">其中 {{ preview.missingId }} 人还没交身份证号（表里写「未提交」）</text><text v-else-if="preview.count" class="ae-ok">身份证号都交齐了</text></view>
          <text v-if="preview.tooMany" class="ae-warn">人数太多，请缩小日期范围分几次导出</text>
          <view v-for="row in preview.rows" :key="row.appId" class="ae-row">
            <view class="ae-row__head"><text class="ae-row__name">{{ row.name || '未填姓名' }}</text><text class="ae-row__id" :class="{ miss: !row.idSubmitted }">{{ row.idNo }}</text></view>
            <text class="ae-row__line">{{ [row.storeName, row.jobTitle].filter(Boolean).join(' · ') }}</text>
            <text class="ae-row__line">{{ row.start || '日期待定' }}{{ row.end ? ' 至 ' + row.end : '' }} · {{ row.status }}</text>
          </view>
          <text v-if="preview.count > preview.rows.length" class="ae-more">只预览前 {{ preview.rows.length }} 人，导出的表格里是全部 {{ preview.count }} 人</text>
          <view v-if="!preview.count" class="ae-empty"><text>这段时间没有要到店的报名</text></view>
        </template>
      </view>
      <view class="ae-note"><k-icon name="lock-keyhole" :size="16" color="muted" /><text>表格里是完整身份证号和手机号，只用于订票、买保险，请勿外传；每次导出都会记在「操作与权限日志」里。</text></view>
    </view>
    <k-bottom flat><view class="k-flex1"><k-button block icon="file-down" :disabled="!canExport" :label="exporting ? '正在导出…' : '一键导出 Excel'" @click="doExport" /></view></k-bottom>
    <k-date-picker v-if="picking" :title="picking === 'from' ? '选择开始日期' : '选择结束日期'" :value="picking === 'from' ? customFrom : customTo" :min-date="picking === 'to' ? customFrom : ''" @cancel="picking = ''" @confirm="confirmDate" />
  </view>
</template>

<script setup>
// 到店名单导出（2026-11-03 主人：「投递简历多的当地主理人，可以一键选择时间，一键导出」）。
// 谁能用：「岗位管理·导出」有权限的门店（换工主理人、城市负责人），服务端 KgApplicantExportService 把关并记日志；没有权限时页面显示服务端的原因。
// 预览只给打码的证件号、手机号；导出走 downloadFile（登录凭证在请求头，链接里只有日期和门店编号），小程序里打开后右上角可转发到微信。
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { toast } from '@/common/screen.js'
import { get } from '@/common/request.js'
import { ensureSession } from '@/common/experience.js'
import { sheet, todayCn } from '@/common/ui.js'
import { downloadDoc } from '@/common/upload.js'
import { RANGES, SCOPES, PREVIEW_URL, rangeOf, rangeText, rangeError, exportQuery, exportPath, exportFileName } from './applicant-export.js'

const rangeKey = ref('thisMonth')
const customFrom = ref('')
const customTo = ref('')
const picking = ref('')
const scope = ref('active')
const storeId = ref(0)
// 能导出的门店（第一次「全部门店」统计时服务端给的），选了单家门店后还用这份列表
const stores = ref([])
const preview = ref({ count: 0, missingId: 0, rows: [] })
// idle 还没选时间 / loading / ready / failed
const state = ref('idle')
const error = ref('')
const exporting = ref(false)

const range = computed(() => {
  if (rangeKey.value !== 'custom') return rangeOf(rangeKey.value, todayCn())
  return rangeError(customFrom.value, customTo.value) ? null : { from: customFrom.value, to: customTo.value }
})
const storeLabel = computed(() => {
  const hit = stores.value.find((s) => Number(s.storeId) === Number(storeId.value))
  return hit ? hit.storeName : '全部门店（' + stores.value.length + ' 家）'
})
const canExport = computed(() => state.value === 'ready' && preview.value.count > 0 && !preview.value.tooMany && !exporting.value)

let seq = 0
async function loadPreview() {
  if (!range.value) { state.value = 'idle'; return }
  const mine = ++seq
  state.value = 'loading'
  try {
    const res = await get(PREVIEW_URL, exportQuery({ ...range.value, scope: scope.value, storeId: storeId.value }))
    if (mine !== seq) return
    preview.value = Object.assign({ count: 0, missingId: 0, rows: [] }, (res && res.data) || {})
    if (!storeId.value) stores.value = preview.value.stores || []
    state.value = 'ready'
  } catch (e) {
    if (mine !== seq) return
    error.value = (e && e.message) || '统计失败，请稍后重试'
    state.value = 'failed'
  }
}

function pickRange(key) {
  rangeKey.value = key
  if (key === 'custom') {
    // 自定义：默认先填上今天到 30 天后，再点开改
    if (!customFrom.value) { const r = rangeOf('next30', todayCn()); customFrom.value = r.from; customTo.value = r.to }
  }
  loadPreview()
}
function confirmDate(value) {
  if (picking.value === 'from') {
    customFrom.value = value
    if (customTo.value && customTo.value < value) customTo.value = value
  } else {
    customTo.value = value
  }
  picking.value = ''
  const err = rangeError(customFrom.value, customTo.value)
  if (err) { toast(err); state.value = 'idle'; return }
  loadPreview()
}
function pickScope(key) {
  scope.value = key
  loadPreview()
}
async function pickStore() {
  const list = [{ storeId: 0, storeName: '全部门店' }].concat(stores.value)
  const i = await sheet(list.map((s) => s.storeName))
  if (i < 0) return
  storeId.value = Number(list[i].storeId) || 0
  loadPreview()
}
async function doExport() {
  if (!canExport.value || !range.value) return
  exporting.value = true
  try {
    await downloadDoc(exportPath({ ...range.value, scope: scope.value, storeId: storeId.value }), 'xlsx', exportFileName(range.value.from, range.value.to))
    // #ifdef MP-WEIXIN
    toast('已导出，可点右上角「…」转发到微信')
    // #endif
  } catch (e) {
    toast((e && e.message) || '导出失败，请稍后重试')
  } finally {
    exporting.value = false
  }
}

onLoad(async (q) => {
  await ensureSession()
  storeId.value = 0
  if (q && q.range && RANGES.some((r) => r.key === q.range)) rangeKey.value = q.range
  loadPreview()
})
</script>

<style scoped lang="scss">
.ae-page { background: var(--k-bg); }
.ae-body { padding: 8px 16px 110px; }
.ae-lead { display: block; padding: 10px 12px; border-radius: 10px; background: var(--k-paper2); color: var(--k-muted); font-size: 13px; line-height: 1.6; }
.ae-section { margin: 16px 2px 8px; display: flex; align-items: baseline; justify-content: space-between; font-size: 16px; font-weight: 700; color: var(--k-ink); }
.ae-meta { font-size: 12px; font-weight: 400; color: var(--k-muted); }
.ae-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ae-chip { min-width: 64px; height: 34px; padding: 0 14px; box-sizing: border-box; border: 1px solid var(--k-line2); border-radius: 17px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--k-ink); }
.ae-chip.on { border-color: var(--k-red); background: var(--k-red); color: #fff; font-weight: 600; }
.ae-custom { margin-top: 10px; display: flex; gap: 10px; }
.ae-date { flex: 1; min-width: 0; height: 42px; padding: 0 10px; box-sizing: border-box; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; gap: 6px; font-size: 13px; }
.ae-date>text:first-child { color: var(--k-muted); }
.ae-date>text:nth-child(2) { flex: 1; min-width: 0; font-weight: 600; }
.ae-range { display: block; margin-top: 8px; color: var(--k-red-deep); font-size: 14px; font-weight: 600; }
.ae-store { margin-top: 10px; height: 42px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; gap: 10px; font-size: 14px; }
.ae-store>text:first-child { color: var(--k-muted); }
.ae-store>text:nth-child(2) { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 600; }
.ae-card { margin-top: 16px; padding: 12px; border: 1px solid var(--k-line2); border-radius: 12px; background: var(--k-paper); }
.ae-empty { padding: 18px 0; display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--k-muted); font-size: 13px; text-align: center; }
.ae-total { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 6px; padding-bottom: 8px; border-bottom: 1px solid var(--k-line); font-size: 14px; }
.ae-total__num { font-size: 26px; font-weight: 700; color: var(--k-ink); }
.ae-missing { width: 100%; color: var(--k-red-deep); font-size: 12px; }
.ae-ok { width: 100%; color: var(--k-green); font-size: 12px; }
.ae-warn { display: block; margin-top: 8px; color: var(--k-red-deep); font-size: 13px; }
.ae-row { padding: 9px 0; border-bottom: 1px solid var(--k-line); display: flex; flex-direction: column; gap: 3px; }
.ae-row:last-of-type { border-bottom: 0; }
.ae-row__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ae-row__name { font-size: 15px; font-weight: 700; color: var(--k-ink); }
.ae-row__id { font-size: 13px; color: var(--k-ink); letter-spacing: .5px; }
.ae-row__id.miss { color: var(--k-red-deep); letter-spacing: 0; }
.ae-row__line { color: var(--k-muted); font-size: 12px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ae-more { display: block; margin-top: 8px; color: var(--k-muted); font-size: 12px; text-align: center; }
.ae-note { margin-top: 12px; display: flex; align-items: flex-start; gap: 6px; color: var(--k-muted); font-size: 12px; line-height: 1.6; }
</style>
