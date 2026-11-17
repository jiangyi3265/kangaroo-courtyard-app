<template>
  <!-- 岗位详情「住宿环境」「店里的宠物」共用的图格（2026-10-31）：3 列方图，视频放第一格带播放钮；格子放不下的在最后一格写 +N，点开大图能翻全部。
       看大图、放视频都在这里处理，页面不用接事件；全屏播放层和采访视频是两份状态，互不影响。 -->
  <view class="jmg" :class="{ 'jmg--lodging': layout === 'lodging', 'jmg--single': layout === 'lodging' && cells.length === 1 }">
    <view v-if="layout === 'lodging' && !cells.length" class="jmg__empty"><k-icon name="bed-double" :size="28" color="red" :stroke="1.5" /><text>门店暂未上传住宿照片或视频</text></view>
    <view v-for="cell in cells" :key="cell.key" class="jmg__cell" :class="{ 'jmg__cell--video': cell.video }" role="button" :aria-label="cell.video ? '播放' + title + '视频' : '查看' + title + '照片'" hover-class="k-press-s" @click="tapCell(cell)">
      <view class="jmg__box">
        <image v-if="cell.src" class="jmg__img" :src="cell.src" mode="aspectFill" />
        <view v-if="cell.video" class="jmg__play"><k-icon name="play" :size="18" color="white" fill /></view>
        <text v-if="cell.video" class="jmg__tag">视频</text>
        <view v-if="cell.more" class="jmg__more"><text>+{{ cell.more }}</text></view>
      </view>
    </view>
    <job-video-player v-if="playing" :src="video" :poster="cover" :title="title" @close="playing = false" />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { absUrl } from '@/common/upload.js'
import { toast } from '@/common/screen.js'
import JobVideoPlayer from './job-video-player.vue'
import { mediaCells } from '../store-page.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  images: { type: Array, default: () => [] },
  video: { type: String, default: '' },
  cover: { type: String, default: '' },
  title: { type: String, default: '住宿展示' },
  layout: { type: String, default: 'grid' }
})
const urls = computed(() => (props.images || []).map(x => absUrl(x)).filter(Boolean))
const cells = computed(() => mediaCells({ images: urls.value, video: props.video, cover: absUrl(props.cover) }))
const playing = ref(false)
function tapCell(cell) {
  if (cell.video) { playing.value = true; return }
  if (!urls.value.length || typeof uni === 'undefined') return
  uni.previewImage({ urls: urls.value, current: urls.value[cell.index] || urls.value[0], fail: () => toast('照片暂时打不开，请稍后重试') })
}
</script>

<style scoped lang="scss">
.jmg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
.jmg--lodging { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.jmg--single { grid-template-columns: minmax(0, 1fr); }
.jmg--lodging .jmg__box { padding-bottom: 66.667%; }
.jmg__empty { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 112px; padding: 16px; box-sizing: border-box; border-radius: 8px; background: var(--k-paper2); color: var(--k-ink2); font-size: 14px; line-height: 1.6; text-align: center; }
.jmg__cell { position: relative; min-width: 0; }
.jmg__box { position: relative; width: 100%; height: 0; padding-bottom: 100%; overflow: hidden; border-radius: 8px; background: #E9DFD3; }
.jmg__cell--video .jmg__box { background: #6E5B49; }
.jmg__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; }
.jmg__play { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; margin: -20px 0 0 -20px; padding-left: 2px; border-radius: 50%; background: rgba(36, 27, 23, .5); border: 1.5px solid rgba(255, 255, 255, .9); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.jmg__tag { position: absolute; left: 5px; bottom: 5px; padding: 0 6px; border-radius: 4px; background: rgba(36, 27, 23, .62); color: #FFFFFF; font-size: 12px; line-height: 20px; }
.jmg__more { position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(36, 27, 23, .45); color: #FFFFFF; font-size: 17px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
</style>
