<template>
  <view class="k-page stays">
    <!-- 1 城市 / 日期 / 人数 搜索 -->
    <view v-if="s === 1">
      <k-topbar>
        <template #left>
          <view class="brand">
            <text class="brand__name">袋鼠小院</text>
            <view class="brand__city" @click="toast('切换城市')">
              <k-icon name="map-pin" :size="15" color="ink" :stroke="2" fill />
              <text class="brand__city-text">大理</text>
              <k-icon name="chevron-down" :size="14" color="ink" :stroke="2" />
            </view>
          </view>
        </template>
      </k-topbar>
      <view class="k-body k-pad-tab">
        <view class="sbox">
          <view class="sbox__sec">
            <text class="sbox__label">入住 / 离店</text>
            <view class="sbox__dates">
              <text class="sbox__big">9月5日</text><text class="sbox__wk">周五</text>
              <k-icon class="sbox__arrow" name="arrow-right" :size="18" color="ink" :stroke="1.8" />
              <text class="sbox__big">9月12日</text><text class="sbox__wk">周五</text>
              <text class="sbox__nights">共7晚</text>
            </view>
          </view>
          <view class="sbox__sec">
            <text class="sbox__label">人数</text>
            <view class="k-between"><text class="sbox__big">1人</text><k-icon name="chevron-down" :size="16" color="ink" :stroke="1.8" /></view>
          </view>
          <view class="sbox__sec no-line">
            <view class="k-row k-gap6"><text class="sbox__kw">关键词</text><text class="sbox__hint">（小院名 / 商圈 / 设施）</text></view>
            <view class="k-row k-gap10 k-mt10">
              <view class="k-input k-flex1 sbox__input"><input v-model="kw" placeholder="搜索小院名、商圈或设施" placeholder-class="k-placeholder" /></view>
              <view class="sbox__btn" @click="s = 2"><text>搜索</text></view>
            </view>
          </view>
        </view>

        <view class="k-section recent"><text class="k-section__title">近期搜索</text><text class="k-small k-muted" @click="toast('已清空')">清空</text></view>
        <view class="k-row k-gap10">
          <view v-for="t in recent" :key="t" class="tag" @click="kw = t"><text>{{ t }}</text></view>
        </view>

        <view class="k-section areas"><text class="k-section__title">推荐区域</text><view class="k-section__more" @click="s = 2"><text class="k-small k-muted">更多</text><k-icon name="chevron-right" :size="14" color="muted" /></view></view>
        <view class="k-grid-2 area-grid">
          <view v-for="a in areas" :key="a.name" class="area" @click="s = 2">
            <image class="area__img" :src="a.img" mode="aspectFill" />
            <view class="area__shade" />
            <view class="area__copy"><text class="area__name">{{ a.name }}</text><text class="area__count">{{ a.count }}家小院</text></view>
          </view>
        </view>

        <k-button block class="find" @click="s = 2">查找房源</k-button>
      </view>
      <k-tabbar active="home" />
    </view>

    <!-- 2 全部房源列表 -->
    <view v-else-if="s === 2">
      <k-topbar title="全部房源" back @back="s = 1">
        <view class="filters">
          <view v-for="f in filterBar" :key="f" class="filters__item" @click="s = 4"><text>{{ f }}</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="1.8" /></view>
        </view>
      </k-topbar>
      <view class="k-body k-pad-tab">
        <view class="k-row k-gap12 src-tabs">
          <view v-for="t in srcTabs" :key="t.key" class="pill" :class="{ on: src === t.key }" @click="src = t.key"><text>{{ t.label }}</text></view>
        </view>
        <view v-for="h in homes" :key="h.name" class="home" @click="openDetail">
          <view class="home__pic">
            <image class="home__img" :src="h.img" mode="aspectFill" />
            <view class="badges"><view class="badge badge--src"><text>{{ h.src }}</text></view><view class="badge badge--safe"><text>安心住</text></view></view>
          </view>
          <view class="k-flex1 home__body">
            <view class="k-between"><text class="home__name">{{ h.name }}</text><k-icon name="heart" :size="22" color="ink" :stroke="1.6" /></view>
            <view class="k-row k-gap8 k-mt8"><view v-for="t in h.tags" :key="t" class="chip"><text>{{ t }}</text></view></view>
            <text class="home__meta k-mt10">{{ h.where }}</text>
            <text class="home__meta k-mt8">{{ h.score }}分 · {{ h.reviews }}条评价</text>
            <view class="k-between k-mt8">
              <view class="k-row"><text class="yen">¥</text><text class="price">{{ h.price }}</text><text class="home__unit">/晚起</text></view>
              <view class="k-row k-gap6"><text class="k-green avail">可订</text><text class="k-small k-muted">{{ h.dates }}</text></view>
            </view>
          </view>
        </view>
      </view>
      <k-tabbar active="home" />
    </view>

    <!-- 3 早鸟特价 -->
    <view v-else-if="s === 3">
      <k-topbar title="早鸟特价" back @back="s = 2" />
      <view class="k-body k-pad-tab">
        <view class="k-between bird-head">
          <text class="bird-head__title">提前预订，价格更优</text>
          <view class="k-row k-gap4">
            <text class="k-small k-muted">剩余</text><view class="tbox"><text>03</text></view><text class="k-small k-muted">天</text>
            <view class="tbox"><text>12</text></view><text class="tsep">:</text><view class="tbox"><text>48</text></view><text class="tsep">:</text><view class="tbox"><text>36</text></view>
          </view>
        </view>
        <view v-for="b in birds" :key="b.name" class="bird" @click="openDetail">
          <view class="bird__pic">
            <image class="bird__img" :src="b.img" mode="aspectFill" />
            <view class="badges"><view class="badge badge--src"><text>{{ b.src }}</text></view><view class="badge badge--safe"><text>安心住</text></view></view>
          </view>
          <view class="k-flex1">
            <text class="home__name">{{ b.name }}</text>
            <text class="home__meta k-mt8">{{ b.where }}</text>
            <view class="bird__price k-mt12">
              <text class="strike">¥{{ b.old }}</text>
              <text class="yen">¥</text><text class="price">{{ b.price }}</text><text class="home__unit">/晚起</text>
            </view>
            <text class="bird__left k-mt4">仅剩 {{ b.left }} 间</text>
            <view class="bird__line" />
            <text class="home__meta">适用入住日：{{ b.range }}</text>
            <view class="k-row k-gap16 k-mt8">
              <view class="k-row k-gap6"><view class="k-circle k-circle--red mark"><k-icon name="x" :size="10" color="white" :stroke="3" /></view><text class="k-small k-muted">不可退</text></view>
              <view class="k-row k-gap6"><view class="k-circle k-circle--green mark"><k-icon name="check" :size="10" color="white" :stroke="3" /></view><text class="k-small k-muted">可取消</text></view>
            </view>
          </view>
        </view>
      </view>
      <k-tabbar active="home" />
    </view>

    <!-- 4 筛选排序 -->
    <view v-else>
      <k-topbar title="筛选排序" back @back="s = 2">
        <template #right><text class="reset" @click="reset">重置</text></template>
      </k-topbar>
      <view class="k-body k-pad-bottom filter">
        <view class="fcard">
          <view class="k-between"><text class="fcard__title">位置</text><text class="k-small k-muted">地图预览</text></view>
          <image class="map" src="/static/media/stays-map.jpg" mode="aspectFill" />
        </view>
        <view class="fcard">
          <view class="k-row k-gap6"><text class="fcard__title">价格区间</text><text class="k-meta">（每晚）</text></view>
          <view class="opts opts--5">
            <view v-for="o in priceOpts" :key="o" class="opt" :class="{ on: price === o }" @click="price = o"><text>{{ o }}</text></view>
          </view>
        </view>
        <view class="fcard">
          <text class="fcard__title">房型设施</text>
          <view class="opts opts--4">
            <view v-for="o in roomOpts" :key="o" class="opt" :class="{ on: room === o }" @click="room = o"><text>{{ o }}</text></view>
          </view>
          <view class="fac-row">
            <view v-for="f in facilities" :key="f.label" class="k-row k-gap6"><k-icon :name="f.icon" :size="18" color="ink" :stroke="1.6" /><text class="fac-row__label">{{ f.label }}</text></view>
          </view>
          <view class="fac-row fac-row--checks">
            <view v-for="c in checks" :key="c.label" class="k-row k-gap8 fac-check" @click="c.on = !c.on">
              <view class="k-circle ck" :class="{ on: c.on }"><k-icon v-if="c.on" name="check" :size="12" color="white" :stroke="3" /></view>
              <text class="fac-check__label">{{ c.label }}</text>
            </view>
          </view>
        </view>
        <view class="fcard">
          <text class="fcard__title">房源来源</text>
          <view class="opts opts--3">
            <view v-for="o in srcOpts" :key="o" class="opt" :class="{ on: source === o }" @click="source = o"><text>{{ o }}</text></view>
          </view>
        </view>
        <view class="fcard">
          <text class="fcard__title">评分与距离</text>
          <view class="k-row k-gap10 k-mt12">
            <text class="fcard__sub">评分</text>
            <view class="opts opts--4 k-flex1 no-mt">
              <view v-for="o in scoreOpts" :key="o" class="opt" :class="{ on: score === o }" @click="score = o"><text>{{ o }}</text></view>
            </view>
          </view>
          <view class="k-row k-gap10 k-mt10">
            <text class="fcard__sub">距离景点</text>
            <view class="opts opts--4 k-flex1 no-mt">
              <view v-for="o in distOpts" :key="o" class="opt" :class="{ on: dist === o }" @click="dist = o"><text>{{ o }}</text></view>
            </view>
          </view>
        </view>
      </view>
      <k-bottom flat><k-button block @click="s = 2">查看 26 家</k-button></k-bottom>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useScreen, go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const kw = ref('')
const recent = ['喜洲古镇', '洱海边', '可做饭', '带厨房']
const areas = [
  { name: '大理古城', count: 326, img: '/static/media/stays-area-dali.jpg' },
  { name: '喜洲古镇', count: 186, img: '/static/media/stays-area-xizhou.jpg' },
  { name: '洱海边', count: 254, img: '/static/media/stays-area-erhai.jpg' },
  { name: '双廊', count: 98, img: '/static/media/stays-area-shuanglang.jpg' }
]
const filterBar = ['位置', '价格', '房型', '排序']
const srcTabs = [{ key: 'all', label: '全部(326)' }, { key: 'direct', label: '直营(186)' }, { key: 'agent', label: '代运营(140)' }]
const src = ref('all')
const homes = [
  { name: '大理喜洲小院', src: '直营', img: '/static/media/stays-list-1.jpg', tags: ['可做饭', '带院子', '步行古镇'], where: '喜洲古镇 · 步行3分钟到稻田', score: '4.8', reviews: 326, price: 128, dates: '9.5–9.12' },
  { name: '洱海边设计师驻店', src: '代运营', img: '/static/media/stays-list-2.jpg', tags: ['海景房', '可长住', '带厨房'], where: '双廊镇 · 海景落地窗', score: '4.7', reviews: 198, price: 198, dates: '9.5–9.12' },
  { name: '白族小院咖啡师兼职', src: '直营', img: '/static/media/stays-list-3.jpg', tags: ['可做饭', '老宅改造', '有阳台'], where: '才村码头 · 步行5分钟到洱海', score: '4.6', reviews: 156, price: 120, dates: '9.6–9.13' }
]
const birds = [
  { name: '院落多人间', src: '直营', img: '/static/media/stays-bird-1.jpg', where: '喜洲古镇 · 公共卫浴 · 可做饭', old: 128, price: 98, left: 2, range: '9月5日–9月20日' },
  { name: '洱海景观大床房', src: '代运营', img: '/static/media/stays-bird-2.jpg', where: '双廊镇 · 海景落地窗', old: 258, price: 188, left: 3, range: '9月6日–9月25日' },
  { name: '白族庭院大床房', src: '直营', img: '/static/media/stays-bird-3.jpg', where: '才村码头 · 院子景观', old: 158, price: 118, left: 1, range: '9月5日–9月18日' }
]
const priceOpts = ['不限', '¥0–150', '¥150–300', '¥300–500', '¥500以上']
const roomOpts = ['不限', '整院', '独立房间', '多人间']
const srcOpts = ['不限', '直营', '代运营']
const scoreOpts = ['不限', '4.5分以上', '4.0分以上', '3.5分以上']
const distOpts = ['不限', '1km内', '3km内', '5km内']
const facilities = [
  { icon: 'bath', label: '独立卫浴' }, { icon: 'wind', label: '空调' }, { icon: 'droplet', label: '热水' }, { icon: 'wifi', label: 'Wi-Fi' }, { icon: 'square-plus', label: '阳台' }
]
const checks = reactive([{ label: '可做饭', on: true }, { label: '长住优惠', on: true }, { label: '带厨房', on: false }])
const price = ref('¥0–150')
const room = ref('独立房间')
const source = ref('直营')
const score = ref('不限')
const dist = ref('不限')
const reset = () => { price.value = '不限'; room.value = '不限'; source.value = '不限'; score.value = '不限'; dist.value = '不限'; checks.forEach(c => { c.on = false }) }
const openDetail = () => go(R.stayDetail)
</script>

<style scoped lang="scss">
.brand { display: flex; align-items: center; gap: 14px; padding-left: 8px; }
.brand__name { font-family: var(--k-serif); font-weight: 700; font-size: 22px; letter-spacing: 1px; }
.brand__city { display: flex; align-items: center; gap: 3px; }
.brand__city-text { font-size: 15px; }

.sbox { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; padding: 0 14px; }
.sbox__sec { padding: 14px 0 12px; border-bottom: 1px solid var(--k-line); }
.sbox__sec.no-line { border-bottom: 0; padding-bottom: 14px; }
.sbox__label { display: block; font-size: 13px; color: var(--k-muted); margin-bottom: 6px; }
.sbox__dates { display: flex; align-items: center; }
.sbox__big { font-size: 20px; font-weight: 600; line-height: 1.3; }
.sbox__wk { font-size: 13px; color: var(--k-muted); margin-left: 8px; }
.sbox__arrow { margin: 0 20px; }
.sbox__nights { margin-left: auto; font-size: 13px; color: var(--k-muted); }
.sbox__kw { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.sbox__hint { font-size: 13px; color: var(--k-muted); }
.sbox__input { min-height: 40px; background: var(--k-paper2); border-color: var(--k-line); }
.sbox__input input { height: 38px; }
.sbox__btn { width: 60px; height: 40px; border-radius: 8px; background: var(--k-paper2); border: 1px solid var(--k-line); display: flex; align-items: center; justify-content: center; font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.recent { margin: 18px 0 12px; }
.areas { margin: 20px 0 12px; }
.tag { height: 30px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; font-size: 13px; }
.area-grid { gap: 12px; }
.area { position: relative; height: 96px; border-radius: 10px; overflow: hidden; background: #DDD5C8; }
.area__img { width: 100%; height: 100%; }
.area__shade { position: absolute; left: 0; right: 0; bottom: 0; height: 60px; background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.55)); }
.area__copy { position: absolute; left: 10px; bottom: 8px; display: flex; flex-direction: column; gap: 2px; }
.area__name { color: #fff; font-size: 15px; font-weight: 600; line-height: 1.2; }
.area__count { color: rgba(255,255,255,.9); font-size: 12px; line-height: 1.2; }
.find { margin-top: 16px; }

.filters { display: flex; align-items: center; padding: 6px 12px 12px; border-bottom: 1px solid var(--k-line); }
.filters__item { flex: 1; display: flex; align-items: center; justify-content: center; gap: 3px; font-size: 15px; }
.src-tabs { margin: 2px 0 12px; }
.pill { height: 30px; padding: 0 22px; border-radius: 999px; background: var(--k-paper2); border: 1px solid transparent; display: flex; align-items: center; font-size: 13px; color: var(--k-muted); }
.pill.on { background: var(--k-paper); border-color: var(--k-red); color: var(--k-red); }
.home { display: flex; gap: 14px; padding: 12px; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; margin-bottom: 12px; }
.home__pic { position: relative; width: 118px; height: 145px; border-radius: 8px; overflow: hidden; flex: 0 0 auto; background: #DDD5C8; }
.home__img { width: 100%; height: 100%; }
.badges { position: absolute; left: 6px; top: 6px; display: flex; gap: 4px; }
.badge { height: 20px; padding: 0 7px; border-radius: 5px; display: flex; align-items: center; font-size: 11px; line-height: 1; }
.badge--src { background: rgba(253,251,247,.95); color: var(--k-red); font-weight: 600; }
.badge--safe { background: rgba(231,239,231,.96); color: var(--k-green); }
.home__body { display: flex; flex-direction: column; }
.home__name { font-family: var(--k-serif); font-weight: 700; font-size: 18px; line-height: 1.3; }
.chip { height: 20px; padding: 0 7px; border-radius: 5px; background: var(--k-paper2); font-size: 11px; color: var(--k-muted); display: flex; align-items: center; }
.home__meta { display: block; font-size: 13px; color: var(--k-muted); line-height: 1.4; }
.yen { color: var(--k-red); font-size: 13px; font-weight: 600; margin-right: 1px; }
.price { color: var(--k-red); font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 24px; line-height: 1; }
.home__unit { font-size: 13px; color: var(--k-muted); margin-left: 3px; }
.avail { font-size: 13px; }

.bird-head { padding: 2px 4px 12px; }
.bird-head__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.tbox { min-width: 22px; height: 22px; padding: 0 3px; border-radius: 4px; background: var(--k-ink); color: #fff; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.tsep { font-size: 13px; color: var(--k-ink); }
.bird { display: flex; gap: 14px; padding: 12px; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; margin-bottom: 12px; }
.bird__pic { position: relative; width: 104px; height: 164px; border-radius: 8px; overflow: hidden; flex: 0 0 auto; background: #DDD5C8; }
.bird__img { width: 100%; height: 100%; }
.bird__price { display: flex; align-items: baseline; justify-content: flex-end; }
.strike { font-size: 13px; color: var(--k-light); text-decoration: line-through; margin-right: 8px; }
.bird__left { display: block; text-align: right; font-size: 13px; color: var(--k-red); }
.bird__line { height: 1px; background: var(--k-line); margin: 10px 0; }
.mark { width: 16px; height: 16px; }

.reset { color: var(--k-red); font-size: 15px; padding-right: 8px; }
.filter { padding-top: 8px; }
.fcard { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; padding: 12px 12px 14px; margin-bottom: 10px; }
.fcard__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.fcard__sub { font-family: var(--k-serif); font-weight: 700; font-size: 15px; width: 58px; flex: 0 0 auto; }
.map { width: 100%; height: 100px; border-radius: 8px; margin-top: 10px; }
.opts { display: grid; gap: 8px; margin-top: 12px; }
.opts.no-mt { margin-top: 0; }
.opts--5 { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.opts--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.opts--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.opt { height: 30px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 13px; white-space: nowrap; }
.opt.on { border-color: var(--k-red); color: var(--k-red); background: #FBF4F0; font-weight: 600; }
.fac-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding: 0 10px; height: 36px; border: 1px solid var(--k-line); border-radius: 8px; }
.fac-row__label { font-size: 13px; color: var(--k-muted); }
.fac-row--checks { justify-content: flex-start; gap: 34px; }
.fac-check__label { font-size: 14px; }
.ck { width: 18px; height: 18px; border: 1.5px solid var(--k-line2); background: var(--k-paper); }
.ck.on { border-color: var(--k-green); background: var(--k-green); }
</style>
