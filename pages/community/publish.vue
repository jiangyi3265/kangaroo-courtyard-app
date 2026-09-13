<template>
  <view class="k-page publish-page">
    <template v-if="s === 1">
      <k-topbar title="发布内容" back />
      <view class="publish-body k-pad-tab">
        <view class="section-head"><text class="section-title">选择类型</text><text class="section-note">内容将发布在对应频道</text></view>
        <view class="type-grid">
          <view v-for="item in types" :key="item.name" class="type-card" :class="{ active: type === item.name }" @click="type = item.name">
            <k-icon :name="item.icon" :size="28" :color="type === item.name ? 'red' : 'ink'" :stroke="1.6" />
            <text class="type-card__name">{{ item.name }}</text><text class="type-card__desc">{{ item.desc }}</text>
          </view>
        </view>
        <view class="upload-head"><text class="section-title">上传内容</text><text class="section-note upload-note">最多9张图片或1个视频</text></view>
        <view class="uploads">
          <view v-for="(item, i) in uploads" :key="item.img" class="upload-item">
            <image class="upload-img" :src="item.img" mode="aspectFill" />
            <view class="upload-close" @click="removeUpload(i)"><k-icon name="x" :size="13" color="white" :stroke="2.2" /></view>
            <text v-if="item.duration" class="upload-duration">{{ item.duration }}</text>
          </view>
          <view class="upload-add" @click="toast('选择图片或视频')"><k-icon name="plus" :size="34" color="ink" :stroke="1.4" /></view>
        </view>
        <view class="field-block"><text class="field-label">标题</text><view class="text-field"><input v-model="title" maxlength="60" /><text class="counter">12/60</text></view></view>
        <view class="field-block body-field-block"><text class="field-label">正文</text><view class="textarea-field"><textarea v-model="body" maxlength="500" /><text class="counter counter--area">38/500</text></view></view>
        <view class="publish-row"><text>城市</text><view class="publish-row__right"><text>大理</text><k-icon name="map-pin" :size="18" color="muted" :stroke="1.6" /></view></view>
        <view class="publish-row" @click="toast('选择日期')"><text>日期</text><view class="publish-row__right"><text>9月7日（周日）</text><k-icon name="chevron-right" :size="18" color="muted" /></view></view>
        <view class="publish-row" @click="toast('选择订单或岗位')"><text>关联订单或岗位</text><text class="optional">（可选）</text><view class="publish-row__right"><text class="muted">请选择</text><k-icon name="chevron-right" :size="18" color="muted" /></view></view>
        <view class="dual-buttons"><view class="dual-button"><k-button type="outline" size="md" block @click="toast('已存为草稿')">存为草稿</k-button></view><view class="dual-button"><k-button size="md" block @click="s = type === '找搭子' ? 2 : 3">下一步</k-button></view></view>
      </view>
      <k-tabbar active="publish" />
    </template>

    <template v-else-if="s === 2">
      <k-topbar title="手机验证" back @back="s = 1" />
      <view class="verify-body k-pad-tab">
        <image class="verify-art" src="/static/media/publish-phone-kangaroo.jpg" mode="aspectFit" />
        <text class="verify-lead">为保障发布安全与沟通顺畅</text><text class="verify-title">发布“找搭子”内容前需验证手机号</text>
        <view class="verify-info">
          <view class="verify-info__row"><k-icon name="info" :size="18" color="ochre" :stroke="1.7" /><view><text class="verify-info__title">用途说明：</text><text class="verify-info__text">用于身份验证、联系沟通与活动通知，\n不会用于其他用途。</text></view></view>
          <view class="verify-info__row"><k-icon name="shield-check" :size="18" color="ochre" :stroke="1.7" /><view><text class="verify-info__title">隐私保护：</text><text class="verify-info__text">你的手机号仅对你和相关参与者可见，\n我们将严格保护你的隐私。</text></view></view>
        </view>
        <view class="phone-wrap"><text class="phone-label">微信手机号</text><view class="phone-field"><text class="phone-number">138 **** 5678</text><view class="wechat"><text>微信授权</text><k-icon name="wechat" :size="23" color="#2FA84F" :stroke="1.2" fill /></view></view><text class="change-account">更换账号</text></view>
        <k-button size="lg" block @click="s = 4">授权并验证</k-button><text class="verify-foot">验证通过后将自动返回草稿</text>
      </view>
      <k-tabbar active="publish" />
    </template>

    <template v-else-if="s === 3">
      <k-topbar title="经历校验" back @back="s = 1" />
      <view class="experience-body k-pad-tab">
        <view class="experience-tip"><view><text class="experience-tip__title">发布“义工日记”需选择已完成的义工经历</text><text class="experience-tip__sub">真实记录让分享更有价值</text></view><k-icon name="clipboard-check" :size="34" color="ochre" :stroke="1.4" /></view>
        <view class="experience-head"><text class="section-title">选择已完成的义工经历</text><view class="k-row k-gap4"><text class="experience-link">去完成体验</text><k-icon name="chevron-right" :size="15" color="muted" /></view></view>
        <view v-for="item in experiences" :key="item.title" class="experience-card" @click="selected = item.title">
          <image class="experience-img" :src="item.img" mode="aspectFill" />
          <view class="experience-copy"><view class="experience-title-row"><text class="experience-name">{{ item.title }}</text><text class="done">已完成</text></view><text class="experience-meta">服务：{{ item.service }}</text><text class="experience-meta">完成时间：{{ item.date }}</text></view>
          <view class="radio" :class="{ selected: selected === item.title }"><view v-if="selected === item.title" class="radio__dot" /></view>
        </view>
        <view class="empty-experience"><text class="empty-experience__title">还没有可用的已完成经历</text><text class="empty-experience__sub">完成一次义工体验后即可分享你的故事</text><k-button type="outline" size="sm" @click="toast('去寻找机会')">去寻找机会</k-button></view>
        <k-button size="lg" block :disabled="!selected" @click="toast('已关联义工经历')">下一步</k-button>
      </view>
      <k-tabbar active="publish" />
    </template>

    <template v-else>
      <k-topbar title="同步活动板" back @back="s = 1" />
      <view class="sync-body k-pad-tab">
        <view class="sync-switch-row"><view><text class="sync-switch-title">同步为用户自发活动</text><text class="sync-switch-sub">开启后将同步到“活动”频道，更多人可见</text></view><view class="switch" :class="{ on: syncOn }" @click="syncOn = !syncOn"><view class="switch__knob" /></view></view>
        <view class="activity-title-row"><text class="section-title">活动信息</text><text class="section-note">（为你的约见/组队补充信息）</text></view>
        <view class="activity-info"><view v-for="item in activityRows" :key="item.label" class="activity-row"><text>{{ item.label }}</text><view class="activity-row__right"><template v-if="item.label === '参与人数'"><view class="round-op" @click="people = Math.max(1, people - 1)"><k-icon name="minus" :size="16" color="ink" :stroke="2" /></view><text class="people">{{ people }}人</text><view class="round-op" @click="people++"><k-icon name="plus" :size="16" color="ink" :stroke="2" /></view></template><text v-else>{{ item.value }}</text><k-icon v-if="item.label !== '参与人数'" name="chevron-right" :size="18" color="muted" /></view></view></view>
        <text class="preview-label">活动预览</text>
        <view class="preview-card"><image class="preview-img" src="/static/media/activity-sunrise.jpg" mode="aspectFill" /><view class="preview-copy"><text class="preview-chip">找搭子 · 组队</text><text class="preview-title">周末一起去苍山日出徒步吗？</text><view class="preview-meta"><k-icon name="map-pin" :size="13" color="muted" /><text>9月7日（周日）05:30  大理 · 苍山洗马潭索道口</text></view><view class="preview-meta"><k-icon name="eye" :size="13" color="muted" /><text>10人 · 报名截至 9月6日 18:00</text></view><view class="preview-sign"><view class="avatar-stack"><image v-for="a in avatars" :key="a" class="preview-avatar" :src="a" mode="aspectFill" /></view><text>已有6人报名</text></view></view></view>
        <view class="dual-buttons sync-buttons"><view class="dual-button"><k-button type="outline" size="lg" block @click="s = 1">上一步</k-button></view><view class="dual-button"><k-button size="lg" block @click="toast('发布成功')">发布</k-button></view></view>
      </view>
      <k-tabbar active="publish" />
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useScreen, toast } from '@/common/screen.js'
const s = useScreen(4)
const type = ref('找搭子')
const types = [{ name: '找搭子', desc: '约见 / 组队', icon: 'users' }, { name: '义工日记', desc: '记录 / 分享', icon: 'book-open' }, { name: '旅居日常', desc: '生活 / 灵感', icon: 'house' }]
const uploads = ref([{ img: '/static/media/orders-coffee.jpg' }, { img: '/static/media/activity-sunrise.jpg', duration: '00:45' }, { img: '/static/media/publish-walk.jpg' }])
const removeUpload = (index) => uploads.value.splice(index, 1)
const title = ref('周末一起去苍山日出徒步吗？')
const body = ref('想找小伙伴一起，在周日清晨出发登顶苍山，看日出云海，适合初级徒步者，新手友好～')
const selected = ref('')
const experiences = [{ title: '古城咖啡馆义工（大理）', service: '咖啡制作 · 店内运营', date: '2025.08.18–2025.08.24', img: '/static/media/publish-vol-cafe.jpg' }, { title: '海边图书馆义工（厦门）', service: '图书整理 · 活动协助', date: '2025.07.10–2025.07.16', img: '/static/media/publish-vol-library.jpg' }, { title: '山野露营地义工（丽江）', service: '营地维护 · 接待协助', date: '2025.06.20–2025.06.26', img: '/static/media/publish-vol-camp.jpg' }]
const syncOn = ref(true)
const people = ref(10)
const activityRows = [{ label: '集合时间', value: '9月7日（周日）05:30' }, { label: '集合地点', value: '苍山洗马潭索道口' }, { label: '预计时长', value: '约 6 小时' }, { label: '参与人数', value: '' }, { label: '报名截止', value: '9月6日（周六）18:00' }]
const avatars = ['/static/media/community-avatar-abu.jpg', '/static/media/community-avatar-xiaoman.jpg', '/static/media/community-avatar-shanye.jpg', '/static/media/community-avatar-yunduo.jpg']
</script>

<style scoped lang="scss">
.publish-page { background: var(--k-bg); }
.publish-body { padding: 10px 16px 106px; }
.section-head, .upload-head, .experience-head, .activity-title-row { display: flex; align-items: center; justify-content: space-between; }
.section-title { font-family: var(--k-serif); font-size: 17px; font-weight: 700; }
.section-note { color: var(--k-muted); font-size: 11px; }
.type-grid { display: flex; gap: 8px; margin-top: 8px; }
.type-card { flex: 1; height: 82px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; }
.type-card.active { border: 1.5px solid var(--k-red); box-shadow: 0 0 0 2px rgba(169,71,52,.08); color: var(--k-red); }
.type-card__name { font-family: var(--k-serif); font-size: 15px; font-weight: 700; }
.type-card__desc { color: var(--k-muted); font-size: 11px; }
.upload-head { justify-content: flex-start; gap: 14px; margin-top: 12px; }
.upload-note { padding-top: 2px; }
.uploads { display: flex; gap: 7px; margin-top: 7px; }
.upload-item, .upload-add { position: relative; width: calc((100% - 21px) / 4); height: 69px; border-radius: 8px; overflow: visible; flex: 0 0 auto; }
.upload-img { width: 100%; height: 69px; border-radius: 8px; }
.upload-close { position: absolute; right: -3px; top: -4px; width: 20px; height: 20px; border-radius: 50%; background: rgba(36,27,23,.78); display: flex; align-items: center; justify-content: center; }
.upload-duration { position: absolute; right: 5px; bottom: 3px; color: #fff; font-size: 11px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,.8); }
.upload-add { border: 1px dashed var(--k-light); display: flex; align-items: center; justify-content: center; background: var(--k-paper); }
.field-block { margin-top: 10px; }
.field-label { display: block; margin-bottom: 5px; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.text-field, .textarea-field { position: relative; border: 1px solid var(--k-line2); background: var(--k-paper); border-radius: 8px; }
.text-field { height: 34px; display: flex; align-items: center; padding: 0 48px 0 9px; }
.text-field input { width: 100%; height: 32px; font-size: 13px; }
.counter { position: absolute; right: 9px; top: 9px; color: var(--k-muted); font-size: 11px; }
.body-field-block { margin-top: 9px; }
.textarea-field { height: 61px; padding: 7px 42px 7px 9px; }
.textarea-field textarea { width: 100%; height: 48px; font-size: 12px; line-height: 1.55; }
.counter--area { top: auto; bottom: 6px; }
.publish-row { height: 40px; border-bottom: 1px solid var(--k-line); display: flex; align-items: center; font-family: var(--k-serif); font-size: 15px; font-weight: 700; }
.publish-row__right { margin-left: auto; display: flex; align-items: center; gap: 6px; font-family: sans-serif; font-size: 14px; font-weight: 500; }
.optional { margin-left: 4px; font-family: sans-serif; font-size: 12px; color: var(--k-muted); font-weight: 400; }
.muted { color: var(--k-muted); }
.dual-buttons { display: flex; gap: 12px; margin-top: 13px; }
.dual-button { min-width: 0; flex: 1; }
.verify-body { padding: 22px 24px 104px; text-align: center; }
.verify-art { display: block; width: 180px; height: 135px; margin: 8px auto 6px; }
.verify-lead { display: block; font-family: var(--k-serif); font-size: 16px; line-height: 1.7; }
.verify-title { display: block; font-family: var(--k-serif); font-size: 18px; font-weight: 700; line-height: 1.6; }
.verify-info { margin-top: 18px; padding: 14px 16px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); text-align: left; }
.verify-info__row { display: flex; align-items: flex-start; gap: 9px; }
.verify-info__row + .verify-info__row { margin-top: 12px; }
.verify-info__title { display: block; font-family: var(--k-serif); font-size: 14px; font-weight: 700; }
.verify-info__text { display: block; margin-top: 3px; color: var(--k-muted); font-size: 12px; line-height: 1.55; white-space: pre-line; }
.phone-wrap { margin-top: 17px; text-align: left; }
.phone-label { display: block; margin-bottom: 6px; font-size: 13px; color: var(--k-muted); }
.phone-field { height: 42px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; }
.phone-number { font-size: 16px; font-weight: 600; letter-spacing: .5px; }
.wechat { display: flex; align-items: center; gap: 6px; color: var(--k-muted); font-size: 12px; }
.change-account { display: block; margin: 8px 0 10px 2px; color: var(--k-indigo); font-size: 12px; }
.verify-foot { display: block; margin-top: 10px; color: var(--k-light); font-size: 12px; letter-spacing: .5px; }
.experience-body { padding: 10px 16px 104px; }
.experience-tip { min-height: 68px; padding: 12px 16px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; }
.experience-tip__title { display: block; font-family: var(--k-serif); font-size: 14px; font-weight: 700; }
.experience-tip__sub { display: block; margin-top: 6px; color: var(--k-muted); font-size: 12px; }
.experience-head { margin: 14px 0 8px; }
.experience-link { color: var(--k-muted); font-size: 12px; }
.experience-card { min-height: 74px; padding: 8px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; gap: 10px; }
.experience-card + .experience-card { margin-top: 8px; }
.experience-img { width: 68px; height: 62px; border-radius: 7px; flex: 0 0 auto; }
.experience-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.experience-title-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
.experience-name { font-family: var(--k-serif); font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.done { padding: 2px 5px; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); font-size: 10px; flex: 0 0 auto; }
.experience-meta { color: var(--k-muted); font-size: 11px; white-space: nowrap; }
.radio { width: 22px; height: 22px; border: 1.5px solid var(--k-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.radio.selected { border-color: var(--k-red); }
.radio__dot { width: 12px; height: 12px; border-radius: 50%; background: var(--k-red); }
.empty-experience { margin: 14px 0; padding: 13px 16px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); }
.empty-experience__title { display: block; font-family: var(--k-serif); font-size: 15px; font-weight: 700; }
.empty-experience__sub { display: block; margin: 5px 0 10px; color: var(--k-muted); font-size: 12px; }
.sync-body { padding: 10px 16px 104px; }
.sync-switch-row { padding: 12px 14px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; }
.sync-switch-title { display: block; font-family: var(--k-serif); font-size: 15px; font-weight: 700; }
.sync-switch-sub { display: block; margin-top: 5px; color: var(--k-muted); font-size: 11px; }
.switch { width: 46px; height: 27px; padding: 2px; border-radius: 16px; background: #BDB8AF; box-sizing: border-box; transition: background .15s; }
.switch.on { background: var(--k-green); }
.switch__knob { width: 23px; height: 23px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .15s; }
.switch.on .switch__knob { transform: translateX(19px); }
.activity-title-row { justify-content: flex-start; gap: 8px; margin: 16px 0 8px; }
.activity-info { padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); }
.activity-row { height: 43px; border-bottom: 1px solid var(--k-line); display: flex; align-items: center; font-family: var(--k-serif); font-size: 14px; font-weight: 700; }
.activity-row:last-child { border-bottom: 0; }
.activity-row__right { margin-left: auto; display: flex; align-items: center; gap: 7px; font-family: sans-serif; font-size: 13px; font-weight: 500; }
.round-op { width: 25px; height: 25px; border: 1px solid var(--k-line2); border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; }
.people { min-width: 36px; text-align: center; }
.preview-label { display: block; margin: 17px 0 8px; font-family: var(--k-serif); font-size: 17px; font-weight: 700; }
.preview-card { height: 133px; padding: 8px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; gap: 10px; box-sizing: border-box; }
.preview-img { width: 88px; height: 115px; border-radius: 7px; flex: 0 0 auto; }
.preview-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.preview-chip { align-self: flex-start; padding: 2px 6px; border-radius: 4px; background: var(--k-ochre-soft); color: #8B622E; font-size: 10px; }
.preview-title { font-family: var(--k-serif); font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preview-meta { display: flex; align-items: center; gap: 4px; color: var(--k-muted); font-size: 10px; white-space: nowrap; overflow: hidden; }
.preview-meta text { overflow: hidden; text-overflow: ellipsis; }
.preview-sign { margin-top: auto; display: flex; align-items: center; gap: 8px; color: var(--k-muted); font-size: 11px; }
.avatar-stack { display: flex; }
.preview-avatar { width: 23px; height: 23px; border-radius: 50%; border: 1.5px solid var(--k-paper); margin-left: -6px; }
.preview-avatar:first-child { margin-left: 0; }
.sync-buttons { margin-top: 11px; }
</style>
