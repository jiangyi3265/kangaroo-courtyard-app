<template>
  <view class="k-page opp">
    <k-topbar :title="titles[s - 1]" back @back="onBack" />

    <!-- 1 AI 技能标签云 -->
    <view v-if="s === 1" class="k-body k-pad-tab">
      <view class="intro">
        <image class="intro__img" src="/static/media/opp-kangaroo.jpg" mode="aspectFit" />
        <text class="intro__text">基于你填写的自由文本，AI已聚类出以下技能标签，可查看来源（不可替代原文）</text>
      </view>

      <view class="raw k-mt8">
        <view class="k-between">
          <view class="k-row k-gap4"><text class="k-title">你的原始文本</text><text class="k-text k-muted">（不可替代）</text></view>
          <view class="k-row k-gap2" @click="go(R.resume + '?s=3')"><text class="ob k-small">查看全部</text><k-icon name="chevron-right" :size="14" color="#9A6A22" /></view>
        </view>
        <view class="raw__box k-mt10">
          <text class="raw__text">做过咖啡师，擅长拉花，拿铁艺术，门店接待收银，活动策划，拍照剪辑，公众号运营，社群维护……</text>
          <text class="k-small k-muted raw__count">共 356 字</text>
        </view>
      </view>

      <view class="k-between k-mt16">
        <view class="k-col"><text class="k-h2">AI聚类技能标签</text><text class="k-meta k-mt2">标签可查看来源，不可替代原文</text></view>
        <view @click="toast('标签由 AI 自动聚类生成')"><k-icon name="circle-help" :size="22" color="muted" :stroke="1.5" /></view>
      </view>

      <view class="k-grid-2 tags k-mt12">
        <view v-for="t in tags" :key="t.name" class="tag" :class="`is-${t.tone}`" @click="toast(`来源：${t.name}`)">
          <k-icon :name="t.icon" :size="26" :color="toneColor[t.tone]" :stroke="1.6" />
          <view class="k-flex1">
            <view class="k-between"><text class="tag__name">{{ t.name }}</text><text class="tag__pct">{{ t.pct }}</text></view>
            <view class="k-row k-gap2"><text class="tag__src">查看来源</text><k-icon name="chevron-right" :size="12" :color="toneColor[t.tone]" /></view>
          </view>
        </view>
      </view>
      <text class="k-meta k-mt16 b">标签仅由AI聚类生成，不替代你的原始经历与表达</text>
    </view>

    <!-- 2 技能匹配机会 -->
    <view v-else-if="s === 2" class="k-body k-pad-tab">
      <view class="hero">
        <view class="k-flex1 k-col">
          <text class="k-text hero__text">根据你的技能画像，找到适合你的机会</text>
          <image class="hero__kg" src="/static/media/opp-banner-kangaroo.jpg" mode="aspectFit" />
        </view>
        <image class="hero__stamp" src="/static/media/opp-stamp.jpg" mode="aspectFit" />
      </view>

      <view v-for="job in jobs" :key="job.title" class="card job k-mt12">
        <view class="job__top">
          <image class="job__img" :src="job.img" mode="aspectFill" />
          <view class="k-flex1 k-col">
            <view class="k-between">
              <view class="k-row"><text class="job__title">{{ job.title }}</text><text class="job__type">（{{ job.type }}）</text></view>
              <view class="match"><text>{{ job.match }}匹配</text></view>
            </view>
            <view class="k-row k-gap4 k-mt8"><k-icon name="map-pin" :size="14" color="muted" :stroke="1.6" /><text class="k-small k-muted">{{ job.place }}</text></view>
            <view class="k-row k-gap8 k-mt10"><view v-for="c in job.chips" :key="c.t" class="chip" :class="`is-${c.tone}`"><text>{{ c.t }}</text></view></view>
            <text v-if="job.reason" class="k-small k-green k-mt10 b">匹配原因：{{ job.reason }}</text>
            <view v-else class="k-row k-gap4 k-mt8"><text class="k-price">{{ job.price }}</text><text class="k-small k-muted">{{ job.unit }}</text></view>
          </view>
        </view>
        <view class="k-row k-gap10 k-mt12">
          <k-button type="outline" size="md" class="k-flex1 btn-serif" @click="go(R.jobDetail)">查看详情</k-button>
          <k-button size="md" class="k-flex1 btn-serif" @click="s = 3">一键报名</k-button>
        </view>
      </view>
    </view>

    <!-- 3 一键报名 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab">
      <view class="card apply-job">
        <image class="apply-job__img" src="/static/media/opp-job-latte.jpg" mode="aspectFill" />
        <view class="k-flex1 k-col">
          <text class="apply-job__title">古城咖啡师（兼职）</text>
          <text class="k-small k-muted k-mt6">大理古城 · 咖啡小院</text>
          <view class="k-row k-gap4 k-mt8"><text class="k-price apply-job__price">120</text><text class="k-text k-muted">元/天</text></view>
        </view>
        <view class="match">94%匹配</view>
      </view>

      <view class="card k-mt12">
        <view class="step"><view class="step__num"><text>1</text></view><text class="step__title">复用我的简历</text></view>
        <view class="resume-box k-mt10">
          <view class="k-row k-gap12">
            <image class="resume-box__avatar" src="/static/media/opp-avatar.jpg" mode="aspectFill" />
            <view class="k-flex1 k-col"><text class="k-subtitle">小袋鼠</text><text class="k-small k-muted k-mt4">最近更新：2024-09-01</text></view>
            <view class="k-row k-gap2" @click="go(R.resume)"><text class="k-text">预览简历</text><k-icon name="chevron-right" :size="16" color="ink" /></view>
          </view>
          <view class="resume-box__foot"><view class="k-circle k-circle--green ok"><k-icon name="check" :size="11" color="white" :stroke="3" /></view><text class="k-text">已包含基本信息、经历、技能等</text></view>
        </view>

        <view class="step k-mt16"><view class="step__num"><text>2</text></view><text class="step__title">到岗日期</text></view>
        <view class="k-input date k-mt10" :class="{ 'k-input--error': dateError }" @click="pickDate">
          <text class="k-flex1" :class="date ? '' : 'k-light'">{{ date || '请选择你可到岗的日期' }}</text>
          <k-icon name="calendar" :size="20" color="muted" :stroke="1.5" />
        </view>
        <text v-if="dateError" class="k-small k-red k-mt6 b">请选择到岗日期</text>

        <view class="k-between k-mt16">
          <view class="step"><view class="step__num"><text>3</text></view><text class="step__title">相关经历</text><text class="k-text k-muted">（已选，支持调整）</text></view>
          <view class="k-row k-gap2" @click="go(R.resume + '?s=4')"><text class="k-small k-muted">编辑</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
        </view>
        <view class="k-row k-gap10 k-mt12 k-wrap">
          <view v-for="e in exps" :key="e" class="exp"><text>{{ e }}</text></view>
        </view>
      </view>

      <view v-if="dateError" class="alert k-mt12">
        <view class="k-row k-gap6"><k-icon name="triangle-alert" :size="16" color="red" :stroke="2" fill /><text class="alert__title">请完善以下信息后报名</text></view>
        <view class="k-between k-mt10"><view class="k-row k-gap8"><view class="alert__bullet" /><text class="k-text">请选择到岗日期</text></view><view class="k-dot" /></view>
      </view>

      <k-button block class="k-mt12 btn-serif" @click="submit">一键报名</k-button>
      <view class="agree k-mt12" @click="agreed = !agreed">
        <view class="k-check" :class="{ checked: agreed }"><k-icon v-if="agreed" name="check" :size="12" color="white" :stroke="3" /></view>
        <text class="k-small k-muted">已阅读并同意</text><text class="k-small agree__link">《用户协议》</text><text class="k-small agree__link">《隐私政策》</text>
      </view>
    </view>

    <!-- 4 认证与赚钱机会 -->
    <view v-else class="k-body k-pad-tab">
      <view class="card card--tight">
        <view class="cert-head">
          <view class="k-row"><text class="k-title">成长认证：咖啡师</text><text class="k-text k-muted">（全职培训）</text></view>
          <view class="k-row k-gap2" @click="toast('认证详情')"><text class="ob k-small">查看详情</text><k-icon name="chevron-right" :size="14" color="#9A6A22" /></view>
        </view>
        <view class="flow">
          <view v-for="(f, i) in flow" :key="f.label" class="flow__wrap">
            <view v-if="i > 0" class="flow__arrow"><view class="flow__line" /><k-icon name="chevron-right" :size="12" color="#B98A4A" :stroke="2" /></view>
            <view class="flow__item">
              <view class="flow__dot" :class="{ done: f.done }"><k-icon :name="f.icon" :size="20" color="white" :stroke="f.done ? 2.6 : 1.7" /></view>
              <text class="flow__label">{{ f.label }}</text>
            </view>
          </view>
        </view>
        <view class="grade">
          <view class="grade__col">
            <text class="k-text">考核等级</text>
            <view class="k-row k-gap8 k-mt6"><text class="grade__num">1</text><text class="k-text">级</text><view class="grade__chip"><text>良好</text></view></view>
            <text class="k-meta k-mt8">考核完成于 2024-08-20</text>
          </view>
          <view class="grade__col grade__col--r">
            <view class="k-row k-gap8"><text class="k-text">综合评分</text><text class="grade__score">88分</text></view>
            <view class="k-row k-gap6 k-mt8"><k-icon v-for="n in 5" :key="n" name="star" :size="28" color="#C99043" :stroke="1.4" :fill="n <= 4" /></view>
            <text class="k-small k-muted k-mt8">超过 72% 的学员</text>
          </view>
        </view>
      </view>

      <view class="card k-mt12">
        <view class="k-between">
          <text class="k-title">已通过证书</text>
          <view class="k-row k-gap2" @click="toast('查看证书')"><text class="ob k-small">查看证书</text><k-icon name="chevron-right" :size="14" color="#9A6A22" /></view>
        </view>
        <view class="cert k-mt10">
          <image class="cert__img" src="/static/media/opp-cert.jpg" mode="aspectFit" />
          <view class="k-flex1 k-col k-gap4">
            <text class="k-subtitle">咖啡师技能认证（初级）</text>
            <text class="k-small k-muted">颁发机构：袋鼠小院认证中心</text>
            <text class="k-small k-muted">证书编号：DRXY-CF-240820-001</text>
          </view>
          <image class="cert__stamp" src="/static/media/opp-cert-stamp.jpg" mode="aspectFit" />
        </view>
      </view>

      <view class="card card--tight k-mt12">
        <text class="k-title rec-head">为你推荐的赚钱机会</text>
        <view v-for="(r, i) in recs" :key="r.title" class="rec" :class="{ 'has-line': i < recs.length - 1 }" @click="go(R.jobDetail)">
          <image class="rec__img" :src="r.img" mode="aspectFill" />
          <view class="k-flex1 k-col">
            <view class="k-between">
              <view class="k-row"><text class="rec__title">{{ r.title }}</text><text class="k-small k-muted">（{{ r.type }}）</text></view>
              <view class="rec__tag" :style="{ background: r.tagColor }"><text>{{ r.tag }}</text></view>
            </view>
            <view class="k-between k-mt4">
              <view class="k-row k-gap3"><k-icon name="map-pin" :size="12" color="muted" :stroke="1.6" /><text class="k-meta">{{ r.place }}</text></view>
              <view class="k-row k-gap3 rec__price-wrap"><text class="rec__price">{{ r.price }}</text><text class="k-meta">{{ r.unit }}</text></view>
            </view>
            <text class="k-meta k-mt4">推荐理由：{{ r.reason }}</text>
          </view>
        </view>
      </view>

      <view class="learn k-mt12" @click="toast('去学习')">
        <image class="learn__img" src="/static/media/opp-tip-kangaroo.jpg" mode="aspectFit" />
        <text class="k-small k-muted k-flex1">持续学习与实践，提升等级，可解锁更多高收益机会</text>
        <view class="k-row k-gap2"><text class="ob k-small">去学习</text><k-icon name="chevron-right" :size="14" color="#9A6A22" /></view>
      </view>
    </view>

    <k-tabbar active="none" badge="6" />
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const titles = ['AI技能标签云', '技能匹配机会', '一键报名', '认证与赚钱机会']
const onBack = () => { if (s.value === 3) s.value = 2; else if (s.value > 1) s.value = 1; else back() }

const toneColor = { green: '#4F7A66', ochre: '#9A6A22', indigo: '#40576B', gray: '#6B635C' }
const tags = [
  { name: '咖啡制作', pct: '92%', icon: 'coffee', tone: 'green' },
  { name: '拉花', pct: '88%', icon: 'coffee', tone: 'ochre' },
  { name: '摄影', pct: '85%', icon: 'camera', tone: 'indigo' },
  { name: '门店服务', pct: '80%', icon: 'briefcase', tone: 'ochre' },
  { name: '社群运营', pct: '75%', icon: 'users', tone: 'green' },
  { name: '活动策划', pct: '70%', icon: 'clipboard-check', tone: 'indigo' },
  { name: '内容创作', pct: '68%', icon: 'file-text', tone: 'ochre' },
  { name: '收银接待', pct: '65%', icon: 'calculator', tone: 'gray' }
]

const jobs = [
  { img: '/static/media/opp-job-latte.jpg', title: '古城咖啡师', type: '兼职', match: '94%', place: '大理古城 · 咖啡小院', chips: [{ t: '咖啡制作', tone: 'ochre' }, { t: '拉花', tone: 'ochre' }, { t: '门店服务', tone: 'ochre' }], reason: '拉花经验 + 大理可到岗' },
  { img: '/static/media/opp-job-photo.jpg', title: '洱海旅拍助理', type: '兼职', match: '88%', place: '洱海生态廊道', chips: [{ t: '摄影', tone: 'indigo' }, { t: '活动策划', tone: 'ochre' }, { t: '内容创作', tone: 'ochre' }], reason: '摄影经验 + 大理可到岗' },
  { img: '/static/media/opp-job-cafe.jpg', title: '咖啡门店服务', type: '全职', match: '86%', place: '喜洲古镇 · 咖啡小院', chips: [{ t: '门店服务', tone: 'ochre' }, { t: '收银接待', tone: 'gray' }, { t: '社群运营', tone: 'green' }], price: '2800', unit: '元/月' }
]

const date = ref('')
const dateError = ref(true)
const agreed = ref(false)
const exps = ['咖啡师经验 2年', '拉花经验 1年', '门店服务经验 1年']
const pickDate = () => { date.value = '2024-09-15'; dateError.value = false }
const submit = () => {
  if (!date.value) { dateError.value = true; return toast('请选择到岗日期') }
  if (!agreed.value) return toast('请先阅读并同意协议')
  go(R.jobProgress)
}

const flow = [
  { label: '报名', icon: 'clipboard-list' },
  { label: '培训学习', icon: 'book-open' },
  { label: '考核', icon: 'file-text' },
  { label: '认证通过', icon: 'check', done: true }
]
const recs = [
  { img: '/static/media/opp-rec-1.jpg', title: '店员带教', type: '全职', tag: '高匹配', tagColor: '#4F7A66', place: '大理古城 · 咖啡小院', price: '3500-4500', unit: '元/月', reason: '拉花经验 + 服务经验' },
  { img: '/static/media/opp-rec-2.jpg', title: '活动助理', type: '兼职', tag: '较高匹配', tagColor: '#C58F3F', place: '洱海生态廊道', price: '120', unit: '元/天', reason: '活动策划 + 执行能力' },
  { img: '/static/media/opp-rec-3.jpg', title: '在线内容任务', type: '远程', tag: '可尝试', tagColor: '#40576B', place: '袋鼠小院内容中心', price: '80-150', unit: '元/篇', reason: '摄影 + 内容创作' }
]
</script>

<style scoped lang="scss">
.b { display: block; }
.k-mt2 { margin-top: 2px; }
.k-mt6 { margin-top: 6px; }
.k-mt10 { margin-top: 10px; }
.k-gap3 { gap: 3px; }
.ob { color: #9A6A22; }
.card { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; padding: 14px; }
.card--tight { padding: 0; }
.btn-serif { font-family: var(--k-serif); }
.ok { width: 16px; height: 16px; }

/* s1 */
.intro { display: flex; align-items: center; gap: 12px; padding: 6px 0 8px; }
.intro__img { width: 88px; height: 92px; flex: 0 0 auto; }
.intro__text { flex: 1; font-size: 15px; line-height: 1.8; color: var(--k-ink); }
.raw { background: #F4EEE4; border: 1px solid var(--k-line); border-radius: 14px; padding: 14px 12px 12px; }
.raw__box { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 10px; padding: 10px 12px 8px; display: flex; flex-direction: column; }
.raw__text { font-size: 14px; line-height: 1.8; color: var(--k-ink); }
.raw__count { align-self: flex-end; margin-top: 4px; }
.tags { gap: 12px 14px; }
.tag { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; min-height: 62px; }
.tag.is-green { background: #E7EFE7; }
.tag.is-ochre { background: #F4E8D2; }
.tag.is-indigo { background: #E7EDF1; }
.tag.is-gray { background: #ECE8E1; }
.tag__name { font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.tag__pct { font-size: 13px; }
.tag__src { font-size: 12px; }
.is-green .tag__name, .is-green .tag__pct, .is-green .tag__src { color: #3F6B56; }
.is-ochre .tag__name, .is-ochre .tag__pct, .is-ochre .tag__src { color: #9A6A22; }
.is-indigo .tag__name, .is-indigo .tag__pct, .is-indigo .tag__src { color: #40576B; }
.is-gray .tag__name, .is-gray .tag__pct, .is-gray .tag__src { color: #6B635C; }

/* s2 */
.hero { display: flex; align-items: center; gap: 8px; padding: 12px 10px 4px 14px; background: #F4EEE4; border: 1px solid var(--k-line); border-radius: 14px; min-height: 82px; }
.hero__text { font-size: 15px; }
.hero__kg { width: 50px; height: 44px; margin-top: 2px; margin-left: 12px; }
.hero__stamp { width: 98px; height: 70px; flex: 0 0 auto; }
.job { padding: 12px; }
.job__top { display: flex; align-items: flex-start; gap: 12px; }
.job__img { width: 112px; height: 122px; border-radius: 10px; flex: 0 0 auto; }
.job__title { font-family: var(--k-serif); font-weight: 700; font-size: 17px; line-height: 1.3; }
.job__type { font-size: 15px; color: var(--k-ink); }
.match { height: 26px; padding: 0 8px; border-radius: 6px; background: var(--k-green); color: #fff; font-size: 13px; font-weight: 600; display: flex; align-items: center; flex: 0 0 auto; }
.chip { height: 24px; padding: 0 8px; border-radius: 5px; font-size: 12px; display: flex; align-items: center; }
.chip.is-ochre { background: #F4E8D2; color: #9A6A22; }
.chip.is-indigo { background: #E7EDF1; color: #40576B; }
.chip.is-green { background: #E7EFE7; color: #4F7A66; }
.chip.is-gray { background: #ECE8E1; color: #6B635C; }

/* s3 */
.apply-job { display: flex; align-items: flex-start; gap: 12px; padding: 12px; }
.apply-job__img { width: 96px; height: 96px; border-radius: 10px; flex: 0 0 auto; }
.apply-job__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; line-height: 1.4; }
.apply-job__price { font-size: 24px; }
.step { display: flex; align-items: center; gap: 8px; }
.step__num { width: 22px; height: 22px; border-radius: 50%; background: #B0864A; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.step__title { font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.resume-box { border: 1px solid var(--k-line); border-radius: 10px; padding: 10px 12px; }
.resume-box__avatar { width: 56px; height: 56px; border-radius: 50%; flex: 0 0 auto; }
.resume-box__foot { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--k-line); }
.date { min-height: 42px; }
.exp { height: 36px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; font-size: 14px; }
.alert { background: #FBF3F0; border: 1px solid #E3BFB5; border-radius: 10px; padding: 12px 12px; }
.alert__title { color: var(--k-red); font-size: 14px; font-weight: 600; }
.alert__bullet { width: 6px; height: 6px; border-radius: 50%; background: #B98A4A; }
.agree { display: flex; align-items: center; gap: 6px; }
.agree__link { color: var(--k-indigo); }

/* s4 */
.cert-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #F7F2EA; border-radius: 14px 14px 0 0; border-bottom: 1px solid var(--k-line); }
.flow { display: flex; align-items: flex-start; padding: 14px 16px 12px; border-bottom: 1px solid var(--k-line); }
.flow__wrap { display: flex; align-items: flex-start; flex: 1; min-width: 0; }
.flow__wrap:first-child { flex: 0 0 auto; }
.flow__item { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 56px; flex: 0 0 auto; }
.flow__arrow { flex: 1; display: flex; align-items: center; height: 44px; padding: 0 2px; }
.flow__line { flex: 1; height: 1.5px; background: #C9A878; }
.flow__dot { width: 44px; height: 44px; border-radius: 50%; background: #B0864A; display: flex; align-items: center; justify-content: center; }
.flow__dot.done { background: var(--k-red); }
.flow__label { font-size: 13px; color: var(--k-ink); white-space: nowrap; }
.grade { display: flex; padding: 12px 14px 14px; }
.grade__col { flex: 1; display: flex; flex-direction: column; }
.grade__col--r { border-left: 1px solid var(--k-line); padding-left: 18px; }
.grade__num { font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 32px; line-height: 1; }
.grade__chip { height: 26px; padding: 0 10px; border: 1px solid var(--k-line2); border-radius: 6px; background: #F4EEE4; font-size: 13px; display: flex; align-items: center; margin-left: 4px; }
.grade__score { font-size: 16px; font-weight: 700; }
.cert { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: #F4EEE4; border: 1px solid var(--k-line); border-radius: 10px; }
.cert__img { width: 46px; height: 62px; flex: 0 0 auto; }
.cert__stamp { width: 60px; height: 60px; flex: 0 0 auto; }
.rec-head { display: block; padding: 12px 14px 8px; }
.rec { display: flex; align-items: center; gap: 10px; padding: 10px 12px 10px 12px; }
.rec.has-line { border-bottom: 1px solid var(--k-line); }
.rec__img { width: 58px; height: 64px; border-radius: 8px; flex: 0 0 auto; }
.rec__title { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.rec__tag { height: 22px; padding: 0 8px; border-radius: 5px; color: #fff; font-size: 12px; display: flex; align-items: center; flex: 0 0 auto; }
.rec__price { color: var(--k-red); font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 16px; }
.learn { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #F4EEE4; border: 1px solid var(--k-line); border-radius: 12px; }
.learn__img { width: 34px; height: 34px; flex: 0 0 auto; }
</style>
