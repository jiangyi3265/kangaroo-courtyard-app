<template>
  <view class="k-page resume">
    <k-topbar :title="titles[s - 1]" back @back="onBack">
      <view v-if="s === 4" class="tabs">
        <view v-for="(t, i) in expTabs" :key="t" class="tabs__item" :class="{ active: tab === i }" @click="tab = i"><text>{{ t }}</text></view>
      </view>
    </k-topbar>

    <!-- 1 简历概览 -->
    <view v-if="s === 1" class="k-body k-pad-tab">
      <view class="banner">
        <k-icon name="shield-check" :size="26" color="#9A6A22" :stroke="1.6" />
        <text class="banner__text k-pre">简历仅在报名时脱敏展示，\n保护你的隐私</text>
        <image class="banner__img" src="/static/media/resume-banner-deco.jpg" mode="aspectFit" />
      </view>

      <view class="card k-mt12" @click="s = 2">
        <text class="k-title">完整度</text>
        <view class="k-row k-gap12 k-mt6">
          <text class="pct">85%</text>
          <view class="k-bar k-flex1"><view class="k-bar__fill" style="width: 85%" /></view>
        </view>
        <view class="k-between k-mt6"><text class="k-small k-muted">完善信息，提升被选中机会</text><k-icon name="chevron-right" :size="16" color="#9A6A22" /></view>
      </view>

      <view class="sec">
        <view class="k-between"><text class="k-title">基本信息</text><view class="k-row k-gap2" @click="s = 2"><text class="k-small k-muted">编辑</text><k-icon name="chevron-right" :size="14" color="muted" /></view></view>
        <view v-for="b in basics" :key="b.label" class="kv"><text class="kv__label">{{ b.label }}</text><text class="kv__value">{{ b.value }}</text></view>
      </view>

      <view class="sec">
        <view class="k-between"><text class="k-title">技能描述</text><view class="k-row k-gap2" @click="s = 3"><text class="k-small k-muted">编辑</text><k-icon name="chevron-right" :size="14" color="muted" /></view></view>
        <text class="k-text skill k-mt6">做过星巴克半年，会拉花和手冲；擅长与人沟通，喜欢手作和空间整理。</text>
      </view>

      <view class="k-grid-3 k-mt14">
        <view v-for="e in expStats" :key="e.title" class="card stat" @click="s = 4">
          <view class="stat__icon" :style="{ background: e.bg }"><k-icon :name="e.icon" :size="20" :color="e.color" :stroke="1.6" fill /></view>
          <text class="stat__title">{{ e.title }}</text>
          <view class="k-row k-gap4"><text class="stat__num">{{ e.num }}</text><text class="k-small">段</text></view>
          <text class="k-small k-muted">{{ e.sub }}</text>
        </view>
      </view>

      <k-button block class="k-mt16" @click="s = 2">编辑简历</k-button>
    </view>

    <!-- 2 基本信息编辑 -->
    <view v-else-if="s === 2" class="k-body k-pad-tab">
      <view class="k-row k-gap8 saving">
        <view class="k-circle k-circle--green saving__ok"><k-icon name="check" :size="13" color="white" :stroke="3" /></view>
        <text class="k-text">自动保存中...</text>
      </view>
      <view class="reuse">
        <text class="k-text k-flex1">从上次简历一键复用</text>
        <view class="reuse__btn" @click="toast('已复用上次简历')"><text>一键复用</text></view>
      </view>
      <text class="k-title k-mt16 b">基本信息</text>

      <view class="form k-mt10">
        <view class="form__row">
          <view class="form__label"><text>昵称</text><text class="req">*</text></view>
          <view class="k-input form__input"><input v-model="form.name" placeholder="请输入昵称" placeholder-class="k-placeholder" /></view>
        </view>
        <view class="form__row">
          <view class="form__label"><text>性别</text><text class="req">*</text></view>
          <view class="k-row k-gap10">
            <view v-for="g in ['女', '男', '其他']" :key="g" class="gender" :class="{ on: form.gender === g }" @click="form.gender = g"><text>{{ g }}</text></view>
          </view>
        </view>
        <view class="form__row">
          <view class="form__label"><text>年龄</text><text class="req">*</text></view>
          <view class="k-input form__input"><input v-model="form.age" type="number" placeholder-class="k-placeholder" /></view>
        </view>
        <view class="form__row">
          <view class="form__label"><text>联系电话</text><text class="req">*</text></view>
          <view class="k-input form__input"><input v-model="form.phone" type="number" placeholder-class="k-placeholder" /></view>
        </view>
        <view class="form__row">
          <view class="form__label"><text>所在城市</text><text class="req">*</text></view>
          <view class="k-input form__input" @click="toast('选择城市')"><text class="k-flex1">{{ form.city }}</text><k-icon name="chevron-right" :size="16" color="ink" /></view>
        </view>
      </view>

      <view class="k-between k-mt14"><view class="form__label"><text>自我介绍</text><text class="req">*</text></view><text class="k-small k-muted">{{ form.intro.length }}/200</text></view>
      <view class="area k-mt8"><textarea v-model="form.intro" :maxlength="200" placeholder="介绍一下自己" placeholder-class="k-placeholder" /></view>

      <k-button block class="k-mt16" @click="save">保存</k-button>
    </view>

    <!-- 3 自由技能编辑 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab">
      <view class="tip">
        <view class="tip__icon"><text>i</text></view>
        <text class="tip__text">没有预设标签，尽情描述你的技能与特长，AI 将在后台为你智能聚类，便于匹配。</text>
      </view>

      <view class="k-between k-mt16"><view class="form__label form__label--lg"><text>技能描述</text><text class="req">*</text></view><text class="k-text k-muted">{{ skill.length }}/1000</text></view>
      <view class="area area--tall k-mt8"><textarea v-model="skill" :maxlength="1000" placeholder-class="k-placeholder" /></view>

      <view class="k-between k-mt16"><view class="form__label form__label--lg"><text>补充说明</text><text class="k-muted form__hint">（可选，多段描述）</text></view><text class="k-text k-muted">{{ extra.length }}/1000</text></view>
      <view class="area area--mid k-mt8"><textarea v-model="extra" :maxlength="1000" placeholder-class="k-placeholder" /></view>

      <view class="k-between k-mt16"><view class="form__label form__label--lg"><text>作品/作品链接</text><text class="k-muted form__hint">（可选）</text></view><text class="k-text k-muted">{{ links.length }}/10</text></view>
      <view v-for="(l, i) in links" :key="i" class="k-input link k-mt8">
        <k-icon name="link" :size="18" color="ink" :stroke="1.7" />
        <text class="link__url k-ellipsis">{{ l }}</text>
        <view @click="links.splice(i, 1)"><k-icon name="circle-x" :size="18" color="muted" :stroke="1.6" /></view>
      </view>
      <view class="addlink k-mt8" @click="addLink"><k-icon name="plus" :size="16" color="ink" :stroke="2" /><text>添加链接</text></view>

      <k-button block class="k-mt16" @click="save">保存</k-button>
    </view>

    <!-- 4 经历列表 -->
    <view v-else class="k-body k-pad-tab">
      <view v-for="(e, i) in volunteer" :key="e.title" class="card exp" :class="{ 'k-mt12': i > 0 }" @click="toast(e.title)">
        <image class="exp__img" :src="e.img" mode="aspectFill" />
        <view class="k-flex1 k-col">
          <text class="exp__title">{{ e.title }}</text>
          <text class="k-small k-muted k-mt2">{{ e.place }}</text>
          <view class="k-row k-gap16 k-mt6"><text class="k-text k-muted">{{ e.range }}</text><text class="k-text k-muted">{{ e.total }}</text></view>
          <view class="k-row k-gap6 k-mt4">
            <text class="k-small">评价：</text>
            <view class="stars"><view v-for="n in 5" :key="n" class="star">
              <k-icon name="star" :size="14" color="#C99043" :stroke="1.6" :fill="n <= Math.floor(e.stars)" />
              <view v-if="n === Math.ceil(e.stars) && e.stars % 1" class="star__half"><k-icon name="star-half" :size="14" color="#C99043" :stroke="1.6" fill /></view>
            </view></view>
            <text class="k-small">{{ e.comment }}</text>
          </view>
        </view>
        <k-icon name="chevron-right" :size="18" color="#9A6A22" />
      </view>

      <text class="k-title k-mt16 b">兼职经历</text>
      <view class="card exp k-mt8" @click="toast('店员（周末）')">
        <image class="exp__img exp__img--short" src="/static/media/resume-exp-shop.jpg" mode="aspectFill" />
        <view class="k-flex1 k-col">
          <text class="exp__title">店员（周末）</text>
          <text class="k-small k-muted k-mt2">喜洲手作小店 · 大理喜洲</text>
          <view class="k-row k-gap16 k-mt6"><text class="k-text k-muted">2024.01 – 2024.06</text><text class="k-text k-muted">共 6 个月</text></view>
        </view>
        <k-icon name="chevron-right" :size="18" color="#9A6A22" />
      </view>

      <text class="k-title k-mt16 b">全职/培训经历</text>
      <view class="card exp k-mt8" @click="go(R.opportunities + '?s=4')">
        <image class="exp__img" src="/static/media/resume-exp-latte.jpg" mode="aspectFill" />
        <view class="k-flex1 k-col">
          <text class="exp__title">咖啡师培训（SCA 基础）</text>
          <text class="k-small k-muted k-mt2">大理咖啡学院</text>
          <text class="k-text k-muted k-mt6">2024.03 – 2024.05</text>
          <view class="k-row k-gap16 k-mt4"><text class="k-small">考核等级：A</text><text class="k-small">通过：是</text></view>
        </view>
        <k-icon name="chevron-right" :size="18" color="#9A6A22" />
      </view>

      <k-button block icon="plus" class="k-mt16" @click="toast('新增经历')">新增经历</k-button>
    </view>

    <k-tabbar active="profile" />
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const titles = ['我的简历', '基本信息编辑', '自由技能编辑', '经历列表']
const onBack = () => { if (s.value > 1) s.value = 1; else back() }
const tab = ref(0)
const expTabs = ['义工经历', '兼职经历', '全职/培训经历']

const basics = [
  { label: '昵称', value: '小袋鼠' },
  { label: '性别', value: '女' },
  { label: '年龄', value: '24' },
  { label: '所在城市', value: '大理' },
  { label: '自我介绍', value: '热爱手作与咖啡，希望在温暖的环境中学习与成长。' }
]
const expStats = [
  { icon: 'heart', title: '义工经历', num: 2, sub: '累计 48 天', color: '#D9A08A', bg: '#F5E6E1' },
  { icon: 'briefcase', title: '兼职经历', num: 1, sub: '累计 6 个月', color: '#B8823C', bg: '#F4E8D2' },
  { icon: 'graduation-cap', title: '全职/培训经历', num: 1, sub: '已通过考核', color: '#40576B', bg: '#E7EDF1' }
]

const form = reactive({ name: '小袋鼠', gender: '女', age: '24', phone: '138 1234 5678', city: '大理', intro: '热爱手作与咖啡，希望在温暖的环境中学习与成长。' })
const skill = ref('做过星巴克半年，会拉花和手冲，熟悉咖啡豆产地与口味搭配；擅长与顾客沟通，能独立完成出品与收银；喜欢手作和空间整理。')
const extra = ref('曾在周末市集摆摊，负责手作饰品销售与陈列；有活动协助经验，擅长现场沟通与协调；性格耐心细致，喜欢学习新事物。')
const links = ref(['https://mp.weixin.qq.com/s/AbcDeFgHiJk'])
const addLink = () => { if (links.value.length >= 10) return toast('最多添加 10 个链接'); links.value.push('https://') }
const save = () => { toast('已保存'); s.value = 1 }

const volunteer = [
  { img: '/static/media/resume-exp-cafe.jpg', title: '古城咖啡师兼职', place: '大理古城 · 古城咖啡小院', range: '2024.05 – 2024.06', total: '共 15 天', stars: 4.5, comment: '非常感谢，认真负责' },
  { img: '/static/media/resume-exp-photo.jpg', title: '洱海旅拍协助', place: '洱海生态廊道', range: '2023.10 – 2023.11', total: '共 33 天', stars: 4, comment: '配合度高，学习快' }
]
</script>

<style scoped lang="scss">
.b { display: block; }
.k-mt2 { margin-top: 2px; }
.k-mt6 { margin-top: 6px; }
.k-mt10 { margin-top: 10px; }
.k-mt14 { margin-top: 14px; }
.card { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; padding: 14px; }
.req { color: var(--k-red); margin-left: 3px; }

/* s1 */
.banner { display: flex; align-items: center; gap: 12px; padding: 12px 8px 12px 14px; background: #F4EEE4; border: 1px solid var(--k-line); border-radius: 14px; }
.banner__text { flex: 1; font-size: 15px; line-height: 1.7; color: var(--k-ink); }
.banner__img { width: 126px; height: 66px; flex: 0 0 auto; }
.pct { color: var(--k-green); font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 26px; line-height: 1; }
.sec { padding: 14px 0 12px; border-bottom: 1px solid var(--k-line); }
.kv { display: flex; align-items: flex-start; margin-top: 8px; font-size: 14px; }
.kv__label { width: 88px; flex: 0 0 auto; color: var(--k-muted); }
.kv__value { flex: 1; min-width: 0; line-height: 1.55; }
.skill { display: block; line-height: 1.75; }
.stat { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 6px 12px; text-align: center; }
.stat__icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
.stat__title { font-size: 13px; color: var(--k-ink); white-space: nowrap; }
.stat__num { font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 24px; line-height: 1.1; }

/* s2 */
.saving { padding: 4px 0 12px; }
.saving__ok { width: 24px; height: 24px; }
.reuse { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; background: #F4EEE4; border: 1px solid #E3CFA6; border-radius: 12px; }
.reuse__btn { height: 32px; padding: 0 12px; border: 1px solid #C99043; border-radius: 8px; background: var(--k-paper); color: #9A6A22; font-size: 14px; display: flex; align-items: center; }
.form { display: flex; flex-direction: column; gap: 16px; }
.form__row { display: flex; align-items: center; gap: 12px; }
.form__label { width: 80px; flex: 0 0 auto; font-size: 15px; color: var(--k-ink); display: flex; align-items: center; }
.form__label--lg { width: auto; font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.form__hint { font-family: var(--k-sans); font-weight: 400; font-size: 14px; }
.form__input { flex: 1; min-height: 42px; }
.form__input input { height: 40px; }
.gender { min-width: 52px; height: 40px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 15px; }
.gender.on { background: var(--k-red); border-color: var(--k-red); color: #FFF8F0; }
.area { border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); padding: 12px; }
.area textarea { width: 100%; height: 104px; font-size: 15px; line-height: 1.7; }
.area--tall textarea { height: 122px; }
.area--mid textarea { height: 108px; }

/* s3 */
.tip { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; background: var(--k-indigo-soft); border: 1px solid #C4D0D8; border-radius: 12px; }
.tip__icon { width: 22px; height: 22px; border-radius: 50%; background: var(--k-indigo); color: #fff; font-family: Georgia, serif; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; margin-top: 1px; }
.tip__text { flex: 1; font-size: 14px; line-height: 1.7; color: var(--k-indigo); }
.link { min-height: 42px; gap: 8px; }
.link__url { flex: 1; min-width: 0; font-size: 14px; }
.addlink { height: 42px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 15px; }

/* s4 */
.tabs { display: flex; align-items: center; padding: 0 8px; margin-top: 2px; }
.tabs__item { flex: 1; text-align: center; padding: 10px 0 12px; font-size: 15px; color: var(--k-ink); position: relative; }
.tabs__item.active { font-family: var(--k-serif); font-weight: 700; }
.tabs__item.active::after { content: ""; position: absolute; left: 50%; bottom: 0; width: 72px; height: 3px; margin-left: -36px; background: var(--k-red); border-radius: 2px; }
.exp { display: flex; align-items: center; gap: 12px; padding: 12px 8px 12px 12px; }
.exp__img { width: 88px; height: 104px; border-radius: 8px; flex: 0 0 auto; }
.exp__img--short { height: 88px; }
.exp__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; line-height: 1.35; }
.stars { display: flex; gap: 1px; }
.star { position: relative; width: 14px; height: 14px; }
.star__half { position: absolute; left: 0; top: 0; }
</style>
