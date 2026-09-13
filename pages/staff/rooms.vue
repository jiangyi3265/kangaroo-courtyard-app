<template>
  <view class="k-page rooms">
    <k-topbar :title="titles[s - 1]" back @back="onBack" />

    <!-- 1 房源列表 -->
    <view v-if="s === 1" class="k-body list-body">
      <view class="filters">
        <view class="dd" @click="toast('切换来源')"><text>直营</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="1.8" /></view>
        <view class="dd" @click="toast('全部状态')"><text>全部状态</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="1.8" /></view>
        <view class="k-flex1" />
        <view class="filters__icon" @click="toast('搜索')"><k-icon name="search" :size="18" color="ink" :stroke="1.8" /></view>
        <view class="filters__filter" @click="toast('筛选')"><k-icon name="filter" :size="16" color="ink" :stroke="1.8" /><text>筛选</text></view>
      </view>
      <view class="stats">
        <view class="stats__item"><text class="stats__num k-red">128</text><text class="stats__label">房源总数</text></view>
        <view class="stats__line" />
        <view class="stats__item"><text class="stats__num k-green">86%</text><text class="stats__label">平均入住率</text></view>
        <view class="stats__line" />
        <view class="stats__item"><text class="stats__num k-indigo">132</text><text class="stats__label">今日订单</text></view>
      </view>
      <view class="tabs">
        <view v-for="t in tabs" :key="t" class="tabs__item" :class="{ active: tab === t }" @click="tab = t"><text>{{ t }}</text></view>
      </view>
      <view v-for="(r, i) in rooms" :key="r.name" class="room" :class="{ 'is-last': i === rooms.length - 1 }">
        <image class="room__img" :src="r.img" mode="aspectFill" />
        <view class="k-flex1">
          <view class="k-between">
            <text class="room__name">{{ r.name }}</text>
            <k-chip :tone="r.tone">{{ r.status }}</k-chip>
          </view>
          <text class="room__addr">{{ r.addr }}</text>
          <view v-if="r.rate" class="room__kpi">
            <text class="room__kpi-label">入住率</text><text class="room__kpi-val k-green">{{ r.rate }}</text>
            <view class="room__kpi-line" />
            <text class="room__kpi-label">今日订单</text><text class="room__kpi-val k-green">{{ r.orders }}</text>
          </view>
          <text v-else class="room__addr room__note">{{ r.note }}</text>
          <view v-if="r.actions" class="room__actions">
            <view class="room__act" @click="s = 2"><k-icon name="pencil" :size="17" color="ink" :stroke="1.6" /><text>编辑</text></view>
            <view class="room__act" @click="toast('房态')"><k-icon name="calendar-check" :size="17" color="ink" :stroke="1.6" /><text>房态</text></view>
            <view class="room__act" @click="go(R.staffVlog + '?s=3')"><k-icon name="chart-column" :size="17" color="ink" :stroke="1.6" /><text>数据</text></view>
            <view class="room__act" @click="toast('更多')"><k-icon name="ellipsis" :size="14" color="ink" :stroke="2" /><text>更多</text></view>
          </view>
        </view>
      </view>
      <view class="fab-bar"><k-button block icon="plus" @click="s = 2">新增房源</k-button></view>
      <k-tabbar mode="staff" active="work" badge="12" />
    </view>

    <!-- 2 新增/编辑房源 -->
    <view v-else-if="s === 2" class="form-body">
      <view class="stp">
        <view v-for="(st, i) in steps2" :key="st" class="stp__item" :class="{ current: i === 0 }">
          <view class="stp__track"><view v-if="i > 0" class="stp__line stp__line--l" /><view v-if="i < steps2.length - 1" class="stp__line stp__line--r" /><view class="stp__dot"><text>{{ i + 1 }}</text></view></view>
          <text class="stp__label">{{ st }}</text>
        </view>
      </view>
      <view class="k-body form-inner">
        <text class="sec-title">基本信息</text>
        <view class="frow">
          <view class="frow__label"><text>房源名称</text><text class="req">*</text></view>
          <view class="k-input k-flex1"><input v-model="form.name" placeholder="请输入房源名称" placeholder-class="k-placeholder" /></view>
        </view>
        <view class="frow">
          <view class="frow__label"><text>房源地址</text><text class="req">*</text></view>
          <view class="k-input k-flex1"><input v-model="form.addr" placeholder="请输入地址" placeholder-class="k-placeholder" /><k-icon name="map-pin" :size="18" color="ink" :stroke="1.7" /></view>
        </view>
        <view class="frow">
          <view class="frow__label"><text>来源类型</text><text class="req">*</text></view>
          <view class="seg k-flex1">
            <view v-for="o in ['直营', '代运营']" :key="o" class="seg__item" :class="{ on: form.type === o }" @click="form.type = o"><text>{{ o }}</text></view>
          </view>
        </view>
        <view class="frow">
          <view class="frow__label"><text>主理人</text><text class="req">*</text></view>
          <view class="host k-flex1">
            <image class="host__avatar" src="/static/media/rooms-host.jpg" mode="aspectFill" />
            <text class="host__name k-flex1">小院主人</text>
            <text class="host__phone">手机号 138****8822</text>
          </view>
        </view>
        <view class="frow__label k-mt4"><text>房源简介</text><text class="req">*</text></view>
        <view class="area k-mt10">
          <textarea v-model="form.desc" class="area__ta" :maxlength="200" placeholder-class="k-placeholder" />
          <text class="area__counter">{{ form.desc.length }}/200</text>
        </view>
        <text class="frow__label k-mt20">标签</text>
        <view class="tags k-mt10">
          <view v-for="t in form.tags" :key="t" class="tag"><text>{{ t }}</text><k-icon name="x" :size="13" color="muted" :stroke="2" /></view>
          <view class="tag" @click="toast('添加标签')"><k-icon name="plus" :size="13" color="muted" :stroke="2" /><text class="tag__add">添加标签</text></view>
        </view>
      </view>
      <view class="fab-bar fab-bar--two">
        <k-button type="secondary" class="btn-draft" @click="toast('已保存草稿')">保存草稿</k-button>
        <k-button class="btn-next" @click="s = 3">下一步</k-button>
      </view>
      <k-tabbar mode="staff" active="work" badge="12" />
    </view>

    <!-- 3 资质上传与审核 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab">
      <view class="stp stp--pad">
        <view v-for="(st, i) in steps3" :key="st" class="stp__item" :class="{ current: i === 1 }">
          <view class="stp__track"><view v-if="i > 0" class="stp__line stp__line--l" /><view v-if="i < steps3.length - 1" class="stp__line stp__line--r" /><view class="stp__dot"><text>{{ i + 1 }}</text></view></view>
          <text class="stp__label">{{ st }}</text>
        </view>
      </view>
      <view class="notice"><text>请上传清晰、完整的资质图片或PDF，支持 JPG/PNG/PDF 格式，单个文件不超过 10MB。</text></view>
      <view v-for="d in docs" :key="d.title" class="doc">
        <view class="doc__title"><text>{{ d.title }}</text><text v-if="d.required" class="req">*</text><text v-if="d.hint" class="doc__hint">{{ d.hint }}</text></view>
        <view class="doc__row">
          <view class="doc__file" @click="toast('查看文件')">
            <image class="doc__thumb" :src="d.img" mode="aspectFill" />
            <view class="k-flex1 k-col k-gap2">
              <text class="doc__name">{{ d.file }}</text>
              <text class="doc__size">{{ d.size }}</text>
              <view v-if="d.uploaded" class="doc__state"><k-icon name="circle-check" :size="16" color="green" :stroke="2" /><text class="k-green">已上传</text></view>
              <view v-else class="doc__state"><k-icon name="circle-minus" :size="16" color="#C9C1B6" :stroke="2" /><text class="doc__optional">选填</text></view>
            </view>
            <k-icon name="chevron-right" :size="18" color="ink" :stroke="1.6" />
          </view>
          <view class="doc__date" @click="toast('选择有效期')">
            <text class="doc__date-label">有效期至</text>
            <view class="k-between"><text class="doc__date-val">{{ d.expire }}</text><k-icon name="calendar" :size="18" :color="d.uploaded ? 'ink' : '#C9C1B6'" :stroke="1.6" /></view>
          </view>
        </view>
      </view>
      <text class="sec-title sec-title--sm k-mt8">审核进度</text>
      <view class="timeline">
        <view v-for="(t, i) in timeline" :key="t.title" class="timeline__item">
          <view class="timeline__track">
            <view v-if="i > 0" class="timeline__line timeline__line--l" :class="{ done: t.done }" />
            <view v-if="i < timeline.length - 1" class="timeline__line timeline__line--r" :class="{ done: timeline[i + 1].done }" />
            <view class="timeline__dot" :class="{ done: t.done }"><k-icon :name="t.done ? 'check' : 'chevron-right'" :size="t.done ? 12 : 14" :color="t.done ? 'white' : '#B7AFA5'" :stroke="t.done ? 3 : 2" /></view>
          </view>
          <text class="timeline__title">{{ t.title }}</text>
          <text class="timeline__time">{{ t.time }}</text>
        </view>
      </view>
      <view class="reject">
        <view class="k-flex1">
          <text class="reject__title">审核驳回 <text class="reject__time">（2025-08-27 16:40）</text></text>
          <text class="reject__desc">驳回原因：消防安全检查合格证模糊，请重新上传清晰版本。</text>
        </view>
        <k-button size="md" class="reject__btn" @click="toast('重新提交')">重新提交</k-button>
      </view>
      <k-tabbar mode="staff" active="work" badge="12" />
    </view>

    <!-- 4 Vlog 上传与审核 -->
    <view v-else class="k-body vlog-body">
      <view class="stp stp--pad">
        <view v-for="(st, i) in steps4" :key="st" class="stp__item" :class="{ current: i === 0 }">
          <view class="stp__track"><view v-if="i > 0" class="stp__line stp__line--l" /><view v-if="i < steps4.length - 1" class="stp__line stp__line--r" /><view class="stp__dot"><text>{{ i + 1 }}</text></view></view>
          <text class="stp__label">{{ st }}</text>
        </view>
      </view>
      <text class="sec-title sec-title--sm">上传视频</text>
      <view class="upload">
        <view class="upload__row">
          <view class="upload__video" @click="toast('预览视频')"><image class="upload__img" src="/static/media/rooms-vlog.jpg" mode="aspectFill" /></view>
          <view class="upload__add" @click="toast('继续添加')"><k-icon name="plus" :size="30" color="ink" :stroke="1.6" /><text>继续添加</text></view>
        </view>
        <text class="upload__tip">已上传 1/5 个视频，单个不超过 500MB，时长 60s~5min</text>
      </view>
      <view class="frow k-mt16">
        <view class="frow__label"><text>封面图</text><text class="req">*</text></view>
        <view class="cover k-flex1">
          <image class="cover__img" src="/static/media/rooms-vlog-cover.jpg" mode="aspectFill" />
          <view class="k-flex1 k-col k-gap4"><text class="doc__name">封面.jpg</text><text class="doc__size">1.1MB</text></view>
          <text class="cover__change" @click="toast('更换封面')">更换</text>
        </view>
      </view>
      <view class="frow">
        <view class="frow__label"><text>来源平台</text><text class="req">*</text></view>
        <view class="seg seg--3 k-flex1">
          <view v-for="o in ['抖音', '小红书', '视频号']" :key="o" class="seg__item" :class="{ on: vlog.platform === o }" @click="vlog.platform = o"><text>{{ o }}</text></view>
        </view>
      </view>
      <view class="frow">
        <view class="frow__label"><text>视频链接</text><text class="req">*</text></view>
        <view class="k-input k-flex1 link"><input v-model="vlog.link" placeholder="粘贴视频链接" placeholder-class="k-placeholder" /><text class="link__copy" @click="toast('已复制链接')">复制链接</text></view>
      </view>
      <view class="frow__label"><text>内容标题</text><text class="req">*</text></view>
      <view class="k-input k-mt10 title-input"><input v-model="vlog.title" :maxlength="30" placeholder-class="k-placeholder" /><text class="doc__size">{{ vlog.title.length }}/30</text></view>
      <view class="freq">
        <k-icon name="lightbulb" :size="28" color="ochre" :stroke="1.6" />
        <view class="k-flex1">
          <text class="freq__title">内容频率提示</text>
          <text class="freq__desc">建议每周至少发布 2 条优质 Vlog，保持活跃度有助于提升曝光与转化。</text>
        </view>
      </view>
      <view class="fab-bar fab-bar--two">
        <k-button type="secondary" class="btn-draft" @click="toast('已保存草稿')">保存草稿</k-button>
        <k-button class="btn-next" @click="go(R.staffVlog + '?s=2')">下一步</k-button>
      </view>
      <k-tabbar mode="staff" active="work" badge="12" />
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const titles = ['房源管理', '新增 / 编辑房源', '资质上传与审核', 'Vlog 上传与审核']
const tabs = ['全部 128', '营业中 96', '待审核 18', '已下架 14']
const tab = ref('营业中 96')
const steps2 = ['基本信息', '设施房型', '房态价格', '二消配置', '发布设置']
const steps3 = ['基本信息', '资质上传', '提交审核', '审核结果']
const steps4 = ['上传视频', '内容信息', '授权声明', '提交审核', '审核结果']
const rooms = [
  { img: '/static/media/rooms-cover-1.jpg', name: '西湖边 · 温馨一居室', status: '营业中', tone: 'green', addr: '西湖区 · 留下街道 · 龙井路88号', rate: '92%', orders: '6', actions: true },
  { img: '/static/media/rooms-cover-2.jpg', name: '花园民宿（家庭房）', status: '营业中', tone: 'green', addr: '余杭区 · 径山镇 · 小古城村12号', rate: '78%', orders: '3', actions: true },
  { img: '/static/media/rooms-cover-3.jpg', name: '老洋房 · 两居室', status: '待审核', tone: 'ochre', addr: '上城区 · 南星街道 · 侯潮路11号', note: '创建于 2025-08-26', actions: true },
  { img: '/static/media/rooms-cover-4.jpg', name: '山景大床房', status: '已下架', tone: 'neutral', addr: '临安区 · 天目山镇 · 天目村66号', note: '下架原因  房源整改中', actions: false }
]
const form = reactive({ name: '西溪湿地 · 庭院复式房', addr: '杭州市西湖区天目山路518号', type: '直营', desc: '独立庭院，复式两层，近西溪湿地，适合家庭与朋友小聚。', tags: ['庭院', '复式', '亲子友好'] })
const docs = [
  { title: '营业执照', required: true, img: '/static/media/rooms-doc-1.jpg', file: '营业执照.jpg', size: '1.2MB', uploaded: true, expire: '2026-06-30' },
  { title: '消防安全检查合格证', required: true, img: '/static/media/rooms-doc-2.jpg', file: '消防证.pdf', size: '2.4MB', uploaded: true, expire: '2026-05-20' },
  { title: '特种行业许可证', hint: '（如有）', img: '/static/media/rooms-doc-3.jpg', file: '特种行业许可证.jpg', size: '1.1MB', uploaded: false, expire: '2025-12-31' },
  { title: '负责人身份证', required: true, img: '/static/media/rooms-doc-4.jpg', file: '身份证-正面.jpg', size: '1.0MB', uploaded: true, expire: '2030-08-15' }
]
const timeline = [
  { title: '提交审核', time: '2025-08-28 10:30', done: true },
  { title: '平台审核中', time: '2025-08-28 11:20', done: true },
  { title: '审核结果', time: '待确定', done: false }
]
const vlog = reactive({ platform: '抖音', link: 'https://v.douyin.com/xxx...', title: '西溪湿地的庭院生活｜治愈系民宿体验' })
const onBack = () => { if (s.value > 1) s.value = 1; else back() }
</script>

<style scoped lang="scss">
.list-body { padding-top: 8px; padding-bottom: calc(132px + var(--k-safe-bottom)); }
.filters { display: flex; align-items: center; gap: 12px; }
.dd { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); font-size: 14px; }
.filters__icon { width: 30px; height: 34px; display: flex; align-items: center; justify-content: center; }
.filters__filter { display: flex; align-items: center; gap: 4px; font-size: 14px; }
.stats { margin-top: 12px; display: flex; align-items: center; height: 66px; padding: 0 8px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.stats__item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stats__num { font-size: 22px; font-weight: 700; line-height: 1.2; font-family: var(--k-sans); }
.stats__label { font-size: 12px; color: var(--k-muted); }
.stats__line { width: 1px; height: 30px; background: var(--k-line); }
.tabs { margin-top: 12px; display: flex; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); overflow: hidden; }
.tabs__item { position: relative; flex: 1; height: 38px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--k-muted); }
.tabs__item.active { color: var(--k-green); font-weight: 600; }
.tabs__item.active::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: 0; height: 2px; background: var(--k-green); }
.room { display: flex; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--k-line); }
.room.is-last { border-bottom: 0; }
.room__img { width: 95px; height: 95px; border-radius: 8px; flex: 0 0 auto; }
.room__name { font-family: var(--k-serif); font-weight: 700; font-size: 17px; line-height: 1.3; }
.room__addr { display: block; margin-top: 5px; font-size: 13px; color: var(--k-muted); }
.room__note { margin-top: 6px; }
.room__kpi { display: flex; align-items: center; margin-top: 7px; font-size: 13px; }
.room__kpi-label { color: var(--k-muted); margin-right: 6px; }
.room__kpi-val { font-weight: 600; }
.room__kpi-line { width: 1px; height: 14px; background: var(--k-line2); margin: 0 12px 0 22px; }
.room__actions { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--k-line); font-size: 13px; }
.room__act { display: flex; align-items: center; gap: 5px; }
.fab-bar { position: fixed; left: 0; right: 0; bottom: calc(56px + var(--k-safe-bottom)); z-index: 49; padding: 8px 16px 8px; background: var(--k-bg); }
.fab-bar--two { display: flex; gap: 12px; }
.btn-draft { flex: 1; }
.btn-next { flex: 1.36; }
.btn-draft, .btn-next { font-family: var(--k-serif); font-size: 17px; }

/* 步骤 */
.stp { display: flex; padding: 12px 8px 10px; border-bottom: 1px solid var(--k-line); }
.stp--pad { margin: 0 -16px; padding: 8px 8px 10px; border-bottom: 0; }
.stp__item { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; color: var(--k-muted); }
.stp__track { position: relative; width: 100%; height: 22px; display: flex; align-items: center; justify-content: center; }
.stp__line { position: absolute; top: 50%; height: 1px; background: var(--k-line2); }
.stp__line--l { left: 0; right: 50%; margin-right: 11px; }
.stp__line--r { left: 50%; right: 0; margin-left: 11px; }
.stp__dot { position: relative; z-index: 1; width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--k-light); }
.stp__item.current .stp__dot { border-color: var(--k-red); background: var(--k-red); color: #fff; font-weight: 600; }
.stp__item.current .stp__label { color: var(--k-ink); font-weight: 600; }
.stp__label { white-space: nowrap; }

/* 表单 */
.form-body { padding-bottom: calc(132px + var(--k-safe-bottom)); }
.form-inner { padding-top: 16px; }
.sec-title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 18px; margin-bottom: 8px; }
.sec-title--sm { font-size: 16px; margin-bottom: 10px; }
.frow { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
.frow__label { display: flex; align-items: center; gap: 4px; width: 76px; flex: 0 0 auto; font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.req { color: var(--k-red); font-family: var(--k-sans); font-weight: 600; }
.k-input { height: 48px; }
.k-input input { height: 46px; }
.seg { display: flex; gap: 10px; }
.seg__item { flex: 1; height: 48px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper2); font-size: 14px; color: var(--k-ink); }
.seg__item.on { border-color: var(--k-red); color: var(--k-red); font-weight: 700; background: var(--k-paper); }
.seg--3 .seg__item { height: 44px; }
.host { display: flex; align-items: center; gap: 8px; height: 50px; padding: 0 14px 0 8px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); }
.host__avatar { width: 30px; height: 30px; border-radius: 50%; flex: 0 0 auto; }
.host__name { font-size: 15px; }
.host__phone { font-size: 13px; color: var(--k-muted); }
.area { position: relative; min-height: 96px; padding: 12px 12px 26px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); }
.area__ta { width: 100%; height: 56px; font-size: 14px; line-height: 1.6; }
.area__counter { position: absolute; right: 12px; bottom: 8px; font-size: 12px; color: var(--k-muted); }
.tags { display: flex; flex-wrap: wrap; gap: 10px; }
.tag { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper2); font-size: 14px; }
.tag__add { color: var(--k-muted); }

/* 资质 */
.notice { padding: 12px 14px; border: 1px solid #E3CFA6; border-radius: 10px; background: var(--k-ochre-soft); color: #7A5A26; font-size: 13px; line-height: 1.6; }
.doc { margin-top: 12px; }
.doc__title { display: flex; align-items: center; gap: 4px; font-family: var(--k-serif); font-weight: 700; font-size: 16px; margin-bottom: 8px; }
.doc__hint { font-family: var(--k-serif); }
.doc__row { display: flex; gap: 10px; }
.doc__file { flex: 1.72; display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 6px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.doc__thumb { width: 66px; height: 50px; border-radius: 4px; flex: 0 0 auto; background: #F6F1E7; }
.doc__name { font-size: 14px; }
.doc__size { font-size: 13px; color: var(--k-muted); }
.doc__state { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; }
.doc__optional { color: var(--k-light); font-weight: 400; }
.doc__date { flex: 1; padding: 8px 10px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; flex-direction: column; justify-content: center; gap: 4px; }
.doc__date-label { font-size: 13px; color: var(--k-muted); }
.doc__date-val { font-size: 15px; }
.timeline { display: flex; padding: 4px 0 0; }
.timeline__item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.timeline__track { position: relative; width: 100%; height: 22px; display: flex; align-items: center; justify-content: center; }
.timeline__line { position: absolute; top: 50%; height: 1.5px; background: var(--k-line2); }
.timeline__line.done { background: var(--k-green); }
.timeline__line--l { left: 0; right: 50%; margin-right: 10px; }
.timeline__line--r { left: 50%; right: 0; margin-left: 10px; }
.timeline__dot { position: relative; z-index: 1; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; justify-content: center; }
.timeline__dot.done { border-color: var(--k-green); background: var(--k-green); }
.timeline__title { font-size: 14px; }
.timeline__time { font-size: 12px; color: var(--k-muted); }
.reject { margin-top: 14px; display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 10px; border: 1px solid #E3BFB5; border-radius: 10px; background: var(--k-red-soft); }
.reject__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 16px; color: var(--k-red); }
.reject__time { font-family: var(--k-sans); font-weight: 500; font-size: 14px; }
.reject__desc { display: block; margin-top: 4px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.reject__btn { flex: 0 0 auto; font-family: var(--k-serif); font-size: 15px; }

/* 390×844 首屏需要完整露出审核进度与驳回原因。 */
.k-pad-tab .notice { padding: 8px 12px; font-size: 11px; line-height: 1.45; }
.k-pad-tab .doc { margin-top: 7px; }
.k-pad-tab .doc__title { margin-bottom: 4px; font-size: 14px; }
.k-pad-tab .doc__row { height: 54px; }
.k-pad-tab .doc__file { padding: 5px; gap: 7px; }
.k-pad-tab .doc__date { padding: 5px 8px; }
.k-pad-tab .doc__thumb { width: 54px; height: 40px; }
.k-pad-tab .doc__name { font-size: 12px; }
.k-pad-tab .doc__size,.k-pad-tab .doc__state,.k-pad-tab .doc__date-label { font-size: 10px; }
.k-pad-tab .doc__date-val { font-size: 12px; }
.k-pad-tab .timeline { padding-top: 1px; }
.k-pad-tab .timeline__item { gap: 3px; }
.k-pad-tab .timeline__title { font-size: 11px; }
.k-pad-tab .timeline__time { font-size: 9px; }
.k-pad-tab .reject { margin-top: 7px; padding: 7px 9px; }
.k-pad-tab .reject__title { font-size: 13px; }
.k-pad-tab .reject__time { font-size: 10px; }
.k-pad-tab .reject__desc { margin-top: 2px; font-size: 10px; line-height: 1.35; }

/* Vlog */
.vlog-body { padding-bottom: calc(132px + var(--k-safe-bottom)); }
.upload { padding: 10px 10px 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.upload__row { display: flex; gap: 12px; }
.upload__video { width: 193px; height: 121px; border-radius: 8px; overflow: hidden; flex: 0 0 auto; }
.upload__img { width: 193px; height: 121px; }
.upload__add { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 1.5px dashed var(--k-line2); border-radius: 8px; background: var(--k-paper2); font-size: 14px; color: var(--k-muted); }
.upload__tip { display: block; margin-top: 10px; font-size: 13px; color: var(--k-muted); }
.cover { display: flex; align-items: center; gap: 12px; padding: 0 12px 0 0; border-bottom: 1px solid var(--k-line); }
.cover__img { width: 62px; height: 51px; border-radius: 6px; flex: 0 0 auto; }
.cover__change { font-size: 14px; }
.link__copy { font-size: 13px; color: var(--k-muted); }
.title-input { padding-right: 12px; }
.freq { margin-top: 20px; display: flex; align-items: flex-start; gap: 12px; padding: 16px 14px; border: 1px solid #E3CFA6; border-radius: 10px; background: var(--k-ochre-soft); }
.freq__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 16px; color: #7A5A26; }
.freq__desc { display: block; margin-top: 6px; font-size: 13px; line-height: 1.6; color: #7A5A26; }
</style>
