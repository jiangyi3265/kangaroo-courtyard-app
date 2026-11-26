<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点：AI袋鼠弹层开着时锁住页面滚动（网页版由弹层自己锁 body） -->
  <!-- #endif -->
  <view class="k-page states">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack" />

    <!-- 1 页面与列表状态 -->
    <view v-if="s === 1" class="body">
      <view class="card">
        <text class="ct">骨架加载</text>
        <view class="sk">
          <view class="sk__sq" />
          <view class="sk__lines"><view class="sk__line" style="width: 92%" /><view class="sk__line" style="width: 80%" /><view class="sk__line" style="width: 70%" /></view>
          <view class="sk__img"><k-icon name="image" :size="28" color="light" /></view>
        </view>
      </view>

      <view class="card">
        <view class="k-between ct-row">
          <text class="ct">下拉刷新</text>
          <view class="k-row k-gap4 refresh"><k-icon name="arrow-down" :size="14" color="muted" /><text class="k-small k-muted">松开刷新</text></view>
          <view class="h-spacer" />
        </view>
        <view class="sk sk--small">
          <view class="sk__sq" />
          <view class="sk__lines"><view class="sk__line" style="width: 92%" /><view class="sk__line" style="width: 60%" /></view>
          <view class="sk__img sk__img--short"><k-icon name="image" :size="28" color="light" /></view>
        </view>
      </view>

      <view class="card">
        <text class="ct">无限加载</text>
        <view class="sk sk--small">
          <view class="sk__sq" />
          <view class="sk__lines"><view class="sk__line" style="width: 92%" /><view class="sk__line" style="width: 60%" /></view>
          <view class="sk__img sk__img--short"><k-icon name="image" :size="28" color="light" /></view>
        </view>
        <view class="loading"><k-icon name="loader-circle" :size="14" color="muted" /><text class="k-small k-muted">正在加载更多…</text></view>
      </view>

      <view class="card">
        <text class="ct">列表空状态</text>
        <view class="empty">
          <view class="empty__ico"><k-icon name="inbox" :size="28" color="red" /></view>
          <view class="empty__copy">
            <text class="empty__title">暂无消息</text>
            <text class="empty__desc">有新的通知会出现在这里</text>
          </view>
        </view>
      </view>

      <view class="card">
        <text class="ct">搜索无结果</text>
        <view class="k-row k-gap12">
          <view class="sbar"><k-icon name="search" :size="16" color="muted" /><text class="sbar__kw">陶艺体验</text><k-icon name="circle-x" :size="16" color="muted" /></view>
          <text class="k-text" @click="back()">取消</text>
        </view>
        <view class="empty">
          <view class="empty__ico"><image class="empty__img" src="/pages/notice/static/states-search-empty.jpg" mode="aspectFill" /></view>
          <view class="empty__copy">
            <text class="empty__title">未找到相关内容</text>
            <text class="empty__desc">换个关键词试试吧</text>
            <view class="btn-o" hover-class="k-press" @click="go(R.staysList + '?s=1')"><text>清除搜索</text></view>
          </view>
        </view>
      </view>

      <view class="card">
        <text class="ct">内容空状态</text>
        <view class="empty empty--tall">
          <view class="empty__ico"><image class="empty__img" src="/static/media/states-empty-box.jpg" mode="aspectFill" /></view>
          <view class="empty__copy">
            <text class="empty__title">还没有相关内容</text>
            <text class="empty__desc">去发布一条新内容吧</text>
            <view v-if="communityEnabled" class="btn-p" hover-class="k-press" @click="go(R.publish)"><text>去发布</text></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 2 表单与权限状态 -->
    <view v-else-if="s === 2" class="body form-body">
      <view class="card">
        <text class="ct">必填错误</text>
        <view class="frow">
          <view class="frow__label"><text>标题</text><text class="k-alert">*</text></view>
          <view class="k-flex1">
            <view class="k-input k-input--error"><input v-model="title" placeholder="请输入活动标题" placeholder-class="k-placeholder" /></view>
            <text class="ferr">请输入活动标题</text>
          </view>
        </view>
      </view>
      <view class="card">
        <text class="ct">格式错误</text>
        <view class="frow">
          <view class="frow__label"><text>手机号</text><text class="k-alert">*</text></view>
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
          <view class="st__icon"><view class="ico"><k-icon :name="p.icon" :size="22" color="red" /></view></view>
          <view class="k-flex1">
            <text class="st__title">{{ p.title }}</text>
            <text class="st__desc">{{ p.desc }}</text>
            <view class="st__actions">
              <!-- 之前带的是 ?s=4 不带 mode：已登录用户在绑定屏点「暂不授权，先逛逛」会被直接退出登录；现在走个人中心同一个绑定入口 -->
              <view v-if="p.primary" class="btn-p" hover-class="k-press" @click="go(R.login + '?s=4&mode=bind-phone')"><text>{{ p.btn }}</text></view>
              <view v-else class="btn-o" hover-class="k-press" @click="openPerm(p)"><text>{{ p.btn }}</text></view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 3 交易与流程状态 -->
    <view v-else-if="s === 3" class="body trade-body">
      <view v-for="t in trades" :key="t.title" class="card card--tight">
        <text class="ct">{{ t.label }}</text>
        <view class="st">
          <view class="st__icon st__icon--lg">
            <view v-if="t.kind === 'ok'" class="ico ok"><k-icon name="check" :size="22" color="green" /></view>
            <view v-else-if="t.kind === 'dashed'" class="ico dashed"><k-icon name="clock" :size="22" color="red" /></view>
            <view v-else class="ico" :class="{ 'ico--warn': t.color === 'red' }"><k-icon :name="t.icon" :size="22" :color="t.color === 'red' ? 'alert' : 'red'" /></view>
          </view>
          <view class="k-flex1">
            <text class="st__title">{{ t.title }}</text>
            <text class="st__desc">{{ t.desc }}</text>
            <view v-if="t.side" class="st__side">
              <view v-if="t.side.type === 'primary'" class="btn-p" hover-class="k-press" @click="onTrade(t.side.label)"><text>{{ t.side.label }}</text></view>
              <view v-else class="btn-o" hover-class="k-press" @click="onTrade(t.side.label)"><text>{{ t.side.label }}</text></view>
            </view>
            <view v-if="t.row" class="st__row">
              <view v-for="b in t.row" :key="b" class="btn-o" hover-class="k-press" @click="onTrade(b)"><text>{{ b }}</text></view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 4 系统与长内容适配 -->
    <view v-else class="body system-body">
      <view v-for="sys in systems" :key="sys.title" class="card card--tight">
        <text class="ct">{{ sys.label }}</text>
        <view class="st">
          <view class="st__icon"><view class="ico"><k-icon :name="sys.icon" :size="22" color="red" /></view></view>
          <view class="k-flex1">
            <text class="st__title">{{ sys.title }}</text>
            <text class="st__desc">{{ sys.desc }}</text>
            <view class="st__row" :class="{ 'st__row--single': sys.btns.length === 1 }">
              <view v-for="b in sys.btns" :key="b" class="btn-o" :class="{ 'btn-g': b === '联系客服' || b === '普通筛选' }" hover-class="k-press" @click="onSys(b, sys)"><text>{{ b }}</text></view>
            </view>
          </view>
        </view>
      </view>

      <view class="card card--tight">
        <text class="ct">长中文标题换行示例</text>
        <view class="demo">
          <image class="demo__img" src="/pages/notice/static/states-room.jpg" mode="aspectFill" />
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
          <view class="demo__thumb"><image class="demo__img demo__img--big" src="/pages/notice/static/states-teacher.jpg" mode="aspectFill" /></view>
          <view class="k-flex1">
            <text class="demo__title demo__title--big">手作老师（兼职）</text>
            <view class="tag tag--big k-mt6"><text>手作教学</text></view>
          </view>
          <view class="demo__side">
            <view class="k-row k-gap2"><text class="k-price demo__price--big">150</text><text class="k-small k-muted">元/天</text></view>
            <view class="k-row k-gap2 k-mt6"><k-icon name="map-pin" :size="14" color="muted" /><text class="k-small k-muted">1.2km</text></view>
          </view>
        </view>
      </view>

      <view class="card card--se">
        <text class="ct">小屏安全区适配<text class="k-meta">（iPhone SE 适配）</text></text>
        <view class="se-bar">
          <view v-for="t in seTabs" :key="t.label" class="se-bar__item" :class="{ active: t.active }">
            <view v-if="t.publish" class="se-bar__publish"><text>发布</text></view>
            <k-icon v-else :name="t.icon" :size="22" :color="t.active ? 'red' : 'ink2'" :fill="t.active" />
            <text v-if="!t.publish" class="se-bar__label">{{ t.label }}</text>
          </view>
        </view>
      </view>
    </view>
    <!-- 「联系客服」：AI袋鼠在本页底部弹出，不跳页 -->
    <k-ai-sheet :show="aiOpen" ctx="profile" @close="aiOpen = false" />
  </view>
</template>

<script setup>
import { communityEnabled } from "@/common/features.js"
import { ref } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
const aiOpen = ref(false)

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
// 本页是全局状态样例，按钮都跳到真实的对应页面（订单、权限恢复页、活动列表等）
const onTrade = (label) => {
  if (label === '查看订单' || label === '查看退款' || label === '重新同步') return go(R.orders)
  if (label === '重新支付') return go(R.review + '?s=4&tab=pay')
  if (label === '查看更多' || label === '加入候补') return go(R.activity)
  toast(label)
}
const openPerm = (p) => go(R.review + '?s=4&tab=' + (p.label === '相机拒绝' ? 'camera' : 'location'))
const systems = [
  { label: '网络断开', icon: 'wifi-off', title: '网络连接已断开', desc: '请检查网络设置后重试。', btns: ['重试', '联系客服'] },
  { label: '推荐不可用', icon: 'bot', title: '推荐服务暂不可用', desc: '推荐服务暂时不可用，可以先用普通筛选。', btns: ['重试', '普通筛选'] },
  { label: '服务维护', icon: 'wrench', title: '系统维护中', desc: '服务维护中，恢复时间以公告为准。', btns: ['查看公告'] }
]
const onSys = (label, sys) => {
  if (label === '联系客服') { aiOpen.value = true; return }
  if (label === '普通筛选') return go(R.jobsFilter)
  // 公告从消息页挪进了「系统通知」子页，这里直接打开公告列表
  if (label === '查看公告') return go(R.notice + '?s=1')
  if (label === '重试') return go(sys && sys.label === '网络断开' ? R.review + '?s=4&tab=network' : R.review + '?s=3')
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
/* 11-18 第三轮：这页是全站「页面状态」的标准样子，样例内容和跳转都不变。
   - 四屏同一种卡：顶上一行 12 / 500 灰色小眉题（是哪种状态），下面「44 圆形浅底 + 22 线性图标」+ 14 / 600 标题 + 12 灰说明，按钮在说明下面、和标题左对齐；
   - 按钮 32 高胶囊：主操作实心暖棕渐变白字、次操作白底细棕边、不可点见下；
   - 空状态：一律 56 浅棕方块 + 32 线性图标（11-18 返修：搜索无结果、内容空状态原来的灰色手绘插画换成 search / package 线性图标，不再插画和线性混用）；不可点按钮是暖棕渐变 45% 透明白字（和登录页一致）。 */
.states { --k-bg: var(--k-page); background: var(--k-page); }
.states :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 17px; font-weight: 600; }
@media (max-width: 359px) { .states :deep(.k-navbar__title) { font-size: 15px; } }
/* 11-18 返修：示例名（.ct）挪到卡片外面当 13 号分组标题（上 20、下 8），卡里只留状态本身，不再「标题叠标题」 */
.body { padding: 0 16px calc(32px + var(--k-safe-bottom)); }
.ct-row { justify-content: center; margin-bottom: 8px; }
.h-spacer { display: none; }
.card { position: relative; background: var(--k-paper); border: 0; border-radius: 12px; padding: 14px; margin: 46px 0 0; }
.ct { position: absolute; left: 0; right: 0; bottom: 100%; margin-bottom: 8px; display: block; font-family: var(--k-sans); font-weight: 500; font-size: 13px; line-height: 18px; color: var(--k-ink2); }
.form-body .st__desc { max-width: 220px; }
.system-body .demo { padding: 0; background: none; } .system-body .tag { background: var(--k-page); }
.ct .k-meta { font-size: 12px; }

/* 按钮：32 高胶囊。主操作实心暖棕，次操作白底细棕边 */
.btn-o, .btn-p { height: 32px; padding: 0 16px; border-radius: 16px; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; white-space: nowrap; }
.btn-o { border: 1px solid var(--k-red-line); background: var(--k-paper); color: var(--k-red-deep); font-weight: 500; }
.btn-p { background: var(--k-grad-brown); color: var(--k-paper); }
/* 第二出口（联系客服）：暖棕文字按钮，不加框 */
.btn-o.btn-g { border-color: transparent; background: transparent; padding: 0 8px; font-size: 13px; color: var(--k-red-deep); }

/* 状态块 */
.st { display: flex; align-items: flex-start; gap: 12px; }
.st__icon { flex: 0 0 44px; }
.ico { width: 44px; height: 44px; border-radius: 12px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.ico.ok { background: var(--k-green-soft); }

.ico--warn { background: var(--k-alert-soft); }
/* 同类操作（去开启 / 去绑定）统一描边 */
.st__actions .btn-p { background: var(--k-paper); border: 1px solid var(--k-red-line); color: var(--k-red-deep); font-weight: 500; }
.st__title { display: block; padding-top: 2px; font-family: var(--k-sans); font-weight: 600; font-size: 14px; line-height: 20px; color: var(--k-ink); }
.st__desc { display: block; font-size: 12px; color: var(--k-muted); line-height: 1.6; margin-top: 2px; white-space: pre-line; }
.st__actions, .st__side, .st__row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }

/* s1 骨架、加载、搜索、空状态 */
@keyframes sk-shine { 0% { opacity: 1; } 50% { opacity: .55; } 100% { opacity: 1; } }
.sk { display: flex; align-items: center; gap: 12px; animation: sk-shine 1.4s ease-in-out infinite; }
.sk__sq { width: 40px; height: 40px; border-radius: 8px; background: var(--k-fill); flex: 0 0 auto; }
.sk__lines { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.sk__line { height: 8px; border-radius: 4px; background: var(--k-fill); }
.sk__img { width: 72px; height: 54px; border-radius: 8px; background: var(--k-fill); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.refresh { margin-right: 0; }
.loading { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 14px; padding-top: 12px; border-top: .5px solid var(--k-line); }
.sbar { flex: 1; min-width: 0; height: 36px; border-radius: 18px; background: var(--k-page); display: flex; align-items: center; gap: 8px; padding: 0 12px; }
.sbar__kw { flex: 1; font-size: 14px; }
.sbar + .k-text { font-size: 14px; color: var(--k-ink2); }
.empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 24px 0 14px; text-align: center; }
/* 11-19 返修：两张插画铺满 56 圆角方块（不用正片叠底，Skyline 也不露白底），和「列表空状态」同一个外形 */
.empty__img { display: block; width: 56px; height: 56px; border-radius: 16px; mix-blend-mode: multiply; }
.empty__ico { width: 56px; height: 56px; margin-bottom: 8px; border-radius: 16px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.empty__copy { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.empty__title { font-size: 14px; font-weight: 500; color: var(--k-ink2); }
.empty__desc { font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.empty__copy .btn-o, .empty__copy .btn-p { margin-top: 8px; }

/* s2 表单与权限 */
.frow { display: flex; align-items: flex-start; gap: 12px; }
.frow__label { width: 56px; flex: 0 0 auto; padding-top: 10px; font-size: 14px; color: var(--k-ink); display: flex; gap: 2px; }
.form-body .k-input { height: 40px; }
.ferr { display: block; font-size: 12px; line-height: 1.6; color: var(--k-alert); margin: 4px 0 0 2px; }
.btn-disabled { flex: 0 0 auto; height: 40px; padding: 0 20px; border-radius: 20px; background: var(--k-paper2); color: var(--k-muted); font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
.btn-disabled + .k-small { font-size: 12px; }

/* s4 长内容示例 */
.demo { display: flex; align-items: flex-start; gap: 12px; background: var(--k-page); border: 0; border-radius: 8px; padding: 8px; }
.demo--big { align-items: center; }
.demo__img { width: 72px; height: 54px; border-radius: 8px; flex: 0 0 auto; }
.demo__thumb { width: 64px; height: 64px; flex: 0 0 auto; border-radius: 8px; overflow: hidden; }
.demo__img--big { display: block; width: 78px; height: 72px; margin-left: -7px; border-radius: 0; }
.demo__title { display: block; font-family: var(--k-sans); font-weight: 600; font-size: 14px; line-height: 1.4; }
.demo__title--big { font-size: 20px; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
@media (max-width: 359px) { .demo--big { flex-wrap: wrap; } .demo--big .demo__side { flex: 0 0 100%; flex-direction: row; align-items: center; justify-content: space-between; padding-left: 76px; box-sizing: border-box; } .demo--big .demo__side .k-mt6 { margin-top: 0; } }
.tag { height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-paper); border: 0; font-size: 10px; font-weight: 500; color: var(--k-ink2); display: inline-flex; align-items: center; flex: 0 0 auto; white-space: nowrap; }
.tag--big { height: 26px; padding: 0 8px; font-size: 13px; }
.demo__price { margin-left: auto; align-items: baseline; flex: 0 0 auto; white-space: nowrap; }
.demo__price .k-price { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
.demo__price .k-meta { font-size: 11px; }
.demo .k-row { flex-wrap: wrap; row-gap: 4px; }
.demo__side { display: flex; flex-direction: column; align-items: flex-end; flex: 0 0 auto; }
.demo__price--big { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
.card--se { padding: 14px 0 0; }
.se-bar { border-radius: 0 0 12px 12px; }
.se-bar { position: relative; display: flex; height: 50px; background: var(--k-paper); padding: 0 6px; }
.se-bar::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.se-bar__item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 10px; color: var(--k-ink2); }
.se-bar__item.active { color: var(--k-red); font-weight: 600; }
.se-bar__publish { width: 46px; height: 46px; border-radius: 50%; background: var(--k-grad-brown); display: flex; align-items: center; justify-content: center; margin-top: -18px; border: 3px solid var(--k-paper); box-shadow: 0 4px 10px rgba(138,90,48,.24); color: #fff; font-size: 13px; font-weight: 600; box-sizing: border-box; }
.se-bar__label { font-size: 10px; }
</style>
