<template>
  <view class="resume-image">
    <canvas canvas-id="masked-resume" id="masked-resume" class="resume-canvas" :style="{width: width + 'px', height: height + 'px'}" />
    <view v-if="path" class="image-preview">
      <text class="preview-title">微信简历图片预览</text>
      <image :src="path" mode="widthFix" class="preview" @click="preview" />
      <text class="preview-hint">对方直接查看图片，无需注册小程序。图片不含联系方式、具体地址或原始经历，也不记录已读。</text>
      <k-button block label="转发图片到微信" @click="share" />
      <k-button type="outline" block label="保存图片" @click="save" />
    </view>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance, nextTick } from 'vue'
import { toast } from '@/common/screen.js'
const width = 750, height = 1060
const owner = getCurrentInstance().proxy
const path = ref('')
async function generate(data) {
  path.value = ''
  await nextTick()
  const ctx = uni.createCanvasContext('masked-resume', owner)
  ctx.setFillStyle('#FCF9F3'); ctx.fillRect(0, 0, width, height)
  const line = (text, x, y, size, color = '#3A322B') => {
    ctx.setFillStyle(color); ctx.setFontSize(size); ctx.fillText(String(text), x, y)
  }
  const wrap = (text, y, size, limit = 3) => {
    ctx.setFontSize(size)
    let row = '', n = 0
    const chars = Array.from(String(text || '未填写'))
    for (const c of chars) {
      if (ctx.measureText(row + c).width > 646 && row) {
        line(n === limit - 1 ? row.slice(0, -1) + '…' : row, 52, y, size)
        if (++n === limit) return
        row = ''; y += size + 14
      }
      row += c
    }
    if (row) line(row, 52, y, size)
  }
  line('袋鼠全球青年 · 招聘协作', 52, 76, 28, '#9A6B3F')
  line('脱敏简历', 52, 160, 48)
  line((data.name || '候选人') + (data.age ? ' · ' + data.age + '岁' : ''), 52, 242, 34)
  ctx.setFillStyle('#DED8CB'); ctx.fillRect(52, 284, 646, 2)
  line('应聘岗位', 52, 346, 26, '#6B635C'); wrap(data.jobTitle, 398, 32, 3)
  line('技能标签', 52, 582, 26, '#6B635C'); wrap((data.skills || []).join(' · ') || '暂未填写', 632, 28, 2)
  line(data.online ? '工作方式' : '可到岗时间', 52, 774, 26, '#6B635C')
  line(data.online ? '线上完成 · 不限地区' : (data.arriveDate || '待沟通'), 52, 824, 30)
  if (!data.online && data.stayDays) line('可停留 ' + data.stayDays + ' 天', 52, 876, 28)
  ctx.setFillStyle('#DED8CB'); ctx.fillRect(52, 924, 646, 2)
  line('仅用于招聘协作 · 联系方式已隐藏', 52, 974, 24, '#6B635C')
  line('如需进一步沟通，请联系转发人', 52, 1014, 24, '#6B635C')
  await new Promise(resolve => ctx.draw(false, resolve))
  path.value = await new Promise((resolve, reject) => uni.canvasToTempFilePath({
    canvasId: 'masked-resume', width, height, destWidth: width, destHeight: height,
    fileType: 'png', success: r => resolve(r.tempFilePath), fail: () => reject(new Error('简历图片生成失败，请重试'))
  }, owner))
}
function preview() { if (path.value) uni.previewImage({ urls: [path.value], current: path.value }) }
function share() {
  if (!path.value) return
  // #ifdef MP-WEIXIN
  if (typeof wx.showShareImageMenu === 'function') {
    wx.showShareImageMenu({ path: path.value, fail: e => {
      if (!/cancel/i.test(e.errMsg || '')) { toast('请保存图片后，在微信聊天中发送'); preview() }
    } })
    return
  }
  // #endif
  toast('请保存图片后，在微信聊天中发送')
  preview()
}
function save() {
  if (!path.value) return
  // #ifdef H5
  const a = document.createElement('a'); a.href = path.value; a.download = '脱敏简历.png'; a.click()
  return
  // #endif
  // #ifndef H5
  uni.saveImageToPhotosAlbum({ filePath: path.value, success: () => toast('图片已保存，可从微信相册发送'), fail: e => {
    if (!/cancel/i.test(e.errMsg || '')) toast('保存失败，请允许保存到相册后重试')
  } })
  // #endif
}
defineExpose({ generate })
</script>

<style scoped>
.resume-canvas { position: fixed; left: -10000px; top: 0; pointer-events: none; }
.image-preview { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; }
.preview-title { font-size: 18px; font-weight: 600; }
.preview { display: block; width: 100%; border: 1px solid var(--k-line); border-radius: 12px; }
.preview-hint { color: var(--k-muted); font-size: 14px; line-height: 1.7; }
</style>
