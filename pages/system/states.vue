<template>
  <view class="k-page states">
    <k-topbar :title="titles[s - 1]" back @back="onBack" />

    <!-- 1 页面与列表状态 -->
    <view v-if="s === 1" class="body">
      <text class="h">骨架加载</text>
      <view class="card">
        <view class="sk">
          <view class="sk__sq" />
          <view class="sk__lines"><view class="sk__line" style="width: 92%" /><view class="sk__line" style="width: 80%" /><view class="sk__line" style="width: 70%" /></view>
          <view class="sk__img"><k-icon name="image" :size="34" color="#C9C2B8" :stroke="1.3" /></view>
        </view>
      </view>

      <view class="k-between h-row">
        <text class="h h--inline">下拉刷新</text>
        <view class="k-row k-gap6 refresh"><k-icon name="arrow-down" :size="16" color="muted" :stroke="1.8" /><text class="k-small k-muted">松开刷新</text></view>
        <view class="h-spacer" />
      </view>
      <view class="card">
        <view class="sk sk--small">
          <view class="sk__sq" />
          <view class="sk__lines"><view class="sk__line" style="width: 92%" /><view class="sk__line" style="width: 60%" /></view>
          <view class="sk__img sk__img--short" />
        </view>
      </view>

      <text class="h">无限加载</text>
      <view class="card">
        <view class="sk sk--small">
          <view class="sk__sq" />
          <view class="sk__lines"><view class="sk__line" style="width: 92%" /><view class="sk__line" style="width: 60%" /></view>
          <view class="sk__img sk__img--short" />
        </view>
        <view class="loading"><k-icon name="loader-circle" :size="16" color="light" :stroke="1.6" /><text class="k-small k-muted">正在加载更多…</text></view>
      </view>

      <text class="h">搜索无结果</text>
      <view class="card">
        <view class="k-row k-gap12">
          <view class="sbar"><k-icon name="search" :size="16" color="muted" :stroke="1.8" /><text class="sbar__kw">陶艺体验</text><k-icon name="circle-x" :size="15" color="muted" :stroke="1.6" /></view>
          <text class="k-text" @click="toast('取消搜索')">取消</text>
        </view>
        <view class="empty">
          <image class="empty__img" src="/static/media/states-search-empty.jpg" mode="aspectFit" />
          <view class="empty__copy">
            <text class="empty__title">未找到相关内容</text>
            <text class="empty__desc">换个关键词试试吧</text>
            <view class="btn-o btn-o--sm" @click="toast('已清除搜索')"><text>清除搜索</text></view>
          </view>
        </view>
      </view>

      <text class="h">内容空状态</text>
      <view class="card">
        <view class="empty empty--tall">
          <image class="empty__img empty__img--box" src="/static/media/states-empty-box.jpg" mode="aspectFit" />
          <view class="empty__copy">
            <text class="empty__title">还没有相关内容</text>
            <text class="empty__desc">去发布一条新内容吧</text>
            <view class="btn-p btn-p--sm" @click="go(R.publish)"><text>去发布</text></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 2 表单与权限状态 -->
    <view v-else-if="s === 2" class="body form-body">
      <view class="card">
        <text class="ct">必填错误</text>
        <view class="frow">
          <view class="frow__label"><text>标题</text><text class="k-red">*</text></view>
          <view class="k-flex1">
            <view class="k-input k-input--error"><input v-model="title" placeholder="请输入活动标题" placeholder-class="k-placeholder" /></view>
            <text class="ferr">请输入活动标题</text>
          </view>
        </view>
      </view>
      <view class="card">
        <text class="ct">格式错误</text>
        <view class="frow">
          <view class="frow__label"><text>手机号</text><text class="k-red">*</text></view>
          <view class="k-flex1">
            <view class="k-input k-input--error"><input v-model="phone" placeholder-class="k-placeholder" /></view>
            <text class="ferr">请输入正确的手机号</text>
          </view>
        </view>
      </view>
      <view class="card">
        <text class="ct">禁用按钮</text>
        <view class="k-row k-gap16 k-mt8">
          <view class="btn-disabled"><text>提交（请先完善信息）</text></view>
          <text class="k-small k-muted">填写中...</text>
        </view>
      </view>
      <view v-for="p in perms" :key="p.title" class="card">
        <text class="ct">{{ p.label }}</text>
        <view class="st">
          <view class="st__icon"><k-icon :name="p.icon" :size="40" color="ink" :stroke="1.3" /></view>
          <view class="k-flex1">
            <text class="st__title">{{ p.title }}</text>
            <text class="st__desc">{{ p.desc }}</text>
          </view>
        </view>
        <view class="st__actions">
          <view v-if="p.primary" class="btn-p" @click="go(R.login + '?s=4')"><text>{{ p.btn }}</text></view>
          <view v-else class="btn-o" @click="toast('前往系统设置')"><text>{{ p.btn }}</text></view>
        </view>
      </view>
    </view>

    <!-- 3 交易与流程状态 -->
    <view v-else-if="s === 3" class="body trade-body">
      <view v-for="t in trades" :key="t.title" class="card card--tight">
        <text class="ct">{{ t.label }}</text>
        <view class="st st--center">
          <view class="st__icon st__icon--lg">
            <view v-if="t.kind === 'ok'" class="ok"><k-icon name="check" :size="30" color="white" :stroke="2.4" /></view>
            <view v-else-if="t.kind === 'dashed'" class="dashed"><k-icon name="clock" :size="28" color="ink" :stroke="1.5" /></view>
            <k-icon v-else :name="t.icon" :size="52" :color="t.color" :stroke="1.3" />
          </view>
          <view class="k-flex1">
            <text class="st__title">{{ t.title }}</text>
            <text class="st__desc">{{ t.desc }}</text>
          </view>
          <view v-if="t.side" class="st__side">
            <view v-if="t.side.type === 'primary'" class="btn-p" @click="onTrade(t.side.label)"><text>{{ t.side.label }}</text></view>
            <view v-else class="btn-o" @click="onTrade(t.side.label)"><text>{{ t.side.label }}</text></view>
          </view>
        </view>
        <view v-if="t.row" class="st__row">
          <view v-for="b in t.row" :key="b" class="btn-o btn-o--wide" @click="onTrade(b)"><text>{{ b }}</text></view>
        </view>
      </view>
    </view>

    <!-- 4 系统与长内容适配 -->
    <view v-else class="body system-body">
      <view v-for="sys in systems" :key="sys.title" class="card card--tight">
        <text class="ct">{{ sys.label }}</text>
        <view class="st">
          <view class="st__icon"><k-icon :name="sys.icon" :size="46" color="ink" :stroke="1.3" /></view>
          <view class="k-flex1">
            <text class="st__title">{{ sys.title }}</text>
            <text class="st__desc">{{ sys.desc }}</text>
          </view>
        </view>
        <view class="st__row" :class="{ 'st__row--single': sys.btns.length === 1 }">
          <view v-for="b in sys.btns" :key="b" class="btn-o btn-o--wide" @click="onSys(b)"><text>{{ b }}</text></view>
        </view>
      </view>

      <view class="card card--tight">
        <text class="ct">长中文标题换行示例</text>
        <view class="demo">
          <image class="demo__img" src="/static/media/states-room.jpg" mode="aspectFill" />
          <view class="k-flex1">
            <text class="demo__title">西湖边 · 温馨一居室带阳台采光极佳可做饭近地铁站步行可达</text>
            <view class="k-row k-gap6 k-mt6">
              <view v-for="c in ['整租', '1室1厅', '25m²']" :key="c" class="tag"><text>{{ c }}</text></view>
              <view class="k-row k-gap2 demo__price"><text class="k-price">2800</text><text class="k-meta">元/月</text></view>
            </view>
          </view>
        </view>
      </view>

      <view class="card card--tight">
        <text class="ct">大字号模式示例（系统大号）</text>
        <view class="demo demo--big">
          <image class="demo__img demo__img--big" src="/static/media/states-teacher.jpg" mode="aspectFill" />
          <view class="k-flex1">
            <text class="demo__title demo__title--big">手作老师（兼职）</text>
            <view class="tag tag--big k-mt6"><text>手作教学</text></view>
          </view>
          <view class="demo__side">
            <view class="k-row k-gap2"><text class="k-price demo__price--big">150</text><text class="k-small k-muted">元/天</text></view>
            <view class="k-row k-gap2 k-mt6"><k-icon name="map-pin" :size="14" color="muted" :stroke="1.7" /><text class="k-small k-muted">1.2km</text></view>
          </view>
        </view>
      </view>

      <view class="card card--se">
        <text class="ct">小屏安全区适配<text class="k-meta">（iPhone SE 适配）</text></text>
        <view class="se-bar">
          <view v-for="t in seTabs" :key="t.label" class="se-bar__item" :class="{ active: t.active }">
            <view v-if="t.publish" class="se-bar__publish"><k-icon name="plus" :size="22" color="white" :stroke="2.2" /></view>
            <k-icon v-else :name="t.icon" :size="24" :color="t.active ? 'red' : 'ink'" :stroke="1.6" :fill="t.active" />
            <text class="se-bar__label">{{ t.label }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const titles = ['1 页面与列表状态', '2 表单与权限状态', '3 交易与流程状态', '4 系统与长内容适配']
const onBack = () => back()

const title = ref('')
const phone = ref('138 1234 5678')
const perms = [
  { label: '定位拒绝', icon: 'map-pin', title: '定位被拒绝', desc: '请在系统设置中开启位置权限，\n以便为你推荐附近的活动与房源。', btn: '去开启' },
  { label: '相机拒绝', icon: 'camera', title: '相机权限被拒绝', desc: '请在系统设置中开启相机权限，\n以便拍摄与上传照片。', btn: '去开启' },
  { label: '手机号未绑定', icon: 'smartphone', title: '未绑定手机号', desc: '绑定后可接收重要通知与订单信息。', btn: '去绑定', primary: true }
]
const trades = [
  { label: '报名成功', kind: 'ok', title: '报名成功', desc: '我们已收到你的报名信息，\n工作人员将尽快与您联系。', side: { label: '查看订单', type: 'outline' } },
  { label: '名额已满', icon: 'users', color: 'ink', title: '名额已满', desc: '很抱歉，该活动名额已满。\n可关注下次开团或加入候补名单。', row: ['加入候补', '查看更多'] },
  { label: '支付处理中', kind: 'dashed', title: '支付处理中', desc: '订单正在处理中，请勿关闭页面，\n请耐心等待…' },
  { label: '支付超时', icon: 'triangle-alert', color: 'red', title: '支付已超时', desc: '订单未在限定时间内完成支付，\n请重新提交订单。', side: { label: '重新支付', type: 'primary' } },
  { label: '订单同步失败（未重复扣款）', icon: 'cloud-off', color: 'ink', title: '订单同步失败', desc: '资金未被重复扣款，请检查网络或\n稍后重试。', row: ['查看订单', '重新同步'] },
  { label: '退款成功', kind: 'ok', title: '退款成功', desc: '¥620.00 已原路退回，\n预计 1-3 个工作日到账。', side: { label: '查看退款', type: 'outline' } }
]
const onTrade = (label) => {
  if (label === '查看订单' || label === '查看退款') return go(R.orders)
  if (label === '重新支付') return go(R.stayPay)
  if (label === '查看更多') return go(R.activity)
  toast(label)
}
const systems = [
  { label: '网络断开', icon: 'wifi-off', title: '网络连接已断开', desc: '请检查网络设置后重试。', btns: ['重试', '联系客服'] },
  { label: 'AI 不可用', icon: 'bot', title: 'AI 暂不可用', desc: 'AI 服务升级中，敬请期待。', btns: ['重试', '普通筛选'] },
  { label: '服务维护', icon: 'wrench', title: '系统维护中', desc: '服务升级中，预计 08-29 12:00 恢复。', btns: ['查看公告'] }
]
const onSys = (label) => {
  if (label === '联系客服') return go(R.messages + '?s=4')
  if (label === '普通筛选') return go(R.jobsFilter)
  if (label === '查看公告') return go(R.messages)
  toast(label)
}
const seTabs = [
  { label: '首页', icon: 'house', active: true },
  { label: '社区', icon: 'compass' },
  { label: '发布', publish: true },
  { label: '消息', icon: 'message-circle' },
  { label: '我的', icon: 'user-round' }
]
</script>

<style scoped lang="scss">
.body { padding: 6px 12px 24px; }
.h { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 17px; margin: 10px 0 8px; }
.h--inline { margin: 0; }
.h-row { margin: 10px 0 8px; }
.h-spacer { width: 68px; }
.card { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; padding: 12px; margin-bottom: 10px; }
.card--tight { padding: 10px 12px 12px; }
.ct { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; margin-bottom: 8px; }

/* 通用按钮（设计图为赭褐描边） */
.btn-o { height: 34px; padding: 0 20px; border-radius: 8px; border: 1px solid #B39377; background: var(--k-paper); color: var(--k-ink); font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
.btn-o--sm { height: 30px; padding: 0 14px; font-size: 13px; }
.btn-o--wide { flex: 1; height: 38px; }
.btn-p { height: 34px; padding: 0 20px; border-radius: 8px; background: var(--k-red); color: #FFF8F0; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
.btn-p--sm { height: 30px; padding: 0 16px; font-size: 13px; }

/* s1 */
.sk { display: flex; align-items: flex-start; gap: 10px; }
.sk__sq { width: 22px; height: 22px; border-radius: 4px; background: #E8E2D8; flex: 0 0 auto; }
.sk__lines { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
.sk__line { height: 6px; border-radius: 3px; background: #E8E2D8; }
.sk__img { width: 118px; height: 56px; border-radius: 6px; background: #E8E2D8; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.sk--small .sk__lines { gap: 8px; padding-top: 3px; }
.sk__img--short { height: 24px; }
.refresh { margin-right: 20px; }
.loading { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 12px; }
.sbar { flex: 1; min-width: 0; height: 32px; border-radius: 999px; background: var(--k-paper2); display: flex; align-items: center; gap: 8px; padding: 0 12px; }
.sbar__kw { flex: 1; font-size: 14px; }
.empty { display: flex; align-items: center; gap: 12px; padding: 12px 0 2px; }
.empty--tall { padding: 4px 0 6px; }
.empty__img { width: 92px; height: 92px; flex: 0 0 auto; margin-left: 30px; }
.empty__img--box { width: 96px; height: 106px; margin-left: 26px; }
.empty__copy { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.empty__title { font-size: 14px; font-weight: 500; }
.empty__desc { font-size: 12px; color: var(--k-muted); }
.empty__copy .btn-o, .empty__copy .btn-p { margin-top: 6px; }

/* s2 */
.frow { display: flex; align-items: flex-start; gap: 12px; margin-top: 4px; }
.frow__label { width: 54px; flex: 0 0 auto; padding-top: 12px; font-size: 14px; display: flex; gap: 2px; }
.ferr { display: block; font-size: 12px; color: var(--k-red); margin: 6px 0 0 10px; }
.btn-disabled { flex: 0 0 auto; width: 210px; height: 30px; border-radius: 6px; background: #C9C1B6; color: #FFF8F0; font-size: 13px; display: flex; align-items: center; justify-content: center; }
.st { display: flex; align-items: flex-start; gap: 14px; }
.st--center { align-items: center; }
.st__icon { width: 60px; height: 56px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.st__icon--lg { width: 62px; height: 60px; }
.st__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.st__desc { display: block; font-size: 12px; color: var(--k-muted); line-height: 1.7; margin-top: 4px; white-space: pre-line; }
.st__actions { display: flex; justify-content: flex-end; margin-top: 4px; }
.st__side { flex: 0 0 auto; align-self: center; }
.st__row { display: flex; gap: 12px; margin-top: 10px; padding-left: 76px; }
.st__row--single { padding-left: 128px; }
.ok { width: 56px; height: 56px; border-radius: 50%; background: var(--k-green); display: flex; align-items: center; justify-content: center; }
.dashed { width: 56px; height: 56px; border-radius: 50%; border: 1.5px dashed var(--k-ink); display: flex; align-items: center; justify-content: center; }

/* s4 */
.demo { display: flex; align-items: flex-start; gap: 10px; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 10px; padding: 8px; }
.demo--big { align-items: center; }
.demo__img { width: 74px; height: 62px; border-radius: 8px; flex: 0 0 auto; }
.demo__img--big { width: 62px; height: 56px; }
.demo__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; line-height: 1.4; }
.demo__title--big { font-size: 20px; }
.tag { height: 22px; padding: 0 8px; border-radius: 5px; background: var(--k-paper2); border: 1px solid var(--k-line); font-size: 12px; color: var(--k-muted); display: inline-flex; align-items: center; }
.tag--big { height: 26px; font-size: 13px; }
.demo__price { margin-left: auto; align-items: baseline; }
.demo__side { display: flex; flex-direction: column; align-items: flex-end; flex: 0 0 auto; }
.demo__price--big { font-size: 22px; }
.card--se { padding: 10px 0 0; overflow: hidden; }
.card--se .ct { padding: 0 12px; margin-bottom: 8px; }
.se-bar { display: flex; height: 56px; border-top: 1px solid var(--k-line); background: var(--k-paper); padding: 0 6px; }
.se-bar__item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 11px; color: var(--k-ink); }
.se-bar__item.active { color: var(--k-red); }
.se-bar__publish { width: 42px; height: 42px; border-radius: 50%; background: var(--k-red); display: flex; align-items: center; justify-content: center; margin-top: -18px; margin-bottom: 1px; box-shadow: 0 4px 12px rgba(169,71,52,.28); }
.se-bar__label { font-size: 11px; }

/* 390×844 状态总览的首屏密度 */
.form-body .card { padding: 8px 10px; margin-bottom: 7px; }
.form-body .ct { margin-bottom: 4px; }
.form-body .frow { margin-top: 0; }
.form-body .k-input { height: 38px; }
.form-body .frow__label { padding-top: 9px; }
.form-body .ferr { margin-top: 3px; }
.form-body .st { gap: 9px; }
.form-body .st__icon { width: 50px; height: 44px; }
.form-body .st__desc { line-height: 1.4; margin-top: 2px; }
.form-body .st__actions { margin-top: 0; }
.form-body .btn-o,
.form-body .btn-p { height: 30px; }

.trade-body .card { padding: 7px 10px; margin-bottom: 7px; }
.trade-body .ct { margin-bottom: 3px; }
.trade-body .st { gap: 9px; }
.trade-body .st__icon--lg { width: 50px; height: 46px; }
.trade-body .ok,
.trade-body .dashed { width: 44px; height: 44px; }
.trade-body .st__desc { line-height: 1.35; margin-top: 2px; }
.trade-body .st__row { margin-top: 5px; padding-left: 59px; }
.trade-body .btn-o,
.trade-body .btn-p { height: 30px; }

.system-body .card { padding: 7px 10px; margin-bottom: 7px; }
.system-body .ct { margin-bottom: 3px; }
.system-body .st { gap: 8px; }
.system-body .st__icon { width: 52px; height: 42px; }
.system-body .st__desc { line-height: 1.35; margin-top: 2px; }
.system-body .st__row { margin-top: 5px; padding-left: 60px; }
.system-body .st__row--single { padding-left: 112px; }
.system-body .btn-o { height: 30px; }
.system-body .demo { padding: 6px; }
.system-body .demo__img { width: 66px; height: 54px; }
.system-body .demo__img--big { width: 55px; height: 48px; }
.system-body .card--se { padding-left: 0; padding-right: 0; padding-bottom: 0; }
.system-body .se-bar { height: 50px; }
</style>
