<template>
  <view class="k-page review">
    <k-topbar :title="titles[s - 1]" back @back="onBack">
      <view v-if="s === 4" class="k-tabs">
        <view v-for="t in errTabs" :key="t.key" class="k-tabs__item err-tab" :class="{ active: errTab === t.key }" @click="errTab = t.key"><text>{{ t.label }}</text></view>
      </view>
    </k-topbar>

    <!-- 1 AI 引导式评价 -->
    <view v-if="s === 1" class="ai k-pad-bottom">
      <text class="ai__progress">评价进度 {{ progress }}/5</text>
      <view class="ai__hello">
        <image class="ai__avatar" src="/static/media/review-kangaroo.jpg" mode="aspectFill" />
        <view class="bubble">
          <view class="bubble__tail" />
          <text class="bubble__hi">HI，我是小院AI助手</text>
          <text class="bubble__copy">为了帮更多手作人找到安心好去处，\n请分享你的真实体验～</text>
        </view>
      </view>
      <view v-for="(q, i) in questions" :key="q.title" class="q">
        <view class="q__head"><view class="q__num"><text>{{ i + 1 }}</text></view><text class="q__title">{{ q.title }}</text></view>
        <view class="q__stars">
          <view v-for="n in 5" :key="n" class="q__star" @click="setStar(q, n)"><k-icon name="star" :size="24" color="#C99043" :stroke="1.6" :fill="n <= q.stars" /></view>
          <text class="q__level">{{ q.label }}</text>
        </view>
        <view class="q__box">
          <textarea v-model="q.text" class="q__area" :maxlength="200" placeholder="说说你的真实感受" placeholder-class="k-placeholder" />
          <text class="q__counter">{{ q.text.length }}/200</text>
        </view>
      </view>
      <view class="polish">
        <view class="k-row k-gap4"><k-icon name="star" :size="14" color="green" :stroke="1.6" fill /><text class="polish__title">AI润色建议（保留原意，提升表达）</text></view>
        <view class="polish__chip"><text>已优化</text></view>
      </view>
      <view class="polish__box"><text class="polish__text">住宿干净安静，工作强度合理，团队沟通良好，有学习机会，位置便利，整体体验很不错，推荐给想找手作相关工作的朋友们～</text></view>
      <text class="ai__note">以上评价将匿名展示，感谢你的真实分享！</text>
      <k-bottom flat pad="8px 16px 4px"><k-button block @click="submitReview">提交评价</k-button></k-bottom>
    </view>

    <!-- 2 到店路线 -->
    <view v-else-if="s === 2" class="k-body k-pad-bottom route">
      <view class="shop">
        <image class="shop__img" src="/static/media/review-room.jpg" mode="aspectFill" />
        <view class="k-flex1">
          <text class="shop__title">西湖边 · 温馨一居室</text>
          <view class="k-row k-gap4 k-mt4"><text class="k-price">¥2800</text><text class="k-meta">元/月</text></view>
          <text class="shop__addr">杭州市西湖区留下街道留和路129号</text>
          <text class="shop__addr">距杭州汽车西站约1.2公里</text>
        </view>
        <view class="shop__call" @click="toast('拨打商家电话')">
          <view class="k-circle k-circle--outline shop__phone"><k-icon name="phone" :size="16" color="ink" :stroke="1.6" /></view>
          <text class="k-meta">联系商家</text>
        </view>
      </view>
      <image class="map" src="/static/media/review-map.jpg" mode="aspectFill" @click="toast('打开地图导航')" />
      <view class="modes">
        <view v-for="m in modes" :key="m" class="mode" :class="{ active: mode === m }" @click="mode = m"><text>{{ m }}</text></view>
      </view>
      <view v-for="p in plans" :key="p.name" class="plan" :class="{ 'plan--on': mode === p.mode || mode === '推荐路线' }">
        <view class="plan__head">
          <text class="plan__name">{{ p.name }}<text v-if="p.rec" class="k-green"> (推荐)</text></text>
          <text class="plan__stat">{{ p.time }}</text>
          <text class="plan__stat">{{ p.dist }}</text>
          <text class="plan__stat plan__stat--last">{{ p.cost }}</text>
        </view>
        <view v-if="p.steps" class="plan__steps">
          <view v-for="(st, i) in p.steps" :key="st.text" class="step">
            <view class="step__track">
              <view v-if="st.dot" class="step__dot" :class="'step__dot--' + st.dot" />
              <k-icon v-else :name="st.icon" :size="14" color="muted" :stroke="1.6" />
              <view v-if="i < p.steps.length - 1" class="step__line" />
            </view>
            <text class="step__text">{{ st.text }}</text>
          </view>
        </view>
        <text v-else-if="p.sub" class="plan__sub">{{ p.sub }}</text>
      </view>
      <text class="sec-title">门店照片</text>
      <view class="photos">
        <image v-for="n in 3" :key="n" class="photos__img" :src="`/static/media/review-shop-${n}.jpg`" mode="aspectFill" @click="toast('查看门店照片')" />
      </view>
      <k-bottom flat>
        <k-button type="outline" size="md" @click="toast('拨打商家电话')">联系商家</k-button>
        <k-button type="outline" size="md" @click="toast('分享路线')">分享路线</k-button>
        <k-button class="k-flex1" size="md" icon="download" @click="toast('已离线保存')">离线保存</k-button>
      </k-bottom>
    </view>

    <!-- 3 AI 暂不可用 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab search">
      <view class="k-row k-gap8">
        <view class="search__box"><k-icon name="search" :size="18" color="muted" :stroke="1.8" /><input v-model="keyword" placeholder="搜索城市 / 区域 / 房源 / 店铺" placeholder-class="k-placeholder" /></view>
        <view class="search__filter" @click="go(R.jobsFilter)">
          <k-icon name="sliders-horizontal" :size="16" color="ink" :stroke="1.8" /><text>筛选</text>
          <view class="search__badge"><text>2</text></view>
        </view>
      </view>
      <view class="filters">
        <view v-for="f in ['位置', '类型', '价格', '更多']" :key="f" class="filter" @click="toast(f)"><text>{{ f }}</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="1.8" /></view>
      </view>
      <view class="unavail">
        <image class="unavail__img" src="/static/media/review-robot.jpg" mode="aspectFit" />
        <text class="unavail__title">推荐服务暂时不可用</text>
        <text class="unavail__desc">AI推荐服务当前暂时不可用，\n你仍可以使用普通搜索与筛选功能。</text>
        <view class="unavail__btns">
          <k-button block @click="toast('正在重试…')">稍后重试</k-button>
          <k-button block type="secondary" @click="go(R.staysList)">使用普通筛选</k-button>
          <k-button block type="secondary" @click="go(R.messages + '?s=4')">联系客服</k-button>
        </view>
      </view>
    </view>

    <!-- 4 权限与错误恢复 -->
    <view v-else class="k-body k-pad-tab perm">
      <view class="perm__body">
        <image v-if="errTab === 'location'" class="perm__img" src="/static/media/review-pin.jpg" mode="aspectFit" />
        <view v-else class="perm__icon" :class="'is-' + current.tone"><k-icon :name="current.icon" :size="46" :color="current.tone" :stroke="1.4" /></view>
        <text class="perm__title">{{ current.title }}</text>
        <text class="perm__desc">{{ current.desc }}</text>
        <view class="perm__steps">
          <view v-for="(st, i) in current.steps" :key="st" class="perm__step">
            <view class="perm__num"><text>{{ i + 1 }}</text></view>
            <text class="perm__step-text">{{ st }}</text>
          </view>
        </view>
        <k-button block @click="toast(current.primary)">{{ current.primary }}</k-button>
        <k-button block type="outline" class="k-mt10" @click="toast(current.secondary)">{{ current.secondary }}</k-button>
        <view class="perm__help" @click="go(R.messages + '?s=4')">
          <text class="k-small k-muted">仍无法解决？</text>
          <text class="k-small perm__help-link">联系客服</text>
          <k-icon name="headset" :size="16" color="muted" :stroke="1.6" />
        </view>
      </view>
    </view>

    <k-tabbar v-if="s === 3 || s === 4" :active="s === 3 ? 'home' : ''" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const titles = ['AI引导式评价', '到店路线', '房源搜索', '权限与错误恢复']
const onBack = () => back()

// s1
const starLabels = { 0: '未评分', 1: '较差', 2: '一般', 3: '一般', 4: '一般', 5: '很好' }
const questions = ref([
  { title: '住宿条件如何?', stars: 5, label: '很好', text: '房间干净整洁，采光好，床铺舒适，晚上很安静。' },
  { title: '工作强度如何?', stars: 5, label: '较好', text: '日常任务合理，节奏适中，不会过度加班。' },
  { title: '团队沟通氛围如何?', stars: 5, label: '很好', text: '同事友善好相处，沟通顺畅，遇到问题会互相帮忙。' },
  { title: '个人成长与学习机会如何?', stars: 5, label: '较好', text: '能学到不少手作技能，偶尔有培训和分享。' },
  { title: '位置与周边便利性如何?', stars: 4, label: '一般', text: '离地铁步行10分钟，周边便利店和餐饮较多。' }
])
const progress = ref(1)
const setStar = (q, n) => { q.stars = n; q.label = starLabels[n]; progress.value = Math.min(5, questions.value.filter(x => x.stars > 0).length) }
const submitReview = () => { toast('评价已提交'); go(R.orders + '?s=2') }

// s2
const modes = ['推荐路线', '步行', '公交', '打车']
const mode = ref('推荐路线')
const plans = [
  { name: '步行 + 公交', rec: true, mode: '公交', time: '28分钟', dist: '1.2公里', cost: '约2元', steps: [
    { icon: 'footprints', text: '步行12分钟（850米）' },
    { dot: 'green', text: '汽车西站 上车' },
    { dot: 'red', text: '91路（开往 黄龙公交站）' },
    { dot: 'hollow', text: '留下站 下车' },
    { icon: 'target', text: '步行8分钟（500米）' }
  ] },
  { name: '步行', mode: '步行', time: '36分钟', dist: '1.8公里', cost: '', sub: '步行1.8公里' },
  { name: '打车', mode: '打车', time: '8分钟', dist: '1.2公里', cost: '约12元' }
]

// s3
const keyword = ref('')

// s4
const errTabs = [
  { key: 'location', label: '定位拒绝', icon: 'map-pin-x', tone: 'green', title: '无法获取你的位置信息', desc: '定位权限已被拒绝，将影响附近房源、路线规划等功能\n请按照以下步骤开启定位权限。', steps: ['打开手机「设置」', '进入「隐私与安全性」>「定位服务」', '找到「袋鼠小院」并选择「使用App期间」', '返回小程序，重新获取位置'], primary: '去系统设置', secondary: '重新获取位置' },
  { key: 'camera', label: '相机未授权', icon: 'camera-off', tone: 'ochre', title: '相机权限未授权', desc: '相机权限未开启，将无法拍摄与上传照片\n请按照以下步骤开启相机权限。', steps: ['打开手机「设置」', '进入「隐私与安全性」>「相机」', '找到「袋鼠小院」并开启相机权限', '返回小程序，重新拍摄'], primary: '去系统设置', secondary: '重新授权相机' },
  { key: 'pay', label: '支付超时', icon: 'hourglass', tone: 'red', title: '支付已超时', desc: '订单未在限定时间内完成支付\n请重新提交订单后再次支付。', steps: ['返回订单页，确认订单信息', '重新提交订单并生成新的支付单', '在 15 分钟内完成微信支付', '支付完成后到「我的-订单」查看'], primary: '重新支付', secondary: '查看订单' },
  { key: 'network', label: '网络断开', icon: 'wifi-off', tone: 'indigo', title: '网络连接已断开', desc: '当前网络不可用，将影响内容加载与提交\n请检查网络设置后重试。', steps: ['检查手机 Wi-Fi 或移动数据是否开启', '关闭飞行模式或切换网络', '返回小程序，下拉刷新页面', '仍无法连接可联系客服'], primary: '重试', secondary: '检查网络设置' }
]
const errTab = ref('location')
const current = computed(() => errTabs.find(t => t.key === errTab.value))
</script>

<style scoped lang="scss">
.sec-title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; margin: 14px 0 10px; }

/* s1 */
.ai { padding: 8px 14px 0; }
.ai__progress { display: block; font-size: 13px; color: var(--k-muted); margin-bottom: 8px; }
.ai__hello { display: flex; align-items: flex-start; gap: 8px; }
.ai__avatar { width: 46px; height: 46px; border-radius: 50%; flex: 0 0 auto; border: 1px solid var(--k-line); }
.bubble { position: relative; flex: 1; min-width: 0; max-width: 240px; background: var(--k-paper); border: 1px solid var(--k-line2); border-radius: 10px; padding: 8px 12px; }
.bubble__tail { position: absolute; left: -6px; top: 16px; width: 10px; height: 10px; background: var(--k-paper); border-left: 1px solid var(--k-line2); border-bottom: 1px solid var(--k-line2); transform: rotate(45deg); }
.bubble__hi { display: block; font-size: 14px; font-weight: 500; }
.bubble__copy { display: block; font-size: 12px; color: var(--k-muted); line-height: 1.6; margin-top: 4px; white-space: pre-line; }
.q { margin-top: 6px; }
.q__head { display: flex; align-items: center; gap: 6px; height: 24px; }
.q__num { width: 16px; height: 16px; border-radius: 50%; background: var(--k-green); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.q__title { font-family: var(--k-serif); font-weight: 700; font-size: 14px; }
.q__stars { display: flex; align-items: center; gap: 14px; padding: 2px 0 4px 2px; }
.q__star { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
.q__level { margin-left: auto; margin-right: 8px; font-size: 13px; color: var(--k-muted); }
.q__box { position: relative; background: var(--k-paper); border: 1px solid var(--k-line2); border-radius: 8px; padding: 6px 10px 16px; }
.q__area { width: 100%; height: 22px; font-size: 13px; line-height: 22px; }
.q__counter { position: absolute; right: 10px; bottom: 3px; font-size: 11px; color: var(--k-light); }
.polish { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
.polish__title { font-size: 13px; }
.polish__chip { height: 18px; padding: 0 6px; border-radius: 4px; background: var(--k-green); color: #fff; font-size: 10px; display: flex; align-items: center; }
.polish__box { margin-top: 6px; background: var(--k-paper); border: 1px solid var(--k-line2); border-radius: 8px; padding: 8px 10px; }
.polish__text { font-size: 12.5px; line-height: 1.6; color: var(--k-muted); }
.ai__note { display: block; text-align: center; font-size: 12px; color: var(--k-muted); margin-top: 8px; }

/* s2 */
.shop { display: flex; align-items: flex-start; gap: 12px; }
.shop__img { width: 78px; height: 72px; border-radius: 8px; flex: 0 0 auto; }
.shop__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.shop__addr { display: block; font-size: 11px; color: var(--k-muted); line-height: 1.5; }
.shop__call { display: flex; flex-direction: column; align-items: center; gap: 4px; padding-left: 10px; border-left: 1px solid var(--k-line); align-self: center; }
.shop__phone { width: 32px; height: 32px; border-width: 1px; }
.map { width: 100%; height: 160px; border-radius: 12px; margin-top: 12px; }
.modes { display: flex; align-items: center; margin-top: 12px; }
.mode { flex: 1; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 14px; color: var(--k-ink); }
.mode.active { background: var(--k-red); color: #FFF8F0; font-weight: 600; }
.plan { margin-top: 10px; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; padding: 10px 12px; }
.plan__head { display: flex; align-items: center; }
.plan__name { flex: 1.3; font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.plan__stat { flex: 1; font-size: 13px; }
.plan__stat--last { text-align: right; flex: .7; }
.plan__steps { margin-top: 8px; }
.step { display: flex; align-items: stretch; gap: 8px; min-height: 22px; }
.step__track { position: relative; width: 14px; display: flex; justify-content: center; align-items: flex-start; padding-top: 4px; }
.step__dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 3px; z-index: 1; }
.step__dot--green { background: var(--k-green); }
.step__dot--red { background: var(--k-red); }
.step__dot--hollow { background: var(--k-paper); border: 1.5px solid var(--k-line2); }
.step__line { position: absolute; left: 6px; top: 16px; bottom: -4px; width: 0; border-left: 1px dashed var(--k-line2); }
.step__text { font-size: 12px; color: var(--k-ink); line-height: 22px; }
.plan__sub { display: block; font-size: 12px; color: var(--k-muted); margin-top: 6px; }
.photos { display: flex; gap: 8px; }
.photos__img { flex: 1; min-width: 0; height: 90px; border-radius: 8px; }

/* s3 */
.search__box { flex: 1; min-width: 0; height: 40px; border-radius: 999px; border: 1px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; gap: 8px; padding: 0 14px; }
.search__box input { flex: 1; min-width: 0; font-size: 13px; }
.search__filter { position: relative; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; gap: 6px; font-size: 14px; flex: 0 0 auto; }
.search__badge { position: absolute; right: -6px; top: -6px; width: 16px; height: 16px; border-radius: 50%; background: var(--k-red); color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; }
.filters { display: flex; gap: 8px; margin-top: 10px; }
.filter { flex: 1; height: 38px; border-radius: 8px; border: 1px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-size: 14px; }
.unavail { display: flex; flex-direction: column; align-items: center; padding-top: 44px; }
.unavail__img { width: 180px; height: 140px; }
.unavail__title { font-family: var(--k-serif); font-weight: 700; font-size: 22px; margin-top: 14px; }
.unavail__desc { font-size: 14px; color: var(--k-muted); line-height: 1.7; text-align: center; margin-top: 8px; white-space: pre-line; }
.unavail__btns { width: 236px; display: flex; flex-direction: column; gap: 12px; margin-top: 22px; }

/* s4 */
.err-tab { font-size: 15px; }
.perm__body { display: flex; flex-direction: column; align-items: center; padding: 60px 8px 0; }
.perm__img { width: 112px; height: 118px; }
.perm__icon { width: 112px; height: 112px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--k-paper2); }
.perm__icon.is-ochre { background: var(--k-ochre-soft); }
.perm__icon.is-red { background: var(--k-red-soft); }
.perm__icon.is-indigo { background: var(--k-indigo-soft); }
.perm__title { font-family: var(--k-serif); font-weight: 700; font-size: 22px; margin-top: 18px; }
.perm__desc { font-size: 13px; color: var(--k-muted); line-height: 1.8; text-align: center; margin-top: 10px; white-space: pre-line; }
.perm__steps { width: 100%; display: flex; flex-direction: column; gap: 12px; margin: 22px 0 26px; padding: 0 8px; }
.perm__step { display: flex; align-items: center; gap: 12px; }
.perm__num { width: 22px; height: 22px; border-radius: 50%; border: 1.2px solid var(--k-light); color: var(--k-muted); font-size: 12px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.perm__step-text { font-size: 14px; }
.perm__help { display: flex; align-items: center; gap: 6px; margin-top: 18px; }
.perm__help-link { color: var(--k-ink); }
</style>
