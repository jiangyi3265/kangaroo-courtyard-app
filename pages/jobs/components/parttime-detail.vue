<template>
  <view class="pt-detail">
    <view class="pt-gallery" :class="'pt-gallery--' + Math.min(m.gallery.length, 3)">
      <view v-for="(src, index) in gallerySlots" :key="index" class="pt-gallery__cell" :role="src ? 'button' : undefined" :aria-label="src ? '查看岗位照片' + (index + 1) : '门店照片待补充'" :hover-class="src ? 'k-press' : 'none'" @click="src && emit('preview-hero', index)">
        <image v-if="src" class="pt-gallery__image" :src="src" mode="aspectFill" />
        <view v-else class="pt-gallery__empty"><k-icon name="image" :size="24" color="muted" /><text>照片待补充</text></view>
        <text v-if="index === 2 && m.gallery.length > 3" class="pt-gallery__count">{{ m.gallery.length }}张</text>
      </view>
      <text v-if="m.heroCaption && m.gallery.length" class="pt-gallery__caption">{{ m.heroCaption }}</text>
    </view>

    <view class="pt-body">
      <view class="pt-heading">
        <view class="pt-heading__top"><view class="pt-heading__title" role="button" aria-label="查看门店" hover-class="k-press" @click="emit('store')"><text>{{ m.title }}</text></view></view>
        <view class="pt-heading__meta"><text class="pt-heading__sub">{{ m.subline }}</text><text v-if="m.status" class="pt-state" :class="{ 'pt-state--closed': m.blocked }">{{ m.status }}</text><view v-if="m.safe" class="pt-safe"><k-icon name="shield-check" :size="12" color="green" /><text>安心商家</text></view></view>
        <view class="pt-lead"><slot name="lead" /></view>
        <view class="pt-heading__actions">
          <view class="pt-favorite" :class="{ 'is-busy': m.favoriteBusy }" role="button" :aria-pressed="m.favorite" :aria-disabled="m.favoriteBusy" :aria-label="m.favorite ? '取消收藏岗位' : '收藏岗位'" hover-class="k-press" @click="!m.favoriteBusy && emit('favorite')"><k-icon name="star" :size="14" :color="m.favorite ? 'red' : 'ink2'" :fill="m.favorite" /><text>{{ m.favorite ? '已收藏' : '收藏' }}</text></view>
          <view class="pt-heading__subscribe"><slot name="subscription" /></view>
        </view>
      </view>
      <view v-if="m.blocked" class="pt-alert"><k-icon name="info" :size="16" color="alert" /><text>{{ m.blocked }}</text></view>

      <view class="pt-card pt-main">
        <text class="pt-h">招募信息</text>
        <view class="pt-facts">
          <view class="pt-facts__dates">
            <view class="pt-facts__line"><text>招募人数</text><text class="pt-facts__value">{{ m.headcount || '待确认' }}</text></view>
            <view class="pt-facts__line"><text>预计到岗</text><text class="pt-facts__value">{{ m.arrival || '待确认' }}</text></view>
          </view>
          <view class="pt-facts__item"><text>最短服务期</text><text class="pt-facts__value">{{ m.minDays || '待确认' }}</text></view>
        </view>
        <view class="pt-location">
          <view class="pt-location__copy" role="button" aria-label="打开门店地图" @click="emit('map')"><text class="pt-h pt-h--small">位置与交通</text><text class="pt-location__address">{{ m.place || '门店地址待补充' }}</text></view>
          <view class="pt-map" :class="{ 'pt-map--pending': !m.map }" role="button" :aria-label="m.map ? '打开地图' : m.place ? '地图搜索门店地址' : '门店位置待补充'" hover-class="k-press" @click="emit('map')"><k-icon class="pt-map__icon" name="map-pin" :size="20" color="red" /><text class="pt-map__pending" :class="{ 'pt-map__pending--on': m.map }">{{ m.map ? (m.mapTag || '地图') : m.place ? '搜索地址' : '位置待补充' }}</text></view>
        </view>
        <view v-if="m.travel.rows.length" class="pt-traffic"><text class="pt-traffic__label">出行参考</text><view class="pt-traffic__copy"><text v-for="row in m.travel.rows" :key="row.k" class="pt-traffic__line"><text class="pt-traffic__k">{{ row.k }}：</text>{{ row.v }}</text><text class="pt-traffic__note">{{ m.travelNote }}</text></view></view>
        <view v-else class="pt-traffic"><text class="pt-pending">交通路线待门店补充</text></view>

        <view class="pt-film">
          <view v-if="m.interview" class="pt-film__cover" role="group" aria-label="门店采访视频" :hover-class="m.playing?.url ? 'none' : 'k-press'" @click="!m.playing?.url && emit('interview')">
            <job-video-player v-if="m.playing?.url" inline :src="m.playing.url" :poster="m.playing.cover" :title="m.playing.title" @close="emit('close-video')" />
            <template v-else>
            <image v-if="m.interview.cover" class="pt-film__image" :src="m.interview.cover" mode="aspectFill" />
            <view class="pt-film__shade" />
            <view class="pt-film__heading"><text v-if="m.interview.mode" class="pt-film__badge">{{ m.interview.mode }}</text><text class="pt-film__title">{{ m.interview.title.replace('实地采访', '线下采访') }}</text></view>
            <view class="pt-film__play"><k-icon name="play" :size="20" color="ink" fill /></view>
            <text class="pt-film__caption">{{ m.interview.caption }}</text>
            </template>
          </view>
          <view v-else class="pt-film__cover pt-film__empty">
            <view class="pt-film__heading"><text class="pt-film__title">{{ m.pendingInterview.title }}</text></view>
            <view class="pt-film__play pt-film__play--pending"><k-icon name="video" :size="14" color="muted" /></view>
            <text class="pt-film__caption pt-film__caption--pending">{{ m.pendingInterview.caption }}</text>
          </view>
          <view v-if="filmSlots.length" class="pt-film__strip" :class="{ 'pt-film__strip--few': filmSlots.length < 3 }"><view v-for="(src, index) in filmSlots" :key="index" class="pt-film__thumb" role="button" :aria-label="'查看门店照片' + (index + 1)" hover-class="k-press" @click="emit('preview-daily', index)"><image :src="src" mode="aspectFill" /></view></view>
        </view>

        <view class="pt-jobs">
          <text class="pt-h pt-jobs__title">{{ m.recruitmentTitle }}</text>
          <view class="pt-jobs__columns">
            <view class="pt-work"><text class="pt-h">岗位工作内容</text><text v-if="contentOpen && content.introduction" class="pt-work__intro">{{ content.introduction }}</text><view v-for="(line, index) in content.lines" :key="index" class="pt-bullet" :class="{ 'pt-bullet--lead': index === 0 }"><text class="pt-bullet__dot">·</text><text>{{ line }}</text></view><view v-if="content.introduction" class="pt-work__toggle" role="button" :aria-expanded="contentOpen" aria-label="查看完整岗位介绍" hover-class="k-press" @click="contentOpen = !contentOpen"><text>{{ contentOpen ? '收起岗位介绍' : '查看完整岗位介绍' }}</text><k-icon :name="contentOpen ? 'chevron-up' : 'chevron-down'" :size="12" color="red" /></view><text v-if="!content.lines.length" class="pt-pending">工作内容待补充</text></view>
            <view class="pt-schedule"><view class="pt-schedule__heading"><text class="pt-h">排班与工时</text></view><view v-if="schedule" class="pt-schedule__body"><view class="pt-schedule__dup"><k-icon name="clock-3" :size="14" color="muted" /></view><view class="pt-schedule__copy"><text class="pt-schedule__line"><text class="pt-schedule__k">排班模式：</text>{{ schedule.mode || '待补充' }}</text><text v-if="schedule.note" class="pt-schedule__line pt-schedule__line--note">{{ schedule.note }}</text><text class="pt-schedule__line"><text class="pt-schedule__k">每日工作时长：</text>{{ schedule.hours ? schedule.hours.replace(/^每日/, '') : '待补充' }}</text></view></view><text v-else class="pt-pending">排班与工时待补充</text></view>
          </view>
          <view v-if="m.requirements.length" class="pt-requirements"><view class="pt-requirements__toggle" role="button" aria-label="任职要求" :aria-expanded="requirementsOpen" hover-class="k-press" @click="requirementsOpen = !requirementsOpen"><text>任职要求</text><text class="pt-requirements__hint">{{ requirementsOpen ? '收起' : '查看要求' }}</text><k-icon :name="requirementsOpen ? 'chevron-up' : 'chevron-down'" :size="12" color="muted" /></view><view v-if="requirementsOpen" class="pt-requirements__body"><view v-for="(row, index) in m.requirements" :key="index" class="pt-bullet"><text class="pt-bullet__dot">·</text><text><text v-if="row.k" class="pt-requirements__key">{{ row.k }}</text>{{ row.v }}</text></view></view></view>
        </view>
      </view>

      <view class="pt-benefits">
        <text class="pt-benefits__tab">岗位待遇</text>
        <view class="pt-benefits__paper">
          <text v-if="m.recruitmentFee" class="pt-fee" style="display:block;font-size:14px;line-height:1.7;margin-bottom:12px">{{ m.recruitmentFee }}</text>
          <template v-if="m.welfare">
            <view v-if="m.welfare.highlights.length" class="pt-benefits__highlights"><view v-for="(highlight, index) in m.welfare.highlights" :key="index" class="pt-benefits__highlight" :class="{ 'pt-benefits__highlight--board': highlight === m.board }"><view class="pt-check"><k-icon name="check" :size="12" color="green" /></view><text>{{ highlight }}</text></view></view>
            <view class="pt-benefits__items" :class="{ 'pt-benefits__items--split': welfareFees.length }">
              <view class="pt-benefits__group"><view v-for="(line, index) in welfareMain" :key="index" class="pt-bullet"><text class="pt-bullet__dot">·</text><text>{{ line }}</text></view></view>
              <view v-if="welfareFees.length" class="pt-benefits__group pt-benefits__fees"><view v-for="(line, index) in welfareFees" :key="index" class="pt-bullet"><text class="pt-bullet__dot">·</text><text>{{ line }}</text></view></view>
            </view>
          </template>
          <text v-else class="pt-pending">食宿、薪酬与福利待门店补充</text>
        </view>
      </view>

      <!-- 包住宿的岗位保留展示区，照片预览和视频播放由 job-media-grid 处理。 -->
      <view v-if="m.lodging" class="pt-card pt-lodging">
        <text class="pt-h">住宿展示</text>
        <job-media-grid :images="m.lodging.images" :video="m.lodging.video" :cover="m.lodging.cover" title="住宿展示" layout="lodging" />
      </view>

      <view class="pt-card pt-manager">
        <text class="pt-h">店长介绍</text>
        <view class="pt-manager__body"><view class="pt-manager__portrait"><image v-if="m.manager && m.manager.avatar" class="pt-manager__avatar" :src="m.manager.avatar" mode="aspectFill" /><view v-else class="pt-manager__avatar pt-manager__avatar--empty"><k-icon name="user-round" :size="24" color="muted" /></view></view><view class="pt-manager__col"><view v-if="m.manager" class="pt-manager__copy"><text class="pt-manager__name">{{ m.manager.name ? '店长：' + m.manager.name : '店长' }}</text><text v-if="m.manager.years" class="pt-manager__line">在这里工作{{ m.manager.years }}</text><text v-if="managerSkills" class="pt-manager__line">擅长：{{ managerSkills }}</text><text v-if="m.manager.quote" class="pt-manager__line">店长说：{{ m.manager.quote }}</text></view><view v-else class="pt-manager__copy pt-manager__pending"><text class="pt-manager__name">店长资料待补充</text><text class="pt-pending">了解店长，出发前多一份熟悉</text></view><view v-if="m.manager && m.manager.ratingText" class="pt-manager__rating"><k-icon name="star" :size="12" color="red" fill /><text>店长服务评分 {{ m.manager.ratingText }}</text></view><view v-else class="pt-manager__unrated"><k-icon name="star" :size="12" color="muted" /><text>暂无服务评分</text></view></view></view>
      </view>

      <view v-if="m.facilities.length" class="pt-card pt-facilities"><view v-for="facility in m.facilities" :key="facility.code" class="pt-facility"><k-icon :name="facility.icon" :art="'amenity-' + facility.code" :size="18" color="red" /><text>{{ facility.label }}</text></view></view>
      <view v-else class="pt-card pt-facilities-empty"><text class="pt-h">该店亮点</text><view class="pt-facilities-empty__tip"><k-icon name="sparkles" :size="14" color="muted" /><text class="pt-pending">门店设施待补充</text></view></view>

      <view class="pt-life">
        <view class="pt-card pt-feedback"><view class="pt-feedback__head" role="button" aria-label="查看岗位评价" hover-class="k-press" @click="emit('reviews')"><text class="pt-h">用户反馈</text><k-icon name="chevron-right" :size="14" color="muted" /></view><view v-if="m.digest.items.length" class="pt-feedback__quotes" role="button" aria-label="阅读用户反馈" hover-class="k-press" @click="emit('reviews')"><text v-for="item in m.digest.items.slice(0, 2)" :key="item.key" class="pt-feedback__quote">{{ item.text }}</text></view><view v-else class="pt-feedback__empty" role="button" aria-label="查看岗位评价" @click="emit('reviews')"><text>暂无评价，期待你的真实体验</text></view><view v-if="m.reviewAppId" class="pt-feedback__write" role="button" aria-label="写岗位评价" hover-class="k-press" @click="emit('write-review')"><text>写评价</text><k-icon name="chevron-right" :size="12" color="red" /></view></view>
        <view class="pt-card pt-daily" role="button" aria-label="查看店里日常" hover-class="k-press" @click="emit('daily')"><view class="pt-daily__head"><text class="pt-h">店内日常</text><k-icon name="chevron-right" :size="14" color="muted" /></view><view v-if="m.daily.length" class="pt-daily__photos"><view v-for="(src, index) in m.daily.slice(0, 3)" :key="src + index" class="pt-daily__cell"><image :src="src" mode="aspectFill" /><text v-if="index === 2 && m.daily.length > 3" class="pt-daily__more">+{{ m.daily.length - 3 }}</text></view></view><view v-else class="pt-daily__empty"><k-icon name="image" :size="20" color="muted" /><text>日常照片待上传</text></view></view>
      </view>

      <view class="pt-card pt-assurance"><text class="pt-h">袋鼠安心保障</text><view v-for="row in assurance" :key="row.key" class="pt-assurance__row"><text class="pt-assurance__text"><text class="pt-assurance__k">{{ row.k }}：</text>{{ row.v }}</text><view v-if="row.link" class="pt-assurance__link" role="button" aria-label="查看营业执照" hover-class="k-press" @click="emit('assurance', row)">{{ row.link }}</view></view></view>
      <view v-if="m.training" class="pt-card pt-training" role="button" aria-label="查看培训活动" hover-class="k-press" @click="emit('training')"><image v-if="m.training.img" class="pt-training__image" :src="m.training.img" mode="aspectFill" /><view class="pt-training__copy"><text class="pt-training__label">袋鼠成长课堂 · 培训活动</text><text class="pt-h">{{ m.training.title }}</text><text class="pt-pending">{{ [m.training.dateText, m.training.city].filter(Boolean).join(' · ') }}</text><view class="pt-training__more"><text class="pt-training__link">了解课程与报名</text><k-icon name="chevron-right" :size="12" color="red" /></view></view></view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import JobVideoPlayer from './job-video-player.vue'
import JobMediaGrid from './job-media-grid.vue'
import { DETAIL_ART } from '../detail-art.js'
import { employmentContent, employmentSchedule, employmentSkills } from '../employment-presentation.js'
defineOptions({ options: { virtualHost: true, styleIsolation: 'isolated' } })
const props = defineProps({ model: { type: Object, required: true } })
const emit = defineEmits(['preview-hero', 'favorite', 'map', 'interview', 'close-video', 'preview-daily', 'daily', 'reviews', 'write-review', 'assurance', 'store', 'follow', 'training'])
const m = computed(() => props.model)
const requirementsOpen = ref(false)
const contentOpen = ref(true)
const content = computed(() => employmentContent(m.value.content))
const schedule = computed(() => employmentSchedule(m.value.work))
const managerSkills = computed(() => employmentSkills(m.value.manager?.skills))
const gallerySlots = computed(() => m.value.gallery.length ? m.value.gallery.slice(0, 3) : [''])
const filmSlots = computed(() => m.value.daily.slice(0, 3))
const isFee = line => /押金|中介|手续费/.test(line)
const welfareMain = computed(() => (m.value.welfare?.items || []).filter(line => !isFee(line)))
const welfareFees = computed(() => (m.value.welfare?.items || []).filter(isFee))
// Preserve the reference sections without presenting unprovided credentials as verified.
const assurance = computed(() => ['insurance', 'license', 'help'].map(key => m.value.assurance.find(row => row.key === key) || {
  key, k: key === 'insurance' ? '保险保障' : '门店资质',
  v: key === 'insurance' ? (String(m.value.insuranceFlag) === '1' ? '本岗位暂不含平台统一保险' : '保险信息待确认') : '营业执照待上传'
}))
</script>

<style scoped lang="scss">
.k-press { opacity: .7; }
/* 兼职 / 全职详情。2026-11-17 改版「小而精」：和换宿详情同一套——顶上照片完整露出，下面一整块白色内容面板，
   区块靠留白和 1px 细线分开；人数 / 到岗 / 服务期、排班与工时放进浅色横条，待遇写成小标签。
   之前照概念图缩出来的 9–10px 小字、渐变棕色待遇卡、描边白卡都不用了。每一块内容都读真实岗位数据，一块没少。 */
.pt-detail { color: var(--k-ink2); font-family: var(--k-sans); font-size: 13px; line-height: 20px; }
/* 头图：最多三张并排，照片之间 2px 缝；左上角白色小胶囊写采访方式，超过三张时右下角写共几张 */
.pt-gallery { position: relative; display: flex; gap: 2px; height: 208px; overflow: hidden; background: #EFEAE3; }
.pt-gallery--0, .pt-gallery--1 { height: 232px; }
.pt-gallery__cell { position: relative; flex: 1; min-width: 0; height: 100%; overflow: hidden; }
.pt-gallery--2 .pt-gallery__cell:first-child, .pt-gallery--3 .pt-gallery__cell:first-child { flex: 1.5; }
.pt-gallery__image { width: 100%; height: 100%; display: block; }
.pt-gallery__empty { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--k-light); font-size: 12px; }
.pt-gallery__caption { position: absolute; left: 12px; top: 12px; max-width: calc(100% - 24px); height: 22px; padding: 0 8px; border-radius: 11px; box-sizing: border-box; background: rgba(255, 255, 255, .94); color: var(--k-red-deep); font-size: 11px; font-weight: 600; line-height: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pt-gallery__count { position: absolute; right: 12px; bottom: 22px; height: 22px; padding: 0 8px; border-radius: 11px; background: rgba(20, 14, 10, .5); color: #fff; font-size: 11px; line-height: 22px; }
/* 白色内容面板：压住头图底边 12px，上面两个角是圆的。
   不能写 z-index：一写，面板里「住宿展示」点开的全屏视频就被压在页面顶栏和底部按钮下面，「关闭」和进度条都点不到。
   面板排在头图后面，只写 position: relative 就已经盖在头图上了 */
.pt-body { position: relative; margin-top: -12px; padding: 16px 16px 20px; border-radius: 12px 12px 0 0; background: #FFFFFF; }
.pt-heading__top { display: flex; align-items: flex-start; gap: 10px; }
.pt-heading__title { flex: 1; min-width: 0; font-size: 18px; line-height: 26px; font-weight: 700; color: var(--k-ink); overflow-wrap: anywhere; }
/* 订阅胶囊自己带一圈 8px 的透明边（可点范围 44 高），往回收让看得见的胶囊和标题第一行对齐 */
.pt-heading__subscribe { flex: 0 0 auto; margin: -9px -8px -9px 0; }
/* 2026-11-18 看图评审：「收藏」原来单独占一行、左边整行空着。现在和上面的订阅是同一种浅色小胶囊，排在「岗位类型｜城市 … 还招 N 人」这一行的最右边；
   这一行右边给它留出 78 的位置。「安心商家」有才多一行 */
.pt-heading__meta { margin-top: 4px; min-height: 28px; padding-right: 78px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pt-heading__sub { min-width: 0; color: var(--k-muted); font-size: 12px; line-height: 18px; }
.pt-state { flex-shrink: 0; height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); font-size: 11px; font-weight: 500; line-height: 17px; white-space: nowrap; }
.pt-state--closed { background: #F5F1EB; color: var(--k-muted); }
.pt-heading__actions { position: relative; display: flex; align-items: center; }
.pt-safe { margin-top: 4px; height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; gap: 2px; }
/* 收藏：看上去是 28 高的小胶囊，外面一圈 4 的透明边把可点范围留在 36 高（和原来一样）；贴着上一行的底边往上放，正好和那一行对齐 */
.pt-favorite { position: absolute; right: -4px; bottom: 100%; margin-bottom: -4px; min-width: 76px; height: 36px; padding: 0 8px; border: 4px solid transparent; border-radius: 18px; box-sizing: border-box; background: #F5F1EB padding-box; display: flex; align-items: center; justify-content: center; gap: 3px; color: var(--k-ink2); font-size: 12px; font-weight: 500; white-space: nowrap; }
.pt-favorite.is-busy { opacity: .6; }
.pt-pending { display: block; color: var(--k-light); font-size: 12px; line-height: 18px; }
.pt-alert { margin-top: 6px; padding: 8px 10px; border-radius: 8px; background: var(--k-alert-soft); color: var(--k-alert); font-size: 12px; line-height: 18px; display: flex; align-items: center; gap: 6px; }
/* 区块：不描边、不要底色，上面一道细线，上下各留 16 */
.pt-card { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--k-line); box-sizing: border-box; }
.pt-h { display: block; font-size: 15px; font-weight: 700; line-height: 22px; color: var(--k-ink); }
.pt-h--small { font-size: 13px; font-weight: 600; line-height: 20px; }
.pt-main { margin-top: 12px; }
/* 招募人数 | 预计到岗 | 最短服务期：一条浅色横条，数字在上、名称在下 */
.pt-facts { margin-top: 10px; padding: 10px 0; border-radius: 8px; background: #F7F5F2; display: flex; align-items: stretch; }
.pt-facts__dates { flex: 2.3; min-width: 0; display: flex; }
.pt-facts__line, .pt-facts__item { flex: 1; min-width: 0; padding: 0 4px; box-sizing: border-box; display: flex; flex-direction: column-reverse; align-items: center; justify-content: center; gap: 2px; text-align: center; color: var(--k-muted); font-size: 11px; line-height: 16px; }
.pt-facts__line + .pt-facts__line { flex: 1.3; border-left: 1px solid #E8E2DA; }
.pt-facts__item { border-left: 1px solid #E8E2DA; }
.pt-facts__value { color: var(--k-ink); font-size: 14px; font-weight: 700; line-height: 22px; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
/* 位置与交通：左边地址，右边一块小地图（点了打开地图）；出行参考放在浅色底里 */
.pt-location { margin-top: 14px; display: flex; align-items: flex-start; gap: 12px; }
.pt-location__copy { flex: 1; min-width: 0; }
.pt-location__address { display: block; margin-top: 2px; font-size: 13px; line-height: 20px; color: var(--k-ink2); overflow-wrap: anywhere; }
.pt-map { position: relative; flex: 0 0 auto; width: 76px; height: 54px; overflow: hidden; border-radius: 8px; background: #EEF2ED; }
.pt-map__art { display: block; width: 100%; height: 100%; }
.pt-map--pending .pt-map__art { opacity: .6; }
.pt-map__pending { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(255, 255, 255, .94); color: var(--k-muted); text-align: center; font-size: 11px; line-height: 16px; }
/* 2026-11-18 看图评审：和换宿详情同一种排法——「出行参考」是小标题，下面浅色底里一条一条写，前面小圆点、「高铁」「机场」加粗；左边不再放一列灰字 */
.pt-traffic { margin-top: 12px; font-size: 12px; line-height: 20px; }
.pt-traffic__label { display: block; color: var(--k-ink); font-size: 13px; font-weight: 700; line-height: 20px; }
.pt-traffic__copy, .pt-traffic > .pt-pending { margin-top: 6px; padding: 8px 10px; border-radius: 8px; background: #F7F5F2; }
.pt-traffic > .pt-pending { margin-top: 0; }
.pt-traffic__line, .pt-traffic__note { display: block; overflow-wrap: anywhere; }
.pt-traffic__line { position: relative; padding-left: 10px; }
.pt-traffic__line + .pt-traffic__line { margin-top: 2px; }
.pt-traffic__line::before { content: ''; position: absolute; left: 0; top: 8px; width: 4px; height: 4px; border-radius: 50%; background: #C9BFB4; }
.pt-traffic__k { color: var(--k-ink); font-weight: 600; }
.pt-traffic__note { margin-top: 6px; color: var(--k-light); font-size: 11px; line-height: 16px; }
/* 采访视频：照片完整露出，字用黑色渐变托住；没有视频时收成一行。下面一排是门店照片，点了看大图 */
.pt-film { margin-top: 14px; }
.pt-film__cover { position: relative; height: 188px; overflow: hidden; border-radius: 8px; background: #EFEAE3; }
.pt-film__image, .pt-film__shade { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.pt-film__shade { background: linear-gradient(180deg, rgba(20, 14, 10, .3), rgba(20, 14, 10, 0) 42%, rgba(20, 14, 10, .6)); }
.pt-film__heading { position: absolute; left: 8px; right: 8px; top: 8px; display: flex; align-items: center; gap: 6px; color: #fff; }
.pt-film__badge { flex: 0 0 auto; height: 20px; padding: 0 7px; border-radius: 10px; background: rgba(255, 255, 255, .94); color: var(--k-red-deep); font-size: 11px; font-weight: 600; line-height: 20px; white-space: nowrap; }
.pt-film__title { min-width: 0; font-size: 12px; font-weight: 600; line-height: 20px; }
.pt-film__play { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: rgba(20, 14, 10, .45); display: flex; align-items: center; justify-content: center; }
.pt-film__caption { position: absolute; left: 12px; right: 12px; bottom: 10px; color: #fff; font-size: 12px; font-weight: 500; line-height: 18px; }
/* 没有视频：左边一个小圆钮，右边标题 + 说明跟着文字自己撑高（字被系统放大或换行时不会叠在一起、也不会被截掉） */
.pt-film__empty { height: auto; min-height: 72px; padding: 10px 10px 10px 60px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 2px; background: #F7F5F2; }
.pt-film__empty .pt-film__heading { position: static; color: var(--k-ink); }
.pt-film__empty .pt-film__title { font-size: 13px; }
.pt-film__play--pending { left: 12px; top: 50%; width: 36px; height: 36px; margin: -18px 0 0; background: #FFFFFF; }
.pt-film__caption--pending { position: static; color: var(--k-muted); font-size: 11px; font-weight: 400; line-height: 16px; }
/* 2026-11-18 看图评审：照片固定三格一行（每格 8 圆角、间隔 8），不足三张靠左排——原来只有一张时被横着拉满、裁成 56 高的细长条，糊成一片；
   和上面的视频隔开 8 */
.pt-film__strip { margin-top: 8px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pt-film__thumb { min-width: 0; height: 72px; overflow: hidden; border-radius: 8px; background: #EFEAE3; }
.pt-film__thumb image { width: 100%; height: 100%; display: block; }
/* 招募要求：岗位工作内容 + 排班与工时（浅色横条）+ 任职要求（点了展开，两列） */
.pt-jobs { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--k-line); }
.pt-jobs__title { margin-bottom: 10px; }
.pt-jobs__columns { display: flex; flex-direction: column; gap: 14px; }
.pt-work, .pt-schedule { min-width: 0; }
.pt-work .pt-h, .pt-schedule .pt-h { font-size: 13px; font-weight: 600; line-height: 20px; }
.pt-work__intro { display: block; margin-top: 4px; font-size: 13px; line-height: 20px; color: var(--k-ink2); }
.pt-work__toggle { min-height: 32px; display: flex; align-items: center; gap: 3px; color: var(--k-red-deep); font-size: 12px; }
.pt-schedule__heading { display: flex; align-items: center; gap: 5px; }
.pt-schedule__body { margin-top: 6px; padding: 10px 12px; border-radius: 8px; background: #F7F5F2; display: flex; align-items: flex-start; gap: 8px; }
/* 小标题前面已经有一个时钟，浅色条里那个一模一样的不再重复画（纯装饰），两行字靠左对齐到内边距。
   这个组件是样式隔离的，小程序里样式穿不进图标组件，所以给图标包了一层再收起来 */
.pt-schedule__dup { display: none; }
.pt-schedule__copy { flex: 1; min-width: 0; }
.pt-schedule__line { display: block; font-size: 13px; font-weight: 600; line-height: 20px; color: var(--k-ink); overflow-wrap: anywhere; }
.pt-bullet { margin-top: 4px; display: flex; align-items: flex-start; gap: 6px; font-size: 13px; line-height: 20px; color: var(--k-ink2); }
.pt-bullet > text:last-child { flex: 1; min-width: 0; overflow-wrap: anywhere; }
/* 圆点画成 4px 的小圆，不用字体里的「·」（各家字体大小不一样） */
.pt-bullet__dot { flex: 0 0 4px; width: 4px; height: 4px; margin-top: 8px; border-radius: 50%; background: #C9BFB4; color: transparent; font-size: 0; overflow: hidden; }
.pt-requirements { margin-top: 14px; border-top: 1px solid var(--k-line); }
.pt-requirements__toggle { min-height: 44px; display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var(--k-ink); }
.pt-requirements__hint { margin-left: auto; color: var(--k-muted); font-size: 12px; font-weight: 400; }
.pt-requirements__body { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 16px; align-items: start; padding-bottom: 4px; }
.pt-requirements__body .pt-bullet { min-width: 0; margin: 0; }
.pt-requirements__key { padding-right: 6px; color: var(--k-red-deep); font-weight: 600; white-space: nowrap; }
/* 岗位待遇：食宿、薪资是大一点的标签（食宿豆绿、薪资暖棕），其余待遇是一枚枚小标签；押金、手续费这类单独一行琥珀色 */
.pt-benefits { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--k-line); }
.pt-benefits__tab { display: block; font-size: 15px; font-weight: 700; line-height: 22px; color: var(--k-ink); }
.pt-benefits__paper { margin-top: 8px; }
.pt-benefits__highlights { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
/* 2026-11-18 看图评审：一页里标签有三种大小。重点标签收到 24 高；薪资直接用价格色的加粗数字，不再配对勾（对勾只留给「包吃包住」）；
   下面的小标签收到 20 高、11 号字，里面不再带小圆点 */
.pt-benefits__highlight { max-width: 100%; min-height: 24px; padding: 2px 8px; border-radius: 4px; box-sizing: border-box; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 13px; font-weight: 700; line-height: 20px; display: flex; align-items: center; gap: 4px; overflow-wrap: anywhere; }
.pt-benefits__highlight--board { background: var(--k-green-soft); color: var(--k-green); font-size: 12px; font-weight: 600; }
.pt-check { flex: 0 0 12px; width: 12px; height: 12px; border-radius: 50%; background: currentColor; display: flex; align-items: center; justify-content: center; }
.pt-benefits__highlight:not(.pt-benefits__highlight--board) .pt-check { display: none; }
/* 第二轮：工资亮点按「价格」的样子——不再装进胶囊，暖棕大字、数字等宽（¥ 和数字是一整串，不拆） */
.pt-benefits__highlight:not(.pt-benefits__highlight--board) { min-height: 0; padding: 0; background: transparent; color: var(--k-red); font-size: 16px; font-weight: 700; line-height: 22px; font-variant-numeric: tabular-nums; }
.pt-benefits__items { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.pt-benefits__group { min-width: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.pt-benefits__items .pt-bullet { max-width: 100%; min-height: 20px; margin: 0; padding: 0 6px; border-radius: 4px; box-sizing: border-box; background: #F5F1EB; font-size: 11px; font-weight: 500; line-height: 20px; gap: 0; }
.pt-benefits__items .pt-bullet > text:last-child { flex: 0 1 auto; }
.pt-benefits__items .pt-bullet__dot { display: none; }
.pt-benefits__fees .pt-bullet { background: var(--k-ochre-soft); color: var(--k-ochre-deep); }
/* 店长介绍：小圆头像（下面一枚评分小标签）+ 名字 + 两三行介绍 */
.pt-manager__body { margin-top: 10px; display: flex; align-items: flex-start; gap: 12px; }
.pt-manager__portrait { flex: 0 0 auto; min-width: 56px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.pt-manager__avatar { display: block; width: 52px; height: 52px; border-radius: 50%; }
.pt-manager__avatar--empty { display: flex; align-items: center; justify-content: center; background: #F5F1EB; }
.pt-manager__rating { display: block; padding: 0 5px; border-radius: 4px; background: var(--k-ochre-soft); color: var(--k-ochre-deep); font-size: 11px; line-height: 17px; white-space: nowrap; }
.pt-manager__unrated { display: block; color: var(--k-light); font-size: 11px; line-height: 17px; white-space: nowrap; }
.pt-manager__copy { flex: 1; min-width: 0; }
.pt-manager__pending { align-self: center; }
.pt-manager__name { display: block; font-size: 14px; font-weight: 600; line-height: 20px; color: var(--k-ink); }
.pt-manager__line { display: block; font-size: 12px; line-height: 18px; color: var(--k-ink2); overflow-wrap: anywhere; }
/* 该店亮点：三列浅色小格，图标在左、名字在右 */
.pt-facilities { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.pt-facility { min-width: 0; min-height: 40px; padding: 4px 6px; border-radius: 8px; box-sizing: border-box; background: #F7F5F2; display: flex; align-items: center; justify-content: center; gap: 5px; color: var(--k-ink2); font-size: 12px; font-weight: 500; line-height: 16px; overflow-wrap: anywhere; }
.pt-facility__image { flex: 0 0 auto; width: 24px; height: 20px; }
/* 用户反馈 + 店内日常：两块浅色小卡并排，整块能点 */
.pt-life { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--k-line); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.pt-feedback, .pt-daily { min-width: 0; margin-top: 0; padding: 12px; border-top: 0; border-radius: 8px; background: #F7F5F2; }
.pt-life .pt-h { font-size: 14px; line-height: 20px; }
/* 「用户反馈」这几个字点了看全部评价：看着还是 20 高一行，上下各多出 6 的可点范围 */
.pt-feedback__head { min-height: 32px; margin: -6px 0; display: flex; align-items: center; justify-content: space-between; }
.pt-feedback__quotes { margin-top: 4px; }
.pt-feedback__quote { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; margin-top: 4px; padding: 0 8px; border-radius: 6px; background: #FFFFFF; color: var(--k-ink2); font-size: 12px; line-height: 20px; }
.pt-feedback__empty, .pt-feedback__write { min-height: 32px; display: flex; align-items: center; gap: 2px; color: var(--k-red-deep); font-size: 12px; line-height: 18px; }
.pt-feedback__empty { margin-top: 4px; color: var(--k-muted); }
.pt-daily__photos { margin-top: 8px; display: flex; gap: 4px; height: 64px; }
.pt-daily__cell { position: relative; flex: 1; min-width: 0; overflow: hidden; border-radius: 6px; }
.pt-daily__cell image { display: block; width: 100%; height: 100%; }
.pt-daily__more { position: absolute; right: 3px; bottom: 3px; padding: 0 4px; border-radius: 4px; background: rgba(20, 14, 10, .55); color: #fff; font-size: 11px; line-height: 16px; }
.pt-daily__empty { margin-top: 8px; min-height: 64px; border-radius: 6px; background: #FFFFFF; color: var(--k-light); font-size: 11px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
/* 袋鼠安心保障：三行并成一块很浅的豆绿底；执照是一枚细边小胶囊 */
.pt-assurance__row { padding: 3px 12px; background: #F4F8F0; color: var(--k-ink2); font-size: 12px; line-height: 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; overflow-wrap: anywhere; }
.pt-h + .pt-assurance__row { margin-top: 10px; padding-top: 9px; border-radius: 8px 8px 0 0; }
.pt-assurance__row:last-child { padding-bottom: 9px; border-radius: 0 0 8px 8px; }
.pt-assurance__link { flex: 0 0 auto; margin-left: auto; height: 24px; padding: 0 9px; border: 1px solid var(--k-red-line); border-radius: 12px; box-sizing: border-box; background: #FFFFFF; color: var(--k-red-deep); font-size: 11px; font-weight: 500; line-height: 22px; }
/* 全职：培训活动入口，浅色底小卡 */
.pt-training { padding: 10px; border-top: 0; border-radius: 12px; background: #F7F5F2; display: flex; gap: 10px; }
.pt-training__image { flex: 0 0 auto; width: 88px; min-height: 88px; height: auto; align-self: stretch; border-radius: 8px; } /* height:auto 去掉图片组件自带的 240 高，不然整张卡被撑高 */
.pt-training__copy { flex: 1; min-width: 0; }
.pt-training__label { display: block; color: var(--k-red-deep); font-size: 11px; line-height: 16px; }
.pt-training .pt-h { font-size: 14px; font-weight: 600; line-height: 20px; }
.pt-training__link { display: block; margin-top: 4px; color: var(--k-red-deep); font-size: 12px; font-weight: 600; line-height: 18px; }
.pt-training__more { margin-top: 4px; display: flex; align-items: center; gap: 2px; }
.pt-training__more .pt-training__link { margin-top: 0; }
/* 招募费用说明：和周围说明字一个大小（模板里写死了 14 号行内样式，这里盖回 13） */
.pt-fee { font-size: 13px !important; line-height: 20px !important; margin-bottom: 8px !important; color: var(--k-ink2); }
/* ===== 2026-11-18 第三轮「逐页精修」（r3jobsa）：兼职 / 全职详情 =====
   ① 「安心商家」原来一枚小标签独占一行：和「兼职岗位｜平潭 · 还招 N 人」并成一行，收藏胶囊排在同一行最右；
   ② 灰底块只留给「招募信息」三格：交通待补充、采访待补充、排班与工时、住宿待上传都改成白底上的一行说明，页面不再一块接一块地发闷；
   ③ 「任职要求 · 查看要求」右边让出客服小钮的位置；④ 区块标题 16 / 700，区块之间发丝线。内容、按钮、点了做什么都没变。 */
.pt-heading { display: flex; flex-wrap: wrap; align-items: center; }
.pt-heading__top { flex: 0 0 100%; }
.pt-heading__meta { flex: 0 1 auto; min-width: 0; margin-top: 6px; padding-right: 0; justify-content: flex-start; }
.pt-heading__actions { flex: 1 1 auto; min-width: 0; margin-top: 6px; margin-left: 6px; }
.pt-safe { margin-top: 0; gap: 2px; }
.pt-favorite { position: static; margin: -4px -4px -4px auto; }
.pt-h { font-size: 16px; line-height: 22px; }
.pt-work .pt-h, .pt-schedule .pt-h { font-size: 14px; line-height: 20px; }
.pt-life .pt-h, .pt-training .pt-h { font-size: 14px; line-height: 20px; }
.pt-benefits__tab { font-size: 16px; }
.pt-card, .pt-jobs, .pt-benefits, .pt-life, .pt-requirements { position: relative; border-top: 0; }
.pt-card::before, .pt-jobs::before, .pt-benefits::before, .pt-life::before, .pt-requirements::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.pt-main::before, .pt-life > .pt-card::before, .pt-training::before { display: none; }
.pt-pending { color: var(--k-muted); }
.pt-traffic > .pt-pending { margin-top: 0; padding: 0; border-radius: 0; background: transparent; }
.pt-film__empty { min-height: 44px; padding: 0 0 0 52px; border-radius: 0; background: transparent; }
.pt-film__play--pending { left: 0; width: 40px; height: 40px; margin-top: -20px; border-radius: 12px; background: var(--k-red-soft); }
.pt-schedule__body { margin-top: 6px; padding: 0; border-radius: 0; background: transparent; }
.pt-schedule__line { font-weight: 500; }
.pt-requirements__toggle { padding-right: 24px; }
.pt-requirements__body { grid-template-columns: minmax(0, 1fr); padding-right: 20px; }
@media (max-width: 359px) {
  .pt-gallery { height: 176px; }
  .pt-gallery--0, .pt-gallery--1 { height: 196px; }
  .pt-body { padding-left: 12px; padding-right: 12px; }
  .pt-film__cover { height: 160px; }
  .pt-film__empty { height: auto; }
  .pt-facts__value { font-size: 13px; }
  .pt-facilities { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* ===== 2026-11-18 第三轮返修（r3jobsa 评审第 1 轮）：兼职 / 全职详情 =====
   ① 紧急招募不再压在头图左上角（原来正好盖住「袋鼠线下实地探访」）：和薪资一起放到标题下面一行（插槽内容的样式在 detail-r3.scss）；
   ② 区块标题一律 16 / 700（招募信息、位置与交通、兼职招募要求、任职要求、该店亮点…），小标题（岗位工作内容、排班与工时、出行参考）14 / 600，排班与工时前的小钟去掉；
   ③ 「任职要求 · 查看要求」：一行 44 高、上下居中，「查看要求 ⌄」对齐到内容右线；
   ④ 采访视频下面的缩略图改成 72 × 72 的方图，左对齐横排；⑤ 「该店亮点」标题到说明 10；
   ⑥ 排班与工时：标签 13 灰、取值 14 / 600 墨色；⑦ 门店采访待补充：一行小图标 + 灰字，不再是方块 + 粗标题；⑧ 区块之间 20 留白 + 发丝线。 */
.pt-lead { order: 1; flex: 0 0 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 0 8px; }
.pt-heading__top { order: 0; }
.pt-heading__meta { order: 2; }
.pt-heading__actions { order: 3; }
.pt-h, .pt-h--small { font-size: 16px; font-weight: 700; line-height: 22px; }
.pt-work .pt-h, .pt-schedule .pt-h, .pt-traffic__label { font-size: 14px; font-weight: 600; line-height: 20px; color: var(--k-ink); }
.pt-schedule__dup { display: none; }
.pt-schedule__line { font-size: 14px; font-weight: 600; line-height: 22px; color: var(--k-ink); }
.pt-schedule__k { font-size: 13px; font-weight: 400; color: var(--k-muted); }
.pt-requirements { margin-top: 20px; }
.pt-requirements__toggle { min-height: 44px; padding: 10px 0 0; box-sizing: border-box; align-items: center; font-size: 16px; font-weight: 700; line-height: 22px; }
.pt-requirements__hint { display: flex; align-items: center; margin-left: auto; font-size: 13px; line-height: 20px; }
.pt-film__strip { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 8px; }
.pt-film__thumb { flex: 0 0 72px; width: 72px; height: 72px; border-radius: 8px; }
.pt-facilities-empty .pt-h { margin-bottom: 10px; }
.pt-facilities-empty .pt-pending { display: block; margin-top: 0; }
.pt-film__empty { min-height: 0; padding: 0; flex-direction: row; align-items: center; justify-content: flex-start; gap: 6px; }
.pt-film__empty .pt-film__play--pending { position: static; flex: 0 0 auto; width: 14px; height: 14px; margin: 0; border-radius: 0; background: transparent; transform: none; }

.pt-film__empty { flex-wrap: wrap; row-gap: 2px; }
.pt-film__empty .pt-film__heading { order: 1; position: static; padding: 0; background: transparent; }
.pt-film__empty .pt-film__title { font-size: 13px; font-weight: 500; line-height: 18px; color: var(--k-ink2); }
.pt-film__empty .pt-film__play--pending { order: 0; }
.pt-film__empty .pt-film__caption--pending { order: 2; flex: 0 0 100%; position: static; margin: 0; padding: 0 0 0 20px; box-sizing: border-box; font-size: 12px; line-height: 18px; color: var(--k-muted); background: transparent; }
.pt-location__address { padding-right: 4px; }
.pt-main .pt-location { margin-top: 20px; padding-top: 20px; position: relative; }
.pt-main .pt-location::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.pt-manager__avatar { width: 56px; height: 56px; border-radius: 50%; }
/* ===== 2026-11-18 第三轮返修第 2 轮（r3jobsa 评审第 2 轮）：兼职 / 全职详情 =====
   ① 「订阅」从标题右边挪到「安心商家 … 收藏」那一行，标题占满整行，不再把「提供」拆开；收藏、订阅同一种 28 高白底细边胶囊，右边让出客服浮钮 12；
   ② 店长介绍：56 头像贴左线，评分小标签挪到右边文字列最下面，文字列右边让出 28；
   ③ 招募信息三格：中间那格放宽、数字不折行（「2026年11月30日」不再把「日」掉到第二行）；
   ④ 采访视频下面的门店照片和三列媒体格一样宽（一张时也占 1/3），不再是孤零零 72 的小方块；
   ⑤ 地址用均衡换行，「· 平潭」不再单独挂一行；岗位待遇里的薪资降成 14 / 600（标题下面已经有大字）。 */
.pt-heading__actions { display: flex; align-items: center; gap: 8px; margin-right: 12px; }
.pt-heading__actions .pt-favorite { margin: -4px 0 -4px auto; }
.pt-heading__actions .pt-heading__subscribe { flex: 0 0 auto; margin: -8px -8px -8px -4px; }
.pt-favorite { min-width: 0; height: 36px; padding: 0 10px; gap: 4px; border: 4px solid transparent; border-radius: 18px; background: var(--k-paper) padding-box; box-shadow: inset 0 0 0 1px var(--k-line2); font-size: 12px; font-weight: 500; color: var(--k-ink2); }

.pt-heading__title { text-wrap: pretty; }
.pt-manager__portrait { min-width: 0; }
.pt-manager__col { flex: 1; min-width: 0; padding-right: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.pt-manager__col > .pt-manager__copy { align-self: stretch; }
.pt-manager__pending { align-self: stretch; }
.pt-facts__dates { flex: 2.5; }
.pt-facts__line + .pt-facts__line { flex: 1.5; }
.pt-facts__value { white-space: nowrap; }
.pt-film__strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pt-film__thumb { width: auto; height: 0; padding-bottom: 100%; position: relative; overflow: hidden; }
.pt-film__thumb image { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.pt-location__address { text-wrap: balance; }
.pt-benefits__highlight:not(.pt-benefits__highlight--board) { font-size: 14px; font-weight: 600; line-height: 20px; color: var(--k-ink2); }
@media (max-width: 359px) {
  .pt-heading__title { font-size: 18px; line-height: 26px; }
  .pt-facts__value { font-size: 13px; }
  .pt-facts__line, .pt-facts__item { padding: 0 2px; }
}
/* ===================== 2026-11-18 第三轮返修第 3 轮：和换宿详情同一套版式 =====================
   「安心商家」贴 16 线、收藏 / 订阅贴右边线（不再给客服钮让 12px）；没有「安心商家」时两颗胶囊靠左；
   店长评分带 12 号星的浅棕胶囊；用户反馈 / 店内日常标题行右边 14 号箭头；安心保障加圆点、标签 600；
   岗位待遇的对勾不要实心圆底；采访视频下只有一张照片时占满一行 3:2；该店亮点没填时是一条 40 高的浅米说明条。 */
.pt-heading__actions { margin-left: 0; margin-right: 0; flex-wrap: wrap; row-gap: 8px; }
.pt-safe { height: 22px; padding: 0 8px; gap: 4px; border-radius: 4px; font-size: 12px; line-height: 22px; }
.pt-state { height: 22px; padding: 0 8px; font-size: 12px; line-height: 22px; }
.pt-heading__actions .pt-favorite:first-child { margin-left: -4px; }
.pt-manager__col { padding-right: 0; }
.pt-manager__rating, .pt-manager__unrated { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 11px; font-size: 12px; font-weight: 500; line-height: 22px; white-space: nowrap; }
.pt-manager__rating { background: var(--k-red-soft); color: var(--k-red-deep); }
.pt-manager__unrated { background: var(--k-paper2); color: var(--k-muted); }
.pt-feedback__head, .pt-daily__head { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.pt-daily__head { min-height: 32px; margin: -6px 0; }
.pt-assurance__row { position: relative; padding-left: 24px; }
.pt-assurance__row::before { content: ''; position: absolute; left: 12px; top: 12px; width: 4px; height: 4px; border-radius: 2px; background: var(--k-light); }
.pt-h + .pt-assurance__row::before { top: 18px; }
.pt-assurance__row, .pt-h + .pt-assurance__row, .pt-assurance__row:last-child { background: var(--k-paper2); }
.pt-assurance__k { font-weight: 600; color: var(--k-ink); }
.pt-check { width: auto; height: auto; flex: 0 0 auto; border-radius: 0; background: transparent; }
.pt-benefits__highlight { gap: 4px; }
.pt-film__thumb:only-child { grid-column: 1 / -1; padding-bottom: 66.67%; }
.pt-facilities-empty__tip { display: flex; align-items: center; gap: 4px; height: 40px; padding: 0 12px; border-radius: 8px; background: var(--k-paper2); }
.pt-facilities-empty .pt-facilities-empty__tip .pt-pending { margin: 0; font-size: 12px; line-height: 18px; color: var(--k-muted); }
.pt-facility { gap: 6px; }
@media (max-width: 359px) {
  .pt-heading__actions { column-gap: 8px; }
}
/* ===================== 2026-11-18 第三轮返修第 4 轮（r3jobsa 评审第 4 轮） =====================
   ① 320 宽左右边距回到 12 / 12（删掉给旧客服钮让位的右边 28）；标题改 pretty 换行，不再把「小院」从中间断开；
   ② 没有「安心商家」时，收藏 / 订阅跟在「还招 N 人」后面、贴右边线，和标签之间留 8，不再叠在一起；收藏和订阅看上去间隔 8；
   ③ 岗位待遇：「提供食宿」「住宿：三人间」同一行、同一种 22 高 12 号小标签；④ 排班说明那一行改 13 / 400 次要色，和上下两行同一种写法；
   ⑤ 采访视频下只有一张照片时 16:9；门店采访待补充时下面的照片缩成 56 高缩略条（不和头图抢）；⑥ 小地图统一成浅米底 + 暖棕定位图标。 */
.pt-heading { column-gap: 8px; }
.pt-heading__actions { flex: 1 1 auto; justify-content: flex-end; gap: 8px; margin-left: 0; }
.pt-heading__actions .pt-favorite, .pt-heading__actions .pt-favorite:first-child { margin: -4px 0; }
.pt-heading__actions .pt-safe + .pt-favorite { margin-left: auto; }
.pt-heading__actions .pt-heading__subscribe { margin-left: -12px; }
.pt-benefits__paper { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 6px; }
.pt-benefits__paper > .pt-fee { flex: 0 0 100%; margin-bottom: 4px !important; }
.pt-benefits__paper > .pt-benefits__highlights, .pt-benefits__paper > .pt-benefits__items, .pt-benefits__items > .pt-benefits__group { display: contents; }
.pt-benefits__highlight--board, .pt-benefits__items .pt-bullet { height: 22px; min-height: 22px; padding: 0 8px; border-radius: 4px; font-size: 12px; font-weight: 500; line-height: 22px; }
.pt-schedule__line--note { font-size: 13px; font-weight: 400; color: var(--k-ink2); }
.pt-film__thumb:only-child { padding-bottom: 56.25%; }
.pt-film__empty ~ .pt-film__strip { grid-template-columns: repeat(auto-fill, 56px); }
.pt-film__empty ~ .pt-film__strip .pt-film__thumb { height: 56px; padding-bottom: 0; grid-column: auto; }
.pt-map { width: 64px; height: 56px; flex: 0 0 64px; background: var(--k-paper2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
.pt-map__icon { flex: 0 0 auto; }
.pt-map .pt-map__pending { position: static; background: transparent; font-size: 11px; line-height: 16px; color: var(--k-muted); }
.pt-map .pt-map__pending--on { color: var(--k-red-deep); font-weight: 500; } /* 11-18：有坐标时也写「地图」，和换宿详情一样，一看就知道能点开 */
@media (max-width: 359px) {
  .pt-heading__actions { flex-basis: 100%; justify-content: flex-start; }
}
/* ===================== 2026-11-18 第三轮返修第 5 轮（r3jobsa 评审第 5 轮） =====================
   ① 采访视频 / 「门店采访待补充」下面的门店照片：一律 3 等分方格、间距 8（只有 1 张时占 1/3，不再是一张没标题的全宽大图；3 张也不再挤在左边）；
   ② 小地图 56×56：浅灰底 + 发丝线网格，一看就是地图；③ 岗位待遇里的薪资和别的标签同一套 22 高小标签（浅棕底深棕 12/600）；
   ④ 店内日常照片格加载前有浅米底；⑤ 「暂无评价，期待你的真实体验」均分两行，不再单剩一个字；
   ⑥ 安心保障三行和换宿版一样：同一块浅灰底、行间不画线；⑦ 320 宽收藏胶囊贴回 12 的左线。 */
.pt-film__strip, .pt-film__empty ~ .pt-film__strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.pt-film__thumb, .pt-film__thumb:only-child, .pt-film__empty ~ .pt-film__strip .pt-film__thumb { grid-column: auto; width: auto; height: 0; padding-bottom: 100%; position: relative; overflow: hidden; border-radius: 8px; background: var(--k-paper2); }
.pt-film__thumb image { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.pt-map { width: 56px; height: 56px; flex: 0 0 56px; border-radius: 8px; background-color: var(--k-page); background-image: linear-gradient(var(--k-line) 1px, transparent 1px), linear-gradient(90deg, var(--k-line) 1px, transparent 1px); background-size: 14px 14px; background-position: -1px -1px; box-shadow: inset 0 0 0 1px var(--k-line); }
.pt-benefits__highlight:not(.pt-benefits__highlight--board) { height: 22px; min-height: 22px; padding: 0 8px; border-radius: 4px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 12px; font-weight: 600; line-height: 22px; }
.pt-daily__cell { background: var(--k-paper2); }
.pt-feedback__empty { font-size: 12px; text-wrap: balance; }
.pt-assurance__row, .pt-h + .pt-assurance__row, .pt-assurance__row:last-child { border: 0; box-shadow: none; background: var(--k-page); }
.pt-assurance__row + .pt-assurance__row { margin-top: -1px; padding-top: 5px; } /* 三行各自铺底，叠 1px 免得两行之间露出一条缝 */
.pt-facilities-empty__tip { background: var(--k-page); }
@media (max-width: 359px) {
  .pt-heading__actions .pt-favorite:first-child { margin-left: -4px; }
}

/* ===================== 2026-11-18 第四轮「高级感」（r3jobsa） =====================
   ① 标题块收成「标题 / 状态加截止 / 一行信息 / 收藏 + 订阅」：「兼职岗位｜平潭岛」「还招 N 人」（绿字）「安心商家」（绿盾 + 绿字）
      排在同一行、都不要底色；收藏和订阅另起一行靠左（和换宿详情同一个样子）；
   ② 出行参考去掉灰框；③ 视频播放钮 48 白圆；视频下只有 1–2 张门店照片时是贴在视频下沿的 56 高缩略图带（3 张仍三等分）；
   ④ 全职头图三张改成 L 形拼图（左 2/3 满高，右边上下两张）；⑤ 岗位待遇小标签统一浅米底 22 高 12 号，「包吃包住」只用绿字。 */
.pt-detail .pt-heading { display: flex; flex-wrap: wrap; align-items: center; column-gap: 12px; }
.pt-detail .pt-heading::before { content: ''; order: 5; flex: 0 0 100%; height: 8px; }
.pt-detail .pt-heading__top { order: 1; flex: 0 0 100%; }
.pt-detail .pt-lead { order: 2; flex: 0 0 100%; }
.pt-detail .pt-heading__meta, .pt-detail .pt-heading__actions { display: contents; }
.pt-detail .pt-heading__sub { order: 3; margin: 8px 0 0; font-size: 13px; line-height: 20px; color: var(--k-muted); }
.pt-detail .pt-state { order: 3; height: auto; margin: 8px 0 0; padding: 0; border-radius: 0; background: transparent; font-size: 13px; font-weight: 500; line-height: 20px; color: var(--k-green); }
.pt-detail .pt-state--closed { color: var(--k-muted); }
.pt-detail .pt-safe { order: 4; height: auto; margin: 8px 0 0; padding: 0; gap: 4px; border-radius: 0; background: transparent; font-size: 13px; font-weight: 500; line-height: 20px; color: var(--k-green); }
.pt-detail .pt-heading { justify-content: flex-start; }
.pt-detail .pt-heading .pt-favorite { order: 6; margin: -4px 0 -4px -4px; }
.pt-detail .pt-heading .pt-heading__subscribe { order: 7; margin-left: 0; margin-top: -8px; margin-bottom: -8px; }
.pt-detail .pt-traffic__copy { padding: 0; border-radius: 0; background: transparent; }
.pt-detail .pt-film__play:not(.pt-film__play--pending) { width: 48px; height: 48px; margin: -24px 0 0 -24px; padding-left: 2px; background: rgba(255, 255, 255, .9); }
.pt-detail .pt-film__strip--few { display: flex; justify-content: flex-start; gap: 4px; margin-top: 4px; }
.pt-detail .pt-film__strip--few .pt-film__thumb { flex: 0 0 56px; width: 56px; height: 56px; padding: 0; border-radius: 8px; }
.pt-detail .pt-film__strip--few .pt-film__thumb image { position: static; width: 56px; height: 56px; border-radius: 8px; }
.pt-detail .pt-gallery--3 { display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; gap: 2px; }
.pt-detail .pt-gallery--3 .pt-gallery__cell:first-child { grid-row: 1 / span 2; }
.pt-detail .pt-gallery--3 .pt-gallery__cell { width: auto; height: auto; min-height: 0; }
.pt-detail .pt-benefits__highlight { height: 22px; min-height: 22px; padding: 0 8px; gap: 2px; border: 0; border-radius: 4px; background: var(--k-paper2); box-shadow: none; color: var(--k-ink2); font-size: 12px; font-weight: 500; line-height: 22px; }
.pt-detail .pt-benefits__highlight text { font-size: 12px; font-weight: 500; color: var(--k-ink2); }
.pt-detail .pt-benefits__highlight--board, .pt-detail .pt-benefits__highlight--board text { color: var(--k-green); }
.pt-detail .pt-benefits__highlight .pt-check { width: auto; height: auto; background: transparent; }

/* ===================== 2026-11-19 第四轮返修（r3jobsa 复评遗留） =====================
   ① 标题块不再用 display:contents（老 iOS 微信不认）：「安心商家」从按钮行挪进信息行（只挪位置，显示条件不变），
      信息行和换宿一样 13/500 墨灰，「还招」「安心商家」前 1×10 发丝竖线；收藏 + 订阅一行靠左、间距 8；
   ② 招募信息三栏去掉灰底，上下发丝线（和换宿一样）；③ 视频下的缩略图带离视频 8；
   ④「门店设施待补充」「袋鼠安心保障」去掉灰底：一行灰字 / 发丝线列表。 */
.pt-detail .pt-heading { display: flex; flex-direction: column; align-items: stretch; }
.pt-detail .pt-heading::before { content: none; display: none; }
.pt-detail .pt-heading__top { order: 1; }
.pt-detail .pt-lead { order: 2; }
.pt-detail .pt-heading__meta { order: 3; display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 0; min-height: 0; margin: 8px 0 0; padding: 0; }
.pt-detail .pt-heading__actions { order: 4; display: flex; flex-wrap: nowrap; align-items: center; justify-content: flex-start; gap: 0; margin: 8px 0 0; }
.pt-detail .pt-heading__sub, .pt-detail .pt-state, .pt-detail .pt-safe { position: relative; margin: 0; font-size: 13px; font-weight: 500; line-height: 20px; }
.pt-detail .pt-heading__sub { color: var(--k-ink2); }
.pt-detail .pt-heading__sub ~ .pt-state, .pt-detail .pt-heading__sub ~ .pt-safe { margin-left: 8px; padding-left: 9px; }
.pt-detail .pt-heading__sub ~ .pt-state::before, .pt-detail .pt-heading__sub ~ .pt-safe::before { content: ''; position: absolute; left: 0; top: 5px; width: 1px; height: 10px; background: var(--k-line2); }
.pt-detail .pt-heading .pt-heading__actions .pt-favorite { order: 0; margin: -4px 0 -4px -4px; }
.pt-detail .pt-heading .pt-heading__actions .pt-heading__subscribe { order: 0; margin: -8px 0 -8px -4px; }
.pt-detail .pt-facts { position: relative; padding: 12px 0; border-radius: 0; background: transparent; box-shadow: none; }
.pt-detail .pt-film__strip--few { gap: 8px; margin-top: 8px; }
.pt-detail .pt-traffic__copy { text-wrap: pretty; } /* 11-19 微信实拍：balance 让三行都在离右边 50 处折行、右边参差；pretty 只防末行单字 */
.pt-detail .pt-facilities-empty__tip { min-height: 0; padding: 0; border-radius: 0; background: transparent; }
.pt-detail .pt-assurance__row, .pt-detail .pt-h + .pt-assurance__row, .pt-detail .pt-assurance__row:last-child { margin-top: 0; padding: 2px 0 2px 12px; border-radius: 0; background: transparent; font-size: 13px; }
.pt-detail .pt-h + .pt-assurance__row { margin-top: 8px; }
.pt-detail .pt-assurance__row + .pt-assurance__row { margin-top: 0; padding-top: 2px; }
.pt-detail .pt-assurance__row::before, .pt-detail .pt-h + .pt-assurance__row::before { left: 0; top: 10px; }

/* ===================== 2026-11-19 微信实拍返修（r3jobsa） =====================
   ①「排班与工时」前的小钟从模板里删掉（:deep 在微信里够不到 k-icon，藏不住），两个小标题都不带图标；
   ② 招募信息三格：半像素内阴影在微信里会描出左右两条淡线，改成和换宿一样的上下两条伪元素发丝线；
   ③ 视频下只有 1–2 张门店照片：也按三等分方格排（约 109 方图、圆角 8、间距 8），不再是贴在视频角上的 56 小块；
   ④ 信息行竖线和文字里的「｜」一个样子（13 高、灰）；⑤ 岗位待遇小标签统一一种浅米底（门店收费那组仍是赭色）。 */
.pt-detail .pt-facts::before, .pt-detail .pt-facts::after { content: ''; position: absolute; left: 0; right: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.pt-detail .pt-facts::before { top: 0; }
.pt-detail .pt-facts::after { bottom: 0; }
.pt-detail .pt-film__strip--few { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.pt-detail .pt-film__strip--few .pt-film__thumb { position: relative; width: auto; height: 0; padding-bottom: 100%; overflow: hidden; border-radius: 8px; }
.pt-detail .pt-film__strip--few .pt-film__thumb image { position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: 8px; }
.pt-detail .pt-heading__sub ~ .pt-state::before, .pt-detail .pt-heading__sub ~ .pt-safe::before { top: 4px; height: 12px; background: var(--k-light); }
.pt-detail .pt-benefits__group:not(.pt-benefits__fees) .pt-bullet { background: var(--k-paper2); }
</style>
