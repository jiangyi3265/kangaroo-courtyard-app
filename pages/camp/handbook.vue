<template>
  <view class="k-page handbook" :class="$userSurface">
    <k-topbar title="袋鼠使用手册" back :fab="false" />
    <view class="reader">
      <view class="chapter-tabs" aria-label="手册目录">
        <button v-for="(item, index) in chapters" :key="item.id" class="chapter-tab"
          :class="{ 'is-current': active === index }" :aria-label="item.number + '，' + item.tab"
          :aria-current="active === index" hover-class="k-press" @click="turn(index)">
          {{ item.tab }}
        </button>
      </view>

      <view class="chapter-heading">
        <view class="chapter-heading__issue"><view class="issue-rule" /><text>{{ chapter.number }}</text></view>
        <text class="chapter-title">{{ chapter.title }}</text>
      </view>

      <swiper class="panels" :current="active" :duration="240" @change="onSwipe">
        <swiper-item v-for="item in chapters" :key="item.id">
          <view class="frame">
            <image class="panel-art" :src="item.image" mode="aspectFill" :aria-label="item.alt" />
            <view class="speech"><text>{{ item.quote }}</text></view>
          </view>
        </swiper-item>
      </swiper>
      <view class="caption"><text>{{ chapter.caption }}</text></view>

      <view class="field-notes">
        <button class="notes-toggle" hover-class="k-press" :aria-expanded="expanded" @click="expanded = !expanded">
          <k-icon name="book-open" :size="19" color="red" />
          <text>{{ chapter.details }}</text>
          <k-icon :name="expanded ? 'chevron-up' : 'chevron-down'" :size="15" color="muted" />
        </button>
        <view v-if="expanded" class="steps">
          <view v-for="(step, index) in chapter.steps" :key="step[0]" class="step">
            <text class="step-number">{{ index + 1 }}</text>
            <view class="step-copy"><text class="step-title">{{ step[0] }}</text><text class="step-body">{{ step[1] }}</text></view>
          </view>
        </view>
        <view v-if="actions.length" class="actions">
          <button v-for="action in actions" :key="action.path" class="related-link" hover-class="k-press" @click="go(action.path)">
            <text>{{ action.label }}</text><k-icon name="chevron-right" :size="12" color="red" />
          </button>
        </view>
      </view>
      <text v-if="chapter.id === 'safety'" class="closing-note">具体岗位、费用和退订规则，请以对应详情、协议与确认页面为准。</text>

      <view class="page-turn">
        <button class="previous" :disabled="active === 0" hover-class="k-press" @click="turn(active - 1)">
          <k-icon name="chevron-left" :size="14" :color="active ? 'ink' : 'muted'" /><text>上一话</text>
        </button>
        <text class="page-count">{{ active + 1 }} / {{ chapters.length }}</text>
        <button class="next" hover-class="k-press-s" @click="turn((active + 1) % chapters.length)">
          <text>{{ active === chapters.length - 1 ? '回到第一话' : '下一话' }}</text>
          <k-icon :name="active === chapters.length - 1 ? 'book-open' : 'chevron-right'" :size="15" color="white" />
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { featureState, refreshFeatures } from '@/common/features.js'
import { go } from '@/common/screen.js'
import R from '@/common/routes.js'
import { chapters } from './handbook-chapters.js'

const active = ref(0)
onLoad(options => {
  const index = chapters.findIndex(item => item.id === options?.chapter)
  if (index >= 0) active.value = index
})
const expanded = ref(false)
const chapter = computed(() => chapters[active.value])
const chapterLinks = {
  apply: [
    { label: '看兼职岗位', path: R.jobsList + '?type=parttime', feature: 'recruitmentEnabled' },
    { label: '看近期活动', path: R.activity, feature: 'communityEnabled' }
  ],
  stay: [{ label: '选小院', path: R.staysList, feature: 'stayBookingEnabled' }],
  groups: [{ label: '进入袋鼠群聊', path: '/pages/camp/index', feature: 'groupChatEnabled' }],
  safety: [{ label: '找客服', path: R.support }]
}
const actions = computed(() => chapterLinks[chapter.value.id].filter(item => !item.feature || featureState[item.feature]))
onShow(() => { refreshFeatures() })

function turn(index) {
  if (!chapters[index] || index === active.value) return
  expanded.value = false
  active.value = index
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}
function onSwipe(event) {
  if (event.detail.source === 'touch') turn(event.detail.current)
}
</script>

<style scoped>
.handbook { background: #fbf8f1; color: #372f28; }
.reader { max-width: 620px; margin: 0 auto; padding: 0 18px calc(24px + var(--k-safe-bottom)); }
.reader button { margin: 0; padding: 0; border-radius: 0; background: transparent; font-family: inherit; line-height: 1.4; color: inherit; }
.reader button::after { border: 0; }
.chapter-tabs { display: flex; border-bottom: 1px solid #d9cebd; }
.reader .chapter-tab { position: relative; flex: 1; min-height: 46px; color: #70665c; font-size: 14px; }
.reader .chapter-tab.is-current { color: #784c2b; font-weight: 650; }
.chapter-tab.is-current::before { position: absolute; bottom: -1px; left: 50%; width: 25px; height: 3px; transform: translateX(-50%); background: #a4693b; content: ''; }
.chapter-heading { padding: 21px 0 14px; }
.chapter-heading__issue { display: flex; align-items: center; gap: 8px; color: #86542f; font-size: 12px; line-height: 18px; font-weight: 600; }
.issue-rule { width: 22px; height: 2px; background: #b58251; }
.chapter-title { display: block; margin-top: 4px; font-size: 26px; font-weight: 700; line-height: 1.4; }
.panels { width: 100%; height: clamp(178px, 54vw, 348px); border: 1px solid #69523f; box-sizing: border-box; background: #eadbc5; }
.frame, .panel-art { width: 100%; height: 100%; }
.frame { position: relative; }
.panel-art { display: block; }
.speech { position: absolute; left: 12px; bottom: 12px; max-width: 82%; padding: 7px 12px; border: 1px solid #5e4938; border-radius: 14px; background: #fffaf1; color: #3b3026; font-size: 14px; line-height: 1.5; font-weight: 550; }
.speech::before { content: ''; position: absolute; top: -5px; left: 22px; width: 8px; height: 8px; background: #fffaf1; border-top: 1px solid #5e4938; border-left: 1px solid #5e4938; transform: skew(-14deg) rotate(45deg); }
.caption { padding: 13px 2px 19px; font-size: 16px; line-height: 1.78; }
.field-notes { border-top: 1px solid #cbbb9f; border-bottom: 1px solid #d9cebd; }
.reader .notes-toggle { width: 100%; min-height: 49px; display: flex; align-items: center; gap: 9px; text-align: left; font-size: 15px; font-weight: 600; }
.notes-toggle text { flex: 1; }
.steps { padding: 2px 0 6px; }
.step { display: flex; align-items: flex-start; gap: 10px; margin: 4px 0 16px; }
.step-number { flex: 0 0 20px; margin-top: 2px; border: 1px solid #c7af94; border-radius: 50%; color: #815432; font-size: 12px; line-height: 20px; text-align: center; }
.step-copy { flex: 1; min-width: 0; }
.step-title, .step-body { display: block; }
.step-title { font-weight: 650; font-size: 15px; line-height: 1.65; }
.step-body { color: #62564c; margin-top: 3px; font-size: 15px; line-height: 1.75; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0 20px; padding-left: 28px; border-top: 1px dashed #e1d6c7; }
.reader .related-link { display: flex; align-items: center; gap: 3px; min-height: 45px; color: #80502c; font-size: 14px; }
.closing-note { display: block; padding: 12px 0 0; color: #75685e; font-size: 13px; line-height: 1.65; }
.page-turn { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 19px; }
.reader .previous, .reader .next { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 46px; font-size: 14px; }
.reader .previous:disabled { opacity: .5; }
.reader .next { min-width: 86px; padding: 0 13px; border-radius: 7px; background: #845632; color: #fffbf3; }
.page-count { color: #75685e; font-size: 12px; font-variant-numeric: tabular-nums; }
@media (max-width: 360px) {
  .reader { padding-left: 12px; padding-right: 12px; }
  .chapter-heading { padding-top: 14px; }
  .chapter-title { font-size: 23px; }
}
</style>
