<template>
  <view class="pt-detail">
    <view class="pt-gallery" :class="'pt-gallery--' + Math.min(m.gallery.length, 3)">
      <view v-for="(src, index) in gallerySlots" :key="index" class="pt-gallery__cell" :role="src ? 'button' : undefined" :aria-label="src ? '查看岗位照片' + (index + 1) : '门店照片待补充'" :hover-class="src ? 'k-press' : 'none'" @click="src && emit('preview-hero', index)">
        <image v-if="src" class="pt-gallery__image" :src="src" mode="aspectFill" />
        <view v-else class="pt-gallery__empty"><k-icon name="image" :size="25" color="#BCAA92" /><text>照片待补充</text></view>
        <text v-if="index === 2 && m.gallery.length > 3" class="pt-gallery__count">{{ m.gallery.length }}张</text>
      </view>
      <text v-if="m.heroCaption && m.gallery.length" class="pt-gallery__caption">{{ m.heroCaption }}</text>
    </view>

    <view class="pt-body">
      <view class="pt-heading">
        <view class="pt-heading__top"><view class="pt-heading__title" role="button" aria-label="查看门店" hover-class="k-press" @click="emit('store')"><text>{{ m.title }}</text></view><view class="pt-heading__subscribe"><slot name="subscription" /></view></view>
        <view class="pt-heading__meta"><text class="pt-heading__sub">{{ m.subline }}</text><text v-if="m.status" class="pt-state" :class="{ 'pt-state--closed': m.blocked }">{{ m.status }}</text></view>
        <view class="pt-heading__actions">
          <view v-if="m.safe" class="pt-safe"><k-icon name="shield-check" :size="16" color="#579C43" /><text>安心商家</text></view>
          <view class="pt-favorite" :class="{ 'is-busy': m.favoriteBusy }" role="button" :aria-pressed="m.favorite" :aria-disabled="m.favoriteBusy" :aria-label="m.favorite ? '取消收藏岗位' : '收藏岗位'" hover-class="k-press" @click="!m.favoriteBusy && emit('favorite')"><k-icon name="star" :size="24" :color="m.favorite ? '#AD7A40' : '#6A625B'" :fill="m.favorite" :stroke="1.6" /><text>{{ m.favorite ? '已收藏' : '收藏' }}</text></view>
        </view>
      </view>
      <view v-if="m.blocked" class="pt-alert"><k-icon name="info" :size="16" color="#C66559" /><text>{{ m.blocked }}</text></view>

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
          <view class="pt-map" :class="{ 'pt-map--pending': !m.map }" role="button" :aria-label="m.map ? '打开地图' : m.place ? '地图搜索门店地址' : '门店位置待补充'" hover-class="k-press" @click="emit('map')"><image class="pt-map__art" :src="DETAIL_ART.employmentMap" mode="aspectFill" /><text v-if="!m.map" class="pt-map__pending">{{ m.place ? '搜索地址' : '位置待补充' }}</text></view>
        </view>
        <view v-if="m.travel.rows.length" class="pt-traffic"><text class="pt-traffic__label">出行参考</text><view class="pt-traffic__copy"><text v-for="row in m.travel.rows" :key="row.k" class="pt-traffic__line">{{ row.k }}：{{ row.v }}</text><text class="pt-traffic__note">{{ m.travelNote }}</text></view></view>
        <view v-else class="pt-traffic"><text class="pt-pending">交通路线待门店补充</text></view>

        <view class="pt-film">
          <view v-if="m.interview" class="pt-film__cover" role="group" aria-label="门店采访视频" :hover-class="m.playing?.url ? 'none' : 'k-press'" @click="!m.playing?.url && emit('interview')">
            <job-video-player v-if="m.playing?.url" inline :src="m.playing.url" :poster="m.playing.cover" :title="m.playing.title" @close="emit('close-video')" />
            <template v-else>
            <image v-if="m.interview.cover" class="pt-film__image" :src="m.interview.cover" mode="aspectFill" />
            <view class="pt-film__shade" />
            <view class="pt-film__heading"><text v-if="m.interview.mode" class="pt-film__badge">{{ m.interview.mode }}</text><text class="pt-film__title">{{ m.interview.title.replace('实地采访', '线下采访') }}</text></view>
            <view class="pt-film__play"><k-icon name="play" :size="22" color="white" fill /></view>
            <text class="pt-film__caption">{{ m.interview.caption }}</text>
            </template>
          </view>
          <view v-else class="pt-film__cover pt-film__empty">
            <view class="pt-film__heading"><text class="pt-film__title">{{ m.pendingInterview.title }}</text></view>
            <view class="pt-film__play pt-film__play--pending"><k-icon name="video" :size="22" color="#9D886D" :stroke="1.4" /></view>
            <text class="pt-film__caption pt-film__caption--pending">{{ m.pendingInterview.caption }}</text>
          </view>
          <view v-if="filmSlots.length" class="pt-film__strip"><view v-for="(src, index) in filmSlots" :key="index" class="pt-film__thumb" role="button" :aria-label="'查看门店照片' + (index + 1)" hover-class="k-press" @click="emit('preview-daily', index)"><image :src="src" mode="aspectFill" /></view></view>
        </view>

        <view class="pt-jobs">
          <text class="pt-h pt-jobs__title">{{ m.recruitmentTitle }}</text>
          <view class="pt-jobs__columns">
            <view class="pt-work"><text class="pt-h">岗位工作内容</text><text v-if="contentOpen && content.introduction" class="pt-work__intro">{{ content.introduction }}</text><view v-for="(line, index) in content.lines" :key="index" class="pt-bullet" :class="{ 'pt-bullet--lead': index === 0 }"><text class="pt-bullet__dot">·</text><text>{{ line }}</text></view><view v-if="content.introduction" class="pt-work__toggle" role="button" :aria-expanded="contentOpen" aria-label="查看完整岗位介绍" hover-class="k-press" @click="contentOpen = !contentOpen"><text>{{ contentOpen ? '收起岗位介绍' : '查看完整岗位介绍' }}</text><k-icon :name="contentOpen ? 'chevron-up' : 'chevron-down'" :size="12" color="#9A7F62" /></view><text v-if="!content.lines.length" class="pt-pending">工作内容待补充</text></view>
            <view class="pt-schedule"><view class="pt-schedule__heading"><k-icon name="clock-3" :size="15" color="#B89064" /><text class="pt-h">排班与工时</text></view><view v-if="schedule" class="pt-schedule__body"><k-icon name="clock-3" :size="14" color="#B89064" /><view class="pt-schedule__copy"><text class="pt-schedule__line">排班模式：{{ schedule.mode || '待补充' }}</text><text v-if="schedule.note" class="pt-schedule__line">{{ schedule.note }}</text><text class="pt-schedule__line">每日工作时长：{{ schedule.hours ? schedule.hours.replace(/^每日/, '') : '待补充' }}</text></view></view><text v-else class="pt-pending">排班与工时待补充</text></view>
          </view>
          <view v-if="m.requirements.length" class="pt-requirements"><view class="pt-requirements__toggle" role="button" aria-label="任职要求" :aria-expanded="requirementsOpen" hover-class="k-press" @click="requirementsOpen = !requirementsOpen"><text>任职要求</text><text class="pt-requirements__hint">{{ requirementsOpen ? '收起' : '查看要求' }}</text><k-icon :name="requirementsOpen ? 'chevron-up' : 'chevron-down'" :size="13" color="muted" /></view><view v-if="requirementsOpen" class="pt-requirements__body"><view v-for="(row, index) in m.requirements" :key="index" class="pt-bullet"><text class="pt-bullet__dot">·</text><text><text v-if="row.k" class="pt-requirements__key">{{ row.k }}</text>{{ row.v }}</text></view></view></view>
        </view>
      </view>

      <view class="pt-benefits">
        <text class="pt-benefits__tab">岗位待遇</text>
        <view class="pt-benefits__paper">
          <text v-if="m.recruitmentFee" style="display:block;font-size:14px;line-height:1.7;margin-bottom:12px">{{ m.recruitmentFee }}</text>
          <template v-if="m.welfare">
            <view v-if="m.welfare.highlights.length" class="pt-benefits__highlights"><view v-for="(highlight, index) in m.welfare.highlights" :key="index" class="pt-benefits__highlight" :class="{ 'pt-benefits__highlight--board': highlight === m.board }"><view class="pt-check"><k-icon name="check" :size="10" color="white" :stroke="3" /></view><text>{{ highlight }}</text></view></view>
            <view class="pt-benefits__items" :class="{ 'pt-benefits__items--split': welfareFees.length }">
              <view><view v-for="(line, index) in welfareMain" :key="index" class="pt-bullet"><text class="pt-bullet__dot">·</text><text>{{ line }}</text></view></view>
              <view v-if="welfareFees.length" class="pt-benefits__fees"><view v-for="(line, index) in welfareFees" :key="index" class="pt-bullet"><text class="pt-bullet__dot">·</text><text>{{ line }}</text></view></view>
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
        <view class="pt-manager__body"><view class="pt-manager__portrait"><image v-if="m.manager && m.manager.avatar" class="pt-manager__avatar" :src="m.manager.avatar" mode="aspectFill" /><view v-else class="pt-manager__avatar pt-manager__avatar--empty"><k-icon name="user-round" :size="28" color="#B39D82" :stroke="1.3" /></view><text v-if="m.manager && m.manager.ratingText" class="pt-manager__rating">店长服务评分 {{ m.manager.ratingText }}</text><text v-else class="pt-manager__unrated">暂无服务评分</text></view><view v-if="m.manager" class="pt-manager__copy"><text class="pt-manager__name">{{ m.manager.name ? '店长：' + m.manager.name : '店长' }}</text><text v-if="m.manager.years" class="pt-manager__line">在这里工作{{ m.manager.years }}</text><text v-if="managerSkills" class="pt-manager__line">擅长：{{ managerSkills }}</text><text v-if="m.manager.quote" class="pt-manager__line">店长说：{{ m.manager.quote }}</text></view><view v-else class="pt-manager__copy pt-manager__pending"><text class="pt-manager__name">店长资料待补充</text><text class="pt-pending">了解店长，出发前多一份熟悉</text></view></view>
      </view>

      <view v-if="m.facilities.length" class="pt-card pt-facilities"><view v-for="facility in m.facilities" :key="facility.code" class="pt-facility"><image v-if="facility.image" class="pt-facility__image" :src="facility.image" mode="aspectFit" /><k-icon v-else :name="facility.icon" :size="23" color="#71858B" /><text>{{ facility.label }}</text></view></view>
      <view v-else class="pt-card pt-facilities-empty"><text class="pt-h">该店亮点</text><text class="pt-pending">门店设施待补充</text></view>

      <view class="pt-life">
        <view class="pt-card pt-feedback"><view class="pt-feedback__head" role="button" aria-label="查看岗位评价" hover-class="k-press" @click="emit('reviews')"><text class="pt-h">用户反馈</text></view><view v-if="m.digest.items.length" class="pt-feedback__quotes" role="button" aria-label="阅读用户反馈" hover-class="k-press" @click="emit('reviews')"><text v-for="item in m.digest.items.slice(0, 2)" :key="item.key" class="pt-feedback__quote">{{ item.text }}</text></view><view v-else class="pt-feedback__empty" role="button" aria-label="查看岗位评价" @click="emit('reviews')">暂无评价，期待你的真实体验 ›</view><view v-if="m.reviewAppId" class="pt-feedback__write" role="button" aria-label="写岗位评价" hover-class="k-press" @click="emit('write-review')">写评价 ›</view></view>
        <view class="pt-card pt-daily" role="button" aria-label="查看店里日常" hover-class="k-press" @click="emit('daily')"><text class="pt-h">店内日常</text><view v-if="m.daily.length" class="pt-daily__photos"><view v-for="(src, index) in m.daily.slice(0, 3)" :key="src + index" class="pt-daily__cell"><image :src="src" mode="aspectFill" /><text v-if="index === 2 && m.daily.length > 3" class="pt-daily__more">+{{ m.daily.length - 3 }}</text></view></view><view v-else class="pt-daily__empty"><k-icon name="image" :size="20" color="#B2A28E" /><text>日常照片待上传</text></view></view>
      </view>

      <view class="pt-card pt-assurance"><text class="pt-h">袋鼠安心保障</text><view v-for="row in assurance" :key="row.key" class="pt-assurance__row"><text>{{ row.k }}：{{ row.v }}</text><view v-if="row.link" class="pt-assurance__link" role="button" aria-label="查看营业执照" hover-class="k-press" @click="emit('assurance', row)">{{ row.link }}</view></view></view>
      <view v-if="m.training" class="pt-card pt-training" role="button" aria-label="查看培训活动" hover-class="k-press" @click="emit('training')"><image v-if="m.training.img" class="pt-training__image" :src="m.training.img" mode="aspectFill" /><view class="pt-training__copy"><text class="pt-training__label">袋鼠成长课堂 · 培训活动</text><text class="pt-h">{{ m.training.title }}</text><text class="pt-pending">{{ [m.training.dateText, m.training.city].filter(Boolean).join(' · ') }}</text><text class="pt-training__link">了解课程与报名 ›</text></view></view>
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
/* 832px reference → 750rpx canvas. Keep typography native; every section uses live job data. */
.pt-detail { --k-sans: 'KG Detail', 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #433A32; font-family: var(--k-sans); font-size: 13px; line-height: 1.5; }
.pt-gallery { display: flex; position: relative; height: 256rpx; margin: 0 9rpx; gap: 3rpx; overflow: hidden; border-radius: 20rpx; background: #EFECE6; }
.pt-gallery__cell { position: relative; flex: 1; min-width: 0; height: 100%; overflow: hidden; }
.pt-gallery__cell:first-child { flex: 1.1; }
.pt-gallery__image { width: 100%; height: 100%; display: block; }
.pt-gallery__empty { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #8B765F; background: #F1E9DC; font-size: 11px; }
.pt-gallery__caption { position: absolute; right: 0; bottom: 12rpx; max-width: 90%; padding: 3rpx 14rpx; color: #FFFDF8; background: rgba(146,113,77,.8); border-radius: 24rpx 0 0 24rpx; font-size: 11px; line-height: 1.5; }
.pt-gallery__count { position: absolute; top: 6px; right: 6px; padding: 1px 6px; border-radius: 10px; background: rgba(40,35,29,.5); color: #FFFEFC; font-size: 10px; }
.pt-body { padding: 0 22rpx 14px; }
.pt-heading { padding: 24rpx 3rpx 0; }
.pt-heading__title { display: block; font-size: 21px; line-height: 1.3; font-weight: 700; letter-spacing: .2px; overflow-wrap: anywhere; }
.pt-heading__meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 2px; }
.pt-heading__sub { color: #716B63; font-size: 12px; }
.pt-state { flex-shrink: 0; background: #E2EFDA; color: #507C3B; border-radius: 6px; font-size: 12px; font-weight: 600; padding: 2px 8px; }
.pt-state--closed { background: #EDDDC5; color: #826543; }
.pt-heading__actions { display: flex; align-items: center; justify-content: space-between; min-height: 30px; margin-top: 2px; }
.pt-safe { display: inline-flex; align-items: center; gap: 4px; background: #DDEFD4; color: #52963F; border-radius: 5px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
.pt-favorite { margin-left: auto; display: flex; align-items: center; gap: 5px; min-height: 30px; padding: 0 2px 0 8px; color: #5A5249; font-size: 13px; }
.pt-favorite.is-busy { opacity: .6; }
.pt-heading__top { display: flex; align-items: center; gap: 12px; }
.pt-heading__top .pt-heading__title { flex: 1; min-width: 0; }
.pt-heading__subscribe { flex: 0 0 auto; max-width: 96px; }
.pt-pending { display: block; color: #8B7B69; font-size: 11px; line-height: 1.7; }
.pt-alert { display: flex; align-items: center; gap: 8px; min-height: 33px; box-sizing: border-box; padding: 6px 12px; margin-top: 3px; border: 1px solid #CB8A80; border-radius: 8px; color: #A35F4A; background: #FCF0EE; font-size: 13px; font-weight: 500; }
.pt-card { margin-top: 7px; padding: 7px 9px; border: 1px solid #E4DDD4; border-radius: 8px; background: #FFFEFC; box-sizing: border-box; box-shadow: 0 1px 2px rgba(80,58,35,.025); }
.pt-h { display: block; font-size: 14px; font-weight: 600; line-height: 1.4; color: #544537; }
.pt-h--small { font-size: 13px; }
.pt-main { padding: 6px 10px 0; }
.pt-facts { display: flex; align-items: flex-start; gap: 10rpx; margin: 6px 0 5px; color: #716B63; font-size: 21rpx; line-height: 1.45; }
.pt-facts__dates { flex: 1.65; min-width: 0; }
.pt-facts__line { display: flex; align-items: baseline; gap: 3px; }
.pt-facts__line > text:first-child { flex-shrink: 0; }
.pt-facts__line .pt-facts__value { flex: 1; min-width: 0; text-align: center; white-space: nowrap; }
.pt-facts__item { flex: 1; min-width: 0; display: flex; align-items: center; flex-direction: column; text-align: center; }
.pt-facts__value { color: #3F3832; font-size: 23rpx; font-weight: 600; overflow-wrap: anywhere; }
.pt-location { display: flex; gap: 8px; align-items: center; padding: 3px 0 3px 7px; border-top: 1px solid #EAE6E0; border-radius: 7px; background: #FBFBF9; }
.pt-location__copy { flex: 1; min-width: 0; }
.pt-location__address { display: block; margin-top: 2px; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.pt-map { position: relative; width: 50px; height: 42px; flex-shrink: 0; overflow: hidden; border-radius: 4px; background: #EEF2ED; }
.pt-map__art { display: block; width: 100%; height: 100%; }
.pt-map--pending .pt-map__art { opacity: .65; }
.pt-map__pending { position: absolute; left: 0; right: 0; bottom: 0; padding: 1px 0; background: rgba(255,254,249,.92); color: #81755F; text-align: center; font-size: 8px; }
.pt-traffic { display: flex; align-items: flex-start; gap: 5px; background: #F3F3F2; border-radius: 4px; padding: 6px 7px; margin-top: 4px; font-size: 9.5px; line-height: 1.6; letter-spacing: -.1px; }
.pt-traffic__label { flex: 0 0 40px; white-space: nowrap; color: #9A9288; }
.pt-traffic__copy { flex: 1; min-width: 0; }
.pt-traffic__line, .pt-traffic__note { display: block; overflow-wrap: anywhere; }
.pt-traffic__note { color: #78726A; font-size: inherit; }
.pt-film { overflow: hidden; border-radius: 8px 8px 0 0; margin-top: 9px; }
.pt-film__cover { position: relative; height: 192rpx; background: #D6D2C7; overflow: hidden; }
.pt-film__empty { background: linear-gradient(120deg, #E5DCCF, #F3EEE5); }
.pt-film__empty .pt-film__heading { color: #78634E; }
.pt-film__image, .pt-film__shade { position: absolute; width: 100%; height: 100%; }
.pt-film__shade { background: linear-gradient(180deg, rgba(28,24,18,.13), transparent 45%, rgba(28,24,18,.55)); }
.pt-film__heading { position: absolute; left: 5px; right: 5px; top: 5px; display: flex; align-items: center; gap: 4px; color: #FCF2D6; }
.pt-film__badge { background: #E5D4AC; color: #705438; border-radius: 12px; font-size: 10px; padding: 1px 6px; white-space: nowrap; }
.pt-film__title { font-size: 13px; font-weight: 600; }
.pt-film__play { position: absolute; left: 50%; top: 50%; width: 38px; height: 38px; margin: -17px 0 0 -19px; background: rgba(29,30,24,.52); border: 1px solid rgba(255,253,247,.6); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.pt-film__caption { position: absolute; bottom: 3px; left: 5px; right: 5px; color: #FFFEFC; font-size: 10px; text-align: center; line-height: 1.4; }
.pt-film__play--pending { background: rgba(255,252,245,.7); border-color: #CEBDA6; }
.pt-film__caption--pending { color: #897B6B; }
.pt-film__strip { display: flex; gap: 2px; height: 50rpx; }
.pt-film__thumb { flex: 1; min-width: 0; }
.pt-film__thumb image { width: 100%; height: 100%; display: block; }
.pt-jobs { margin: 8px -10px 0; }
.pt-jobs__title { margin-left: 10px; margin-bottom: 3px; font-size: 14px; }
.pt-jobs__columns { display: flex; flex-direction:column; gap: 12px; }
.pt-work, .pt-schedule { min-width: 0; box-sizing: border-box; padding: 7px 10px 10px; background: #FFFEFC; border-radius: 8px; }
.pt-work { flex: 1.12; border-bottom: 1px solid #E8E0D7; padding-left: 9px; padding-right: 7px; }
.pt-work .pt-bullet { font-size: 14px; line-height:1.8; }
.pt-work__intro { display: block; margin: 5px 0; font-size: 14px; line-height: 1.8; color: #716354; }
.pt-work__toggle { display: flex; align-items: center; gap: 3px; padding: 5px 0 0; color: #947657; font-size: 10px; }
.pt-schedule { flex: 1; }
.pt-schedule__heading { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; }
.pt-schedule__body { display: flex; align-items: flex-start; gap: 6px; }
.pt-schedule__copy { flex: 1; min-width: 0; }
.pt-schedule__line { display: block; font-size: 11px; line-height: 1.8; overflow-wrap: anywhere; }
.pt-bullet { display: flex; align-items: flex-start; gap: 5px; font-size: 11px; line-height: 1.65; margin-top: 2px; }
.pt-bullet > text:last-child { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.pt-bullet__dot { flex-shrink: 0; font-weight: 700; color: #B8946C; }
.pt-bullet--lead { color: #9B6C40; font-weight: 600; }
.pt-requirements { border-top: 1px solid #F0EBE5; margin: 0 10px; }
.pt-requirements__toggle { min-height: 30px; display: flex; align-items: center; gap: 4px; font-size: 12px; }
.pt-requirements__hint { margin-left: auto; color: #8B8176; font-size: 11px; }
.pt-requirements__body { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; align-items: start; padding-bottom: 8px; }
.pt-requirements__body .pt-bullet { min-width: 0; margin: 0; font-size: 14px; line-height: 1.65; }
.pt-requirements__key { padding-right: 6px; color: var(--k-red-deep); font-weight: 700; white-space: nowrap; }
.pt-benefits { position: relative; margin-top: 7px; padding: 30px 7px 5px; min-height: 120px; box-sizing: border-box; border: 1px solid #C7A27A; border-radius: 9px; background: linear-gradient(110deg, #C2996B 0%, #E5D0B2 38%, #FAF5EB 70%); overflow: hidden; }
.pt-benefits__tab { position: absolute; top: 0; left: 0; width: 132px; box-sizing: border-box; padding: 2px 14px 4px; border-radius: 0 0 13px 0; background: #BF9468; color: #FFFBF3; font-size: 18px; font-weight: 600; letter-spacing: 1px; }
.pt-benefits__paper { padding: 4px 10px; min-height: 82px; box-sizing: border-box; background: rgba(255,252,244,.78); border-radius: 8px; }
.pt-benefits__highlights { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.pt-benefits__highlight { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: 5px; color: #875D35; font-size: 16px; font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; }
.pt-benefits__highlight--board { flex: 0 1 auto; justify-content: flex-start; max-width: 55%; background: #FFFCF3; padding: 3px 10px; border-radius: 5px; font-size: 21px; }
.pt-check { flex: 0 0 14px; width: 14px; height: 14px; border-radius: 50%; background: #6CAE57; display: flex; align-items: center; justify-content: center; }
.pt-benefits__items { margin-top: 4px; }
.pt-benefits__items--split { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(0,1fr); gap: 7px; align-items: end; }
.pt-benefits__fees { min-width: 0; }
.pt-benefits__items .pt-bullet { margin-top: 0; color: #6D553C; }
.pt-manager__body { display: flex; align-items: flex-start; gap: 8px; margin-top: 3px; min-height: 69px; }
.pt-manager__portrait { width: 75px; flex-shrink: 0; padding-top: 3px; }
.pt-manager__avatar { display: block; width: 50px; height: 50px; margin: 0 7px 3px; border-radius: 50%; }
.pt-manager__avatar--empty { display: flex; align-items: center; justify-content: center; background: #F2ECE3; }
.pt-manager__unrated { display: block; color: #998772; font-size: 9px; }
.pt-manager__pending { align-self: center; }
.pt-manager__rating { display: block; width: max-content; background: #F2E3CC; color: #88603D; border-radius: 3px; padding: 0 3px; font-size: 9px; white-space: nowrap; line-height: 1.4; }
.pt-manager__copy { flex: 1; min-width: 0; }
.pt-manager__name { display: block; font-weight: 600; font-size: 13px; }
.pt-manager__line { display: block; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.pt-facilities { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); padding: 4px 3px; gap: 2px; }
.pt-facility { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; font-size: 10px; line-height: 1.3; }
.pt-facility__image { height: 23px; width: 28px; }
.pt-life { display: grid; grid-template-columns: minmax(0,1.85fr) minmax(0,1fr); gap: 3px; }
.pt-feedback, .pt-daily { margin-top: 5px; padding: 5px 7px 7px; min-height: 77px; }
.pt-feedback__head { display: flex; align-items: center; justify-content: space-between; min-height: 21px; }
.pt-feedback__quotes { margin-top: 3px; }
.pt-feedback__quote { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; background: #F5F4F0; border-radius: 3px; padding: 0 3px; margin-top: 2px; font-size: 18rpx; line-height: 1.75; letter-spacing: -.1px; }
.pt-feedback__empty, .pt-feedback__write { font-size: 11px; color: #8A6B4C; line-height: 2; }
.pt-daily__photos { display: flex; gap: 3px; height: 76rpx; margin-top: 4px; }
.pt-daily__empty { min-height: 76rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; margin-top: 4px; background: #F5F1EA; border-radius: 4px; font-size: 10px; color: #907C66; }
.pt-daily__cell { flex: 1; min-width: 0; position: relative; overflow: hidden; border-radius: 2px; }
.pt-daily__cell image { display: block; height: 100%; width: 100%; }
.pt-daily__more { position: absolute; bottom: 2px; right: 2px; color: #FFFEFA; background: rgba(40,35,29,.6); padding: 0 3px; font-size: 9px; border-radius: 3px; }
.pt-assurance { padding: 6px 9px; }
.pt-assurance__row { display: flex; flex-wrap: wrap; gap: 0 4px; font-size: 11px; line-height: 1.65; margin-top: 2px; }
.pt-assurance__link { color: #9A6B3F; font-size: 11px; font-weight: 600; }
.pt-training { display: flex; gap: 10px; background: #F6EDDF; }
.pt-training__image { width: 90px; min-height: 90px; align-self: stretch; border-radius: 5px; }
.pt-training__copy { flex: 1; min-width: 0; }
.pt-training__label { color: #94724D; font-size: 10px; }
.pt-training__link { display: block; color: #95663D; font-size: 12px; margin-top: 5px; }
@media (max-width: 350px) { .pt-facts__line { gap: 1px; } .pt-jobs__columns { gap: 2px; } .pt-work, .pt-schedule { padding-left: 7px; padding-right: 7px; } .pt-benefits__highlight--board { font-size: 17px; } .pt-benefits__highlight { font-size: 14px; } .pt-feedback__quote { font-size: 9.5px; } .pt-benefits__items--split { grid-template-columns: 1fr; } }
</style>
