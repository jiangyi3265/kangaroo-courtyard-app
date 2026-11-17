<template>
  <k-community-gate>
  <view class="k-page link-page">
    <k-topbar title="关联帖子" back />
    <view class="link-body">
      <view class="intro"><text class="intro__title">为这条动态关联内容</text><text class="intro__sub">选择小院、门店、岗位、活动或自己的帖子</text></view>
      <view class="search">
        <k-icon name="search" :size="17" color="muted" :stroke="1.8" />
        <input v-model="kwDraft" class="search__input" confirm-type="search" maxlength="30" :placeholder="tab === 'post' ? '搜索我的帖子标题' : '搜索小院、门店、岗位或活动'" placeholder-class="link-search-ph" @confirm="runSearch" />
        <view v-if="kwDraft" class="search__clear" hover-class="k-press" @click="clearSearch"><k-icon name="x" :size="14" color="muted" :stroke="2" /></view>
        <view class="search__btn" hover-class="k-press" aria-role="button" aria-label="搜索关联内容" @click="runSearch"><text>搜索</text></view>
      </view>
      <view class="tabs">
        <view v-for="t in LINK_TABS" :key="t.key" class="tab" :class="{ on: tab === t.key }" hover-class="k-press" @click="setTab(t.key)"><text>{{ t.label }}</text></view>
      </view>
      <text class="hint">{{ hintText }}</text>
      <view v-for="it in rows" :key="it.type + it.id" class="item" :class="{ on: isSelected(it) }" hover-class="k-press" aria-role="radio" :aria-checked="isSelected(it)" :aria-label="it.title + '，' + it.label" @click="choose(it)">
        <image v-if="it.cover" class="item__img" :src="absUrl(it.cover)" mode="aspectFill" />
        <view v-else class="item__img item__img--empty"><k-icon :name="iconOf(it.type)" :size="22" color="red" :stroke="1.7" /></view>
        <view class="item__copy">
          <text class="item__title">{{ it.title }}</text>
          <view class="item__meta"><text class="item__tag" :class="'item__tag--' + it.type">{{ it.label }}</text><text v-if="it.meta" class="item__sub">{{ it.meta }}</text></view>
        </view>
        <view class="item__pick" :class="{ on: isSelected(it) }"><k-icon v-if="isSelected(it)" name="check" :size="14" color="white" :stroke="2" /></view>
      </view>

      <view v-if="failed && !rows.length" class="state"><text class="state__title">没加载出来</text><view class="state__retry" hover-class="k-press" @click="load()"><text>重新加载</text></view></view>
      <view v-else-if="loaded && !rows.length" class="state"><k-icon :name="iconOf(tab === 'place' ? 'stay' : tab)" :size="30" color="muted" /><text class="state__title">{{ keyword ? '没有搜到，换个关键词试试' : emptyText }}</text></view>
      <view v-else-if="!loaded" class="state"><text class="state__sub">正在加载…</text></view>
      <view v-else-if="hasMore" class="state"><view class="state__retry" hover-class="k-press" @click="load(true)"><text>{{ paging ? '加载中…' : '加载更多' }}</text></view></view>
      <text v-else-if="rows.length" class="end">已显示全部内容</text>
    </view>
    <view class="selection-bar">
      <view class="selection-bar__summary"><text class="selection-bar__label">{{ selected ? '已选' : '未选择' }}</text><text class="selection-bar__title">{{ selected ? selected.title : '关联为选填，也可以直接返回' }}</text></view>
      <view class="selection-bar__actions">
        <view class="selection-bar__clear" hover-class="k-press" aria-role="button" @click="choose('none')"><text>{{ current ? '取消关联' : '暂不关联' }}</text></view>
        <view class="selection-bar__confirm" :class="{ 'is-disabled': !selected }" hover-class="k-press" aria-role="button" :aria-disabled="!selected" @click="confirmSelection"><text>确认关联</text></view>
      </view>
    </view>
  </view>

  </k-community-gate>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 关联帖子选择页（2026-10-17 发布页改版，对照主人样稿 图 3）：从发布页「关联帖子（选填）」点进来。
//   搜索框 + 页签 小院/门店（type=place）/ 岗位（在招的）/ 活动（还没结束的），列表卡：封面 / 标题 / 类型小标签 / 城市；
//   点选后确认才交还发布页；直接返回不改原有关联。
//   发布页选的城市排在前面（不过滤，别的城市也能关联）。支持小院 / 门店、岗位、活动，以及自己已公开的帖子。
// 新页面放在 community 分包里（主包只剩约 183KB）。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onLoad, onUnload, onReachBottom } from '@dcloudio/uni-app'
import { apiPostLinkables } from '@/common/api.js'
import { back } from '@/common/screen.js'
import { absUrl } from '@/common/upload.js'
import { errText } from '@/common/ui.js'
import { LINK_TABS, linkView, linkRequest, finishLinkPicker } from './post-link.js'

let requestId = ''
const city = ref('')
const current = ref(null)
const selected = ref(null)
onLoad((q) => {
  requestId = String((q && q.request) || '')
  const o = linkRequest(requestId)
  city.value = (o && o.city) || ''
  current.value = linkView(o && o.current)
  selected.value = current.value
  tab.value = ['job', 'activity', 'post'].includes(current.value?.type) ? current.value.type : 'place'
  load()
})
// 返回 / 侧滑离开：没选就当没改
onUnload(() => finishLinkPicker(requestId, null))

const ICONS = { stay: 'house', store: 'store', job: 'briefcase-business', activity: 'calendar-days', post: 'file-text' }
const iconOf = (t) => ICONS[t] || 'link'
const isSelected = (it) => !!selected.value && selected.value.type === it.type && selected.value.id === it.id
const hintText = computed(() => tab.value === 'post' ? '可关联自己已公开的找搭子、旅居日常和经验分享；审核中的帖子通过后可选。' : city.value && city.value !== '全部城市' ? `优先显示${city.value}，也可选择其他城市的内容` : '发布后，读者可从你的帖子打开关联内容')
const EMPTY = { place: '还没有可以关联的小院或门店', job: '还没有在招的岗位', activity: '近期还没有活动', post: '你还没有可关联的公开帖子，可先到「我的发布」查看审核进度' }
const emptyText = computed(() => EMPTY[tab.value] || '这里还没有内容')

const tab = ref('place')
const keyword = ref('')
const kwDraft = ref('')
const rows = ref([])
const loaded = ref(false)
const failed = ref(false)
const hasMore = ref(false)
const paging = ref(false)
let page = 1
let seq = 0
// 换页签 / 搜索时先清掉上一份；连着切只认最后一次（慢的旧请求不能盖掉新结果）
async function load(more) {
  if (more && (paging.value || !hasMore.value)) return
  const my = ++seq
  const next = more ? page + 1 : 1
  if (!more) { rows.value = []; hasMore.value = false; loaded.value = false; failed.value = false }
  paging.value = !!more
  try {
    const res = (await apiPostLinkables({ type: tab.value, keyword: keyword.value || undefined, city: city.value || undefined, page: next })).data || {}
    if (my !== seq) return
    const list = (res.rows || []).map(linkView).filter(Boolean).map(x => ({ ...x, meta: [x.city, x.sub].filter(Boolean).join(' · ') }))
    if (more) {
      const seen = new Set(rows.value.map(x => x.type + x.id))
      rows.value = [...rows.value, ...list.filter(x => !seen.has(x.type + x.id))]
    } else rows.value = list
    hasMore.value = !!res.hasMore
    page = next
    loaded.value = true
  } catch (e) {
    if (my !== seq) return
    if (!more) { rows.value = []; failed.value = true; loaded.value = true }
    uni.showToast({ title: errText(e, '加载失败，请稍后再试'), icon: 'none' })
  } finally {
    if (my === seq) paging.value = false
  }
}
onReachBottom(() => load(true))
function setTab(key) {
  if (tab.value === key) return
  tab.value = key
  rows.value = []
  load()
}
function runSearch() {
  const v = String(kwDraft.value || '').trim().slice(0, 30)
  kwDraft.value = v
  try { uni.hideKeyboard() } catch (e) { /* 没有键盘可收 */ }
  keyword.value = v
  rows.value = []
  load()
}
function clearSearch() {
  kwDraft.value = ''
  if (!keyword.value) return
  keyword.value = ''
  rows.value = []
  load()
}
// 先点选，确认后再提交；返回不提交本页暂选结果。
function choose(it) {
  if (it === 'none') return completeSelection('none')
  selected.value = linkView(it)
}
function confirmSelection() {
  if (selected.value) completeSelection(selected.value)
}
function completeSelection(it) {
  const id = requestId
  requestId = ''
  finishLinkPicker(id, it === 'none' ? 'none' : { type: it.type, id: it.id, title: it.title, cover: it.cover, city: it.city, label: it.label, sub: it.sub })
  back()
}
</script>

<style scoped lang="scss">
.link-page { background: var(--k-bg); }
.link-body { padding: 12px 16px calc(158px + var(--k-safe-bottom)); }
.intro { padding: 4px 0 20px; }
.intro__title { display: block; font-size: 20px; line-height: 1.4; font-weight: 600; color: var(--k-ink); }
.intro__sub { display: block; margin-top: 6px; font-size: 14px; color: var(--k-muted); }
.search { height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 4px 0 14px; border: 1px solid var(--k-line2); border-radius: 14px; background: var(--k-paper); }
.search__input { flex: 1; min-width: 0; height: 46px; font-size: 14px; color: var(--k-ink); }
.search__clear { flex: 0 0 auto; width: 28px; height: 46px; display: flex; align-items: center; justify-content: center; }
.search__btn { flex: 0 0 auto; width: 48px; height: 46px; display: flex; align-items: center; justify-content: center; color: var(--k-red-deep); font-size: 13px; }
.tabs { height: 54px; margin-top: 4px; border-bottom: 1px solid var(--k-line2); display: flex; align-items: stretch; gap: 0; }
.tab { position: relative; display: flex; flex:1; justify-content:center; align-items: center; font-size: 14px; color: var(--k-muted); white-space: nowrap; }
.tab.on { color: var(--k-ink); font-weight: 600; }
.tab.on::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--k-red); }
.hint { display: block; padding: 14px 0 4px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.item { margin-top: 12px; padding: 12px; border: 1px solid transparent; border-radius: 16px; background: var(--k-paper); display: flex; align-items: center; gap: 12px; }
.item.on { border-color: var(--k-red); background: var(--k-red-soft); }
.item__img { flex: 0 0 auto; width: 64px; height: 72px; border-radius: 10px; background: var(--k-paper2); }
.item__img--empty { display: flex; align-items: center; justify-content: center; }
.item__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8px; }
.item__title { font-size: 15px; font-weight: 600; line-height: 1.5; color: var(--k-ink); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; word-break: break-all; }
.item__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; min-width: 0; }
.item__tag { flex: 0 0 auto; padding: 2px 6px; border-radius: 4px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 11px; line-height: 16px; }
.item__tag--stay { background: var(--k-ochre-soft); color: var(--k-ochre-deep); }
.item__tag--job { background: var(--k-green-soft); color: var(--k-green); }
.item__tag--activity { background: var(--k-indigo-soft); color: var(--k-indigo); }
.item__sub { min-width: 0; font-size: 12px; color: var(--k-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item__pick { flex: 0 0 auto; width: 22px; height: 22px; border: 1px solid var(--k-line2); border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--k-paper); }
.item__pick.on { border-color: var(--k-red); background: var(--k-red); }
.state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 12px; text-align: center; }
.state__title { font-size: 15px; font-weight: 500; color: var(--k-ink); line-height: 1.5; }
.state__sub { font-size: 14px; color: var(--k-muted); }
.state__retry { min-height: 48px; padding: 0 20px; border: 1px solid var(--k-line2); border-radius: 12px; color: var(--k-red-deep); font-size: 14px; display: flex; align-items: center; }
.end { display: block; padding: 24px 0; text-align: center; font-size: 12px; color: var(--k-muted); }
.selection-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; padding: 12px 16px calc(12px + var(--k-safe-bottom)); background: var(--k-paper); border-top: 1px solid var(--k-line); }
.selection-bar__summary { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.selection-bar__label { flex: 0 0 auto; font-size: 12px; color: var(--k-muted); }
.selection-bar__title { flex: 1; min-width: 0; font-size: 14px; line-height: 20px; color: var(--k-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.selection-bar__actions { display: flex; gap: 12px; }
.selection-bar__clear, .selection-bar__confirm { height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 14px; font-size: 15px; }
.selection-bar__clear { flex: 0 0 34%; border: 1px solid var(--k-line2); color: var(--k-ink2); }
.selection-bar__confirm { flex: 1; min-width: 0; background: var(--k-red); color: var(--k-paper); font-weight: 600; }
.selection-bar__confirm.is-disabled { background: var(--k-paper2); color: var(--k-muted); }
</style>

<style lang="scss">
/* 搜索框提示字：小程序里 placeholder 不带 scoped 的 data-v 类，单独放这里（类名带页面前缀） */
.link-search-ph { color: var(--k-muted); font-size: 14px; }
</style>
